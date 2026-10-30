// Story discovery: turn a topic's judged claims into a short list of candidate videos a producer can choose from.
//
// Stage 1 drafts candidates from the corpus (deterministic): a popular claim a study contradicts, studies or sources
// that disagree, a study that overturned the AI guess, a widely repeated claim nobody checked, and the decision
// groups in site.json. Stage 2 evaluates each: the evidence audit (src/lib/evidence.ts), coherence, depth,
// the ranking dimensions, and readiness with explicit blocking reasons. The reviewer's file (src/lib/review.ts)
// supplies what code cannot judge: whether a verdict decides a sentence, whether claims answer one question, and the
// viewer-facing framing. Without it, multi-claim stories cap at needs-review and titles are plain questions.
//
// Every score is an editorial heuristic from corpus counts and the audit, labelled as such. Nothing is audience data.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, topicDir, ROOT } from '../shared/io';
import { type PassageReader, PRIOR_CAP, docKey, studyVerdicts, validate } from './evidence';
import type {
  Assertion,
  EvidenceItem,
  EvidenceRef,
  Validation,
  StoryKind,
  Readiness,
  Arc,
  Finding,
  Story,
} from '../shared/types';
import { MAX_CHAIN_CLAIMS, MAX_QUESTIONS, type ReviewFile, type StoryReview } from './review';
import { type ClaimView, type Topic, topicNames, VAL } from './topics';

export type StoryInput = Pick<Topic, 'name' | 'label' | 'claims' | 'recap'> & { sameStudy?: Record<string, string> };

export interface StoriesFile {
  topic: string;
  basis: { claims: number; sources: number; studies: number; candidates: number };
  stories: Story[];
  rejected: { id: string; title: string; reason: string }[];
}

const CURIOSITY: Record<StoryKind, number> = { contradicted: 1, conflict: 1, surprise: 0.8, decision: 0.5, gap: 0.5 };
const STAKES: Record<string, number> = { 'pro-hype': 1, pro: 0.7, skeptic: 0.5, calibrating: 0.4 };
const MAX_VIDEOS = 12; // a topic lists at most this many videos; a chain's follow-ups ride on their first question
const MIN_REPEATED = 3; // sources repeating a claim before it counts as popular
const MIN_GAP = 5; // sources repeating an unchecked claim before the gap is a story
const round = (n: number) => Math.round(n * 100) / 100;
const slug = (id: string) => id.split('/').pop()!;
/** A story's public page is `/<topic>/<storyUrlSlug>/`: the id without its kind (the kind is classification, never
 *  shown). Unique within a topic today; `getStaticPaths` would collide loudly if that changed. */
export const storyUrlSlug = (s: Pick<Story, 'id'>) => s.id.split(':')[1];
/** A recap group's slug: the tail of its decision story's id, and the group's anchor on the topic page. */
export const groupSlug = (title: string) =>
  title
    .replace(/\?$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const plain = (c: ClaimView) => c.text.replace(/\.$/, '');
const q = (c: ClaimView) => `"${plain(c)}"`;
const lc = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const ask = (c: ClaimView) => lc(plain(c));
const short = (s: string, max = 70) => (s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, '') + '…');
const n = (k: number, w: string) => `${k} ${k === 1 ? w : w.endsWith('y') ? `${w.slice(0, -1)}ies` : `${w}s`}`;
const prior = (c: ClaimView) => c.verdicts.find((v) => v.by === 'AI guess') ?? null;
const studyRefs = (c: ClaimView): EvidenceRef[] =>
  studyVerdicts(c).map((v) => ({ kind: 'study', claim: c.id, cite: v.cite! }));
const statementRefs = (c: ClaimView, stance = 'asserts'): EvidenceRef[] =>
  c.sources.filter((s) => s.stance === stance).map((s) => ({ kind: 'statement', claim: c.id, source: s.id }));
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const docOf = (x: EvidenceItem, sameStudy: Record<string, string> = {}) =>
  x.ref.kind === 'study' ? docKey(x.ref.cite, sameStudy) : null;
const STOP = new Set(
  'that than then with from this what when which more most into over about their there they them some only also very much like just'.split(
    ' ',
  ),
);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .match(/[a-z]{4,}/g)
      ?.filter((w) => !STOP.has(w)) ?? [],
  );
const jaccard = (a: Set<string>, b: Set<string>) => {
  const both = [...a].filter((w) => b.has(w)).length;
  return both / (a.size + b.size - both || 1);
};
// ponytail: word-overlap Jaccard over every claim, O(claims^2) per topic; swap for the watcher's similar.ts if it drags.
function related(c: ClaimView, all: ClaimView[], exclude: Set<string>, k = 3): string[] {
  const t = tokens(c.text);
  return all
    .filter((o) => o.id !== c.id && !exclude.has(o.id))
    .map((o) => ({ id: o.id, j: jaccard(t, tokens(o.text)) }))
    .filter((x) => x.j >= 0.25)
    .sort((a, b) => b.j - a.j || (a.id < b.id ? -1 : 1))
    .slice(0, k)
    .map((x) => x.id);
}

