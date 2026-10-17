// Evidence validator: can a proposed sentence be published on the strength of what the corpus has recorded?
//
// Three layers, kept apart:
// 1. Deterministic: do the referenced claims, sources, study verdicts and passages exist; which way does each verdict
//    point; is every figure in the sentence present in a cited passage (digits or words; a verdict note never counts,
//    it is an AI's reading of the passage). Any failure blocks.
// 2. Applicability: does a verdict on the canonical claim decide THIS sentence? A base rate ("most lose") cannot decide
//    a possibility claim ("an expert can"); a verdict whose own note limits its scope ("though the setting is futures,
//    not stocks") is partial. Defaults come from conservative wording heuristics; a reviewer's judgment (see
//    scripts/briefs/stories.md) overrides them. Contextual evidence is listed but never decides.
// 3. Never semantic approval: a sentence whose wording differs from the canonical claim is flagged for human review.
//
// Evidence hierarchy (README "How verdicts work"): a study verdict with a passage is evidence; an AI guess is context,
// never verification; a source's statement proves only what the source said. Support must be cited, but
// contradictions and qualifications are pulled from every study verdict on the claim, so none can be hidden.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasFigure, nums } from './numbers';
import type { ClaimVerdictView, ClaimView, Topic, Verdict } from './topics';

/** sameStudy: '<summary file>.txt' -> '<primary file>.txt' when two documents report one study (site.json). */
export type Corpus = Pick<Topic, 'name' | 'claims'> & { sameStudy?: Record<string, string> };
export type Stance = 'asserts' | 'denies';

export type EvidenceRef =
  | { kind: 'study'; claim: string; cite: string } // a recorded study verdict, cite = '<topic>/sources/<file>.txt#L10-L24'
  | { kind: 'statement'; claim: string; source: string } // a video or post that takes a stance on the claim
  | { kind: 'guess'; claim: string }; // the AI guess on the claim: context only

export interface Assertion {
  id: string;
  text: string;
  /** fact: the sentence is offered as true. attribution: it reports what sources say. disagreement: it reports that studies disagree. */
  kind: 'fact' | 'attribution' | 'disagreement';
  /** The canonical claims the sentence rests on, and whether it affirms or negates each. */
  claims: { id: string; stance: Stance }[];
  evidence: EvidenceRef[];
  /** Figures the caller has established by a recorded calculation from cited inputs (see src/lib/script.ts). */
  derived?: string[];
}

export type Status = 'supported' | 'qualified' | 'disputed' | 'unsupported' | 'unverified';
export type Decision = 'approved' | 'qualify' | 'blocked';
export type Role =
  'supports' | 'contradicts' | 'qualifies' | 'context' | 'inconclusive' | 'statement' | 'guess' | 'broken';
export type Applicability = 'direct' | 'partial' | 'contextual';
/** What the sentence claims: can/some (an outcome is possible), most/usually (typical), always/reliably (universal). */
export type Modality = 'possibility' | 'typical' | 'universal' | 'plain';

export interface Judgment {
  level: Applicability;
  reason: string;
}
/** Reviewer judgments keyed `${claim}|${stance}|${cite}`: does that verdict decide a sentence with that stance? */
export type Judgments = Record<string, Judgment>;
export const judgmentKey = (claim: string, stance: Stance, cite: string) => `${claim}|${stance}|${cite}`;

export interface EvidenceItem {
  ref: EvidenceRef;
  role: Role;
  cited: boolean; // false: found on the claim but not in the assertion's own references
  by: string | null; // study display name, source title, or 'AI guess'
  verdict: Verdict | null;
  confidence: number | null;
  note: string;
  applicability?: Applicability; // study verdicts only
  basis?: 'review' | 'heuristic'; // where the applicability came from
  why?: string; // the applicability reason
  passage?: string; // the cited lines, when the reader could fetch them (not persisted)
  problem?: string;
}

export interface Validation {
  id: string;
  text: string;
  kind: Assertion['kind'];
  modality: Modality;
  status: Status;
  decision: Decision;
  review: boolean; // a human (or a semantic check) must confirm before publication
  verbatim: boolean; // the sentence contains the canonical claim wording, so no semantic check is needed
  strength: number; // max confidence among cited, directly applicable supporting study verdicts (0 when none)
  independent: number; // distinct documents among them
  supporting: EvidenceItem[];
  contradicting: EvidenceItem[];
  qualifying: EvidenceItem[]; // partly verdicts and partially applicable ones
  context: EvidenceItem[]; // contextual verdicts, statements, guesses, inconclusive verdicts, broken references
  problems: string[]; // reference-integrity failures; any one blocks
  limitations: string[];
  suggestions: string[];
  explanation: string;
}

