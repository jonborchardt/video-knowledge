// Contracts shared by every capability: the shapes of the files one stage writes and another reads. Types and
// plain literals only, no import statement (browser-safe).

export const WPM_DEFAULT = 150; // narration words per minute; the runtime estimate scales with it
export const MAX_REVISIONS = 3;
/** The answer is given once (`answer`), limits sit beside their figures, and `takeaway` is what the viewer can do. */
export const SECTIONS = ['hook', 'setup', 'investigation', 'answer', 'takeaway'] as const;
/** A video that answers a chain of questions (EvidencePackage.questions): one hook, a block per question, one close. */
export const CHAIN_SECTIONS = ['hook', 'question-1', 'question-2', 'question-3', 'close'] as const;
/** A Short (EvidencePackage.short): one finding out of a produced video, with its own hook and a close that points at
 *  the full video. The finding carries its qualifications; the close carries no figure. */
export const SHORT_SECTIONS = ['hook', 'finding', 'close'] as const;
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
export type SectionName = (typeof SECTIONS)[number] | (typeof CHAIN_SECTIONS)[number] | (typeof SHORT_SECTIONS)[number];
export type ShortFormat = (typeof SHORT_FORMATS)[number];
export type SentenceType = 'factual' | 'attributed' | 'hypothetical' | 'rhetorical' | 'transitional';
export type Severity = 'blocking' | 'warning' | 'info';
export type ScriptStatus = 'passed' | 'needs-review' | 'blocked';
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
  spokenWords: number; // numeral-aware count (src/shared/numbers.ts); the runtime estimate uses it
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
  /** Figures the caller has established by a recorded calculation from cited inputs (see src/shared/sentences.ts). */
  derived?: string[];
}
export type Status = 'supported' | 'qualified' | 'disputed' | 'unsupported' | 'unverified';
export type Decision = 'approved' | 'qualify' | 'blocked';
export type Role =
  'supports' | 'contradicts' | 'qualifies' | 'context' | 'inconclusive' | 'statement' | 'guess' | 'broken';
export type Applicability = ApplicabilityLevel;
/** What the sentence claims: can/some (an outcome is possible), most/usually (typical), always/reliably (universal). */
export type Modality = 'possibility' | 'typical' | 'universal' | 'plain';
export interface EvidenceItem {
  ref: EvidenceRef;
  role: Role;
  cited: boolean; // false: found on the claim but not in the assertion's own references
  by: string | null; // study display name, source title, or 'AI guess'
  verdict: Verdict | null;
  confidence: number | null;
  note: string;
  applicability?: Applicability; // study verdicts only
  basis?: Basis; // where the applicability came from
  why?: string; // the applicability reason
  passage?: string; // the cited lines, when the reader could fetch them (not persisted)
  problem?: string;
}
export type Basis = 'recorded' | 'review' | 'heuristic';
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
export type StoryKind = 'contradicted' | 'conflict' | 'surprise' | 'gap' | 'decision';
export type Readiness = 'ready' | 'needs-review' | 'needs-research' | 'rejected';
export type Arc = Record<'hook' | 'conflict' | 'evidence' | 'resolution' | 'takeaway', string>;
export interface Finding {
  role: 'belief' | 'evidence'; // belief: what the sources say (attribution); evidence: a fact the studies decide
  validation: Validation;
}
export interface StoriesFile {
  topic: string;
  basis: { claims: number; sources: number; studies: number; candidates: number };
  stories: Story[];
  rejected: { id: string; title: string; reason: string }[];
}
export interface Story {
  id: string; // '<kind>:<primary claim slug>' or 'decision:<group slug>', stable across runs
  kind: StoryKind; // classification metadata, never shown in a title
  title: string;
  alternates: string[];
  question: string;
  whyWatch: string;
  tension: string;
  evidenceNeeded: string;
  evidenceAvailable: string[];
  gaps: string[];
  premise: string;
  claims: string[]; // the key claims, every one of which answers the question
  related: string[]; // nearby claims left out of the narrative, by wording overlap
  arc: Arc;
  coherence: { score: number; basis: 'review' | 'heuristic'; explanation: string };
  scores: {
    coherence: number;
    relevance: number;
    curiosity: number;
    stakes: number;
    depth: number;
    originality: number;
    evidence: number; // strength and applicability of the studies behind the central conclusion
    editorial: number; // mean of coherence, relevance, curiosity, stakes, depth
    overall: number;
    explanation: string;
  };
  readiness: Readiness;
  readinessWhy: string;
  blocking: string[]; // what keeps it from ready
  reviewed: boolean;
  audit: { central: Validation; findings: Finding[] };
  /** The follow-up questions the same video answers (story-review.json `chain`); absent for a one-question video. */
  chain?: { id: string; question: string }[];
  /** The story whose video answers this one as a follow-up: it is never produced on its own. */
  partOf?: string;
  /** Suggested follow-ups for the reviewer (ready, no shared claims, nearest wording); never applied by code. */
  chainCandidates?: string[];
}
export type Verdict = 'right' | 'wrong' | 'partly' | 'untestable' | 'unknown';
/** How far a study verdict's passage reaches its claim. contextual is listed but never decides any sentence. */
export const APPLICABILITY = ['direct', 'partial', 'contextual'] as const;
export type ApplicabilityLevel = (typeof APPLICABILITY)[number];

