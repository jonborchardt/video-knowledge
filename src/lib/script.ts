// Script stage: one reviewed story -> evidence package -> narration script with sentence-level provenance -> validation.
//
// Artifacts live in topics/<topic>/scripts/<story slug>/ (scriptDir). The code is deterministic; the writing and the semantic
// review are agent work driven by scripts/briefs/script.md and scripts/briefs/script-review.md:
//   evidence-package.json  built from stories.json, the report and the store (evidence-package.ts, buildPackage)
//   script.json            written by the writer agent (Script)
//   script-review.json     written by an independent reviewer agent (ScriptReviewFile)
//   validation.json        deterministic checks merged with the review (script-validation.ts, validateScript)
//   script.md, review.md   rendered by script-md.ts
//   release.json           the approved fingerprints (release.ts)
// This file holds the shared types, fingerprints and folder conventions; each stage's code lives in its own module.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Applicability, Assertion, Basis, EvidenceRef, Stance, Validation } from './evidence';
import { sha, topicDir, TOPICS, ROOT } from './io';
import type { Story } from './stories';

export const WPM_DEFAULT = 150; // narration words per minute; the runtime estimate scales with it
export const MAX_REVISIONS = 3;
/** The answer is given once (`answer`), limits sit beside their figures, and `takeaway` is what the viewer can do. */
export const SECTIONS = ['hook', 'setup', 'investigation', 'answer', 'takeaway'] as const;
/** A video that answers a chain of questions (EvidencePackage.questions): one hook, a block per question, one close. */
export const CHAIN_SECTIONS = ['hook', 'question-1', 'question-2', 'question-3', 'close'] as const;
/** A Short (EvidencePackage.short): one finding out of a produced video, with its own hook and a close that points at
 *  the full video. The finding carries its qualifications; the close carries no figure. */
export const SHORT_SECTIONS = ['hook', 'finding', 'close'] as const;
export type SectionName = (typeof SECTIONS)[number] | (typeof CHAIN_SECTIONS)[number] | (typeof SHORT_SECTIONS)[number];
/** The sections a script written from this package has, in order. */
export const sectionsFor = (pkg: Pick<EvidencePackage, 'questions' | 'short'> | null): readonly SectionName[] =>
  pkg?.short
    ? SHORT_SECTIONS
    : pkg?.questions
      ? ['hook', ...pkg.questions.map((_, i) => `question-${i + 1}` as SectionName), 'close']
      : SECTIONS;
/** A Short's storyboard may not estimate longer than this. YouTube allows 180 s, but a Short is watched on a phone
 *  with a thumb on the screen: the brief aims at 30 to 45 s and this is the editorial ceiling. */
export const SHORT_MAX_SECONDS = 60;
/** Ready Short candidates per video; the reviewer picks by leaving the rest unkept. */
export const MAX_SHORTS = 3;
/** The Short formats the brand allows as an eyebrow line (brand/design.md 2.6). */
export const SHORT_FORMATS = [
  'ONE FIGURE FROM THE RECORD',
  'THE COMMISSION FINDS',
  'EXHIBIT IN BRIEF',
  'CLAIM UNDER EXAMINATION',
  'PUBLIC ADVISORY',
] as const;
export type ShortFormat = (typeof SHORT_FORMATS)[number];
export type SentenceType = 'factual' | 'attributed' | 'hypothetical' | 'rhetorical' | 'transitional';
export type Severity = 'blocking' | 'warning' | 'info';
export type ScriptStatus = 'passed' | 'needs-review' | 'blocked';

// ---- evidence package -------------------------------------------------------------------------------------------

export type EvidenceRole = 'supports' | 'contradicts' | 'qualifies' | 'context';
export interface PackageEvidence {
  cite: string;
  doc: string; // 'topics/<topic>/sources/<file>.txt'
  by: string; // the document's display name
  verdict: string | null;
  confidence: number | null;
  note: string;
  /** supports: establishes the claim; qualifies: partly or in a narrower setting; contradicts; context: background only. */
  role: EvidenceRole;
  applicability: Applicability;
  basis: Basis;
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
  readiness: string;
  central: { text: string; status: string; decision: string; strength: number; independent: number };
  claims: PackageClaim[];
  documents: PackageDoc[];
  gaps: string[];
  /** A chained video's questions in order, the first the story's own, each with its own framing; absent for a
   *  one-question video. `chainWhy` says why each answer raises the next question. */
  chainWhy?: string;
  /** A Short's package: a filter of its parent's with the finding it extracts; absent for a video. */
  short?: ShortBlock;
  questions?: {
    story: string;
    question: string;
    claims: string[];
    central: { text: string; status: string };
    premise: string;
    tension: string;
    whyWatch: string;
    arc: Story['arc'];
  }[];
}