export type PassageReader = (cite: string) => string | null;

/** Reads `<topic>/sources/<file>.txt#L10-L24` from the repo; null when the file or the lines do not exist. */
export function passageReader(root = process.cwd()): PassageReader {
  return (cite) => {
    const m = cite.match(/^([^#]+\.txt)#L(\d+)(?:-L(\d+))?$/);
    if (!m) return null;
    const file = join(root, m[1]);
    if (!existsSync(file)) return null;
    const lines = readFileSync(file, 'utf8').split('\n');
    const [from, to] = [Number(m[2]), Number(m[3] ?? m[2])];
    if (from < 1 || to < from || to > lines.length) return null;
    return lines.slice(from - 1, to).join('\n');
  };
}

export const PRIOR_CAP = 0.5; // mirrors the watcher: a study weaker than this cannot override an AI guess
const STRONG = 0.75;
const ABSOLUTE =
  /\b(always|never|all|every|everyone|anyone|guarantees?|guaranteed|reliably|consistently|proves?|causes?|definitely|certainly|nobody|no one)\b/i;
const TYPICAL = /\b(most|usually|typically|on average|majority|tend|tends|generally|often|rarely|seldom)\b/i;
const POSSIBLE = /\b(can|could|may|might|possible|possibly|some|a few|occasionally|sometimes)\b/i;
const PLURAL = /\b(several|many|multiple|most|numerous|countless)\b/i;
// A verdict note that reports a population rate rather than an individual outcome.
const BASE_RATE =
  /\b(most|majority|average|median|typical(ly)?|on average|per ?cent|\d+ (of|out of) \d+)\b|\d+(\.\d+)?\s*%/i;
// A verdict note that limits its own reach: different setting, population, instrument, or an indirect measure.
const SCOPE_HEDGE =
  /\b(though|although|however|rather than|narrow(er|ly)?|only in|limited to|not .{0,40} as such|different (setting|population|instrument|market|era|period)|in a (lab|different)|self-report(ed|s)?|proxy|indirect(ly)?|not directly|does not directly|doesn't directly|tangential|older models|earlier models|not the same)\b/i;
const docOf = (cite: string) => cite.split('#')[0];
/** The document a citation counts as: its file, mapped one hop through sameStudy by basename, so that a summary and
 *  the report it summarises are one study wherever independence is counted. A self-mapping or a cycle stays put. */
export function docKey(cite: string, sameStudy: Record<string, string> = {}): string {
  const file = docOf(cite);
  const base = file.split('/').pop()!;
  const primary = sameStudy[base];
  return primary && primary !== base ? `${file.slice(0, file.length - base.length)}${primary}` : file;
}
const isStudy = (x: EvidenceItem): x is EvidenceItem & { ref: { kind: 'study'; claim: string; cite: string } } =>
  x.ref.kind === 'study';
const isJudgment = (v: Verdict | null) => v === 'right' || v === 'wrong' || v === 'partly';
const round = (n: number) => Math.round(n * 100) / 100;

export function modalityOf(text: string): Modality {
  if (ABSOLUTE.test(text)) return 'universal';
  if (TYPICAL.test(text)) return 'typical';
  if (POSSIBLE.test(text)) return 'possibility';
  return 'plain';
}

/** Sort order for records on one document: the latest first, higher confidence on a date tie. */
const newest = (a: ClaimVerdictView, b: ClaimVerdictView) =>
  (b.date ?? '').localeCompare(a.date ?? '') || (b.confidence ?? 0) - (a.confidence ?? 0);

/** The study verdicts on a claim, one per study: the newest record on the primary document; a summary document
 *  (sameStudy) only stands in when the primary has no verdict. */
export function studyVerdicts(c: ClaimView, sameStudy: Record<string, string> = {}): ClaimVerdictView[] {
  const latest = new Map<string, ClaimVerdictView>();
  const primaryFirst = (a: ClaimVerdictView, b: ClaimVerdictView) =>
    Number(docKey(b.cite!, sameStudy) === docOf(b.cite!)) - Number(docKey(a.cite!, sameStudy) === docOf(a.cite!)) ||
    newest(a, b);
  for (const v of c.verdicts.filter((x) => x.by !== 'AI guess' && x.cite).sort(primaryFirst)) {
    const doc = docKey(v.cite!, sameStudy);
    if (!latest.has(doc)) latest.set(doc, v);
  }
  return [...latest.values()];
}

const directionOf = (verdict: Verdict | null, stance: Stance): Role =>
  verdict === 'partly'
    ? 'qualifies'
    : verdict === 'right' || verdict === 'wrong'
      ? (verdict === 'right') === (stance === 'asserts')
        ? 'supports'
        : 'contradicts'
      : 'inconclusive';

/** Default applicability of a study verdict to a sentence, from wording alone. Conservative: when in doubt, not direct. */
export function applicabilityOf(modality: Modality, verdict: Verdict | null, note: string): Judgment {
  // "Most fail" is only context for "some can succeed", whichever way the sentence leans on the claim.
  if (modality === 'possibility' && verdict === 'wrong' && BASE_RATE.test(note))
    return {
      level: 'contextual',
      reason: 'a population base rate cannot rule out an individual outcome the sentence only says is possible',
    };
  if (SCOPE_HEDGE.test(note))
    return { level: 'partial', reason: `the verdict note limits its own scope ("${note.match(SCOPE_HEDGE)![0]}")` };
  return { level: 'direct', reason: 'the verdict bears on the claim as worded' };
}

const applyLevel = (direction: Role, level: Applicability): Role =>
  level === 'contextual' ? 'context' : level === 'partial' && direction !== 'inconclusive' ? 'qualifies' : direction;

export function validate(
  a: Assertion,
  corpus: Corpus,
  readPassage: PassageReader,
  judgments: Judgments = {},
): Validation {
  const byId = new Map(corpus.claims.map((c) => [c.id, c]));
  const stanceOf = new Map(a.claims.map((c) => [c.id, c.stance]));
  const modality = modalityOf(a.text);
  const same = corpus.sameStudy ?? {};
  const keyOf = (cite: string) => docKey(cite, same);
  const problems: string[] = [];
  if (!a.claims.length) problems.push('no canonical claim referenced');
  for (const c of a.claims) if (!byId.has(c.id)) problems.push(`unknown claim ${c.id}`);

  const item = (ref: EvidenceRef, cited: boolean, v?: ClaimVerdictView | null): EvidenceItem => ({
    ref,
    cited,
    role: 'broken',
    by: v?.by ?? null,
    verdict: v?.verdict ?? null,
    confidence: v?.confidence ?? null,
    note: v?.note ?? '',
  });
  const broken = (ref: EvidenceRef, problem: string): EvidenceItem => {
    problems.push(problem);
    return { ...item(ref, true), problem };
  };
  // A study verdict, placed by direction then by how far it reaches this sentence.
  const studyItem = (claim: string, stance: Stance, v: ClaimVerdictView, cited: boolean, passage?: string) => {
    const direction = directionOf(v.verdict, stance);
    const reviewed = judgments[judgmentKey(claim, stance, v.cite!)];
    const j = reviewed ?? applicabilityOf(modality, v.verdict, v.note);
    return {
      ...item({ kind: 'study', claim, cite: v.cite! }, cited, v),
      role: direction === 'inconclusive' ? direction : applyLevel(direction, j.level),
      applicability: j.level,
      basis: reviewed ? ('review' as const) : ('heuristic' as const),
      why: j.reason,
      ...(passage !== undefined ? { passage } : {}),
    };
  };

  // 1. Resolve the cited references against the corpus. Any failure is a problem, and problems block.
  const cited: EvidenceItem[] = a.evidence.map((ref) => {
    const claim = byId.get(ref.claim);
    if (!claim) return broken(ref, `unknown claim ${ref.claim}`);
    if (!stanceOf.has(ref.claim)) return broken(ref, `evidence on ${ref.claim}, which the assertion does not rest on`);
    const stance = stanceOf.get(ref.claim)!;
    if (ref.kind === 'guess') {
      const v = claim.verdicts.find((x) => x.by === 'AI guess');
      return v ? { ...item(ref, true, v), role: 'guess' } : broken(ref, `no AI guess recorded on ${ref.claim}`);
    }
    if (ref.kind === 'statement') {
      const s = claim.sources.find((x) => x.id === ref.source);
      if (!s) return broken(ref, `source ${ref.source} does not take a stance on ${ref.claim}`);
      if (s.stance !== stance)
        return broken(ref, `source ${ref.source} ${s.stance} ${ref.claim}, the assertion says it ${stance}`);
      return { ...item(ref, true), role: 'statement', by: s.title, note: s.quote };
    }
    // The latest record with this citation: a later re-judgment or retraction of the same passage supersedes.
    const v = claim.verdicts.filter((x) => x.cite === ref.cite).sort(newest)[0];
    if (!v) return broken(ref, `no study verdict on ${ref.claim} cites ${ref.cite}`);
    const passage = readPassage(ref.cite);
    if (passage === null) return broken(ref, `passage not found: ${ref.cite}`);
    return studyItem(ref.claim, stance, v, true, passage);
  });

  // 2. Every other study verdict on the claims stays visible, whether or not the author cited it.
  const citedDocs = new Set(cited.filter(isStudy).map((x) => `${x.ref.claim}|${keyOf(x.ref.cite)}`));
  const uncited: EvidenceItem[] = a.claims.flatMap(({ id, stance }) =>
    studyVerdicts(byId.get(id) ?? ({ verdicts: [] } as unknown as ClaimView), same)
      .filter((v) => !citedDocs.has(`${id}|${keyOf(v.cite!)}`))
      .map((v) => studyItem(id, stance, v, false)),
  );
  const all = [...cited, ...uncited];
  const supporting = cited.filter((x) => x.role === 'supports');
  const contradicting = all.filter((x) => x.role === 'contradicts');
  const qualifying = all.filter((x) => x.role === 'qualifies');
  const context = all.filter((x) => !['supports', 'contradicts', 'qualifies'].includes(x.role));
  const contextual = context.filter((x) => x.role === 'context');
  const uncitedSupport = uncited.filter((x) => x.role === 'supports');
  const statements = cited.filter((x) => x.role === 'statement');
  const strength = Math.max(0, ...supporting.map((x) => x.confidence ?? 0));
  const independent = new Set(supporting.filter(isStudy).map((x) => keyOf(x.ref.cite))).size;
  const verbatim =
    a.claims.length > 0 &&
    a.claims.every((c) => a.text.toLowerCase().includes((byId.get(c.id)?.text ?? '\0').toLowerCase()));
  const limitations: string[] = [];
  const suggestions: string[] = [];
  const name = (x: EvidenceItem) => x.by ?? 'unnamed';

  let status: Status;
  let decision: Decision;
  if (a.kind === 'attribution') {
    const channels = new Set(
      statements.map(
        (x) => byId.get(x.ref.claim)?.sources.find((s) => s.id === (x.ref as { source: string }).source)?.channel,
      ),
    );
    const need = PLURAL.test(a.text.replace(/"[^"]*"/g, '')) ? 2 : 1; // the frame, not the quoted words
    const stated = Number(a.text.match(/^(\d+) sources?\b/)?.[1] ?? 0); // "12 sources claim": all twelve must be cited
    if (statements.length < stated) {
      status = 'unverified';
      decision = 'blocked';
      limitations.push(`The sentence counts ${stated} sources; ${statements.length} cited.`);
    } else if (channels.size >= need) {
      status = 'supported';
      decision = 'approved';
      limitations.push('Reports what the sources said, not whether it is true.');
    } else {
      status = 'unverified';
      decision = 'blocked';
      limitations.push(
        `An attribution needs ${need} distinct source${need > 1 ? 's' : ''} making the statement; ${channels.size} cited.`,
      );
    }
  } else if (a.kind === 'disagreement') {
    const decisive = all.filter(
      (x) => isStudy(x) && x.cited && isJudgment(x.verdict) && x.applicability !== 'contextual',
    );
    const sides = new Set(decisive.map((x) => x.verdict));
    const docs = new Set(decisive.filter(isStudy).map((x) => keyOf(x.ref.cite)));
    if (docs.size >= 2 && sides.has('right') && sides.has('wrong')) {
      status = 'supported';
      decision = 'approved';
    } else if (docs.size >= 2 && sides.size >= 2) {
      status = 'qualified';
      decision = 'qualify';
      suggestions.push(
        'The studies differ in scope rather than direction: say the result is context-dependent, not that studies disagree.',
      );
    } else {
      status = 'unsupported';
      decision = 'blocked';
      limitations.push('The cited studies do not point in different directions.');
    }
  } else {
    if (!supporting.length && !contradicting.length && !qualifying.length) {
      status = 'unverified';
      decision = 'blocked';
      limitations.push(
        contextual.length
          ? 'The studies on this claim are context only: none decides the sentence as worded.'
          : cited.some((x) => x.role === 'guess')
            ? 'Only an AI guess backs this; a guess is not independent verification, however confident.'
            : 'No study verdict in the corpus bears on this.',
      );
      if (uncitedSupport.length)
        suggestions.push(
          `Cite the supporting study verdict: ${uncitedSupport
            .filter(isStudy)
            .map((x) => x.ref.cite)
            .join(', ')}.`,
        );
      else if (statements.length) suggestions.push('Attribute it instead: report that the sources make the claim.');
      else if (contextual.length && modality === 'possibility')
        suggestions.push(
          'Reframe from "can" to what the base rate shows ("most do not"), which the evidence does decide.',
        );
    } else if (contradicting.length && supporting.length) {
      status = 'disputed';
      decision = 'qualify';
      suggestions.push('Present the disagreement: name the studies on each side instead of stating one side as fact.');
    } else if (contradicting.length) {
      status = 'unsupported';
      decision = 'blocked';
      suggestions.push('The evidence points the other way; reverse the claim or report it as what the sources say.');
    } else if (qualifying.length) {
      status = 'qualified';
      decision = 'qualify';
      for (const q of qualifying)
        limitations.push(`${name(q)}: ${q.note}${q.applicability === 'partial' ? ` [partial: ${q.why}]` : ''}`);
      suggestions.push('Add the qualification: the evidence supports a narrower or weaker statement.');
    } else {
      status = 'supported';
      decision = strength >= PRIOR_CAP ? 'approved' : 'qualify';
      if (strength < PRIOR_CAP)
        suggestions.push(
          `The strongest support is weak (${strength}); say "one study suggests" or find stronger evidence.`,
        );
    }
    // An absolute word is a problem when the sentence asserts it, not when it denies a claim that contains it.
    const asserts = a.claims.some((c) => c.stance === 'asserts');
    if (
      asserts &&
      status !== 'unverified' &&
      modality === 'universal' &&
      !(status === 'supported' && strength >= STRONG)
    ) {
      const word = a.text.match(ABSOLUTE)![0];
      limitations.push(`"${word}" is stronger than the evidence (strongest support ${strength}).`);
      if (decision === 'approved') decision = 'qualify';
      if (status === 'supported') status = 'qualified';
    }
    // Figures must come from a cited passage, not from the writer and not from a verdict note. A figure that is part
    // of a referenced claim's own wording ("ten times as productive") is what the verdict judged, not the writer's.
    const evidenceText = [...supporting, ...qualifying].map((x) => x.passage ?? '').join('\n');
    const claimText = a.claims.map((c) => byId.get(c.id)?.text ?? '').join('\n');
    for (const n of nums(a.text))
      if (!hasFigure(evidenceText, n) && !hasFigure(claimText, n) && !a.derived?.includes(n)) {
        limitations.push(`The figure "${n}" does not appear in the cited passages.`);
        suggestions.push(`Drop "${n}" or cite a passage that states it.`);
        status = 'unverified';
        decision = 'blocked';
      }
  }
  for (const c of contradicting) limitations.push(`Contradicted by ${name(c)}: ${c.note}`);
  for (const c of contextual) limitations.push(`Context only, ${name(c)} (${c.verdict}): ${c.why}.`);
  if (problems.length) {
    status = 'unverified';
    decision = 'blocked';
  }
  const review = decision !== 'blocked' && (!verbatim || decision === 'qualify' || status === 'disputed');
  if (review && !verbatim)
    limitations.push(
      'Wording differs from the canonical claim; confirm the cited passages support this exact sentence.',
    );

  const parts = [
    problems.length ? `${problems.length} reference problem${problems.length > 1 ? 's' : ''}` : null,
    supporting.length
      ? `${supporting.length} supporting (${independent} independent, strongest ${round(strength)})`
      : 'no direct support',
    contradicting.length ? `${contradicting.length} contradicting` : null,
    qualifying.length ? `${qualifying.length} qualifying` : null,
    contextual.length ? `${contextual.length} context only` : null,
    statements.length ? `${statements.length} source statement${statements.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return {
    id: a.id,
    text: a.text,
    kind: a.kind,
    modality,
    status,
    decision,
    review,
    verbatim,
    strength: round(strength),
    independent,
    supporting,
    contradicting,
    qualifying,
    context,
    problems,
    limitations,
    suggestions,
    explanation: `${status} (${decision}): ${parts.join(', ')}.`,
  };
}