/** The assertion a story makes about one claim: affirm it when the evidence does, deny it when the evidence says wrong. */
function factAbout(c: ClaimView, id: string): Assertion {
  const denies = c.verdict === 'wrong';
  return {
    id,
    text: denies ? `The evidence does not support ${q(c)}` : c.text,
    kind: 'fact',
    claims: [{ id: c.id, stance: denies ? 'denies' : 'asserts' }],
    evidence: studyRefs(c),
  };
}
function attributionAbout(c: ClaimView, id: string): Assertion {
  return {
    id,
    text: `${n(c.asserted, 'source')} claim ${q(c)}; no study in the corpus has checked it.`,
    kind: 'attribution',
    claims: [{ id: c.id, stance: 'asserts' }],
    evidence: statementRefs(c),
  };
}
const finding = (c: ClaimView, i: number): { role: Finding['role']; assertion: Assertion } =>
  c.studies
    ? { role: 'evidence', assertion: factAbout(c, `f${i}`) }
    : { role: 'belief', assertion: attributionAbout(c, `f${i}`) };

interface Draft {
  id: string;
  kind: StoryKind;
  question: string; // also the working title until a reviewer supplies one
  alternates: string[];
  whyWatch: string;
  tension: string;
  evidenceNeeded: string;
  premise: string;
  arc: Arc;
  unresolved: (core: ClaimView[]) => string[]; // from the final claim list, so a reviewer's pruning removes stale gaps
  claims: string[];
  central: (core: ClaimView[]) => Assertion;
}

// Stage 1: candidates, one drafter per story kind. Titles are plain questions; the kind is metadata and never appears
// in them. A sixth kind is a new drafter in CLAIM_DRAFTERS (or beside decisionDrafts), not a branch in a shared body.
const studied = (c: ClaimView) => studyVerdicts(c).filter((v) => ['right', 'wrong', 'partly'].includes(v.verdict));
const names = (c: ClaimView) => uniq(studied(c).map((v) => v.by)).join(', ');
const deciding = (c: ClaimView) => `${c.decidedBy}: ${c.note}`;
const channelCount = (c: ClaimView) => new Set(c.sources.map((s) => s.channel)).size;
type ClaimDrafter = (c: ClaimView) => Draft | null;

/** A. Popular claim contradicted: many independent sources on one side, a study decides for the other. */
const contradictedDraft: ClaimDrafter = (c) => {
  const sv = studied(c);
  const channels = channelCount(c);
  const popular = c.asserted >= c.denied ? 'asserts' : 'denies';
  const repeated = Math.max(c.asserted, c.denied);
  if (!(
    c.decidedBy &&
    repeated >= MIN_REPEATED &&
    channels >= 2 &&
    c.verdict === (popular === 'asserts' ? 'wrong' : 'right')
  ))
    return null;
  return {
    id: `contradicted:${slug(c.id)}`,
    kind: 'contradicted',
    question: `Is it true that ${ask(c)}?`,
    alternates: [
      `${n(repeated, 'source')} say ${lc(short(plain(c)))}. Does it hold up?`,
      `What the research says about ${lc(short(plain(c)))}`,
    ],
    whyWatch: `${n(repeated, 'source')} across ${n(channels, 'channel')} ${popular === 'asserts' ? 'repeat' : 'deny'} it, and the study that checked it points the other way. Anyone who has heard the claim gains from seeing it tested.`,
    tension: `What gets repeated against what was measured. ${deciding(c)}`,
    evidenceNeeded: `A measurement of whether ${ask(c)}, on the population and under the conditions the claim describes.`,
    premise: `${n(repeated, 'source')} ${popular === 'asserts' ? 'assert' : 'deny'} ${q(c)}. ${deciding(c)} The gap between what gets repeated and what the data shows is the story.`,
    arc: {
      hook: `Open on the claim in the sources' own words.`,
      conflict: `Then the study that checked it: ${deciding(c)}`,
      evidence: `Walk through ${names(c)}: what was measured, on whom, and the caveats.`,
      resolution: `Say exactly what the evidence rules out and what it leaves open, including any narrower version that survives.`,
      takeaway: `What a viewer should do differently now that the claim is not what it seemed.`,
    },
    unresolved: () => sv.filter((v) => v.verdict === 'partly').map((v) => `${v.by} only partly agrees: ${v.note}`),
    claims: [c.id],
    central: () => ({
      id: 'central',
      text: `Contrary to the sources that repeat it, the evidence ${c.verdict === 'wrong' ? 'does not support' : 'supports'} ${q(c)}`,
      kind: 'fact',
      claims: [{ id: c.id, stance: c.verdict === 'wrong' ? 'denies' : 'asserts' }],
      evidence: studyRefs(c),
    }),
  };
};

