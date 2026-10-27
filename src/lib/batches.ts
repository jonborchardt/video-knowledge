// The two files agents write for the research stage, typed and checked before anything is recorded:
//   extraction batches, h*.json (scripts/briefs/extract.md), recorded by scripts/record.mjs
//   study verdicts, sv_*.json (scripts/briefs/sources.md), recorded by scripts/record-sources.mjs
// The checks are pure and list every problem, so a malformed file stops the run before the first write.
// No imports and only erasable syntax: the .mjs scripts load this file through node's type stripping.

export const VERDICTS = ['right', 'wrong', 'partly', 'untestable', 'unknown'] as const;
export type VerdictValue = (typeof VERDICTS)[number];
export const LEANS = ['pro', 'pro-hype', 'calibrating', 'skeptic', 'neutral'] as const;
export type Lean = (typeof LEANS)[number];

/** An AI guess: [verdict, confidence 0-1 (null for untestable or unknown), note]. */
export type Guess = [VerdictValue, number | null, string];
interface Said {
  s?: 'd'; // the source denies the claim
  q: string; // the source's words
}
/** Reuse an existing claim by slug. */
export interface ReuseClaim extends Said {
  c: string;
}
/** Create a claim, with its AI guess and lean; f forces past the near-duplicate check. */
export interface NewClaim extends Said {
  n: string;
  v: Guess;
  l?: Lean;
  f?: true;
}
/** Reuse a claim created by an `n` in an earlier source, by its exact text. */
export interface CreatedClaim extends Said {
  n2: string;
}
export type BatchAssertion = ReuseClaim | NewClaim | CreatedClaim;
export interface ExtractionBatch {
  video: string;
  sum?: string;
  as: BatchAssertion[];
}
/** How far a study verdict's passage reaches its claim. contextual is listed but never decides any sentence. */
export const APPLICABILITY = ['direct', 'partial', 'contextual'] as const;
export type ApplicabilityLevel = (typeof APPLICABILITY)[number];
/** One entry of topics/<topic>/applicability.json, keyed applicabilityKey(claim, cite); written only by record-sources. */
export interface RecordedApplicability {
  level: ApplicabilityLevel;
  reason: string;
}
export const applicabilityKey = (claim: string, cite: string) => `${claim}|${cite}`;
export interface StudyVerdict {
  claim: string; // <topic>/<slug>
  verdict: VerdictValue;
  confidence?: number | null;
  note: string;
  source: string; // <topic>/sources/<file>.txt#L<start>-L<end>
  applicability: ApplicabilityLevel;
  why?: string; // one line, required unless direct
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const isVerdict = (x: unknown): x is VerdictValue => (VERDICTS as readonly unknown[]).includes(x);
/** right, wrong and partly need a confidence in [0, 1]; untestable and unknown take null (or none). */
function confidenceProblem(verdict: VerdictValue, c: unknown): string | null {
  const graded = verdict === 'right' || verdict === 'wrong' || verdict === 'partly';
  if (c === null || c === undefined) return graded ? `${verdict} needs a confidence` : null;
  if (typeof c !== 'number' || c < 0 || c > 1) return `confidence ${JSON.stringify(c)} is not a number in [0, 1]`;
  return null;
}

/** Every problem in an extraction batch file. `claims` is the topic's claims now (id and text); a `c` slug must be one
 *  of them, and an `n2` must be one of their texts or the text of an `n` in an earlier batch. */
export function checkBatches(x: unknown, topic: string, claims: { id: string; text: string }[]): string[] {
  if (!Array.isArray(x)) return ['the file is not a JSON array of batches'];
  const ids = new Set(claims.map((c) => c.id));
  const texts = new Set(claims.map((c) => c.text));
  const full = (slug: string) => (slug.includes('/') ? slug : `${topic}/${slug}`);
  const out: string[] = [];
  x.forEach((b: unknown, i) => {
    const where = isObj(b) && isText(b.video) ? b.video : `batch ${i}`;
    if (!isObj(b)) return void out.push(`${where}: not an object`);
    if (!isText(b.video)) out.push(`${where}: no "video" id`);
    if (b.sum !== undefined && typeof b.sum !== 'string') out.push(`${where}: "sum" is not a string`);
    if (!Array.isArray(b.as)) return void out.push(`${where}: no "as" array`);
    const created: string[] = [];
    b.as.forEach((a: unknown, j) => {
      const at = `${where} as[${j}]`;
      if (!isObj(a)) return void out.push(`${at}: not an object`);
      const kinds = (['c', 'n', 'n2'] as const).filter((k) => a[k] !== undefined);
      if (kinds.length !== 1) return void out.push(`${at}: needs exactly one of "c", "n", "n2"`);
      if (!isText(a.q)) out.push(`${at}: no quote "q"`);
      if (a.s !== undefined && a.s !== 'd') out.push(`${at}: "s" is ${JSON.stringify(a.s)}; only "d" (denies)`);
      if (kinds[0] === 'c') {
        if (!isText(a.c)) out.push(`${at}: "c" is not a slug`);
        else if (!ids.has(full(a.c))) out.push(`${at}: unknown slug ${a.c}`);
      } else if (kinds[0] === 'n2') {
        if (!isText(a.n2)) out.push(`${at}: "n2" is not claim text`);
        else if (!texts.has(a.n2))
          out.push(`${at}: n2 matches no existing claim and no "n" in an earlier batch: ${a.n2}`);
      } else {
        if (!isText(a.n)) return void out.push(`${at}: "n" is not claim text`);
        created.push(a.n);
        const v = a.v;
        if (!Array.isArray(v) || v.length !== 3)
          out.push(`${at}: new claim without "v": [verdict, confidence, note]: ${a.n}`);
        else if (!isVerdict(v[0]))
          out.push(`${at}: verdict ${JSON.stringify(v[0])} is not one of ${VERDICTS.join(', ')}`);
        else {
          const p = confidenceProblem(v[0], v[1]);
          if (p) out.push(`${at}: ${p}`);
          if (!isText(v[2])) out.push(`${at}: the AI guess has no note`);
        }
        if (a.l !== undefined && !(LEANS as readonly unknown[]).includes(a.l)) out.push(`${at}: bad lean "${a.l}"`);
        if (a.f !== undefined && a.f !== true) out.push(`${at}: "f" must be true when present`);
      }
    });
    // Created claims are reusable by n2 from the next batch on (record reads the store before each batch).
    for (const t of created) texts.add(t);
  });
  return out;
}

const CITE = /^[a-z0-9-]+\/sources\/[^#\s]+\.txt#L\d+(-L\d+)?$/i;
/** Every problem in a study verdict file. */
export function checkStudyVerdicts(x: unknown): string[] {
  if (!Array.isArray(x)) return ['the file is not a JSON array of verdicts'];
  const out: string[] = [];
  x.forEach((v: unknown, i) => {
    const at = isObj(v) && isText(v.claim) ? `[${i}] ${v.claim}` : `[${i}]`;
    if (!isObj(v)) return void out.push(`${at}: not an object`);
    if (!isText(v.claim) || !v.claim.includes('/')) out.push(`${at}: "claim" is not <topic>/<slug>`);
    if (!isVerdict(v.verdict))
      out.push(`${at}: verdict ${JSON.stringify(v.verdict)} is not one of ${VERDICTS.join(', ')}`);
    else {
      const p = confidenceProblem(v.verdict, v.confidence);
      if (p) out.push(`${at}: ${p}`);
    }
    if (!isText(v.note)) out.push(`${at}: no "note"`);
    if (!isText(v.source) || !CITE.test(v.source))
      out.push(`${at}: "source" is not <topic>/sources/<file>.txt#L<a>-L<b>`);
    if (!isLevel(v.applicability))
      out.push(`${at}: applicability ${JSON.stringify(v.applicability)} is not one of ${APPLICABILITY.join(', ')}`);
    else if (v.applicability !== 'direct' && !isText(v.why)) out.push(`${at}: ${v.applicability} needs a "why"`);
  });
  return out;
}

const isLevel = (x: unknown): x is ApplicabilityLevel => (APPLICABILITY as readonly unknown[]).includes(x);
/** Every problem in topics/<topic>/applicability.json. */
export function checkApplicabilityFile(x: unknown): string[] {
  if (!isObj(x)) return ['applicability.json is not an object'];
  const out: string[] = [];
  for (const [k, e] of Object.entries(x)) {
    const i = k.lastIndexOf('|');
    if (i < 0 || !k.slice(0, i).includes('/') || !CITE.test(k.slice(i + 1))) {
      out.push(`${k}: key is not <claim>|<cite>`);
      continue;
    }
    const level = isObj(e) ? e.level : undefined;
    if (!isLevel(level)) out.push(`${k}: level ${JSON.stringify(level)} is not one of ${APPLICABILITY.join(', ')}`);
    if (!isObj(e) || !isText(e.reason)) out.push(`${k}: no reason`);
  }
  return out;
}

/** applicability.json with these verdicts' levels merged in (a later entry for the same claim and cite wins), keys sorted. */
export function withApplicability(
  existing: Record<string, RecordedApplicability>,
  verdicts: StudyVerdict[],
): Record<string, RecordedApplicability> {
  const all: Record<string, RecordedApplicability> = { ...existing };
  for (const v of verdicts)
    all[applicabilityKey(v.claim, v.source)] = {
      level: v.applicability,
      reason: v.why?.trim() || 'recorded as direct with the verdict',
    };
  return Object.fromEntries(
    Object.keys(all)
      .sort()
      .map((k) => [k, all[k]]),
  );
}

/** True when the store already holds this exact study verdict (so re-recording it changes only its applicability). */
export function isStored(
  x: StudyVerdict,
  stored: {
    method?: string;
    source?: string;
    verdict: string;
    confidence?: number | null;
    note?: string;
    date?: string;
  }[],
): boolean {
  // Only the current record on that document counts (newest by date, the later one on a tie): re-recording a
  // superseded verdict restores it, so it must reach the watcher.
  const doc = (s?: string) => (s ?? '').split('#')[0];
  let r: (typeof stored)[number] | undefined;
  for (const s of stored)
    if (s.method === 'source' && doc(s.source) === doc(x.source) && (!r || (s.date ?? '') >= (r.date ?? ''))) r = s;
  return (
    !!r &&
    r.source === x.source &&
    r.verdict === x.verdict &&
    r.note === x.note &&
    (r.confidence ?? null) === (x.confidence ?? null)
  );
}
