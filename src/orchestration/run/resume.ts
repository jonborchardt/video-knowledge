// Resume policy and stuck detection (spec §4.4 steps 6 and 7, §10): the tick decides which halted stories are due to
// run again (a retryable halt by backoff; any other once the board's answer moved, because a person acted; a budget
// halt when the ISO week rolled) and which running locks are stuck. Pure over the files; the work plane runs what is due.
import type { Automation } from '../../shared/automation';
import { ROOT, shortOf } from '../../shared/io';
import { loadLedger, openOutput } from '../../modules/publishing';
import { boardNext, loadDecisions } from '../production';
import { type Halt, appendJournal, clearHalt, readJournal, writeHalt } from './journal';
import { readLock, release } from './lock';
import { alive as pidAlive, killTree } from './proc';
import { type DueResume, isoWeek, updateSchedule } from './schedule';
import { type StatusRow, statusOf } from './status';
import { isFixtureTopic } from '../../config/site';

const RETRYABLE_ERROR = /No audio was received|truncated|ECONN|ETIMEDOUT|Session closed|bringToFront/;

/** A halt the tick may clear on its own, by backoff: a hung step, a stale lock, a step that failed on a transient. */
export function retryable(h: Pick<Halt, 'kind' | 'why'> & { retryable?: boolean }): boolean {
  if (h.kind === 'retries-spent') return false; // the retries are over: a person's, whatever flag the halt carried
  if (h.retryable) return true;
  if (h.kind === 'timeout' || h.kind === 'lock-stale') return true;
  return h.kind === 'step-failed' && RETRYABLE_ERROR.test(h.why);
}

/** How many times the story was resumed into the same kind of halt: every failed resume rewrites the halt with a new
 *  `at`, so the count runs from the last finish, or the last halt of another kind, to now. */
export function resumesSince(dir: string, h: Pick<Halt, 'kind'>): number {
  let n = 0;
  for (const e of readJournal(dir)) {
    if (e.kind === 'finish' || (e.kind === 'halt' && e.step !== h.kind)) n = 0;
    else if (e.kind === 'resume') n++;
  }
  return n;
}

/** When the output this story id names went live, or null when it is not live now: the main output, or a Short's own.
 *  Reads the ledger only, so a story the board cannot read still answers. */
export function publishedAt(topic: string, storyId: string, root = ROOT): string | null {
  const short = shortOf(storyId);
  const parent = short?.parent ?? storyId;
  const ledger = loadLedger(topic, parent, root);
  const output = short ? `short:${short.slug}` : undefined;
  if (!ledger || (output && !ledger.outputs[output])) return null;
  const o = openOutput(topic, parent, { root, ...(output && { output }) });
  return o.state.live ? (o.out.events.findLast((e) => e.type === 'published')?.at ?? null) : null;
}

/** Settles what still asks a person about a release already live: an `awaiting-person` halt older than the output's
 *  publication, on a story the board calls published. The journal keeps the halt whole; its queued resume goes. Any
 *  other halt stays: a needs-person on a live video is a person's. `only` limits it to one story and its Shorts. */
export function settleFinished(
  root = ROOT,
  deps: ResumeDeps & { by: string; only?: { topic: string; storyId: string } },
): string[] {
  const now = deps.now ?? Date.now;
  const ask = deps.ask ?? boardNext;
  const at = new Date(now()).toISOString();
  const settled: string[] = [];
  for (const r of deps.rows ?? statusOf(root, deps.alive)) {
    const h = r.halt;
    if (r.state !== 'halted' || h?.kind !== 'awaiting-person' || isFixtureTopic(r.topic)) continue;
    const { only } = deps;
    if (only && (r.topic !== only.topic || !`${r.storyId}/`.startsWith(`${only.storyId}/`))) continue;
    const live = publishedAt(r.topic, r.storyId, root);
    if (!live || h.at >= live || ask(r.topic, r.storyId, root).halt?.kind !== 'published') continue;
    clearHalt(r.dir);
    appendJournal(r.dir, {
      at,
      runId: 'settle',
      stage: h.stage,
      next: h.board.next,
      step: 'settle',
      kind: 'do',
      attempt: 0,
      error: `settled by ${deps.by}: ${h.kind} from ${h.at}, live since ${live}: ${h.why}`,
    });
    updateSchedule(root, (s) => ({
      ...s,
      due: (s.due ?? []).filter((d) => !(d.topic === r.topic && d.storyId === r.storyId)),
    }));
    settled.push(`${r.topic}/${r.storyId}`);
  }
  return settled;
}

export interface ResumeDeps {
  now?: () => number;
  ask?: (
    topic: string,
    storyId: string,
    root: string,
  ) => { stage: string; next: string; halt?: { kind: string } | null };
  rows?: StatusRow[];
  alive?: (pid: number) => boolean;
}