/** B. Disagreement: studies on both sides, or sources split with a study in play. */
const conflictDraft: ClaimDrafter = (c) => {
  const sv = studied(c);
  const verdicts = new Set(sv.map((v) => v.verdict));
  const studiesConflict = verdicts.has('right') && verdicts.has('wrong');
  const sourcesConflict = c.asserted >= 2 && c.denied >= 2 && sv.length > 0; // a lone dissenter is not a conflict
  if (!studiesConflict && !sourcesConflict) return null;
  const who = studiesConflict ? 'The studies' : 'The sources';
  return {
    id: `conflict:${slug(c.id)}`,
    kind: 'conflict',
    question: studiesConflict ? `Why do studies disagree about whether ${ask(c)}?` : `Is it true that ${ask(c)}?`,
    alternates: studiesConflict
      ? [
          `${cap(short(plain(c)))}: the case for and against`,
          `What we actually know about whether ${lc(short(plain(c)))}`,
        ]
      : [`Sources disagree: ${short(plain(c))}`, `Is it true that ${ask(c)}?`],
    whyWatch: `Two confident, opposite answers to the same question. Explaining why they differ (population, task, timing, design) teaches more than either headline.`,
    tension: `${who} split: ${sv.map((v) => `${v.by} says ${v.verdict}`).join(', ')}.`,
    evidenceNeeded: `The studies on each side compared on design, population and timing, to explain the split rather than pick a winner.`,
    premise: `${who} split on ${q(c)}: ${sv.map((v) => `${v.by} says ${v.verdict}`).join(', ')}. The reasons they differ are the useful part.`,
    arc: {
      hook: `Two confident, opposite answers to the same question: ${q(c)}.`,
      conflict: `${who} do not agree, and both sides have a case.`,
      evidence: `Lay the studies side by side (${names(c)}): design, sample, what was measured.`,
      resolution: `Where the disagreement comes from, and which answer applies to which situation.`,
      takeaway: `The conditions under which the claim holds, instead of a yes or no.`,
    },
    unresolved: () => [
      `What explains the split between ${names(c)}?`,
      ...sv.filter((v) => v.verdict === 'partly').map((v) => `${v.by}: ${v.note}`),
    ],
    claims: [c.id],
    central: () =>
      studiesConflict
        ? {
            id: 'central',
            text: `Studies disagree on whether ${ask(c)}`,
            kind: 'disagreement',
            claims: [{ id: c.id, stance: 'asserts' }],
            evidence: studyRefs(c),
          }
        : factAbout(c, 'central'),
  };
};

/** C. Surprise: a study overturned the AI guess, which stands in for the informed expectation. */
const surpriseDraft: ClaimDrafter = (c) => {
  const sv = studied(c);
  const p = prior(c);
  const move = p && c.verdict && c.verdict in VAL && p.verdict in VAL ? Math.abs(VAL[c.verdict] - VAL[p.verdict]) : 0;
  if (!(c.decidedBy && p && move > 0 && (move >= 1 || (c.confidence ?? 0) >= 0.6))) return null;
  return {
    id: `surprise:${slug(c.id)}`,
    kind: 'surprise',
    question: `Is it really true that ${ask(c)}?`,
    alternates: [
      `What one study found about whether ${lc(short(plain(c)))}`,
      `The evidence on ${lc(short(plain(c)))} is not what you expect`,
    ],
    whyWatch: `An informed guess said "${p.verdict}"; the study that checked it said "${c.verdict}". The viewer gets to be wrong along with the experts, then corrected.`,
    tension: `Expectation: ${p.note} Finding: ${deciding(c)}`,
    evidenceNeeded: `An independent study that confirms or limits the finding, on the same question.`,
    premise: `Before checking, the best guess was "${p.verdict}": ${p.note} ${deciding(c)} ${n(c.asserted + c.denied, 'source')} take a position on it.`,
    arc: {
      hook: `State the expectation everyone shares, with the sources that voice it.`,
      conflict: `A study checked it and found something else.`,
      evidence: `${deciding(c)}`,
      resolution: `Why the expectation was wrong, or what the sources were missing.`,
      takeaway: `The corrected belief, with its limits.`,
    },
    unresolved: () => sv.filter((v) => v.verdict !== c.verdict).map((v) => `${v.by} differs: ${v.note}`),
    claims: [c.id],
    central: () => factAbout(c, 'central'),
  };
};

