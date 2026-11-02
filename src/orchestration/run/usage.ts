// The read side of agent spend (M3 1.2). The attempt (one `claude -p` invocation) is the unit: `attempts()` lists
// every attempt exactly once, from the attempt records of a run folder where they exist, from a journal line's own
// costUsd only when that line has no records (a run before M3, listed with unknown model and tokens), and from the
// discovery record for discovery (it has no journal). A journal line's costUsd is the sum of its attempts and is
// never added to them. Every rollup and every estimate is a sum or a median over `attempts()` and nothing else.
//
// Budget semantics (`agents.budgetUsd` in automation.json): `perAgent` is the limit requested from the CLI per
// invocation (--max-budget-usd) and the reservation the pre-check adds before each agent; the CLI can overshoot it
// (observed), so it is not a ceiling: every overshoot is recorded on its attempt (`overCap`). `perRun`, `perTopic`
// and `perWeek` are the orchestration's conservative checks before each agent, enforced by the runners.
// `.automation/budget.json` is written once per attempt (`addSpend`) and stays the gate; it is shown beside the
// week's rollup with the difference named: a gap means an attempt whose line or record was lost, and `unparsed`
// counts attempts that ended with no parseable result (their real cost is unknown to both). Estimates are
// informational and never gate anything. Nothing here writes.
import { ROOT } from '../../shared/io';
import type { ModelUsage } from './agent';
import { discoveryRecords } from './discovery-state';
import { type AttemptRecord, type JournalEntry, RUN_DIR, readAttempts, readJournal } from './journal';
import { isoWeek, weekSpend } from './runner';
import { runFolders } from './status';
import { roleOf } from './steps';
import { join } from 'node:path';

export interface Attempt {
  /** Unique across every source: `<run folder>#<line>-<round>`, `<run folder>#<line>` or `discovery:<slot>:<who>`. */
  key: string;
  source: 'record' | 'journal' | 'discovery';
  topic: string;
  /** The story id, `research` for a topic run's folder (research and scans), the slot for discovery. */
  storyId: string;
  at: string;
  step: string;
  role: string;
  /** Null when unknown (a line before M3). */
  modelRequested: string | null;
  /** Empty when unknown. One entry per model version; several when the invocation used several models. */
  models: ModelUsage[];
  costUsd: number;
  ms: number | null;
  turns: number | null;
  /** Completed with a result (open records are not finished). */
  finished: boolean;
  /** Finished, exit 0, no error: what an estimate may learn from. Null when unknown (an old line without exit). */
  ok: boolean | null;
  /** The attempt ended without a parseable result (a spawn error, a kill): its real cost is unknown everywhere. */
  unparsed: boolean;
  overCap: boolean | null;
  budgetUsd: number | null;
  line: number | null;
  round: number | null;
  /** The journal line index of the folder's last `finish` before this attempt, or -1: the per-run rollup's boundary. */
  runStart: number;
}

const fromRecord = (r: AttemptRecord, dir: string, topic: string, storyId: string, runStart: number): Attempt => ({
  key: `${dir}#${r.line}-${r.round}`,
  source: 'record',
  topic,
  storyId,
  at: r.at,
  step: r.step,
  role: r.role,
  modelRequested: r.modelRequested,
  models: r.models,
  costUsd: r.costUsd,
  ms: r.finishedAt ? r.ms : null,
  turns: r.turns,
  finished: r.finishedAt !== null,
  ok: r.finishedAt ? r.exit === 0 && !r.isError : null,
  unparsed: r.finishedAt !== null && r.models.length === 0 && r.turns === null && (r.exit !== 0 || r.isError),
  overCap: r.overCap,
  budgetUsd: r.budgetUsd,
  line: r.line,
  round: r.round,
  runStart,
});

const fromLine = (
  e: JournalEntry,
  line: number,
  dir: string,
  topic: string,
  storyId: string,
  runStart: number,
): Attempt => ({
  key: `${dir}#${line}`,
  source: 'journal',
  topic,
  storyId,
  at: e.at,
  step: e.step,
  role: roleOf({ kind: 'prompt', text: e.step }),
  modelRequested: e.modelRequested ?? null,
  models: e.models ?? [],
  costUsd: e.costUsd ?? 0,
  ms: e.ms ?? null,
  turns: e.turns ?? null,
  finished: true,
  ok: e.exit === undefined ? null : e.exit === 0 && !e.error,
  unparsed: /^no result/.test(e.error ?? ''),
  overCap: e.overCap ?? null,
  budgetUsd: null,
  line,
  round: null,
  runStart,
});

