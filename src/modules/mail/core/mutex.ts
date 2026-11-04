// The prepared-directory lock. The lock is `<lockDir>/held/`, a directory that only ever comes into existence by the
// rename of a directory the acquirer prepared with its own marker `owner.<pid>.<token>` inside.
// What this relies on, and what establishes it (see ../README.md, "The lock's evidence"): among processes racing to
// rename their prepared directories onto one absent target, exactly one wins and its marker is the one left there
// (measured by tests/primitives-experiment.ts); a rename never replaces a non-empty directory and rmdir never removes
// one (tests/mutex.test.ts). Those are observations on the platform named in the README, not guarantees from Node.
// Release unlinks the marker and removes the empty directory. Recovery unlinks only a marker whose pid is dead (its
// own unique name: a live owner's marker is never touched) and removes `held/` only when it is empty, which a live
// owner's never is. So no live owner is displaced, two recoverers of one dead owner cannot both acquire (the rename
// decides), and there is no shared token to initialise. Age never decides anything: a live owner keeps its lock
// however long it stalls; waiters time out and say who holds it. Each holder asserts the invariant (held/ holds its
// marker alone) before running fn.
// ponytail: pid reuse (a dead owner's pid handed to an unrelated live process) strands held/ until a person deletes
// it; the timeout error names it.
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pidAlive, sleepSync } from './io';

const HELD = 'held';
const OWNER = /^owner\.(\d+)\.([0-9a-f-]+)$/;
const code = (e: unknown) => (e as NodeJS.ErrnoException).code;
const TRANSIENT = ['EPERM', 'EBUSY', 'EACCES'];
const ignore = (fn: () => void, codes: string[]) => {
  try {
    fn();
  } catch (e) {
    if (!codes.includes(code(e) ?? '')) throw e;
  }
};

export interface MutexOpts {
  timeoutMs?: number;
  alive?: (pid: number) => boolean;
  pid?: number;
}

/** Runs `fn` holding the lock under `lockDir` (created on first use). `fn` is synchronous: no await inside, and no
 *  network call. Throws after `timeoutMs` (10 s) naming the holder. */
export function withMutex<T>(lockDir: string, fn: () => T, opts: MutexOpts = {}): T {
  const alive = opts.alive ?? pidAlive;
  const pid = opts.pid ?? process.pid;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  mkdirSync(lockDir, { recursive: true });
  const held = join(lockDir, HELD);
  const mine = `owner.${pid}.${randomUUID()}`;
  const tmp = mkdtempSync(join(lockDir, '.acq-'));
  writeFileSync(join(tmp, mine), '');
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      try {
        renameSync(tmp, held);
        break; // ours: held/ came into being with our marker inside
      } catch (e) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(code(e) ?? '')) throw e;
      }
      let owners: string[];
      try {
        owners = readdirSync(held).filter((n) => OWNER.test(n));
      } catch (e) {
        if (code(e) === 'ENOENT') continue; // released in between: try again at once
        if (!TRANSIENT.includes(code(e) ?? '')) throw e;
        // Windows answers EPERM while a directory is being deleted: contended, not broken
        if (Date.now() > deadline)
          throw new Error(`mail state locked (${held}): ${(e as Error).message}`, { cause: e });
        sleepSync(20);
        continue;
      }
      for (const o of owners)
        if (!alive(Number(OWNER.exec(o)![1]))) ignore(() => unlinkSync(join(held, o)), ['ENOENT']);
      // empty (a crashed release, or a dead owner's marker just removed): remove it; fails if it is live and non-empty
      if (owners.length === 0 || owners.some((o) => !alive(Number(OWNER.exec(o)![1]))))
        ignore(() => rmdirSync(held), ['ENOENT', 'ENOTEMPTY', 'EPERM', 'EBUSY']);
      if (Date.now() > deadline) {
        const o = owners[0];
        let since = '?';
        ignore(() => {
          if (o) since = statSync(join(held, o)).mtime.toISOString();
        }, ['ENOENT', ...TRANSIENT]);
        throw new Error(
          `mail state locked by pid ${o ? OWNER.exec(o)![1] : '?'} since ${since} (${held}); if that pid is not a repo process, delete the held folder`,
        );
      }
      sleepSync(20);
    }
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  try {
    const names = listHeld(held);
    if (names.length !== 1 || names[0] !== mine)
      throw new Error(`mail lock invariant broken in ${held}: ${names.join(', ')}`);
    return fn();
  } finally {
    release(held, mine);
  }
}

/** The holder's own check of the directory, through the same transient refusals. */
function listHeld(held: string): string[] {
  for (let attempt = 1; ; attempt++) {
    try {
      return readdirSync(held);
    } catch (e) {
      if (!TRANSIENT.includes(code(e) ?? '') || attempt >= 50) throw e;
      sleepSync(20);
    }
  }
}

/** The marker must go (a live pid's marker would hold the lock until this process dies): retried through Windows'
 *  transient EPERM/EBUSY. The empty directory may stay: any later acquirer removes an empty held/. */
function release(held: string, mine: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      unlinkSync(join(held, mine));
      break;
    } catch (e) {
      if (code(e) === 'ENOENT') break;
      if (!TRANSIENT.includes(code(e) ?? '') || attempt >= 50) throw e;
      sleepSync(20);
    }
  }
  ignore(() => rmdirSync(held), ['ENOENT', 'ENOTEMPTY', 'EPERM', 'EBUSY']);
}