// ---- research corpus and review shapes (from corpus.ts, batches.ts, review.ts, evidence.ts) ----

/** One entry of topics/<topic>/applicability.json, keyed applicabilityKey(claim, cite); written only by record-sources. */
export interface RecordedApplicability {
  level: ApplicabilityLevel;
  reason: string;
}

export interface CorpusVerdict {
  by: string; // 'AI guess' or the study's display name
  verdict: Verdict;
  confidence: number | null;
  note: string;
  cite: string | null; // '<topic>/sources/<file>.txt#L10-L24', a path in the repo
  date: string | null; // YYYY-MM-DD the verdict was recorded; a later record on the same document supersedes
  applicability?: RecordedApplicability; // recorded with the verdict (applicability.json); a ceiling, absent means none
}
export interface CorpusSource {
  id: string;
  title: string;
  channel: string;
  kind: 'video' | 'post';
  href: string;
  stance: 'asserts' | 'denies';
  quote: string;
}
export interface CorpusClaim {
  id: string;
  text: string;
  verdict: Verdict | null;
  confidence: number | null;
  decidedBy: string | null; // a study's display name, or null when the AI guess decides
  lean: string | null;
  sources: CorpusSource[]; // every source that asserts or denies it, with its quote
  verdicts: CorpusVerdict[]; // every recorded judgment: the AI guess and each study
}
export interface Corpus {
  name: string;
  claims: CorpusClaim[];
  sameStudy?: Record<string, string>; // '<summary file>.txt' -> '<primary file>.txt' when two documents report one study
  docNames?: Record<string, string>; // '<file>.txt' -> display name
}

export interface StoryReview {
  /** Drop the candidate with this reason (incoherent, redundant, not a story). */
  reject?: string;
  /** 0 to 1: do the claims form one argument or investigation? Below 0.5 rejects. */
  coherence?: { score: number; reason: string };
  /** The final claim list (ids), replacing the candidate's: prune tangents, add what the question needs. */
  claims?: string[];
  question?: string;
  title?: string;
  alternates?: string[];
  whyWatch?: string;
  tension?: string;
  evidenceNeeded?: string;
  premise?: string;
  arc?: Partial<Record<'hook' | 'conflict' | 'evidence' | 'resolution' | 'takeaway', string>>;
  /** The premise and arc carry every qualification the audit raised, so qualified findings no longer hold the story at needs-review. */
  qualificationsAccepted?: boolean;
  /** Hold the story at needs-research for this reason, whatever the audit says (an essential gap the code cannot see). */
  research?: string;
  /** Who the script is written for; the evidence package carries it to the writer (a stated default otherwise). */
  audience?: string;
  /** Follow-up stories this story's video goes on to answer, in order: each answer raises the next question. Each
   *  keeps its own audit; the video is ready only when every one is. Chains do not nest. */
  chain?: string[];
  /** Why each answer leads to the next question (required with a chain). */
  chainWhy?: string;
}

export interface ReviewFile {
  /** `${claim}|${stance}|${cite}` -> does that verdict decide a sentence taking that stance on the claim? */
  applicability?: Judgments;
  stories?: Record<string, StoryReview>;
}

export interface Judgment {
  level: Applicability;
  reason: string;
}
/** Reviewer judgments keyed `${claim}|${stance}|${cite}`: does that verdict decide a sentence with that stance? */
export type Judgments = Record<string, Judgment>;

export type PassageReader = (cite: string) => string | null;

// The public record (topics/<topic>/public-record.json): written only by `npm run report` and `npm run article -- correct`.
export const FINDING_LABELS = ['verified', 'qualification', 'unresolved', 'reported'] as const;
export type FindingLabel = (typeof FINDING_LABELS)[number];

export interface ClaimState {
  label: FindingLabel;
  verdict: Verdict | null;
}
export type Revision =
  | {
      at: string; // YYYY-MM-DD
      kind: 'claim';
      id: string;
      from: ClaimState | null;
      to: ClaimState | null; // null: the claim left the report (merged away)
      note: string;
    }
  | {
      at: string;
      kind: 'article';
      id: string; // the story id
      from: null;
      to: null;
      sentences: string[]; // the corrected sentence ids
      note: string;
      release?: number; // the article release this correction made (absent on revisions recorded before it was kept)
    };
export type ClaimRevision = Extract<Revision, { kind: 'claim' }>;
export interface PublicRecord {
  exhibits: Record<string, number>;
  revisions: Revision[];
}
