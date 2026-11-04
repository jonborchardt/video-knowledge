// The core's file helpers: copies of the few things it needs from src/shared/io.ts, because core/ imports nothing
// outside itself (the self-contained rule in tests/boundaries.json) so it can be copied into another project whole.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

export const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);
export const toJson = (x: unknown): string => JSON.stringify(x, null, 1) + '\n';
export const sha = (s: string | Buffer): string => createHash('sha1').update(s).digest('hex');
export const sleepSync = (ms: number): void => {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
/** Whether a process exists: a signal-0 probe; EPERM (another user's process) counts as alive, never as dead. */
export const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const RENAME_RETRIES = 5;
/** `<path>.tmp` then an atomic rename, retried on Windows' EPERM/EBUSY while something holds the target open. */
export function writeJsonAtomic(path: string, value: unknown, retryMs = 100): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, toJson(value));
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(tmp, path);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY') || attempt >= RENAME_RETRIES) {
        try {
          unlinkSync(tmp);
        } catch {
          /* the old file stands */
        }
        throw e;
      }
      sleepSync(retryMs);
    }
  }
}
