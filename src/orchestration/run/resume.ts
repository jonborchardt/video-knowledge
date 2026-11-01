// Resume policy and stuck detection (spec §4.4 steps 6 and 7, §10): the tick decides which halted stories are due to
// run again (a retryable halt by backoff; any other once the board's answer moved, because a person acted; a budget
// halt when the ISO week rolled) and which running locks are stuck. Pure over the files; the work plane runs what is due.
import type { Automation } from '../../shared/automation';
import { ROOT } from '../../shared/io';
import { boardNext } from '../production';
import { type Halt, readJournal, writeHalt } from './journal';
import { readLock, release } from './lock';
import { alive as pidAlive, killTree } from './proc';
import { type DueResume, isoWeek } from './schedule';
import { type StatusRow, statusOf } from './status';

const RETRYABLE_ERROR = /No audio was received|truncated|ECONN|ETIMEDOUT|Session closed|bringToFront/;

/** A halt the tick may clear on its own, by backoff: a hung step, a stale lock, a step that failed on a transient. */
export function retryable(h: Pick<Halt, 'kind' | 'why'>): boolean {
  if (h.kind === 'timeout' || h.kind === 'lock-stale') return true;
  return h.kind === 'step-failed' && RETRYABLE_ERROR.test(h.why);
}

/** How many times the halted story was resumed since its halt was written. */
const resumesSince = (dir: string, h: Halt): number =>
  readJournal(dir).filter((e) => e.kind === 'resume' && e.at >= h.at).length;

export interface ResumeDeps {
  now?: () => number;
  ask?: (topic: string, storyId: string, root: string) => { stage: string; next: string };
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
  for (const r of rows) {
    if (r.state !== 'halted' || !r.halt) continue;
    const h = r.halt;
    if (retryable(h)) {
      const attempt = resumesSince(r.dir, h);
      const backoff = a.runs.retryBackoffMinutes;
      if (attempt >= backoff.length) {
        writeHalt(r.dir, {
          ...h,
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
  ask?: (topic: string, storyId: string, root: string) => { stage: string; next: string };
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
      if (silent >= limit && lock) {
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