/** D. Gap: widely repeated, never checked. The absence of evidence is the question, not a verdict. */
const gapDraft: ClaimDrafter = (c) => {
  if (!(c.studies === 0 && c.asserted >= MIN_GAP)) return null;
  const p = prior(c);
  return {
    id: `gap:${slug(c.id)}`,
    kind: 'gap',
    question: `What is the evidence that ${ask(c)}?`,
    alternates: [
      `${n(c.asserted, 'source')} say ${lc(short(plain(c)))}. Where is the proof?`,
      `An unchecked claim: ${short(plain(c))}`,
    ],
    whyWatch: `${n(c.asserted, 'source')} across ${n(channelCount(c), 'channel')} assert it and nobody shows a measurement. Asking for the evidence on camera is the story${c.lean === 'pro-hype' || c.lean === 'pro' ? ', and the claim sells something' : ''}.`,
    tension: `Confidence without a check. The AI guess leans "${p?.verdict ?? 'unknown'}" (${p?.note ?? 'no note'}), which is a guess, not a finding.`,
    evidenceNeeded: `Any study or dataset that tests whether ${ask(c)}.`,
    premise: `${n(c.asserted, 'source')} assert ${q(c)}, and no study in the corpus bears on it. The story is the search for evidence, not a verdict.`,
    arc: {
      hook: `How often this gets said, and how confidently.`,
      conflict: `Ask for the evidence and find none in the corpus.`,
      evidence: `What the sources offer instead (anecdote, authority, mechanism) and what a real test would need.`,
      resolution: `Absence of evidence is not evidence of absence: what would change the picture.`,
      takeaway: `How to treat the claim until it is checked.`,
    },
    unresolved: () => [`Has anyone measured whether ${ask(c)}?`, 'Which study or dataset would settle it?'],
    claims: [c.id],
    central: () => attributionAbout(c, 'central'),
  };
};

const CLAIM_DRAFTERS: ClaimDrafter[] = [contradictedDraft, conflictDraft, surpriseDraft, gapDraft];

/** E. Decision groups from site.json. A group is a subject, not yet a question: the reviewer prunes it to the claims
 *  that answer one, or rejects it. Unreviewed, it cannot be ready. */
function decisionDrafts(t: StoryInput): Draft[] {
  const byId = new Map(t.claims.map((c) => [c.id, c]));
  const lead = (cs: ClaimView[]) =>
    [...cs].sort(
      (a, b) =>
        Number(!!b.decidedBy) - Number(!!a.decidedBy) ||
        Number(b.studies > 0) - Number(a.studies > 0) ||
        (b.confidence ?? 0) - (a.confidence ?? 0),
    )[0];
  return t.recap.flatMap((g): Draft[] => {
    const core = g.claims.filter((c) => byId.has(c.id));
    if (core.length < 2) return [];
    const title = g.title.replace(/\?$/, '');
    return [
      {
        id: `decision:${groupSlug(g.title)}`,
        kind: 'decision',
        question: g.title.endsWith('?') ? g.title : `${title}: what should you do?`,
        alternates: [`What the research says about ${lc(title)}`, `${title}: a decision guide`],
        whyWatch: `The viewer faces a choice and has heard the claims on every side. This walks them from those claims to what the evidence settles.`,
        tension: `The claims pull in different directions and not all of them survive a check.`,
        evidenceNeeded: `A verdict, with its scope, on each claim the decision rests on.`,
        premise: `${n(core.length, 'claim')} bear on this choice; studies decide ${core.filter((c) => c.decidedBy).length} of them. Walk the viewer from the claims they have heard to the decision the evidence supports.`,
        arc: {
          hook: `The decision a viewer faces, in their terms.`,
          conflict: `The claims pulling in different directions: ${core.map((c) => q(c)).join('; ')}.`,
          evidence: `Each claim's verdict, strongest study first.`,
          resolution: `What the evidence settles and what it leaves open.`,
          takeaway: `A decision rule the viewer can apply.`,
        },
        unresolved: (cs) =>
          cs
            .filter((c) => !c.decidedBy)
            .map((c) => `${c.studies ? 'No study strong enough to decide' : 'Unchecked'}: ${q(c)}`),
        claims: core.map((c) => c.id),
        central: (cs) => {
          const l = lead(cs.length ? cs : core);
          return l.studies ? factAbout(l, 'central') : attributionAbout(l, 'central');
        },
      },
    ];
  });
}

function drafts(t: StoryInput): Draft[] {
  return [
    ...t.claims.flatMap((c) => CLAIM_DRAFTERS.map((draft) => draft(c)).filter((d): d is Draft => d !== null)),
    ...decisionDrafts(t),
  ];
}

// Stage 2: evaluate one candidate: audit its evidence, score it, decide its readiness, frame it for the viewer.
type Rejection = { rejected: string };

