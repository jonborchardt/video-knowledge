// One run per story: a lock file with the owner's pid and a heartbeat. Live while the pid is alive (whatever the
// heartbeat age: a render can go quiet for an hour); a dead owner's lock is taken over and the caller journals it.
import { closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, scriptDirs, writeJsonAtomic } from '../../shared/io';

const LOCK = 'lock.json';
const RUN_DIR = 'run';

export interface Lock {
  runId: string;
  pid: number;
  host: string;
  startedAt: string;
  heartbeatAt: string;
  command: string;
  /** The child or agent running now, so a takeover can kill it (Windows children outlive a killed parent). */
  childPid?: number;
  childStep?: string;
  /** When the child or agent running now started (the live view's elapsed time). */
  childAt?: string;
}

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const readLock = (dir: string): Lock | null => readJson<Lock>(join(dir, LOCK));

/** Takes the lock for `command`, or reports the live lock that holds it. A lock whose pid is dead is taken over. */
export function acquire(
  dir: string,
  command: string,
  opts: {
    staleMinutes?: number;
    now?: () => number;
    alive?: (pid: number) => boolean;
    pid?: number;
    /** Test hook: runs between the read and the exclusive create. */
    onBeforeWrite?: () => void;
  } = {},
): { lock: Lock; tookOver: Lock | null } | { held: Lock } {
  const alive = opts.alive ?? pidAlive;
  const now = new Date((opts.now ?? Date.now)()).toISOString();
  const path = join(dir, LOCK);
  mkdirSync(dir, { recursive: true });
  // read, then create exclusively (O_EXCL): a lock that appears in between wins, whoever holds it
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = readLock(dir);
    if (current && alive(current.pid)) return { held: current };
    opts.onBeforeWrite?.();
    const lock: Lock = {
      runId: randomUUID().slice(0, 8),
      pid: opts.pid ?? process.pid,
      host: hostname(),
      startedAt: now,
      heartbeatAt: now,
      command,
    };
    if (current) {
      try {
        unlinkSync(path); // the dead owner's file
      } catch {
        /* gone already */
      }
    }
    try {
      const fd = openSync(path, 'wx');
      writeSync(fd, JSON.stringify(lock, null, 1) + '\n');
      closeSync(fd);
      return { lock, tookOver: current };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      // someone else created it between our read and our write: read again
    }
  }
  const held = readLock(dir);
  if (held) return { held };
  throw new Error(`could not take the lock in ${dir}`);
}

/** Records the child or agent that runs now (only the owner may). */
export function setChild(dir: string, lock: Lock, childPid: number | null, childStep?: string): void {
  const current = readLock(dir);
  if (current?.runId !== lock.runId) return;
  writeJsonAtomic(join(dir, LOCK), {
    ...current,
    childPid: childPid ?? undefined,
    childStep: childPid === null ? undefined : (childStep ?? current.childStep),
    childAt: childPid === null ? undefined : (current.childAt ?? new Date().toISOString()),
  });
}

export function heartbeat(dir: string, lock: Lock, now: () => number = Date.now): void {
  const current = readLock(dir);
  if (current?.runId !== lock.runId) return;
  writeJsonAtomic(join(dir, LOCK), { ...current, heartbeatAt: new Date(now()).toISOString() });
}

/** Every story folder under `root` whose lock belongs to a live process, as `<topic>/<slug>` dir paths. */
export function aliveLocks(root: string, alive: (pid: number) => boolean = pidAlive): string[] {
  return scriptDirs(root)
    .map((d) => join(d.dir, RUN_DIR))
    .filter((dir) => {
      const l = readLock(dir);
      return l !== null && alive(l.pid);
    });
}

/** Only the owner removes its lock. */
export function release(dir: string, lock: Lock): void {
  const p = join(dir, LOCK);
  if (existsSync(p) && readLock(dir)?.runId === lock.runId) unlinkSync(p);
}