/** Every agent attempt under `root`, once each, oldest first within a folder. */
export function attempts(root = ROOT): Attempt[] {
  const out: Attempt[] = [];
  for (const f of runFolders(root)) {
    const dir = join(f.dir, RUN_DIR);
    const journal = readJournal(dir);
    const records = readAttempts(dir);
    const byLine = new Map<number, AttemptRecord[]>();
    for (const r of records) byLine.set(r.line, [...(byLine.get(r.line) ?? []), r]);
    let runStart = -1;
    const finishBefore = (line: number) => {
      // the last finish line strictly before `line` (1-based lines; journal is 0-based)
      let s = -1;
      for (let i = 0; i < Math.min(line - 1, journal.length); i++) if (journal[i].kind === 'finish') s = i;
      return s;
    };
    journal.forEach((e, i) => {
      const line = i + 1;
      if (e.kind === 'finish') runStart = i;
      if (e.kind !== 'prompt') return;
      const recs = byLine.get(line);
      if (recs) {
        for (const r of recs) out.push(fromRecord(r, dir, f.topic, f.storyId, runStart));
        byLine.delete(line);
      } else out.push(fromLine(e, line, dir, f.topic, f.storyId, runStart));
    });
    // orphans: a record whose journal line was never written (a crash before the step journaled) still counts
    for (const [line, recs] of byLine)
      for (const r of recs) out.push(fromRecord(r, dir, f.topic, f.storyId, finishBefore(line)));
  }
  for (const d of discoveryRecords(root))
    for (const [inst, run] of Object.entries(d.institutions)) {
      const one = (who: string, role: string, r: (typeof run.reviews)[string]): Attempt => ({
        key: `discovery:${d.slot}:${who}`,
        source: 'discovery',
        topic: 'proposals',
        storyId: d.slot,
        at: d.startedAt,
        step: `${role} ${who}`,
        role,
        modelRequested: r.modelRequested ?? null,
        models: r.models ?? [],
        costUsd: r.costUsd,
        ms: r.ms ?? null,
        turns: r.turns ?? null,
        finished: true,
        ok: r.ok,
        unparsed: false,
        overCap: null,
        budgetUsd: null,
        line: null,
        round: null,
        runStart: -1,
      });
      if (run.session !== null || run.error) out.push(one(inst, 'discovery', run));
      for (const [slug, rev] of Object.entries(run.reviews)) out.push(one(`${inst}/${slug}`, 'proposalReview', rev));
    }
  return out.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}

export interface WeekRollup {
  /** The sum over attempts() in the week. */
  rolledUpUsd: number;
  /** What `.automation/budget.json` holds (the gate, written once per attempt). */
  budgetUsd: number;
  /** budget minus rollup: a lost line or record when positive. */
  gapUsd: number;
  attempts: number;
  unknownModel: number;
  mixedModel: number;
  unparsed: number;
  overCap: number;
}
export interface Rollups {
  byRun: Record<string, { runUsd: number; totalUsd: number }>;
  byStory: Record<string, { totalUsd: number; attempts: number }>;
  byTopic: Record<string, { totalUsd: number; attempts: number }>;
  weeks: Record<string, WeekRollup>;
}

const add = <T extends Record<string, number>>(m: Record<string, T>, k: string, zero: T, f: (t: T) => void) => {
  const t = (m[k] ??= { ...zero });
  f(t);
};

export function rollups(root = ROOT, all = attempts(root)): Rollups {
  const r: Rollups = { byRun: {}, byStory: {}, byTopic: {}, weeks: {} };
  // per run: the attempts after the folder's last finish line (the current or latest run of that folder)
  const lastFinish = new Map<string, number>();
  for (const a of all) {
    const k = `${a.topic}/${a.storyId}`;
    lastFinish.set(k, Math.max(lastFinish.get(k) ?? -1, a.runStart));
  }
  for (const a of all) {
    const k = `${a.topic}/${a.storyId}`;
    add(r.byStory, k, { totalUsd: 0, attempts: 0 }, (t) => void ((t.totalUsd += a.costUsd), t.attempts++));
    add(r.byTopic, a.topic, { totalUsd: 0, attempts: 0 }, (t) => void ((t.totalUsd += a.costUsd), t.attempts++));
    add(r.byRun, k, { runUsd: 0, totalUsd: 0 }, (t) => {
      t.totalUsd += a.costUsd;
      if (a.runStart >= (lastFinish.get(k) ?? -1)) t.runUsd += a.costUsd;
    });
    const w = isoWeek(new Date(a.at));
    const wk = (r.weeks[w] ??= {
      rolledUpUsd: 0,
      budgetUsd: weekSpend(root, w),
      gapUsd: 0,
      attempts: 0,
      unknownModel: 0,
      mixedModel: 0,
      unparsed: 0,
      overCap: 0,
    });
    wk.rolledUpUsd += a.costUsd;
    wk.attempts++;
    if (a.models.length === 0 && a.finished) wk.unknownModel++;
    if (a.models.length > 1) wk.mixedModel++;
    if (a.unparsed) wk.unparsed++;
    if (a.overCap) wk.overCap++;
  }
  for (const wk of Object.values(r.weeks)) wk.gapUsd = wk.budgetUsd - wk.rolledUpUsd;
  return r;
}

export interface Estimate {
  n: number;
  medianUsd: number;
  p75Usd: number;
  medianMs: number;
}
export const MIN_OBSERVATIONS = 5;

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/** The history of one role on one model version: completed, ok, single-model attempts only (a mixed-model or
 *  unknown-model attempt teaches nothing about one model); null under MIN_OBSERVATIONS ("insufficient history"). */
export function estimate(role: string, model: string, root = ROOT, all = attempts(root)): Estimate | null {
  const obs = all.filter(
    (a) => a.finished && a.ok === true && a.role === role && a.models.length === 1 && a.models[0].model === model,
  );
  if (obs.length < MIN_OBSERVATIONS) return null;
  const usd = obs.map((a) => a.costUsd).sort((x, y) => x - y);
  const ms = obs.map((a) => a.ms ?? 0).sort((x, y) => x - y);
  return { n: obs.length, medianUsd: quantile(usd, 0.5), p75Usd: quantile(usd, 0.75), medianMs: quantile(ms, 0.5) };
}