/** The candidate's claims after review, its central conclusion and each essential finding through the gate. */
interface Audit {
  r: StoryReview;
  reviewed: boolean;
  claims: string[];
  core: ClaimView[];
  central: Validation;
  findings: Finding[];
  same: Record<string, string>;
}
function audit(d: Draft, t: StoryInput, review: ReviewFile, readPassage: PassageReader): Audit | Rejection {
  const r: StoryReview = review.stories?.[d.id] ?? {};
  const reviewed = d.id in (review.stories ?? {});
  if (r.reject) return { rejected: r.reject };
  const byId = new Map(t.claims.map((c) => [c.id, c]));
  const same = t.sameStudy ?? {};
  const corpus = { name: t.name, claims: t.claims, sameStudy: same };
  const claims = uniq(r.claims ?? d.claims).filter((id) => byId.has(id));
  if (!claims.length) return { rejected: 'no known claims left after review' };
  if (d.kind !== 'decision' && !claims.includes(d.claims[0]))
    return {
      rejected: `the review removed the primary claim ${d.claims[0]}, which the central conclusion is built on`,
    };
  const core = claims.map((id) => byId.get(id)!);
  const judgments = review.applicability ?? {};
  const central = validate(d.central(core), corpus, readPassage, judgments);
  const findings: Finding[] = core
    .map(finding)
    .map((f) => ({ role: f.role, validation: validate(f.assertion, corpus, readPassage, judgments) }));
  return { r, reviewed, claims, core, central, findings, same };
}

/** Coherence, depth, evidence strength and the editorial dimensions, each from corpus counts and the audit. */
interface Scoring {
  coherence: Story['coherence'];
  decisive: EvidenceItem[];
  docs: number;
  sources: Set<string>;
  channels: Set<string>;
  flipped: boolean;
  tension: boolean;
  depth: number;
  strength: number;
  strongest: EvidenceItem | undefined;
  independent: number;
  evidence: number;
  relevance: number;
  curiosity: number;
  lean: string;
  stakes: number;
  editorial: number;
}
function score(d: Draft, { r, claims, core, central, findings, same }: Audit): Scoring {
  // Coherence: a reviewer's score, else a structural guess. One claim is one question; a cluster is unproven.
  const drift = core.filter((c) => core.every((o) => o === c || jaccard(tokens(c.text), tokens(o.text)) === 0));
  const coherence = r.coherence
    ? { score: r.coherence.score, basis: 'review' as const, explanation: r.coherence.reason }
    : claims.length === 1
      ? { score: 0.8, basis: 'heuristic' as const, explanation: 'One claim, one question. Unreviewed.' }
      : {
          score: 0.4,
          basis: 'heuristic' as const,
          explanation: `${n(claims.length, 'claim')} grouped by subject, not yet confirmed to answer one question.${
            drift.length ? ` No shared wording with the rest: ${drift.map((c) => short(plain(c), 40)).join('; ')}.` : ''
          } Unreviewed.`,
        };

  // Depth: what there is to explore.
  const decisive = [central, ...findings.filter((f) => f.role === 'evidence').map((f) => f.validation)].flatMap((v) =>
    [...v.supporting, ...v.contradicting, ...v.qualifying].filter((x) => x.applicability !== 'contextual'),
  );
  const docs = new Set(decisive.map((x) => docOf(x, same)).filter(Boolean)).size;
  const sources = new Set(core.flatMap((c) => c.sources.map((s) => s.id)));
  const channels = new Set(core.flatMap((c) => c.sources.map((s) => s.channel)));
  const flipped = core.some((c) => c.decidedBy && prior(c) && prior(c)!.verdict !== c.verdict);
  const tension =
    d.kind === 'contradicted' ||
    flipped ||
    central.kind === 'disagreement' ||
    central.status === 'disputed' ||
    central.status === 'qualified' ||
    findings.some((f) => f.validation.contradicting.length > 0);
  const depth = round(
    0.4 * (Math.min(docs, 3) / 3) +
      0.3 * (Math.min(sources.size, 6) / 6) +
      (tension ? 0.15 : 0) +
      0.15 * (Math.min(claims.length, 3) / 3),
  );

  // Evidence: what stands behind the central conclusion, discounted for partial applicability.
  const sides = [
    ...central.supporting,
    ...central.qualifying,
    ...(central.kind === 'disagreement' ? central.contradicting : []),
  ].filter((x) => x.cited);
  const weight = (x: EvidenceItem) => (x.confidence ?? 0) * (x.applicability === 'partial' ? 0.6 : 1);
  const strength = Math.max(0, ...sides.map(weight));
  const strongest = [...sides].sort((a, b) => weight(b) - weight(a))[0];
  const independent = new Set(sides.map((x) => docOf(x, same)).filter(Boolean)).size;
  const evidence =
    central.decision === 'blocked' || central.kind === 'attribution'
      ? 0
      : round(Math.min(1, strength * (1 + 0.15 * (independent - 1))));

  // Editorial dimensions.
  const relevance = round(Math.min(1, Math.log2(1 + sources.size) / Math.log2(21)));
  const curiosity = round(Math.min(1, CURIOSITY[d.kind] + (flipped && d.kind !== 'surprise' ? 0.2 : 0)));
  const lean = core.map((c) => c.lean ?? '').sort((a, b) => (STAKES[b] ?? 0.3) - (STAKES[a] ?? 0.3))[0];
  const stakes = STAKES[lean] ?? 0.3;
  const editorial = round((coherence.score + relevance + curiosity + stakes + depth) / 5);
  return {
    coherence,
    decisive,
    docs,
    sources,
    channels,
    flipped,
    tension,
    depth,
    strength,
    strongest,
    independent,
    evidence,
    relevance,
    curiosity,
    lean,
    stakes,
    editorial,
  };
}