/** The halted stories due to run again, and the `retries-spent` rewrites the tick makes on the way. */
export function dueResumes(a: Automation, root = ROOT, deps: ResumeDeps = {}): DueResume[] {
  const now = deps.now ?? Date.now;
  const ask = deps.ask ?? boardNext;
  const rows = deps.rows ?? statusOf(root, deps.alive);
  const at = new Date(now()).toISOString();
  const due: DueResume[] = [];
  const decisions = loadDecisions(root);
  for (const r of rows) {
    if (r.state !== 'halted' || !r.halt) continue;
    if (isFixtureTopic(r.topic)) continue; // the fixture is excluded from every automatic selection (spec 5.8)
    if (decisions[`${r.topic}/${r.storyId}`]?.decision === 'parked') continue; // a person said leave it alone
    const h = r.halt;
    if (retryable(h)) {
      const attempt = resumesSince(r.dir, h);
      const backoff = a.runs.retryBackoffMinutes;
      if (attempt >= backoff.length) {
        // written once, without the retryable flag: one halt key, one mail, a date that stays put
        const rest = { ...h };
        delete rest.retryable;
        writeHalt(r.dir, {
          ...rest,
          kind: 'retries-spent',
          why: `${backoff.length} retries did not clear: ${h.why}`,
          unblock: { kind: 'fix', text: `${h.unblock.text} (after reading the step log)` },
          at,
        });
        continue;
      }
      if (now() - Date.parse(h.at) >= backoff[attempt] * 60_000)
        due.push({ topic: r.topic, storyId: r.storyId, why: 'backoff', at });
      continue;
    }
    if (h.kind === 'budget') {
      if (isoWeek(now()) > isoWeek(Date.parse(h.at)))
        due.push({ topic: r.topic, storyId: r.storyId, why: 'week-rolled', at });
      continue;
    }
    const b = ask(r.topic, r.storyId, root);
    if (b.stage !== h.board.stage || b.next !== h.board.next)
      due.push({ topic: r.topic, storyId: r.storyId, why: 'moved', at });
  }
  return due;
}

export interface StuckDeps {
  now?: () => number;
  ask?: (
    topic: string,
    storyId: string,
    root: string,
  ) => { stage: string; next: string; halt?: { kind: string } | null };
  rows?: StatusRow[];
  alive?: (pid: number) => boolean;
  kill?: (pid: number) => void;
}

/** A halt older than `stuckAfterMinutes` that is not retryable and whose board answer has not moved; a running lock
 *  whose journal has been silent that long is killed through its pid and halted `timeout`. Returns what is stuck. */
export function stuckRows(
  a: Automation,
  root = ROOT,
  deps: StuckDeps = {},
): { stuck: StatusRow[]; killed: StatusRow[] } {
  const now = deps.now ?? Date.now;
  const ask = deps.ask ?? boardNext;
  const alive = deps.alive ?? pidAlive;
  const kill = deps.kill ?? killTree;
  const rows = deps.rows ?? statusOf(root, alive);
  const limit = a.runs.stuckAfterMinutes * 60_000;
  const stuck: StatusRow[] = [];
  const killed: StatusRow[] = [];
  for (const r of rows) {
    if (r.state === 'halted' && r.halt && !retryable(r.halt) && now() - Date.parse(r.halt.at) >= limit) {
      const b = ask(r.topic, r.storyId, root);
      if (b.stage === r.halt.board.stage && b.next === r.halt.board.next) stuck.push(r);
    }
    if (r.state === 'running') {
      const last = readJournal(r.dir).at(-1);
      const silent = last ? now() - Date.parse(last.at) : now() - Date.parse(r.since ?? new Date(now()).toISOString());
      const lock = readLock(r.dir);
      // a live runner heartbeats every minute and its own step timeouts outlast stuckAfterMinutes: only a stale
      // heartbeat (the runner frozen or gone) with a silent journal is stuck; an unreadable heartbeat counts as stale
      const beat = lock ? now() - Date.parse(lock.heartbeatAt) : 0;
      const staleBeat = !(beat < a.runs.lockStaleMinutes * 60_000);
      if (silent >= limit && staleBeat && lock) {
        kill(lock.pid);
        release(r.dir, lock); // the dead run's lock: the halt shows at once and the story is free for a resume
        writeHalt(r.dir, {
          kind: 'timeout',
          stage: r.step ?? 'unknown',
          why: `no journal entry for ${Math.round(silent / 60_000)} minutes at ${r.step ?? 'an unknown step'}; the run was killed (pid ${lock.pid})`,
          unblock: { kind: 'run', text: `npm run run -- story ${r.topic} ${r.storyId}` },
          at: new Date(now()).toISOString(),
          runId: lock.runId,
          board: { stage: r.step ?? '', next: '' },
        });
        killed.push(r);
      }
    }
  }
  return { stuck, killed };
}
