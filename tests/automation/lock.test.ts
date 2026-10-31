import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { acquire, heartbeat, readLock, release, setChild } from '../../src/orchestration/run/lock';

const tmp = mkdtempSync(join(tmpdir(), 'vk-lock-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const dir = (n: string) => join(tmp, n);

describe('story lock', () => {
  it('a second acquire on a live lock is held', () => {
    const d = dir('a');
    const a = acquire(d, 'x', { alive: () => true });
    expect('lock' in a).toBe(true);
    const b = acquire(d, 'y', { alive: () => true });
    expect('held' in b && b.held.command).toBe('x');
  });
  it('a live pid with an old heartbeat is still held (a long render)', () => {
    const d = dir('b');
    acquire(d, 'x', { alive: () => true, now: () => 0 });
    const b = acquire(d, 'y', { alive: () => true, now: () => 60 * 60_000, staleMinutes: 10 });
    expect('held' in b).toBe(true);
  });
  it('a dead pid is taken over, whatever the heartbeat age, and the caller sees whose it was', () => {
    const d = dir('c');
    acquire(d, 'x', { alive: () => true });
    const r = acquire(d, 'y', { alive: () => false });
    expect('tookOver' in r && r.tookOver?.command).toBe('x');
    expect(readLock(d)?.command).toBe('y');
  });
  it('heartbeat moves heartbeatAt and keeps the rest', () => {
    const d = dir('d');
    const a = acquire(d, 'x', { now: () => 1000 });
    if (!('lock' in a)) throw new Error('not acquired');
    heartbeat(d, a.lock, () => 5000);
    expect(readLock(d)?.heartbeatAt).toBe(new Date(5000).toISOString());
    expect(readLock(d)?.runId).toBe(a.lock.runId);
  });
  it('the lock file is created exclusively: a file that appears between the read and the write wins', () => {
    const d = dir('x');
    // a lock written by another process with a live pid, after this process read "no lock"
    let reads = 0;
    const r = acquire(d, 'late', {
      alive: () => true,
      onBeforeWrite: () => {
        if (reads++ === 0)
          writeFileSync(
            join(d, 'lock.json'),
            JSON.stringify({
              runId: 'first',
              pid: process.pid,
              host: 'h',
              startedAt: 'x',
              heartbeatAt: 'x',
              command: 'first',
            }),
          );
      },
    });
    expect('held' in r && r.held.runId).toBe('first');
  });
  it('setChild records the running child and a takeover hands it back to be killed', () => {
    const d = dir('y');
    const a = acquire(d, 'x', { alive: () => true });
    if (!('lock' in a)) throw new Error('not acquired');
    setChild(d, a.lock, 4242, 'agent: storyboard.md');
    expect(readLock(d)?.childPid).toBe(4242);
    expect(readLock(d)?.childStep).toBe('agent: storyboard.md');
    const r = acquire(d, 'y', { alive: () => false });
    expect('tookOver' in r && r.tookOver?.childPid).toBe(4242);
  });
  it('release by another runId is a no-op; the owner removes it', () => {
    const d = dir('e');
    const a = acquire(d, 'x');
    if (!('lock' in a)) throw new Error('not acquired');
    release(d, { ...a.lock, runId: 'someone-else' });
    expect(existsSync(join(d, 'lock.json'))).toBe(true);
    release(d, a.lock);
    expect(existsSync(join(d, 'lock.json'))).toBe(false);
  });
});