/** Readiness from the central narrative and its essential findings, with the reasons spelled out; or a rejection. */
function readinessOf(
  d: Draft,
  { r, claims, central, findings }: Audit,
  { coherence, strength }: Scoring,
): { readiness: Readiness; readinessWhy: string; blocking: string[] } | Rejection {
  const blocking: string[] = [];
  let readiness: Readiness;
  const first = (v: Validation) => v.limitations[0] ?? v.explanation;
  if (coherence.basis === 'review' && coherence.score < 0.5)
    return { rejected: `incoherent: ${coherence.explanation}` };
  if (central.status === 'unsupported' && central.kind === 'fact')
    return { rejected: `the central conclusion is contradicted by the evidence: ${first(central)}` };
  if (d.kind === 'gap') {
    blocking.push('No study in the corpus checks the claim; the story is the search for evidence.');
    readiness = 'needs-research';
  } else if (r.research) {
    blocking.push(`Reviewer: ${r.research}`);
    readiness = 'needs-research';
  } else if (central.decision === 'blocked') {
    blocking.push(`Central conclusion ${central.status}: ${first(central)}`);
    readiness = 'needs-research';
  } else if (strength < PRIOR_CAP) {
    blocking.push(
      `The strongest study that bears on the central conclusion is weaker than ${PRIOR_CAP} (${round(strength)} after applicability); it cannot carry a narrative.`,
    );
    readiness = 'needs-research';
  } else {
    const missing = findings.filter((f) => f.validation.decision === 'blocked');
    for (const f of missing)
      blocking.push(`Finding ${f.validation.status}: ${short(f.validation.text, 60)} (${first(f.validation)})`);
    if (missing.length) readiness = 'needs-research';
    else {
      const uncertaintyIsSubject = central.kind === 'disagreement' && central.decision === 'approved';
      if (claims.length > 1 && coherence.basis === 'heuristic')
        blocking.push('A multi-claim story needs a reviewer to confirm the claims answer one question.');
      if (central.review && !uncertaintyIsSubject && !r.qualificationsAccepted)
        blocking.push(`Central conclusion needs review (${central.status}, ${central.decision}): ${first(central)}`);
      for (const f of findings)
        if (
          f.validation.review &&
          !r.qualificationsAccepted &&
          !(uncertaintyIsSubject && f.validation.status === 'disputed')
        )
          blocking.push(`Finding needs review (${f.validation.status}): ${short(f.validation.text, 60)}`);
      readiness = blocking.length ? 'needs-review' : 'ready';
    }
  }
  const readinessWhy =
    readiness === 'ready'
      ? `Coherent (${coherence.score}), central conclusion ${central.status}${central.decision === 'qualify' ? ' with accepted qualifications' : ''}, ${findings.length} essential finding${findings.length === 1 ? '' : 's'} verified, no pending review.`
      : readiness === 'needs-review'
        ? `Usable if a reviewer resolves: ${blocking.join(' ')}`
        : `Essential evidence is missing: ${blocking.join(' ')}`;
  return { readiness, readinessWhy, blocking };
}

