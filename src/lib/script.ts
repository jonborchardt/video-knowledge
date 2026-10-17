// Script stage: one reviewed story -> evidence package -> narration script with sentence-level provenance -> validation.
//
// Artifacts live in <topic>/scripts/<story slug>/ (scriptDir). The code here is deterministic; the writing and the
// semantic review are agent work driven by scripts/briefs/script.md and scripts/briefs/script-review.md:
//   evidence-package.json  built here from stories.json, the report and the store (buildPackage)
//   script.json            written by the writer agent (Script)
//   script-review.json     written by an independent reviewer agent (ScriptReviewFile)
//   validation.json        built here: deterministic checks merged with the review (validateScript)
//   script.md, review.md   rendered here
// The validator fails closed: a factual sentence without provenance, a figure absent from the cited passage, a quote
// that is not in the passage, a calculation that does not reproduce, or a reference that does not resolve blocks.
// Approval needs both layers: no blocking issue, and a reviewer's approval of the sentence's current fingerprint.
// A changed sentence changes its fingerprint, so a revision never inherits an approval.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Applicability,
  type Assertion,
  type EvidenceRef,
  type PassageReader,
  type Stance,
  type Validation,
  applicabilityOf,
  judgmentKey,
  validate,
} from './evidence';
import { hasFigure, nums, spokenWords, wordsToDigits } from './numbers';
import type { ReviewFile } from './review';
import type { Story } from './stories';
import type { Storyboard } from './storyboard';
import { type ClaimView, type Topic, topicNames } from './topics';

export const WPM_DEFAULT = 150; // narration words per minute; the runtime estimate scales with it
export const RUNTIME = { min: 8, max: 12 }; // minutes, the long-form target
export const MAX_REVISIONS = 3;
export const SECTIONS = [
  'hook',
  'setup',
  'investigation',
  'findings',
  'qualifications',
  'implications',
  'conclusion',
] as const;
export type SectionName = (typeof SECTIONS)[number];
export type SentenceType = 'factual' | 'attributed' | 'hypothetical' | 'rhetorical' | 'transitional';
export type Severity = 'blocking' | 'warning' | 'info';
export type ScriptStatus = 'passed' | 'needs-review' | 'blocked';

// ---- evidence package -------------------------------------------------------------------------------------------

export type EvidenceRole = 'supports' | 'contradicts' | 'qualifies' | 'context';
export interface PackageEvidence {
  cite: string;
  doc: string; // '<topic>/sources/<file>.txt'
  by: string; // the document's display name
  verdict: string | null;
  confidence: number | null;
  note: string;
  /** supports: establishes the claim; qualifies: partly or in a narrower setting; contradicts; context: background only. */
  role: EvidenceRole;
  applicability: Applicability;
  basis: 'review' | 'heuristic';
  why: string;
  passage: string | null;
  audited: boolean; // used by the story audit (the newest verdict per document); older passages stay citable
}
export interface PackageStatement {
  source: string;
  title: string;
  channel: string;
  kind: 'video' | 'post';
  href: string;
  stance: Stance;
  quote: string;
  /** The transcript around the recorded quote (about 300 characters each side), persisted so that speaker attribution
   *  can be checked without the gitignored transcript; null when neither a transcript nor a previous package had it. */
  context: string | null;
}
export interface PackageClaim {
  id: string;
  text: string;
  stance: Stance; // the stance the story takes on it
  verdict: string | null;
  confidence: number | null;
  decidedBy: string | null;
  lean: string | null;
  role: 'belief' | 'evidence';
  guess: { verdict: string; confidence: number | null; note: string } | null; // context only, never verification
  statements: PackageStatement[]; // evidence that someone made (or denied) the claim
  evidence: PackageEvidence[]; // study verdicts with their passages
  audit: { text: string; status: string; decision: string; limitations: string[]; suggestions: string[] };
}
export interface PackageDoc {
  file: string;
  name: string;
  sha: string;
  lines: number;
  sameStudyAs: string | null; // another file reporting the same study: not independent corroboration
  cites: string[];
}
export interface EvidencePackage {
  topic: string;
  story: string;
  fingerprint: string; // of everything below except generatedAt
  generatedAt: string;
  inputs: Record<string, string>; // sha of each input file
  audience: string;
  title: string;
  question: string;
  alternates: string[];
  premise: string;
  whyWatch: string;
  tension: string;
  arc: Story['arc'];
  format: string;
  readiness: string;
  central: { text: string; status: string; decision: string; strength: number; independent: number };
  claims: PackageClaim[];
  documents: PackageDoc[];
  gaps: string[];
}

const DEFAULT_AUDIENCE =
  'General YouTube audience with no prior knowledge of MLM pay plans or research methods (default; set audience in story-review.json to change).';
export const sha = (s: string | Buffer) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const docOf = (cite: string) => cite.split('#')[0];
const fileOf = (cite: string) => docOf(cite).split('/').pop()!;
const isStudyRef = (r: EvidenceRef): r is { kind: 'study'; claim: string; cite: string } => r.kind === 'study';

