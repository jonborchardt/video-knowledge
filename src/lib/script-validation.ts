// Script validation: deterministic checks on every sentence of script.json, merged with the reviewer's file.
// It fails closed: a factual sentence without provenance, a figure absent from the cited passage, a quote that is not
// in the passage, a calculation that does not reproduce, or a reference that does not resolve blocks.
// Approval needs both layers: no blocking issue, and a reviewer's approval of the sentence's current fingerprint.
// A changed sentence changes its fingerprint, so a revision never inherits an approval.
import type { Corpus } from './corpus';
import { type PassageReader, validate } from './evidence';
import { type DocHasher, docHasher } from './evidence-package';
import { hasFigure, nums, spokenWords, wordsToDigits } from './numbers';
import type { ReviewFile } from './review';
import {
  revisionsInPass,
  sectionsFor,
  docOf,
  isStudyRef,
  minutes,
  norm,
  scriptFingerprint,
  sentenceFingerprint,
  sentences,
  words,
} from './script';
import {
  type AssertionResult,
  type Calc,
  type EvidencePackage,
  type Issue,
  type Quote,
  MAX_REVISIONS,
  type ReviewFinding,
  type Script,
  type ScriptAssertion,
  type ScriptReviewFile,
  type ScriptStatus,
  type ScriptValidation,
  type SentenceResult,
  type Severity,
  WPM_DEFAULT,
} from '../shared/types';
import type { CorpusClaim } from './corpus';

const NUMBERISH = /\d|\$|\bper ?cent\b|\bpercent\b/i;

// A numbers recap: a sentence that re-reads two or more figures from documents the viewer already heard them from.
// The next sentence or two may unpack a figure; past that it is a repeat. One figure reused as context ("of the 70
// statements"), counts up to ten ("five years") and years stay quiet. ponytail: figures only; a restated point
// without numbers is the reviewer's to find (scripts/briefs/script-review.md, repetition).
const NEAR = 2;
const YEAR = /^(1[6-9]|20)\d\d$/;
/** The figures a viewer would notice: not counts up to ten, not years (a bare 1600-2099; "$1,950" and "2,000 people"
 *  are figures). */
const figuresIn = (text: string) =>
  [...wordsToDigits(text).matchAll(/(\$?)(\d[\d,]*(?:\.\d+)?)/g)]
    .filter(([, currency, n]) => currency || n.includes(',') || !YEAR.test(n))
    .map(([, , n]) => n.replaceAll(',', ''))
    .filter((n) => Number(n) > 10 || n.includes('.'));
/** Sentence id -> the earlier figures it re-reads, each with the sentence that first gave it. */
export function repetitions(
  all: { id: string; text: string; assertions?: ScriptAssertion[] }[],
): Map<string, string[]> {
  const first = new Map<string, number>(); // `${doc}|${figure}` -> index of the sentence that first spoke it
  const out = new Map<string, string[]>();
  all.forEach((s, i) => {
    const docs = new Set((s.assertions ?? []).flatMap((a) => a.evidence.filter(isStudyRef).map((e) => docOf(e.cite))));
    const again = new Map<string, string>(); // figure -> where it was first said
    for (const n of new Set(figuresIn(s.text)))
      for (const d of docs) {
        const at = first.get(`${d}|${n}`);
        if (at === undefined) first.set(`${d}|${n}`, i);
        else if (i - at > NEAR && !again.has(n)) again.set(n, all[at].id);
      }
    if (again.size >= 2)
      out.set(
        s.id,
        [...again].map(([n, id]) => `${n} (first in ${id})`),
      );
  });
  return out;
}

