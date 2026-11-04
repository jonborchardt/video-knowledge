// A process the mutex tests spawn: increments a JSON counter n times under the lock.
//   mutex-child <lockDir> <counter.json> <n> [--die-holding] [--hold-ms <ms>] [--violations <file>] [--ready <file>]
// --die-holding exits inside the first critical section (a dead holder); --hold-ms sleeps inside the first section (a
// live owner); --ready names a file written once the first section is entered; any error the lock throws (a broken
// invariant included) is appended to --violations and written beside the counter, and the child exits 3.
import { appendFileSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { withMutex } from '../core/mutex';

const [lockDir, counter, nArg, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const n = Number(nArg);
const holdMs = Number(flag('--hold-ms') ?? 0);
const violations = flag('--violations');
const ready = flag('--ready');
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

try {
  for (let i = 0; i < n; i++) {
    withMutex(lockDir, () => {
      if (i === 0 && ready) writeFileSync(ready, String(process.pid));
      if (i === 0 && rest.includes('--die-holding')) process.exit(1);
      if (i === 0 && holdMs) sleep(holdMs);
      let v = 0;
      try {
        v = JSON.parse(readFileSync(counter, 'utf8')).n;
      } catch {
        /* first increment */
      }
      // a deliberate window between read and write, so lost updates would show
      sleep(2);
      writeFileSync(counter, JSON.stringify({ n: v + 1 }));
    });
  }
} catch (e) {
  const msg = `${process.pid}: ${(e as Error).message}`;
  if (violations) appendFileSync(violations, msg + '\n');
  writeFileSync(`${counter}.err.${process.pid}`, `${(e as Error).stack ?? msg}\n`);
  writeSync(2, `mutex-child ${msg}\n`);
  process.exit(3);
}
