// The prepared-directory lock (core/mutex.ts): held/ exists only by the atomic rename of a prepared directory;
// recovery touches only a dead owner's marker; a live owner is never displaced. The cross-process cases spawn real
// processes.
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';
import { withMutex } from '../core/mutex';

const run = promisify(execFile);
const TSX = join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const CHILD = join(ROOT, 'src', 'modules', 'mail', 'tests', 'mutex-child.ts');
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const fresh = () => {
  const d = mkdtempSync(join(tmpdir(), 'vk-mutex-'));
  dirs.push(d);
  return { dir: d, lock: join(d, 'lock'), counter: join(d, 'counter.json') };
};
const child = (args: string[]) =>
  run(process.execPath, [TSX, '--tsconfig', join(ROOT, 'tsconfig.json'), CHILD, ...args], { windowsHide: true }).then(
    () => 0,
    (e: { code?: number; stderr?: string }) => {
      if (e.stderr) console.error(e.stderr);
      return e.code ?? 1;
    },
  );
const count = (p: string) => JSON.parse(readFileSync(p, 'utf8')).n as number;
/** What the lock directory holds besides acquisition temp folders: `held` while someone holds it, nothing after. */
const held = (lock: string) => (existsSync(join(lock, 'held')) ? readdirSync(join(lock, 'held')) : null);
const waitFor = async (p: string, ms = 15_000) => {
  const until = Date.now() + ms;
  while (!existsSync(p)) {
    if (Date.now() > until) throw new Error(`no ${p} within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe('withMutex', () => {
  it('serialises increments across four processes', async () => {
    const { lock, counter } = fresh();
    const codes = await Promise.all([1, 2, 3, 4].map(() => child([lock, counter, '25'])));
    expect(codes).toEqual([0, 0, 0, 0]);
    expect(count(counter)).toBe(100);
    expect(held(lock)).toBeNull();
  });

  it('recovers from a dead holder', async () => {
    const { lock, counter } = fresh();
    expect(await child([lock, counter, '1', '--die-holding'])).toBe(1);
    expect(held(lock)?.some((n) => n.startsWith('owner.'))).toBe(true);
    withMutex(lock, () => writeFileSync(counter, '{"n":7}'));
    expect(count(counter)).toBe(7);
    expect(held(lock)).toBeNull();
  });

  it('a live owner keeps its lock whatever its age', () => {
    const { lock } = fresh();
    mkdirSync(join(lock, 'held'), { recursive: true });
    const marker = `owner.${process.pid}.0123`;
    writeFileSync(join(lock, 'held', marker), '');
    const old = new Date(Date.now() - 10 * 60_000);
    utimesSync(join(lock, 'held', marker), old, old);
    expect(() => withMutex(lock, () => 1, { timeoutMs: 200 })).toThrow(new RegExp(`pid ${process.pid}`));
    expect(held(lock)).toEqual([marker]);
  });

  it('a live child holding the lock makes the parent time out, then the parent acquires', async () => {
    const { dir, lock, counter } = fresh();
    const ready = join(dir, 'ready');
    const done = child([lock, counter, '1', '--hold-ms', '2500', '--ready', ready]);
    await waitFor(ready);
    expect(() => withMutex(lock, () => 1, { timeoutMs: 300 })).toThrow(/locked by pid/);
    expect(await done).toBe(0);
    expect(withMutex(lock, () => 42)).toBe(42);
    expect(count(counter)).toBe(1);
  });

  it('simultaneous recoverers and a live replacement owner never break the single-owner invariant', async () => {
    const { dir, lock, counter } = fresh();
    const violations = join(dir, 'violations.log');
    expect(await child([lock, counter, '1', '--die-holding'])).toBe(1);
    const owner = child([lock, counter, '20', '--hold-ms', '300', '--violations', violations]);
    await new Promise((r) => setTimeout(r, 50));
    const codes = await Promise.all([
      owner,
      ...[1, 2, 3, 4, 5].map(() => child([lock, counter, '20', '--violations', violations])),
    ]);
    expect(codes).toEqual([0, 0, 0, 0, 0, 0]);
    expect(existsSync(violations)).toBe(false);
    expect(count(counter)).toBe(120);
    expect(held(lock)).toBeNull();
  });

  it('an empty held directory (a crashed release) is recovered', () => {
    const { lock } = fresh();
    mkdirSync(join(lock, 'held'), { recursive: true });
    expect(withMutex(lock, () => 'v', { timeoutMs: 1000 })).toBe('v');
    expect(held(lock)).toBeNull();
  });

  it('eight processes starting on a missing lock directory', async () => {
    const { lock, counter } = fresh();
    const codes = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => child([lock, counter, '5'])));
    expect(codes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(count(counter)).toBe(40);
    expect(held(lock)).toBeNull();
  });

  it('releases on a throw inside the section and returns the value otherwise', () => {
    const { lock } = fresh();
    expect(() =>
      withMutex(lock, () => {
        throw new Error('inside');
      }),
    ).toThrow('inside');
    expect(held(lock)).toBeNull();
    expect(withMutex(lock, () => 'v')).toBe('v');
  });
});
