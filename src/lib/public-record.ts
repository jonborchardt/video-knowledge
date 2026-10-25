// The public record of an inquiry (plan D5, D7): `topics/<topic>/public-record.json`, written only by `npm run report`
// and `npm run article -- correct`. Exhibit numbers are assigned once and never renumber (a removed source keeps its
// number as a gap); revisions are append-only, one per public change of a claim's label or verdict or per correction
// of a released article, each explained by a person's note.
import { join } from 'node:path';
import { findingLabel, FINDING_LABELS, type FindingLabel } from './finding-label';
import { readJson, ROOT, topicDir } from './io';
import type { Topic, Verdict } from './topics';

export const PUBLIC_RECORD_FILE = 'public-record.json';

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
    };
export type ClaimRevision = Extract<Revision, { kind: 'claim' }>;
export const isClaimRevision = (r: Revision): r is ClaimRevision => r.kind === 'claim';
export interface PublicRecord {
  exhibits: Record<string, number>;
  revisions: Revision[];
}

export const publicRecordPath = (topic: string, root = ROOT) => join(topicDir(topic, root), PUBLIC_RECORD_FILE);

export const loadPublicRecord = (topic: string, root = ROOT): PublicRecord =>
  readJson<PublicRecord>(publicRecordPath(topic, root)) ?? { exhibits: {}, revisions: [] };

export const claimStates = (t: Pick<Topic, 'claims'>): Record<string, ClaimState> =>
  Object.fromEntries(t.claims.map((c) => [c.id, { label: findingLabel(c), verdict: c.verdict }]));

const same = (a: ClaimState | null, b: ClaimState | null) => a?.label === b?.label && a?.verdict === b?.verdict;

/** The record after a report run. `before` is the claims' states from the previous report, null to seed (exhibit
 *  numbers only). A claim new to the report is not a revision; one that left it is (`to: null`). */
export function nextPublicRecord(
  prev: PublicRecord,
  before: Record<string, ClaimState> | null,
  after: Pick<Topic, 'claims' | 'sources'>,
  today: string,
): PublicRecord {
  const exhibits = { ...prev.exhibits };
  let n = Math.max(0, ...Object.values(exhibits));
  for (const id of after.sources.map((s) => s.id).sort()) exhibits[id] ??= ++n;
  const revisions = [...prev.revisions];
  if (before) {
    const now = claimStates(after);
    for (const id of [...new Set([...Object.keys(before), ...Object.keys(now)])].sort()) {
      const from = before[id] ?? null;
      const to = now[id] ?? null;
      if (from && !same(from, to)) revisions.push({ at: today, kind: 'claim', id, from, to, note: '' });
    }
  }
  return { exhibits, revisions };
}

const isState = (x: unknown) =>
  x === null ||
  (typeof x === 'object' &&
    FINDING_LABELS.includes((x as ClaimState).label) &&
    ((x as ClaimState).verdict === null || typeof (x as ClaimState).verdict === 'string'));

export function publicRecordProblems(x: unknown): string[] {
  const r = x as PublicRecord;
  if (!r || typeof r !== 'object' || typeof r.exhibits !== 'object' || !Array.isArray(r.revisions))
    return ['not a public record: { exhibits, revisions }'];
  const out: string[] = [];
  const seen = new Map<number, string>();
  for (const [id, n] of Object.entries(r.exhibits)) {
    if (!Number.isInteger(n) || n < 1) out.push(`exhibit ${id}: ${n} is not a positive whole number`);
    else if (seen.has(n)) out.push(`exhibit ${id}: number ${n} is also ${seen.get(n)}'s`);
    else seen.set(n, id);
  }
  r.revisions.forEach((v, i) => {
    const shape =
      v?.kind === 'claim'
        ? isState(v.from) && isState(v.to)
        : v?.kind === 'article' &&
          v.from === null &&
          v.to === null &&
          Array.isArray(v.sentences) &&
          v.sentences.length > 0 &&
          v.sentences.every((x) => typeof x === 'string' && x);
    if (typeof v?.at !== 'string' || !v.at || typeof v.id !== 'string' || !shape) out.push(`revision ${i}: malformed`);
    else if (!v.note?.trim()) out.push(`revision ${i} (${v.id}, ${v.at}): no note`);
  });
  return out;
}

/** Fills the note of the latest unexplained revision of `id`. */
export function noteRevision(rec: PublicRecord, id: string, note: string): PublicRecord {
  const i = rec.revisions.findLastIndex((v) => v.kind === 'claim' && v.id === id && !v.note.trim());
  if (i < 0) throw new Error(`no unexplained revision of ${id}`);
  return { ...rec, revisions: rec.revisions.map((v, j) => (j === i ? { ...v, note } : v)) };
}

/** The record with an article correction appended, unless the same one is already there (a re-run of correct after
 *  its release write failed). */
export const withArticleRevision = (rec: PublicRecord, r: Extract<Revision, { kind: 'article' }>): PublicRecord =>
  rec.revisions.some(
    (x) =>
      x.kind === 'article' &&
      x.id === r.id &&
      x.at === r.at &&
      x.note === r.note &&
      JSON.stringify(x.sentences) === JSON.stringify(r.sentences),
  )
    ? rec
    : { ...rec, revisions: [...rec.revisions, r] };

export const revisionLine = (r: Revision) => `Revised ${r.at}: ${r.note}`;