// Pacing, calibrated on the first four scripts: ten or more figures inside eight sentences is a stretch of numbers a
// viewer cannot hold (keep what the argument needs, chart the rest), and the evidence should start within a minute.
const DENSE = { window: 8, figures: 10 };
const START_SECONDS = 60;
/** Sentence id -> pacing warnings: a numbers recap, the start of a dense stretch of figures, a slow start. */
export function pacing(all: ReturnType<typeof sentences>, wpm: number): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  const add = (id: string, category: string, explanation: string) =>
    out.set(id, [...(out.get(id) ?? []), issue(id, category, 'warning', explanation)]);
  for (const [id, what] of repetitions(all))
    add(id, 'repetition', `re-reads figures the viewer already heard: ${what.join(', ')}`);
  const per = all.map((s) => figuresIn(s.text).length);
  const sum = (i: number) => per.slice(i, i + DENSE.window).reduce((a, b) => a + b, 0);
  for (let i = 0; i < all.length; i++) {
    if (sum(i) < DENSE.figures) continue;
    let end = i;
    while (end + 1 < all.length && sum(end + 1) >= DENSE.figures) end++;
    // The stretch runs from its first sentence with a figure to its last.
    let last = Math.min(end + DENSE.window, all.length) - 1;
    while (!per[i]) i++;
    while (!per[last]) last--;
    const n = per.slice(i, last + 1).reduce((a, b) => a + b, 0);
    add(
      all[i].id,
      'number-dense',
      `${n} figures from ${all[i].id} to ${all[last].id}: keep the ones the argument needs, chart the rest and say the point in words`,
    );
    i = last;
  }
  const start = all.findIndex((s) => s.section !== 'hook' && s.section !== 'setup');
  const seconds = Math.round(
    (all.slice(0, Math.max(start, 0)).reduce((w, s) => w + spokenWords(s.text), 0) / wpm) * 60,
  );
  if (start > 0 && seconds > START_SECONDS)
    add(
      all[start].id,
      'slow-start',
      `the evidence starts about ${seconds} seconds in; reach it within ${START_SECONDS}`,
    );
  return out;
}
/** Quoted spans in a sentence: straight or curly double quotes, the words inside. */
const quotedSpans = (text: string) => [...text.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]);
/** A name or role appears as whole words (never a bare substring: "a" is not a speaker), at least three characters. */
export function mentions(haystack: string, who: string): boolean {
  const w = norm(who);
  if (w.length < 3) return false;
  const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
  return re.test(norm(haystack));
}
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

export interface ValidateOptions {
  review?: ScriptReviewFile | null;
  judgments?: ReviewFile['applicability'];
  previous?: ScriptValidation | null; // carries resolved findings and history forward
  pkg?: EvidencePackage | null;
  hashDoc?: DocHasher;
  pacing?: boolean; // false for prose that is read, not spoken (articles)
}

const issue = (
  sentence: string,
  category: string,
  severity: Severity,
  explanation: string,
  extra: Partial<Issue> = {},
): Issue => ({ sentence, category, severity, explanation, by: 'deterministic', ...extra });
type ScriptSentence = ReturnType<typeof sentences>[number];