/** The viewer-facing story: the draft's framing with the reviewer's overrides, the evidence and gaps, the scores. */
function frame(
  d: Draft,
  t: StoryInput,
  a: Audit,
  s: Scoring,
  { readiness, readinessWhy, blocking }: { readiness: Readiness; readinessWhy: string; blocking: string[] },
): Story {
  const { r, reviewed, claims, core, central, findings } = a;
  const { coherence, decisive, docs, sources, channels, flipped, tension, depth, strongest, independent, evidence } = s;
  const evidenceAvailable = uniq(
    decisive.map(
      (x) => `${x.by}: ${x.verdict} (${x.confidence ?? '?'}, ${x.applicability}${x.cited ? '' : ', uncited'})`,
    ),
  );
  const contextOnly = uniq(
    [central, ...findings.map((f) => f.validation)]
      .flatMap((v) => v.context.filter((x) => x.role === 'context'))
      .map((x) => `${x.by} is context only: ${x.why}`),
  );
  const gaps = uniq([...blocking, ...contextOnly, ...d.unresolved(core)]);
  return {
    id: d.id,
    kind: d.kind,
    title: r.title ?? d.question,
    alternates: r.alternates ?? d.alternates,
    question: r.question ?? d.question,
    whyWatch: r.whyWatch ?? d.whyWatch,
    tension: r.tension ?? d.tension,
    evidenceNeeded: r.evidenceNeeded ?? d.evidenceNeeded,
    evidenceAvailable,
    gaps,
    premise: r.premise ?? d.premise,
    claims,
    related: uniq(core.flatMap((c) => related(c, t.claims, new Set(claims)))).slice(0, 5),
    arc: { ...d.arc, ...(r.arc ?? {}) },
    coherence,
    scores: {
      coherence: coherence.score,
      relevance: s.relevance,
      curiosity: s.curiosity,
      stakes: s.stakes,
      depth,
      originality: 1,
      evidence,
      editorial: s.editorial,
      overall: round(0.6 * s.editorial + 0.4 * evidence),
      explanation:
        `editorial ${s.editorial} = mean of coherence ${coherence.score} (${coherence.basis}), relevance ${s.relevance} (${n(sources.size, 'source')}, ${n(channels.size, 'channel')}), ` +
        `curiosity ${s.curiosity} (${d.kind}${flipped ? ', a study overturned the guess' : ''}), stakes ${s.stakes} (lean: ${s.lean || 'none'}), depth ${depth} (${n(docs, 'study')}, ${n(claims.length, 'claim')}${tension ? ', tension' : ''}); ` +
        `evidence ${evidence} = ${strongest ? `strongest ${strongest.by} at ${strongest.confidence} (${strongest.applicability}) across ${n(independent, 'independent document')}` : 'no decisive evidence'}; ` +
        `overall = 0.6 editorial + 0.4 evidence, scaled by originality. Heuristics from corpus counts and the audit, not audience data.`,
    },
    readiness,
    readinessWhy,
    blocking,
    reviewed,
    audit: { central, findings },
  };
}

function evaluate(d: Draft, t: StoryInput, review: ReviewFile, readPassage: PassageReader): Story | Rejection {
  const a = audit(d, t, review, readPassage);
  if ('rejected' in a) return a;
  const s = score(d, a);
  const ready = readinessOf(d, a, s);
  if ('rejected' in ready) return ready;
  return frame(d, t, a, s, ready);
}

/** Review entries keyed to a story id the corpus no longer drafts: they judge nothing and should be removed. */
export const staleReviewIds = (t: StoryInput, review: ReviewFile): string[] => {
  const ids = new Set(drafts(t).map((d) => d.id));
  return Object.keys(review.stories ?? {}).filter((id) => !ids.has(id));
};

/** Discover, audit, evaluate, deduplicate and rank. Deterministic for a given corpus and review file. */
export function discover(t: StoryInput, readPassage: PassageReader, review: ReviewFile = {}): StoriesFile {
  const all = drafts(t);
  const rejected: StoriesFile['rejected'] = [];
  const stories: Story[] = [];
  for (const d of all) {
    const s = evaluate(d, t, review, readPassage);
    if ('rejected' in s) rejected.push({ id: d.id, title: d.question, reason: s.rejected });
    else stories.push(s);
  }
  stories.sort((a, b) => b.scores.overall - a.scores.overall || (a.id < b.id ? -1 : 1));
  // Originality: a story whose claims mostly repeat a higher-ranked story's is a variation of it, not a second story.
  // A reviewed multi-claim story is a hub: a single-claim candidate on one of its claims is a chapter of it.
  const hubs = stories.filter((s) => s.claims.length > 1 && s.coherence.basis === 'review');
  const kept: Story[] = [];
  for (const s of stories) {
    const hub = s.claims.length === 1 ? hubs.find((h) => h.claims.includes(s.claims[0])) : undefined;
    if (hub) {
      rejected.push({ id: s.id, title: s.title, reason: `subsumed by ${hub.id}` });
      continue;
    }
    const mine = new Set(s.claims);
    const twin = kept
      .map((k) => ({ k, overlap: jaccard(mine, new Set(k.claims)) }))
      .sort((a, b) => b.overlap - a.overlap)[0];
    const originality = round(1 - (twin?.overlap ?? 0));
    if (originality < 0.5) {
      rejected.push({
        id: s.id,
        title: s.title,
        reason: `a variation of ${twin.k.id} (claims overlap ${round(twin.overlap)})`,
      });
      continue;
    }
    s.scores.originality = originality;
    s.scores.overall = round(s.scores.overall * (0.7 + 0.3 * originality));
    kept.push(s);
  }
  kept.sort((a, b) => b.scores.overall - a.scores.overall || (a.id < b.id ? -1 : 1));
  rejected.sort((a, b) => (a.id < b.id ? -1 : 1));
  // Chains link across the whole ranked list, so the cap counts videos: a chain is one video, ranked by its best
  // question, and its stories are listed together or not at all.
  for (const s of kept) linkChain(s, review, kept);
  const videoOf = (s: Story) => s.partOf ?? s.id;
  const videos = new Set([...new Set(kept.map(videoOf))].slice(0, MAX_VIDEOS));
  const listed = kept.filter((s) => videos.has(videoOf(s)));
  suggestChains(listed);
  return {
    topic: t.name,
    basis: {
      claims: t.claims.length,
      sources: new Set(t.claims.flatMap((c) => c.sources.map((s) => s.id))).size,
      studies: new Set(t.claims.flatMap((c) => c.verdicts.map((v) => v.cite?.split('#')[0]).filter(Boolean))).size,
      candidates: all.length,
    },
    stories: listed,
    rejected,
  };
}

