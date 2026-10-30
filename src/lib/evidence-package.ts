// Evidence package: everything the writer may cite for one story, built from stories.json, the report and the store.
// Pure apart from its readers: passages, documents and transcripts are injected, so it runs on an in-memory corpus.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Corpus } from './corpus';
import { type PassageReader, applicabilityFor } from './evidence';
import type { Stance, EvidencePackage, PackageClaim, PackageDoc, PackageEvidence, Story } from '../shared/types';
import { lf, sha, topicDir, TOPICS, ROOT } from '../shared/io';
import { MAX_QUESTIONS, type ReviewFile } from './review';
import { docOf, isStudyRef, norm } from './script';

const DEFAULT_AUDIENCE =
  'General YouTube audience with no prior knowledge of MLM pay plans or research methods (default; set audience in story-review.json to change).';
const fileOf = (cite: string) => docOf(cite).split('/').pop()!;

/** Reads a document by its cite path (`<topic>/sources/<file>.txt`, under topics/) with normalised line endings; null when it is gone. */
export type DocReader = (file: string) => string | null;
export function docReader(root = ROOT): DocReader {
  return (file) => {
    const p = join(root, TOPICS, file);
    return existsSync(p) ? lf(readFileSync(p, 'utf8')) : null;
  };
}
export type DocHasher = (file: string) => string | null;
/** The sha the package records for a document; null when the reader has no such file. */
export function docHasher(r: DocReader = docReader()): DocHasher {
  return (file) => {
    const text = r(file);
    return text === null ? null : sha(text);
  };
}
export type TranscriptReader = (sourceId: string) => string | null;
/** Reads `<root>/topics/<topic>/store/transcripts/<source id>.txt` (a gitignored cache); null when it is not there. */
export function transcriptReader(topic: string, root = ROOT): TranscriptReader {
  return (id) => {
    const p = join(topicDir(topic, root), 'store', 'transcripts', `${id}.txt`);
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

export interface PackageOptions {
  review?: ReviewFile;
  inputs?: Record<string, string>; // sha of each input file
  readDoc?: DocReader;
  readTranscript?: TranscriptReader;
  previous?: EvidencePackage | null; // its persisted quote context stands where no transcript is available
  chain?: Story[]; // the follow-up stories the same video answers (chainOf); their claims join the package
}

export function buildPackage(
  story: Story,
  t: Corpus,
  read: PassageReader,
  {
    review = {},
    inputs = {},
    readDoc = docReader(),
    readTranscript = () => null,
    previous = null,
    chain = [],
  }: PackageOptions = {},
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
      const text = readDoc(file) ?? '';
      const same = t.sameStudy?.[fileOf(cite)];
      d = {
        file,
        name: t.docNames?.[fileOf(cite)] ?? fileOf(cite),
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
  // A chained video's claims are every question's, each with the audit of the first story that has it.
  const parts = [story, ...chain];
  if (parts.length > MAX_QUESTIONS)
    throw new Error(`story ${story.id} chains ${parts.length} questions; a video answers at most ${MAX_QUESTIONS}`);
  const seen = new Set<string>();
  const pairs = parts
    .flatMap((s) => s.claims.map((id, i) => ({ s, id, i })))
    .filter(({ id }) => !seen.has(id) && seen.add(id));
  const claims: PackageClaim[] = pairs.map(({ s, id, i }) => {
    const c = byId.get(id);
    if (!c) throw new Error(`story claim ${id} is not in the topic`);
    const f = s.audit.findings[i];
    if (!f) throw new Error(`story ${s.id} has no audit for claim ${id}; run discover first`);
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
      const j = applicabilityFor(c.id, stance, 'plain', x, review.applicability);
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
        basis: j.basis,
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
    gaps: [...new Set(parts.flatMap((s) => s.gaps))],
    // A chained video carries each question's own framing, and why each answer leads to the next.
    ...(chain.length && {
      chainWhy: review.stories?.[story.id]?.chainWhy ?? '',
      questions: parts.map((s) => ({
        story: s.id,
        question: s.question,
        claims: s.claims,
        central: { text: s.audit.central.text, status: s.audit.central.status },
        premise: s.premise,
        tension: s.tension,
        whyWatch: s.whyWatch,
        arc: s.arc,
      })),
    }),
  };
  return { ...body, fingerprint: sha(JSON.stringify(body)), generatedAt: new Date().toISOString() };
}