/** Script-level checks: structure, the package the script was written from, and the cited documents' bytes. */
function scriptIssues(script: Script, all: ScriptSentence[], pkg: EvidencePackage | null, hashDoc: DocHasher): Issue[] {
  const top: Issue[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    if (seen.has(s.id)) top.push(issue(s.id, 'structure', 'blocking', `duplicate sentence id ${s.id}`));
    seen.add(s.id);
  }
  const names = sectionsFor(pkg);
  for (const name of names)
    if (!script.sections.some((x) => x.name === name))
      top.push(issue('-', 'structure', pkg?.questions ? 'blocking' : 'warning', `no "${name}" section`));
  for (const x of script.sections)
    if (!names.includes(x.name)) top.push(issue('-', 'structure', 'blocking', `unknown section "${x.name}"`));
  // A chained video answers each question in its own block: the block asserts at least one of that story's claims.
  pkg?.questions?.forEach((q, i) => {
    const sec = script.sections.find((x) => x.name === `question-${i + 1}`);
    const asserted = new Set(
      sec?.sentences.flatMap((y) => (y.assertions ?? []).flatMap((a) => a.claims.map((c) => c.id))),
    );
    if (sec && !q.claims.some((c) => asserted.has(c)))
      top.push(
        issue(
          '-',
          'structure',
          'blocking',
          `section "${sec.name}" asserts none of ${q.story}'s claims: "${q.question}" is not answered`,
        ),
      );
  });
  if (pkg && script.generation?.evidencePackage !== pkg.fingerprint)
    top.push(
      issue(
        '-',
        'stale-package',
        'warning',
        `the script was written from evidence package ${script.generation?.evidencePackage ?? '?'}; the current package is ${pkg.fingerprint}`,
      ),
    );
  if (!script.generation?.model) top.push(issue('-', 'provenance', 'warning', 'generation.model is missing'));
  // A Short's close points at the full video and carries no figure: a number there is a second finding.
  if (pkg?.short)
    for (const s of all)
      if (s.section === 'close' && nums(s.text).length)
        top.push(
          issue(
            s.id,
            'figure-in-close',
            'blocking',
            `a Short's close carries a figure ("${nums(s.text)[0]}"); say it in the finding`,
          ),
        );
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
  return top;
}

/** The reviewer's file against the current script: whether its approvals count, the findings still open (same
 *  sentence fingerprint), the history of resolved ones, and the issues about the review itself. */