/** What makes a package a Short's (src/lib/shorts.ts builds it): the parent, the candidate it came from, what the
 *  writer must open from and carry, the cap, and the parent fingerprints it is bound to. */
export interface ShortBlock {
  parent: string; // the parent story id
  key: string; // the candidate key in shorts.json (its scene's first sentence id)
  slug: string; // the folder and the id's tail
  format: ShortFormat;
  sentences: string[]; // the parent sentences the finding comes from
  hook: string; // the reviewer's opening line
  carries: string[]; // how each parent qualification is said inside the Short
  maxSeconds: number;
  parentFingerprints: { package: string; script: string; release: string };
}

export const docOf = (cite: string) => cite.split('#')[0];
export const isStudyRef = (r: EvidenceRef): r is { kind: 'study'; claim: string; cite: string } => r.kind === 'study';

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
  /** The viewer-facing chapter title (a question section's question); the section name otherwise. */
  title?: string;
  sentences: Sentence[];
}
export interface Script {
  topic: string;
  story: string;
  title: string;
  revision: number; // 1 for the first draft; the writer increments it on each revision
  /** The revision a send-back pass started from (absent = 0): the revision limit counts revisions within the pass. */
  passStartRevision?: number;
  generation: {
    model: string;
    brief: string;
    date: string;
    wordsPerMinute: number;
    evidencePackage: string; // package fingerprint the draft was written from
    notes?: string;
    /** A sanctioned corrective pass past the revision limit: only the listed sentences change, for the reason given. */
    corrective?: { revision: number; reason: string; sentences: string[]; authorizedBy: string }[];
    /** The writer stopped because a finding needs a passage the package does not have; the evidence agent closes it. */
    needsEvidence?: { claim: string; why: string; hint?: string }[];
  };
  sections: Section[];
}
/** A section's viewer-facing title: its own (a question section's question), else its name capitalised. */
export const sectionTitle = (sec: Pick<Section, 'name' | 'title'>) =>
  sec.title ?? sec.name[0].toUpperCase() + sec.name.slice(1);
export const revisionsInPass = (s: Script) => s.revision - (s.passStartRevision ?? 0);

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
export interface Disposition {
  fingerprint: string;
  category: string;
  reason: string;
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
   *  narration, valid at that sentence fingerprint only; a list retires several categories on one sentence. Blocking
   *  issues cannot be dispositioned. */
  dispositions?: Record<string, Disposition | Disposition[]>;
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
    validation: string; // validationFingerprint of validation.json as locked (content, not timestamps)
    storyboard: string; // storyboardFingerprint of storyboard.json as locked (content, not issues)
  };
}

// ---- files -------------------------------------------------------------------------------------------------------

export const storySlug = (storyId: string) => storyId.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
/** A Short's id is `<story-id>/shorts/<slug>`: the parent and the slug, or null for a story. */
export function shortOf(storyId: string): { parent: string; slug: string } | null {
  const m = /^(.+)\/shorts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(storyId);
  return m ? { parent: m[1], slug: m[2] } : null;
}
export const shortId = (parent: string, slug: string) => `${parent}/shorts/${slug}`;
/** A story's folder, or a Short's nested in its parent's: the id carries the nesting, so every CLI keyed by
 *  (topic, storyId) works on a Short unchanged. */
export const scriptDir = (topic: string, storyId: string, root = ROOT) => {
  const s = shortOf(storyId);
  return s
    ? join(topicDir(topic, root), 'scripts', storySlug(s.parent), 'shorts', s.slug)
    : join(topicDir(topic, root), 'scripts', storySlug(storyId));
};
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
/** Every topics/<topic>/scripts/<slug> with a script.json, for the site and the tests. */
export function scriptDirs(root = ROOT): { topic: string; slug: string; dir: string }[] {
  const topics = readdirSync(join(root, TOPICS), { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !d.name.startsWith('.'),
  );
  return topics.flatMap(({ name: topic }) => {
    const base = join(topicDir(topic, root), 'scripts');
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(base, d.name, FILES.script)))
      .map((d) => ({ topic, slug: d.name, dir: join(base, d.name) }));
  });
}