export type DocHasher = (file: string) => string | null;
/** The sha the package records for `<topic>/sources/<file>.txt`, from the working tree; null when the file is gone. */
export function docHasher(root = process.cwd()): DocHasher {
  return (file) => {
    const p = join(root, file);
    return existsSync(p) ? sha(readFileSync(p, 'utf8')) : null;
  };
}
export type TranscriptReader = (sourceId: string) => string | null;
/** Reads `<root>/<topic>/store/transcripts/<source id>.txt` (a gitignored cache); null when it is not there. */
export function transcriptReader(topic: string, root = process.cwd()): TranscriptReader {
  return (id) => {
    const p = join(root, topic, 'store', 'transcripts', `${id}.txt`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
}
const CONTEXT = 300;
/** The transcript window around the quote, located case- and whitespace-insensitively; a prefix when not located. */
export function quoteContext(transcript: string, quote: string): string {
  const text = norm(transcript);
  const q = norm(quote);
  const at = q ? text.indexOf(q) : -1;
  if (at < 0) return `(quote not located) ${text.slice(0, CONTEXT)}`;
  return text.slice(Math.max(0, at - CONTEXT), at + q.length + CONTEXT);
}

export function buildPackage(
  story: Story,
  t: Topic,
  read: PassageReader,
  review: ReviewFile = {},
  inputs: Record<string, string> = {},
  root = process.cwd(),
  readTranscript: TranscriptReader = () => null,
  previous: EvidencePackage | null = null,
): EvidencePackage {
  // Without a transcript (a clean checkout), the window persisted by the previous package stands.
  const kept = new Map(
    (previous?.claims ?? []).flatMap((c) => c.statements.map((s) => [`${s.source}\n${s.quote}`, s.context])),
  );
  const context = (source: string, quote: string) => {
    const transcript = readTranscript(source);
    return transcript !== null ? quoteContext(transcript, quote) : (kept.get(`${source}\n${quote}`) ?? null);
  };
  const byId = new Map(t.claims.map((c) => [c.id, c]));
  const docs = new Map<string, PackageDoc>();
  const doc = (cite: string) => {
    const file = docOf(cite);
    let d = docs.get(file);
    if (!d) {
      const p = join(root, file);
      const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
      const same = t.sameStudy[fileOf(cite)];
      d = {
        file,
        name: t.docNames[fileOf(cite)] ?? fileOf(cite),
        sha: sha(text),
        lines: text ? text.split('\n').length : 0,
        sameStudyAs: same ? `${t.name}/sources/${same}` : null,
        cites: [],
      };
      docs.set(file, d);
    }
    if (!d.cites.includes(cite)) d.cites.push(cite);
    return d;
  };
  const claims: PackageClaim[] = story.claims.map((id, i) => {
    const c = byId.get(id);
    if (!c) throw new Error(`story claim ${id} is not in the topic`);
    const f = story.audit.findings[i];
    if (!f) throw new Error(`story ${story.id} has no audit for claim ${id}; run discover first`);
    const v = f.validation;
    const stance: Stance = c.verdict === 'wrong' ? 'denies' : 'asserts';
    const evidence: PackageEvidence[] = [...v.supporting, ...v.contradicting, ...v.qualifying, ...v.context]
      .filter((x) => isStudyRef(x.ref))
      .map((x) => {
        const cite = (x.ref as { cite: string }).cite;
        const d = doc(cite);
        return {
          cite,
          doc: d.file,
          by: x.by ?? d.name,
          verdict: x.verdict,
          confidence: x.confidence,
          note: x.note,
          role: x.role === 'supports' || x.role === 'contradicts' || x.role === 'qualifies' ? x.role : 'context',
          applicability: x.applicability ?? 'contextual',
          basis: x.basis ?? 'heuristic',
          why: x.why ?? '',
          passage: read(cite),
          audited: true,
        };
      });
    // Every other recorded study passage on the claim: the audit keeps one verdict per document, the writer may cite any.
    for (const x of c.verdicts) {
      if (x.by === 'AI guess' || !x.cite || evidence.some((e) => e.cite === x.cite)) continue;
      const d = doc(x.cite);
      const j =
        review.applicability?.[judgmentKey(c.id, stance, x.cite)] ?? applicabilityOf('plain', x.verdict, x.note);
      const direction =
        x.verdict === 'partly'
          ? 'qualifies'
          : x.verdict === 'right' || x.verdict === 'wrong'
            ? (x.verdict === 'right') === (stance === 'asserts')
              ? 'supports'
              : 'contradicts'
            : 'context';
      evidence.push({
        cite: x.cite,
        doc: d.file,
        by: x.by,
        verdict: x.verdict,
        confidence: x.confidence,
        note: x.note,
        role:
          j.level === 'contextual'
            ? 'context'
            : j.level === 'partial' && direction !== 'context'
              ? 'qualifies'
              : direction,
        applicability: j.level,
        basis: review.applicability?.[judgmentKey(c.id, stance, x.cite)] ? 'review' : 'heuristic',
        why: j.reason,
        passage: read(x.cite),
        audited: false,
      });
    }
    const guess = c.verdicts.find((x) => x.by === 'AI guess');
    return {
      id: c.id,
      text: c.text,
      stance,
      verdict: c.verdict,
      confidence: c.confidence,
      decidedBy: c.decidedBy,
      lean: c.lean,
      role: f.role,
      guess: guess ? { verdict: guess.verdict, confidence: guess.confidence, note: guess.note } : null,
      statements: c.sources.map((s) => ({
        source: s.id,
        title: s.title,
        channel: s.channel,
        kind: s.kind,
        href: s.href,
        stance: s.stance,
        quote: s.quote,
        context: context(s.id, s.quote),
      })),
      evidence,
      audit: {
        text: v.text,
        status: v.status,
        decision: v.decision,
        limitations: v.limitations,
        suggestions: v.suggestions,
      },
    };
  });
  const body = {
    topic: t.name,
    story: story.id,
    inputs,
    audience: review.stories?.[story.id]?.audience ?? DEFAULT_AUDIENCE,
    title: story.title,
    question: story.question,
    alternates: story.alternates,
    premise: story.premise,
    whyWatch: story.whyWatch,
    tension: story.tension,
    arc: story.arc,
    format: story.format,
    readiness: story.readiness,
    central: {
      text: story.audit.central.text,
      status: story.audit.central.status,
      decision: story.audit.central.decision,
      strength: story.audit.central.strength,
      independent: story.audit.central.independent,
    },
    claims,
    documents: [...docs.values()].sort((a, b) => (a.file < b.file ? -1 : 1)),
    gaps: story.gaps,
  };
  return { ...body, fingerprint: sha(JSON.stringify(body)), generatedAt: new Date().toISOString() };
}

// ---- script ------------------------------------------------------------------------------------------------------

export interface Calc {
  expression: string; // digits and + - * / ( ) only
  inputs: { value: string; cite: string }[]; // every operand, with the passage it comes from
  result: string; // as written in the sentence
  note?: string;
}
export interface Quote {
  text: string; // the words inside the quotation marks
  cite?: string; // a study passage among the assertion's evidence
  source?: string; // or a source id among the assertion's statement evidence
  /** Who the narration says spoke the words (a name, a role, a show); must be in the package's quote context, the
   *  source title or the channel. Required whenever the narration names the speaker. */
  speaker?: string;
}
export interface ScriptAssertion {
  id: string; // '<sentence id>.<letter>'
  text: string; // one atomic statement, with the figures it uses written as digits
  kind: Assertion['kind'];
  claims: Assertion['claims'];
  evidence: EvidenceRef[];
  quote?: Quote;
  calc?: Calc;
  qualifications?: string[]; // where the narration carries the limitation this assertion needs
}
export interface Sentence {
  id: string;
  text: string;
  type: SentenceType;
  assertions?: ScriptAssertion[];
  note?: string; // writer's note to the reviewer (why a hypothetical is safe, what a number means)
}
export interface Section {
  name: SectionName;
  sentences: Sentence[];
}
export interface Script {
  topic: string;
  story: string;
  title: string;
  revision: number; // 1 for the first draft; the writer increments it on each revision
  generation: {
    model: string;
    brief: string;
    date: string;
    wordsPerMinute: number;
    evidencePackage: string; // package fingerprint the draft was written from
    notes?: string;
  };
  sections: Section[];
}

export interface Issue {
  sentence: string;
  assertion?: string;
  category: string;
  severity: Severity;
  explanation: string;
  refs?: string[];
  suggestion?: string;
  by: 'deterministic' | 'review';
  revision?: number; // review findings: the revision they were raised against
  fingerprint?: string; // review findings: the sentence fingerprint they were raised against
  disposition?: string; // deterministic warnings: the reviewer's reason for retiring it at this fingerprint
}
export interface ReviewFinding extends Omit<Issue, 'by'> {
  fingerprint: string; // of the sentence as reviewed; a finding whose fingerprint no longer matches is resolved
}
export interface ScriptReviewFile {
  reviewer: string;
  model?: string;
  date: string;
  revision: number;
  /** The evidence package the review was made against; approvals count only for that exact package. */
  packageFingerprint?: string;
  /** sentence id -> fingerprint approved: every assertion entailed by its passages, every factual claim covered. */
  approved: Record<string, string>;
  findings: ReviewFinding[];
  /** assertion id (or sentence id) -> why a deterministic warning there is a false positive or already carried by the
   *  narration, valid at that sentence fingerprint only. Blocking issues cannot be dispositioned. */
  dispositions?: Record<string, { fingerprint: string; reason: string }>;
}

export interface AssertionResult {
  id: string;
  text: string;
  kind: Assertion['kind'];
  calc?: Calc;
  quote?: Quote;
  status: 'verified' | 'needs-review' | 'blocked';
  validation: Validation;
  issues: Issue[];
}
export interface SentenceResult {
  id: string;
  section: SectionName;
  text: string;
  type: SentenceType;
  fingerprint: string;
  words: number;
  status: 'verified' | 'needs-review' | 'blocked'; // verified on a non-factual sentence: the reviewer confirmed it carries no fact
  approved: boolean; // by the reviewer, at this fingerprint
  assertions: AssertionResult[];
  issues: Issue[]; // sentence-level, including review findings on it
}
export interface ScriptValidation {
  topic: string;
  story: string;
  revision: number;
  date: string;
  status: ScriptStatus;
  scriptFingerprint: string;
  packageFingerprint: string | null;
  wordsPerMinute: number;
  words: number;
  spokenWords: number; // numeral-aware count (src/lib/numbers.ts); the runtime estimate uses it
  minutes: number;
  counts: {
    sentences: number;
    factual: number; // sentences typed factual or attributed
    assertions: number;
    verified: number;
    blocking: number;
    warnings: number; // open warnings (dispositioned ones excluded)
    dispositioned: number; // warnings the reviewer retired at the current fingerprint
    unreviewed: number; // sentences without a current approval
  };
  revisionLimitReached: boolean;
  sentences: SentenceResult[];
  issues: Issue[]; // every open issue, blocking first
  resolved: (ReviewFinding & { resolvedBy: number })[]; // review findings whose sentence changed since
  history: { revision: number; date: string; status: ScriptStatus; blocking: number; warnings: number }[];
}

export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const minutes = (w: number, wpm: number) => Math.round((w / wpm) * 10) / 10;
export const sentenceFingerprint = (s: Sentence) =>
  sha(
    [
      s.text,
      ...(s.assertions ?? []).map((a) => JSON.stringify([a.text, a.kind, a.claims, a.evidence, a.quote, a.calc])),
    ]
      .join('\n')
      .replace(/\s+/g, ' '),
  );
export const scriptFingerprint = (s: Script) =>
  sha(s.sections.map((x) => x.sentences.map((y) => `${y.id}:${y.text}`).join('\n')).join('\n'));
export const sentences = (s: Script) => s.sections.flatMap((x) => x.sentences.map((y) => ({ ...y, section: x.name })));

/** Case, quote style, dashes and whitespace do not count; pdftotext's replacement characters are dropped. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const NUMBERISH = /\d|\$|\bper ?cent\b|\bpercent\b/i;
// ponytail: arithmetic only, no functions; a Function over a digits-and-operators whitelist is the whole evaluator.
export function evalExpr(e: string): number | null {
  if (!/^[\d.\s+\-*/()]+$/.test(e)) return null;
  try {
    const v = Function(`"use strict"; return (${e});`)() as unknown;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
const decimals = (s: string) => (s.split('.')[1] ?? '').length;
// ponytail: the conventional bases a calculation may use without citing them (percent, per mille, months, weeks, days).
const CONSTANTS = new Set(['1', '10', '100', '1000', '12', '52', '365']);

export function validateScript(
  script: Script,
  t: Pick<Topic, 'name' | 'claims'>,
  read: PassageReader,
  review: ScriptReviewFile | null = null,
  judgments: ReviewFile['applicability'] = {},
  previous: ScriptValidation | null = null,
  pkg: EvidencePackage | null = null,
  hashDoc: DocHasher = docHasher(),
): ScriptValidation {
  const packageFingerprint = pkg?.fingerprint ?? null;
  // A source may be quoted on several claims; the statement (and its context) is the one on the claim cited.
  const statementOf = (claims: string[], source: string) =>
    pkg?.claims
      .filter((c) => claims.includes(c.id))
      .flatMap((c) => c.statements)
      .find((s) => s.source === source) ?? null;
  const wpm = script.generation?.wordsPerMinute || WPM_DEFAULT;
  const corpus = { name: t.name, claims: t.claims };
  const byId = new Map<string, ClaimView>(t.claims.map((c) => [c.id, c]));
  const all = sentences(script);
  const top: Issue[] = [];
  const issue = (
    sentence: string,
    category: string,
    severity: Severity,
    explanation: string,
    extra: Partial<Issue> = {},
  ): Issue => ({ sentence, category, severity, explanation, by: 'deterministic', ...extra });

  // Structure.
  const seen = new Set<string>();
  for (const s of all) {
    if (seen.has(s.id)) top.push(issue(s.id, 'structure', 'blocking', `duplicate sentence id ${s.id}`));
    seen.add(s.id);
  }
  for (const name of SECTIONS)
    if (!script.sections.some((x) => x.name === name))
      top.push(issue('-', 'structure', 'warning', `no "${name}" section`));
  for (const x of script.sections)
    if (!(SECTIONS as readonly string[]).includes(x.name))
      top.push(issue('-', 'structure', 'blocking', `unknown section "${x.name}"`));
  if (packageFingerprint && script.generation?.evidencePackage !== packageFingerprint)
    top.push(
      issue(
        '-',
        'stale-package',
        'warning',
        `the script was written from evidence package ${script.generation?.evidencePackage ?? '?'}; the current package is ${packageFingerprint}`,
      ),
    );
  if (!script.generation?.model) top.push(issue('-', 'provenance', 'warning', 'generation.model is missing'));
  // Every cited document must still be the bytes the package recorded: a changed source invalidates every approval
  // that rested on it, so the package is rebuilt and the script re-reviewed.
  if (pkg) {
    const citedFiles = new Set(
      all
        .flatMap((s) => s.assertions ?? [])
        .flatMap((a) => [
          ...a.evidence.filter(isStudyRef).map((r) => r.cite),
          ...(a.quote?.cite ? [a.quote.cite] : []),
          ...(a.calc?.inputs.map((i) => i.cite) ?? []),
        ])
        .map(docOf),
    );
    for (const d of pkg.documents.filter((d) => citedFiles.has(d.file))) {
      const now = hashDoc(d.file);
      if (now === null)
        top.push(issue('-', 'missing-source', 'blocking', `${d.file} is not in the working tree; restore it`));
      else if (now !== d.sha)
        top.push(
          issue(
            '-',
            'stale-source',
            'blocking',
            `${d.file} changed since the evidence package was built (${d.sha} -> ${now}); regenerate the package and re-review`,
          ),
        );
    }
  }

  // A review is bound to the package it was made against: approvals of another package (or of none, an older file)
  // count for nothing, while its findings still apply by sentence fingerprint.
  const reviewCurrent = !!review && (!pkg || review.packageFingerprint === pkg.fingerprint);
  if (review && !reviewCurrent)
    top.push(
      issue(
        '-',
        'stale-review',
        'info',
        `the review was made against evidence package ${review.packageFingerprint ?? '(none recorded)'}; the package is now ${pkg!.fingerprint}, so its approvals do not count`,
      ),
    );
  // Review findings that still apply (same sentence fingerprint) stay open; the rest were addressed by a revision.
  const prints = new Map(all.map((s) => [s.id, sentenceFingerprint(s)]));
  const open = (review?.findings ?? []).filter((f) => prints.get(f.sentence) === f.fingerprint);
  // Resolved findings are history: the previous validation's list, plus every finding (in the file, or open in the
  // previous validation and since deleted from the file) whose sentence has changed. Deleting a finding never erases it.
  const key = (f: { sentence: string; fingerprint?: string; explanation: string }) =>
    `${f.sentence}|${f.fingerprint}|${f.explanation}`;
  const resolvedNow = new Map<string, ReviewFinding & { resolvedBy: number }>();
  for (const r of previous?.resolved ?? []) resolvedNow.set(key(r), r);
  const stale = [
    ...(review?.findings ?? []),
    ...(previous?.issues ?? []).filter(
      (i): i is Issue & { fingerprint: string } => i.by === 'review' && typeof i.fingerprint === 'string',
    ),
  ].filter((f) => prints.get(f.sentence) !== f.fingerprint);
  for (const f of stale) {
    const { by: _by, ...finding } = f as ReviewFinding & { by?: string };
    void _by;
    if (!resolvedNow.has(key(f))) resolvedNow.set(key(f), { ...finding, resolvedBy: script.revision });
  }
  const resolved = [...resolvedNow.values()];
  // A finding's references must be reproducible from the repository: no URLs, no absolute paths, no gitignored caches.
  const unreproducible = (ref: string) =>
    /^https?:/i.test(ref) || /^([A-Za-z]:)?[\\/]/.test(ref) || /(^|\/)(store\/transcripts|work)\//.test(ref);
  for (const f of open)
    for (const ref of f.refs ?? [])
      if (unreproducible(ref))
        top.push(
          issue(
            f.sentence,
            'unreproducible-ref',
            'warning',
            `the finding cites "${ref}", which is outside the repository`,
            {
              suggestion: 'Cite the package context or a committed source path.',
            },
          ),
        );

  const results: SentenceResult[] = all.map((s) => {
    const issues: Issue[] = [];
    const fp = prints.get(s.id)!;
    const assertions = s.assertions ?? [];
    for (const a of assertions)
      if (!a.id.startsWith(`${s.id}.`))
        issues.push(issue(s.id, 'structure', 'blocking', `assertion id ${a.id} must start with ${s.id}.`));
    const factualType = s.type === 'factual' || s.type === 'attributed';
    if (factualType && !assertions.length)
      issues.push(
        issue(s.id, 'missing-provenance', 'blocking', `a ${s.type} sentence with no assertion: nothing to check`, {
          suggestion: 'Add an assertion per factual claim with its claim and evidence, or retype the sentence.',
        }),
      );
    if (!factualType && !assertions.length && NUMBERISH.test(s.text))
      issues.push(
        issue(
          s.id,
          'figure-in-non-factual',
          'warning',
          `a ${s.type} sentence carries a figure; the reviewer must confirm it is not a representative outcome`,
        ),
      );
    // Every figure in the sentence must belong to some assertion, so no part of a sentence rides on another's evidence.
    const covered = assertions.map((a) => a.text).join(' ');
    if (assertions.length)
      for (const n of nums(s.text))
        if (!hasFigure(covered, n))
          issues.push(
            issue(
              s.id,
              'figure-without-assertion',
              'blocking',
              `the figure "${n}" is in no assertion of this sentence`,
              {
                suggestion: `Add an assertion that states "${n}" and cites the passage it comes from.`,
              },
            ),
          );

    const ar: AssertionResult[] = assertions.map((a) => {
      const own: Issue[] = [];
      const add = (category: string, severity: Severity, explanation: string, extra: Partial<Issue> = {}) =>
        own.push(issue(s.id, category, severity, explanation, { assertion: a.id, ...extra }));
      const cites = new Set(a.evidence.filter(isStudyRef).map((r) => r.cite));
      const statementIds = new Set(
        a.evidence
          .filter((r): r is { kind: 'statement'; claim: string; source: string } => r.kind === 'statement')
          .map((r) => r.source),
      );
      // Calculation: inputs from cited passages, arithmetic that reproduces, result as written.
      const derived: string[] = [];
      if (a.calc) {
        const c = a.calc;
        const bad: string[] = [];
        for (const inp of c.inputs) {
          if (!cites.has(inp.cite))
            bad.push(`input ${inp.value} cites ${inp.cite}, which is not among the assertion's evidence`);
          else {
            const p = read(inp.cite);
            if (p === null) bad.push(`passage not found: ${inp.cite}`);
            else if (!hasFigure(p, inp.value)) bad.push(`input ${inp.value} is not in ${inp.cite}`);
          }
        }
        for (const n of nums(c.expression))
          if (!c.inputs.some((i) => i.value.replaceAll(',', '') === n) && !CONSTANTS.has(n))
            bad.push(`operand ${n} is not a declared input`);
        const v = evalExpr(c.expression);
        const r = Number(c.result.replaceAll(',', ''));
        if (v === null) bad.push(`cannot evaluate "${c.expression}"`);
        else if (!Number.isFinite(r) || Math.abs(v - r) > 0.5 * 10 ** -decimals(c.result) + 1e-9)
          bad.push(`${c.expression} = ${v}, not ${c.result}`);
        if (!hasFigure(a.text, c.result)) bad.push(`the result ${c.result} is not in the assertion text`);
        if (bad.length)
          add('bad-arithmetic', 'blocking', bad.join('; '), { suggestion: 'Fix the inputs or drop the figure.' });
        else derived.push(c.result.replaceAll(',', ''));
      }
      const v = validate(
        { id: a.id, text: a.text, kind: a.kind, claims: a.claims, evidence: a.evidence, derived },
        corpus,
        read,
        judgments,
      );
      for (const p of v.problems) add('bad-reference', 'blocking', p);
      if (v.decision === 'blocked' && !v.problems.length)
        add(
          v.limitations.some((l) => /figure/.test(l))
            ? 'invented-number'
            : v.status === 'unsupported'
              ? 'contradicted'
              : 'unsupported',
          'blocking',
          v.limitations.join(' ') || v.explanation,
          { suggestion: v.suggestions.join(' ') || undefined },
        );
      else if (v.decision === 'qualify') {
        // The limitation that applies: the cited qualifying verdicts, else whatever the gate said (minus the wording note).
        const citedQ = v.qualifying.filter((x) => x.cited);
        const why = citedQ.length
          ? citedQ.map((x) => `${x.by}: ${x.note}`)
          : v.limitations.filter((l) => !l.startsWith('Wording differs') && !/is stronger than the evidence/.test(l));
        const universal = v.limitations.find((l) => /is stronger than the evidence/.test(l));
        add('needs-qualification', 'warning', [...why, ...(universal ? [universal] : []), ...v.suggestions].join(' '), {
          suggestion: a.qualifications?.length
            ? `The writer says the narration carries it: ${a.qualifications.join(' ')}`
            : 'Say where the narration carries this limitation (qualifications), or narrow the sentence.',
        });
      } else if (v.review)
        add(
          'wording',
          'info',
          'Wording differs from the canonical claim; the reviewer confirms the passages entail it.',
        );
      // Attribution figures come from what the source actually said.
      if (a.kind === 'attribution') {
        const quotes = v.context
          .filter((x) => x.role === 'statement')
          .map((x) => x.note)
          .join('\n');
        const stated = wordsToDigits(a.text).match(/^(\d+) sources?\b/)?.[1];
        for (const n of nums(a.text))
          if (n !== stated && !hasFigure(quotes, n))
            add('figure-not-in-quote', 'blocking', `the figure "${n}" is not in the cited source statements`);
      }
      // Quotation: the exact words, inside the cited passage or statement.
      if (a.quote) {
        const q = a.quote;
        if (norm(q.text).split(' ').length < 3) add('quote', 'blocking', 'a quotation needs at least three words');
        if (q.cite) {
          if (!cites.has(q.cite))
            add('quote', 'blocking', `the quotation cites ${q.cite}, which is not among the assertion's evidence`);
          else {
            const p = read(q.cite);
            if (p === null) add('quote', 'blocking', `passage not found: ${q.cite}`);
            else if (!norm(p).includes(norm(q.text))) add('misquote', 'blocking', `"${q.text}" is not in ${q.cite}`);
          }
        } else if (q.source) {
          const st = a.claims.map((c) => byId.get(c.id)?.sources.find((x) => x.id === q.source)).find(Boolean);
          if (!statementIds.has(q.source) || !st)
            add(
              'quote',
              'blocking',
              `the quotation names source ${q.source}, which is not among the assertion's evidence`,
            );
          else if (!norm(st.quote).includes(norm(q.text)))
            add('misquote', 'blocking', `"${q.text}" is not in the recorded quote from ${q.source}: "${st.quote}"`);
          // Speaker attribution: the person the narration names must be in the transcript window the package
          // persisted around the quote, or in the source's title or channel. Never taken on trust.
          const context =
            statementOf(
              a.claims.filter((c) => byId.get(c.id)?.sources.some((x) => x.id === q.source)).map((c) => c.id),
              q.source,
            )?.context ?? null;
          const named = st ? `${norm(st.title)} ${norm(st.channel)}` : '';
          if (!st || !statementIds.has(q.source)) {
            /* already blocked above */
          } else if (!q.speaker)
            add(
              'speaker-missing',
              'warning',
              'the quotation names no speaker; the reviewer confirms the narration does not say who spoke',
              {
                suggestion: 'Set quote.speaker to the name, role or show the narration attributes the words to.',
              },
            );
          else if (named.includes(norm(q.speaker)) || (context !== null && norm(context).includes(norm(q.speaker)))) {
            /* verified */
          } else
            add(
              'speaker-unverified',
              'blocking',
              context === null
                ? `speaker "${q.speaker}" is not the source title or channel and there is no transcript context in the evidence package`
                : `speaker "${q.speaker}" is not in the transcript context around the quote, the source title or the channel`,
              { suggestion: 'Name the speaker as the transcript does, or attribute the words to the source itself.' },
            );
        } else add('quote', 'blocking', 'a quotation needs a cite or a source');
        if (!norm(s.text).includes(norm(q.text))) add('quote', 'blocking', 'the quoted words are not in the sentence');
      }
      const blocked = own.some((x) => x.severity === 'blocking');
      return {
        id: a.id,
        text: a.text,
        kind: a.kind,
        ...(a.calc ? { calc: a.calc } : {}),
        ...(a.quote ? { quote: a.quote } : {}),
        status: blocked ? 'blocked' : 'needs-review',
        validation: v,
        issues: own,
      };
    });

    const reviewHere = open.filter((f) => f.sentence === s.id).map<Issue>((f) => ({ ...f, by: 'review' }));
    issues.push(...reviewHere);
    // A reviewer may retire a deterministic warning (never a blocking issue) at this exact fingerprint.
    for (const i of [...issues, ...ar.flatMap((a) => a.issues)]) {
      const d = review?.dispositions?.[i.assertion ?? s.id];
      if (i.by === 'deterministic' && i.severity === 'warning' && d && d.fingerprint === fp) i.disposition = d.reason;
    }
    const approved = reviewCurrent && review!.approved?.[s.id] === fp;
    const blocking = [...issues, ...ar.flatMap((a) => a.issues)].some((x) => x.severity === 'blocking');
    for (const a of ar) if (a.status !== 'blocked') a.status = approved && !blocking ? 'verified' : 'needs-review';
    // Every sentence needs the reviewer: a hypothetical or a transition can smuggle a fact the code cannot see.
    const status: SentenceResult['status'] = blocking ? 'blocked' : approved ? 'verified' : 'needs-review';
    return {
      id: s.id,
      section: s.section,
      text: s.text,
      type: s.type,
      fingerprint: fp,
      words: words(s.text),
      status,
      approved,
      assertions: ar,
      issues,
    };
  });

  const w = results.reduce((n, s) => n + s.words, 0);
  const sw = results.reduce((n, s) => n + spokenWords(s.text), 0);
  const mins = minutes(sw, wpm);
  if (mins < RUNTIME.min || mins > RUNTIME.max)
    top.push(
      issue(
        '-',
        'runtime',
        'warning',
        `${w} words (${sw} as spoken) is about ${mins} minutes at ${wpm} wpm; the target is ${RUNTIME.min} to ${RUNTIME.max}`,
      ),
    );
  const issues = [...top, ...results.flatMap((s) => [...s.issues, ...s.assertions.flatMap((a) => a.issues)])].sort(
    (a, b) => ['blocking', 'warning', 'info'].indexOf(a.severity) - ['blocking', 'warning', 'info'].indexOf(b.severity),
  );
  const blocking = issues.filter((x) => x.severity === 'blocking').length;
  const warnings = issues.filter((x) => x.severity === 'warning' && !x.disposition).length;
  const dispositioned = issues.filter((x) => x.disposition).length;
  const unreviewed = results.filter((s) => s.status === 'needs-review').length;
  const status: ScriptStatus = blocking ? 'blocked' : unreviewed || !review ? 'needs-review' : 'passed';
  const date = new Date().toISOString();
  const history = [
    ...(previous?.history ?? []).filter((h) => h.revision !== script.revision),
    {
      revision: script.revision,
      date,
      status,
      blocking,
      warnings,
    },
  ];
  return {
    topic: script.topic,
    story: script.story,
    revision: script.revision,
    date,
    status,
    scriptFingerprint: scriptFingerprint(script),
    packageFingerprint,
    wordsPerMinute: wpm,
    words: w,
    spokenWords: sw,
    minutes: mins,
    counts: {
      sentences: results.length,
      factual: results.filter((s) => s.type === 'factual' || s.type === 'attributed').length,
      assertions: results.reduce((n, s) => n + s.assertions.length, 0),
      verified: results.reduce((n, s) => n + s.assertions.filter((a) => a.status === 'verified').length, 0),
      blocking,
      warnings,
      dispositioned,
      unreviewed,
    },
    revisionLimitReached: status === 'blocked' && script.revision >= MAX_REVISIONS,
    sentences: results,
    issues,
    resolved,
    history,
  };
}

// ---- rendering ---------------------------------------------------------------------------------------------------

const MARK: Record<string, string> = { verified: 'ok', 'needs-review': 'review', blocked: 'BLOCKED' };
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const excerpt = (p: string | null, n = 320) => {
  if (!p) return '(passage not found)';
  const one = p.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
};

/** The narration as a reader sees it: sections, sentences with status markers, then the evidence behind each sentence. */
export function renderScriptMd(script: Script, v: ScriptValidation, read: PassageReader): string {
  const by = new Map(v.sentences.map((s) => [s.id, s]));
  const out: string[] = [
    `# ${script.title}`,
    '',
    `Story \`${script.story}\` (${script.topic}), revision ${script.revision}. About ${v.minutes} minutes (${v.words} words at ${v.wordsPerMinute} wpm). Validation: **${v.status}**, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.verified}/${v.counts.assertions} assertions verified.`,
    '',
    'Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.',
    '',
  ];
  for (const sec of script.sections) {
    out.push(`## ${sec.name[0].toUpperCase()}${sec.name.slice(1)}`, '');
    out.push(
      sec.sentences
        .map((s) => {
          const r = by.get(s.id)!;
          // A reviewed non-factual sentence carries no marker; everything else shows its state.
          const m = r.assertions.length || r.issues.length || r.status !== 'verified' ? MARK[r.status] : '';
          return `${s.text}${m ? ` [${s.id} ${m}]` : ''}`;
        })
        .join(' '),
      '',
    );
  }
  const openIssues = v.issues.filter((i) => !i.disposition);
  if (openIssues.length) {
    out.push('## Open issues', '');
    for (const i of openIssues)
      out.push(
        `- **${i.severity}** ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category} (${i.by}): ${i.explanation}${i.suggestion ? ` Suggestion: ${i.suggestion}` : ''}`,
      );
    out.push('');
  }
  out.push('## Evidence by sentence', '');
  for (const s of v.sentences) {
    if (!s.assertions.length && !s.issues.length) continue;
    out.push(`### ${s.id} (${s.type}, ${s.status})`, '', `> ${s.text}`, '');
    for (const i of s.issues) out.push(`- ${i.severity} ${i.category} (${i.by}): ${i.explanation}`);
    for (const a of s.assertions) {
      out.push(`- **${a.id}** [${a.status}] ${a.text}`);
      out.push(
        `  - ${a.validation.explanation}${a.validation.modality !== 'plain' ? ` modality: ${a.validation.modality}.` : ''}`,
      );
      for (const i of a.issues) out.push(`  - ${i.severity} ${i.category}: ${i.explanation}`);
      for (const x of [
        ...a.validation.supporting,
        ...a.validation.qualifying,
        ...a.validation.contradicting,
        ...a.validation.context,
      ]) {
        const cite = 'cite' in x.ref ? x.ref.cite : 'source' in x.ref ? x.ref.source : 'AI guess';
        out.push(
          `  - ${x.role}${x.cited ? '' : ' (uncited)'}: ${x.by ?? ''} ${x.verdict ?? ''}${x.confidence != null ? ` ${x.confidence}` : ''}${x.applicability ? `, ${x.applicability}` : ''} \`${cite}\``,
        );
        if (x.ref.kind === 'study' && x.cited) out.push(`    > ${excerpt(x.passage ?? read(x.ref.cite))}`);
        else if (x.note) out.push(`    > ${excerpt(x.note)}`);
      }
      if (a.calc)
        out.push(`  - calculation: ${a.calc.expression} = ${a.calc.result}${a.calc.note ? ` (${a.calc.note})` : ''}`);
      if (a.quote) out.push(`  - quotation: "${a.quote.text}" from \`${a.quote.cite ?? a.quote.source}\``);
    }
    out.push('');
  }
  return out.join('\n');
}

export interface StoryboardSummary {
  scenes: number;
  runtime: number; // seconds
  status: string;
  issues: Issue[];
}
export function renderReviewMd(
  script: Script,
  v: ScriptValidation,
  pkg: EvidencePackage | null,
  sb: StoryboardSummary | null,
): string {
  const open = v.issues.filter((i) => i.severity !== 'info' && !i.disposition);
  const dispositioned = v.issues.filter((i) => i.disposition);
  const decisions = [
    ...v.issues
      .filter((i) => i.severity === 'warning' && i.category !== 'runtime' && !i.disposition)
      .map((i) => `${i.sentence}${i.assertion ? ` ${i.assertion}` : ''}: ${i.explanation}`),
    ...(v.revisionLimitReached
      ? [
          `Revision limit (${MAX_REVISIONS}) reached with ${v.counts.blocking} blocking issues open: a person decides whether to cut, re-research or abandon.`,
        ]
      : []),
  ];
  return [
    `# Review: ${script.title}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Story | \`${script.story}\` (${script.topic}) |`,
    `| Revision | ${script.revision} of at most ${MAX_REVISIONS} |`,
    `| Validation | **${v.status}** (${v.date.slice(0, 10)}) |`,
    `| Words / runtime | ${v.words} words, about ${v.minutes} min at ${v.wordsPerMinute} wpm |`,
    `| Sentences | ${v.counts.sentences} (${v.counts.factual} factual or attributed) |`,
    `| Assertions | ${v.counts.assertions}, ${v.counts.verified} verified |`,
    `| Issues | ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.dispositioned ?? 0} dispositioned |`,
    `| Unreviewed sentences | ${v.counts.unreviewed} |`,
    `| Scenes | ${sb ? `${sb.scenes}, ${mmss(sb.runtime)} (${sb.status})` : 'no storyboard yet'} |`,
    `| Evidence package | ${v.packageFingerprint ?? '?'}${pkg ? ` (${pkg.documents.length} documents, ${pkg.claims.length} claims)` : ''} |`,
    `| Model | ${script.generation?.model ?? '?'} |`,
    '',
    'Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.',
    '',
    '## Open issues',
    '',
    ...(open.length
      ? open.map(
          (i) =>
            `- **${i.severity}** ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category} (${i.by}): ${i.explanation}`,
        )
      : ['None.']),
    ...(sb?.issues.length
      ? [
          '',
          '### Storyboard',
          '',
          ...sb.issues.map((i) => `- **${i.severity}** ${i.sentence} ${i.category}: ${i.explanation}`),
        ]
      : []),
    '',
    '## Dispositions',
    '',
    'Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.',
    '',
    ...(dispositioned.length
      ? dispositioned.map(
          (i) =>
            `- ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category}: ${i.disposition} (warning was: ${i.explanation})`,
        )
      : ['None.']),
    '',
    '## Resolved review findings',
    '',
    ...(v.resolved.length
      ? v.resolved.map(
          (r) =>
            `- ${r.sentence}${r.assertion ? ` (${r.assertion})` : ''} ${r.category} (raised against revision ${r.revision ?? '?'}, addressed in revision ${r.resolvedBy}): ${r.explanation}`,
        )
      : ['None.']),
    '',
    '## Research gaps',
    '',
    ...(pkg?.gaps.length ? pkg.gaps.map((g) => `- ${g}`) : ['None recorded on the story.']),
    '',
    '## Outstanding editorial decisions',
    '',
    ...(decisions.length ? decisions.map((d) => `- ${d}`) : ['None.']),
    '',
    '## History',
    '',
    ...v.history.map(
      (h) =>
        `- revision ${h.revision}, ${h.date.slice(0, 10)}: ${h.status}, ${h.blocking} blocking, ${h.warnings} warnings`,
    ),
    '',
  ].join('\n');
}

// ---- release -----------------------------------------------------------------------------------------------------

/** Written by `npm run script -- lock` once validation passed and the storyboard is ok: the fingerprints approved. */
export interface Release {
  topic: string;
  story: string;
  approvedBy: string; // a person, or "automated: ..." so a reader knows nobody signed off
  date: string;
  revision: number;
  fingerprints: {
    script: string; // scriptFingerprint
    package: string; // evidence package fingerprint
    validation: string; // sha of validation.json as locked
    storyboard: string; // sha of storyboard.json as locked
  };
}
/** One warning per locked fingerprint the current script, package or storyboard no longer matches. */
export function releaseCheck(release: Release | null, v: ScriptValidation, sb: Storyboard | null): Issue[] {
  if (!release) return [];
  const stale = (what: string, locked: string, now: string | null) => ({
    sentence: '-',
    category: 'release-stale',
    severity: 'warning' as const,
    explanation: `release.json locked ${what} ${locked}; it is now ${now ?? '(none)'}: the approved package has changed, lock it again after review`,
    by: 'deterministic' as const,
  });
  const out: Issue[] = [];
  if (release.fingerprints.script !== v.scriptFingerprint)
    out.push(stale('script', release.fingerprints.script, v.scriptFingerprint));
  if (release.fingerprints.package !== v.packageFingerprint)
    out.push(stale('package', release.fingerprints.package, v.packageFingerprint));
  if (sb && sb.scriptFingerprint !== release.fingerprints.script)
    out.push(stale('the storyboard script', release.fingerprints.script, sb.scriptFingerprint));
  return out;
}

// ---- files -------------------------------------------------------------------------------------------------------

export const storySlug = (storyId: string) => storyId.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
export const scriptDir = (topic: string, storyId: string, root = process.cwd()) =>
  join(root, topic, 'scripts', storySlug(storyId));
export const FILES = {
  pkg: 'evidence-package.json',
  script: 'script.json',
  review: 'script-review.json',
  validation: 'validation.json',
  scriptMd: 'script.md',
  storyboard: 'storyboard.json',
  storyboardMd: 'storyboard.md',
  reviewMd: 'review.md',
  release: 'release.json',
} as const;
export const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);
/** Serialises without passages: provenance stays with the citation, and the CLI re-reads them on demand. */
export const toJson = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'passage' ? undefined : v), 1) + '\n';
export function writeArtifact(dir: string, name: string, content: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), content);
}
/** Every <topic>/scripts/<slug> with a script.json, for the site and the tests. */
export function scriptDirs(root = process.cwd()): { topic: string; slug: string; dir: string }[] {
  return topicNames().flatMap((topic) => {
    const base = join(root, topic, 'scripts');
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(base, d.name, FILES.script)))
      .map((d) => ({ topic, slug: d.name, dir: join(base, d.name) }));
  });
}