interface ReviewMerge {
  current: boolean;
  prints: Map<string, string>;
  open: ReviewFinding[];
  resolved: (ReviewFinding & { resolvedBy: number })[];
  issues: Issue[];
}
function mergeReview(
  script: Script,
  all: ScriptSentence[],
  review: ScriptReviewFile | null,
  pkg: EvidencePackage | null,
  previous: ScriptValidation | null,
): ReviewMerge {
  const issues: Issue[] = [];
  // A review is bound to the package it was made against: approvals of another package (or of none, an older file)
  // count for nothing, while its findings still apply by sentence fingerprint.
  const current = !!review && (!pkg || review.packageFingerprint === pkg.fingerprint);
  if (review && !current)
    issues.push(
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
  // A finding's references must be reproducible from the repository: no URLs, no absolute paths, no gitignored caches.
  const unreproducible = (ref: string) =>
    /^https?:/i.test(ref) || /^([A-Za-z]:)?[\\/]/.test(ref) || /(^|\/)(store\/transcripts|work)\//.test(ref);
  for (const f of review?.findings ?? [])
    // open or resolved: history must stay reproducible too
    for (const ref of f.refs ?? [])
      if (unreproducible(ref))
        issues.push(
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
  return { current, prints, open, resolved: [...resolvedNow.values()], issues };
}

/** Sentence-level checks: provenance for a factual sentence, every quotation declared, every figure on an assertion. */
function sentenceIssues(s: ScriptSentence): Issue[] {
  const issues: Issue[] = [];
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
  if (!factualType && !assertions.length && NUMBERISH.test(wordsToDigits(s.text)))
    issues.push(
      issue(
        s.id,
        'figure-in-non-factual',
        'warning',
        `a ${s.type} sentence carries a figure; the reviewer must confirm it is not a representative outcome`,
      ),
    );
  // Every quotation in the narration must be declared on an assertion (quote.text), or it is never checked.
  const declared = assertions.map((a) => norm(a.quote?.text ?? '')).filter(Boolean);
  for (const span of quotedSpans(s.text))
    if (norm(span).split(' ').length >= 3 && !declared.some((d) => d.includes(norm(span))))
      issues.push(
        issue(
          s.id,
          'quote-unchecked',
          factualType ? 'blocking' : 'warning',
          `the quoted words "${span}" are on no assertion's quote, so nothing checked them against a passage or a source`,
          {
            suggestion: 'Declare the quotation on an assertion with quote.text and its cite or source, or unquote it.',
          },
        ),
      );
  // Every figure in the sentence must belong to some assertion, so no part of a sentence rides on another's evidence.
  const covered = assertions.map((a) => a.text).join(' ');
  if (assertions.length)
    for (const n of nums(s.text))
      if (!hasFigure(covered, n))
        issues.push(
          issue(s.id, 'figure-without-assertion', 'blocking', `the figure "${n}" is in no assertion of this sentence`, {
            suggestion: `Add an assertion that states "${n}" and cites the passage it comes from.`,
          }),
        );
  return issues;
}

/** What one assertion is checked against: the passages, the corpus, the review's applicability, the package. */
interface AssertionContext {
  read: PassageReader;
  corpus: Corpus;
  judgments: ReviewFile['applicability'];
  byId: Map<string, CorpusClaim>;
  pkg: EvidencePackage | null;
  ids: Set<string>; // every sentence id in the script (a Short's qualifications must name one)
}

/** The calculation: inputs from cited passages, arithmetic that reproduces, the result as written. Returns the
 *  problems and, when there are none, the derived figure the gate may accept. */
function checkCalc(
  c: Calc,
  text: string,
  cites: Set<string>,
  read: PassageReader,
): { bad: string[]; derived: string[] } {
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
  if (!hasFigure(text, c.result)) bad.push(`the result ${c.result} is not in the assertion text`);
  return { bad, derived: bad.length ? [] : [c.result.replaceAll(',', '')] };
}

/** The quotation: the exact words, inside the cited passage or the recorded statement, with a verified speaker. */
function quoteIssues(
  a: ScriptAssertion,
  q: Quote,
  s: ScriptSentence,
  cites: Set<string>,
  statementIds: Set<string>,
  { read, byId, pkg }: AssertionContext,
  add: (category: string, severity: Severity, explanation: string, extra?: Partial<Issue>) => void,
) {
  if (norm(q.text).split(' ').length < 3) add('quote', 'blocking', 'a quotation needs at least three words');
  if (q.cite) {
    if (!cites.has(q.cite))
      add('quote', 'blocking', `the quotation cites ${q.cite}, which is not among the assertion's evidence`);
    else {
      const p = read(q.cite);
      if (p === null) add('quote', 'blocking', `passage not found: ${q.cite}`);
      else if (!norm(p).includes(norm(q.text))) add('misquote', 'blocking', `"${q.text}" is not in ${q.cite}`);
      // A named speaker on a study quotation must be the passage, the study or the document, and in the sentence.
      if (q.speaker) {
        const study = a.claims
          .flatMap((c) => byId.get(c.id)?.verdicts ?? [])
          .filter((x) => x.cite === q.cite)
          .map((x) => x.by);
        const docName = pkg?.documents.find((d) => d.file === docOf(q.cite!))?.name ?? '';
        const where = [p ?? '', ...study, docName].join('\n');
        if (!mentions(s.text, q.speaker) || !mentions(where, q.speaker))
          add(
            'speaker-unverified',
            'blocking',
            `speaker "${q.speaker}" must be named in the sentence and be the study, the document or words in the passage`,
          );
      }
    }
  } else if (q.source) {
    const st = a.claims.map((c) => byId.get(c.id)?.sources.find((x) => x.id === q.source)).find(Boolean);
    if (!statementIds.has(q.source) || !st)
      add('quote', 'blocking', `the quotation names source ${q.source}, which is not among the assertion's evidence`);
    else if (!norm(st.quote).includes(norm(q.text)))
      add('misquote', 'blocking', `"${q.text}" is not in the recorded quote from ${q.source}: "${st.quote}"`);
    // Speaker attribution: the person the narration names must be in the transcript window the package persisted
    // around the quote, or in the source's title or channel. Never taken on trust. A source may be quoted on several
    // claims; the statement (and its context) is the one on the claim cited.
    const claimIds = a.claims.filter((c) => byId.get(c.id)?.sources.some((x) => x.id === q.source)).map((c) => c.id);
    const packaged =
      pkg?.claims
        .filter((c) => claimIds.includes(c.id))
        .flatMap((c) => c.statements)
        .find((x) => x.source === q.source)?.context ?? null;
    const context = packaged && !packaged.startsWith('(quote not located)') ? packaged : null; // an unlocated window is not evidence
    const named = st ? `${st.title}\n${st.channel}` : '';
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
    else if (!mentions(s.text, q.speaker))
      add('speaker-unverified', 'blocking', `speaker "${q.speaker}" is not named in the sentence`, {
        suggestion: 'quote.speaker is who the narration says spoke; use those words.',
      });
    else if (mentions(named, q.speaker) || (context !== null && mentions(context, q.speaker))) {
      /* verified */
    } else
      add(
        'speaker-unverified',
        'blocking',
        context === null
          ? `speaker "${q.speaker}" is not the source title or channel and there is no located transcript context in the evidence package`
          : `speaker "${q.speaker}" is not in the transcript context around the quote, the source title or the channel`,
        { suggestion: 'Name the speaker as the transcript does, or attribute the words to the source itself.' },
      );
  } else add('quote', 'blocking', 'a quotation needs a cite or a source');
  if (!norm(s.text).includes(norm(q.text))) add('quote', 'blocking', 'the quoted words are not in the sentence');
}

/** One assertion through the evidence gate, plus its calculation, attribution figures and quotation. */
function checkAssertion(a: ScriptAssertion, s: ScriptSentence, ctx: AssertionContext): AssertionResult {
  const own: Issue[] = [];
  const add = (category: string, severity: Severity, explanation: string, extra: Partial<Issue> = {}) =>
    own.push(issue(s.id, category, severity, explanation, { assertion: a.id, ...extra }));
  const cites = new Set(a.evidence.filter(isStudyRef).map((r) => r.cite));
  const statementIds = new Set(
    a.evidence
      .filter((r): r is { kind: 'statement'; claim: string; source: string } => r.kind === 'statement')
      .map((r) => r.source),
  );
  let derived: string[] = [];
  if (a.calc) {
    const c = checkCalc(a.calc, a.text, cites, ctx.read);
    if (c.bad.length)
      add('bad-arithmetic', 'blocking', c.bad.join('; '), { suggestion: 'Fix the inputs or drop the figure.' });
    derived = c.derived;
  }
  const v = validate(
    { id: a.id, text: a.text, kind: a.kind, claims: a.claims, evidence: a.evidence, derived },
    ctx.corpus,
    ctx.read,
    ctx.judgments,
  );
  for (const p of v.problems) add('bad-reference', 'blocking', p);
  // A Short asserts only the finding it extracts: its package holds those claims and no other.
  if (ctx.pkg?.short)
    for (const c of a.claims)
      if (!ctx.pkg.claims.some((x) => x.id === c.id))
        add('scope', 'blocking', `claim ${c.id} is not in the Short's package; a Short asserts only its own finding`, {
          suggestion: 'Drop the claim, or have the shorts review widen the candidate.',
        });
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
    // In a Short the viewer never hears the rest of the video: the limitation must be placed on a sentence of the
    // Short itself, or the assertion blocks (a video leaves the warning to the reviewer).
    const placed = (a.qualifications ?? []).some((q) => [...q.matchAll(/\bs\d+\b/g)].some((m) => ctx.ids.has(m[0])));
    add(
      'needs-qualification',
      ctx.pkg?.short && !placed ? 'blocking' : 'warning',
      [...why, ...(universal ? [universal] : []), ...v.suggestions].join(' '),
      {
        suggestion: a.qualifications?.length
          ? `The writer says the narration carries it: ${a.qualifications.join(' ')}`
          : 'Say where the narration carries this limitation (qualifications), or narrow the sentence.',
      },
    );
  } else if (v.review)
    add('wording', 'info', 'Wording differs from the canonical claim; the reviewer confirms the passages entail it.');
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
  if (a.quote) quoteIssues(a, a.quote, s, cites, statementIds, ctx, add);
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
}

/** The review applied to one sentence: its open findings, the dispositions that retire warnings at this exact
 *  fingerprint, the approval, and the resulting statuses. */
function judgeSentence(
  s: ScriptSentence,
  issues: Issue[],
  ar: AssertionResult[],
  m: ReviewMerge,
  review: ScriptReviewFile | null,
): SentenceResult {
  const fp = m.prints.get(s.id)!;
  issues.push(...m.open.filter((f) => f.sentence === s.id).map<Issue>((f) => ({ ...f, by: 'review' })));
  // A reviewer may retire a deterministic warning (never a blocking issue) at this exact fingerprint.
  for (const i of [...issues, ...ar.flatMap((a) => a.issues)]) {
    const d = [review?.dispositions?.[i.assertion ?? s.id] ?? []].flat().find((x) => x.category === i.category);
    if (m.current && i.by === 'deterministic' && i.severity === 'warning' && d && d.fingerprint === fp)
      i.disposition = d.reason;
  }
  const approved = m.current && review!.approved?.[s.id] === fp;
  const blocking = [...issues, ...ar.flatMap((a) => a.issues)].some((x) => x.severity === 'blocking');
  for (const a of ar) if (a.status !== 'blocked') a.status = approved && !blocking ? 'verified' : 'needs-review';
  // Every sentence needs the reviewer: a hypothetical or a transition can smuggle a fact the code cannot see.
  return {
    id: s.id,
    section: s.section,
    text: s.text,
    type: s.type,
    fingerprint: fp,
    words: words(s.text),
    status: blocking ? 'blocked' : approved ? 'verified' : 'needs-review',
    approved,
    assertions: ar,
    issues,
  };
}

export function validateScript(
  script: Script,
  t: Corpus,
  read: PassageReader,
  {
    review = null,
    judgments = {},
    previous = null,
    pkg = null,
    hashDoc = docHasher(),
    pacing: paceIt = true,
  }: ValidateOptions = {},
): ScriptValidation {
  const wpm = script.generation?.wordsPerMinute || WPM_DEFAULT;
  const all = sentences(script);
  const ctx: AssertionContext = {
    read,
    corpus: { name: t.name, claims: t.claims, sameStudy: t.sameStudy ?? {} },
    judgments,
    byId: new Map<string, CorpusClaim>(t.claims.map((c) => [c.id, c])),
    pkg,
    ids: new Set(all.map((s) => s.id)),
  };
  const top = scriptIssues(script, all, pkg, hashDoc);
  const merge = mergeReview(script, all, review, pkg, previous);
  top.push(...merge.issues);
  const paced = paceIt ? pacing(all, wpm) : new Map<string, Issue[]>();
  const results = all.map((s) =>
    judgeSentence(
      s,
      [...sentenceIssues(s), ...(paced.get(s.id) ?? [])],
      (s.assertions ?? []).map((a) => checkAssertion(a, s, ctx)),
      merge,
      review,
    ),
  );
  // Runtime is reported, never targeted: a script is as long as its story needs (scripts/briefs/script.md).
  const w = results.reduce((n, s) => n + s.words, 0);
  const sw = results.reduce((n, s) => n + spokenWords(s.text), 0);
  const mins = minutes(sw, wpm);
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
    { revision: script.revision, date, status, blocking, warnings },
  ];
  return {
    topic: script.topic,
    story: script.story,
    revision: script.revision,
    date,
    status,
    scriptFingerprint: scriptFingerprint(script),
    packageFingerprint: pkg?.fingerprint ?? null,
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
    revisionLimitReached:
      status === 'blocked' &&
      revisionsInPass(script) >= MAX_REVISIONS &&
      !script.generation.corrective?.some((c) => c.revision === script.revision),
    sentences: results,
    issues,
    resolved: merge.resolved,
    history,
  };
}