/** Attach the reviewer's chain of follow-up questions; a chain that cannot be produced holds the story at needs-review. */
function linkChain(s: Story, review: ReviewFile, listed: Story[]) {
  const r = review.stories?.[s.id];
  const ids = r?.chain ?? [];
  if (!ids.length) return;
  const find = (id: string) => listed.find((x) => x.id === id);
  s.chain = ids.map((id) => ({ id, question: find(id)?.question ?? '' }));
  const why: string[] = [];
  if (ids.length + 1 > MAX_QUESTIONS)
    why.push(`A video answers at most ${MAX_QUESTIONS} questions; this chain makes ${ids.length + 1}.`);
  if (!r?.chainWhy) why.push('A chain needs chainWhy: why each answer raises the next question.');
  const carried = new Set([...s.claims, ...ids.flatMap((id) => find(id)?.claims ?? [])]).size;
  if (carried > MAX_CHAIN_CLAIMS)
    why.push(
      `A chained video carries at most ${MAX_CHAIN_CLAIMS} claims; this one carries ${carried}: prune claims or split the chain.`,
    );
  ids.forEach((id, i) => {
    const c = find(id);
    if (id === s.id || ids.indexOf(id) !== i) why.push(`The chain lists ${id} twice.`);
    else if (!c) why.push(`Chained story ${id} is not a current candidate.`);
    // The first story to chain a follow-up claims it; a second video answering the same question is a duplicate.
    else if (c.partOf) why.push(`Chained story ${id} is already a follow-up in ${c.partOf}.`);
    // A story with a chain of its own stays a first question, so the two cannot claim each other.
    else if (review.stories?.[id]?.chain?.length)
      why.push(`Chained story ${id} has a chain of its own; chains do not nest.`);
    else {
      c.partOf = s.id;
      if (c.readiness !== 'ready') why.push(`Chained story ${id} is ${c.readiness}.`);
    }
  });
  if (!why.length) return;
  s.blocking.push(...why);
  s.gaps = uniq([...s.gaps, ...why]);
  if (s.readiness === 'ready') {
    s.readiness = 'needs-review';
    s.readinessWhy = `Usable if a reviewer resolves: ${s.blocking.join(' ')}`;
  }
}

/** Suggest follow-ups for ready stories outside any chain. */
function suggestChains(listed: Story[]) {
  const free = listed.filter((s) => s.readiness === 'ready' && !s.chain && !s.partOf);
  const words = (s: Story) => tokens(`${s.question} ${s.premise}`);
  for (const s of free) {
    const mine = new Set(s.claims);
    const near = free
      .filter((o) => o !== s && !o.claims.some((c) => mine.has(c)))
      .map((o) => ({ id: o.id, j: jaccard(words(s), words(o)) }))
      .filter((x) => x.j > 0)
      .sort((a, b) => b.j - a.j || (a.id < b.id ? -1 : 1))
      .slice(0, MAX_QUESTIONS - 1)
      .map((x) => x.id);
    if (near.length) s.chainCandidates = near;
  }
}

/** The chained stories a story's video also answers, in order (those still listed). */
export const chainOf = (s: Story, file: StoriesFile | null): Story[] =>
  (s.chain ?? []).flatMap((c) => file?.stories.find((x) => x.id === c.id) ?? []);

export const storiesPath = (topic: string, root = ROOT) => join(topicDir(topic, root), 'stories.json');
export function loadStories(topic: string, root = ROOT): StoriesFile | null {
  return readJson<StoriesFile>(storiesPath(topic, root));
}
/** Topics with a stories.json. */
/** Topics with a report and a stories.json (loadTopic needs the report). */
export function storyTopicNames(): string[] {
  return topicNames().filter((n) => existsSync(storiesPath(n)));
}
