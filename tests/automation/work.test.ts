// The work plane (phase 1 Task 4): disabled; the job order; a held lock tries the next job once; two instances on
// the same fixture are separated by the lock; the scheduler text is printed, never run.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { runDir } from '../../src/orchestration/run/journal';
import type { RunResult } from '../../src/orchestration/run/runner';
import { readSchedule, writeSchedule } from '../../src/orchestration/run/schedule';
import { type Job, nextJob, scheduleText, work } from '../../src/orchestration/run/work';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-work-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  return root;
};
const on = { ...DEFAULTS, enabled: { ...DEFAULTS.enabled, work: true } };
const T = 'heat-pumps';
const due = (storyId: string) => ({ topic: T, storyId, why: 'backoff' as const, at: 'x' });
const done = (): RunResult => ({ outcome: 'done', stage: 'packaged', halt: null, iterations: 1, costUsd: 0 });
const held = (): RunResult => ({ outcome: 'held', stage: '', halt: null, iterations: 0, costUsd: 0 });
const pick: Job = { kind: 'pick', topic: T, storyId: 'decision:p', why: 'production pick' };

describe('nextJob', () => {
  it('a due resume beats the pick; the pick when nothing is due; null when idle', () => {
    const root = fresh();
    expect(nextJob(on, root, { pick: () => pick })).toEqual(pick);
    writeSchedule(root, { due: [due('decision:a')] });
    expect(nextJob(on, root, { pick: () => pick })).toMatchObject({ kind: 'resume', storyId: 'decision:a' });
    writeSchedule(root, { due: [] });
    expect(nextJob(on, root, { pick: () => null })).toBeNull();
  });
  it('no story job while the story runs are at the concurrency cap', () => {
    const root = fresh();
    writeSchedule(root, { due: [due('decision:a')] });
    writeFileSync(
      join(runDir(T, 'decision:z', root), 'lock.json'),
      '{"runId":"x","pid":1,"host":"h","startedAt":"s","heartbeatAt":"s","command":"c"}',
    );
    expect(nextJob(on, root, { pick: () => pick, alive: () => true })).toBeNull();
    expect(nextJob(on, root, { pick: () => pick, alive: () => false })?.kind).toBe('resume');
  });
});

describe('work', () => {
  it('is disabled by default and idle with nothing to do', async () => {
    const root = fresh();
    expect((await work(DEFAULTS, root, {})).outcome).toBe('disabled');
    expect((await work(on, root, { pick: () => null })).outcome).toBe('idle');
  });
  it('runs the one due resume, removes it from the due list and records the job', async () => {
    const root = fresh();
    writeSchedule(root, { due: [due('decision:a'), due('decision:b')] });
    const ran: string[] = [];
    const r = await work(on, root, { now: () => 0, runStory: async (_t, s) => (ran.push(s), done()) });
    expect(r.outcome).toBe('done');
    expect(ran).toEqual(['decision:a']);
    expect(readSchedule(root).due).toEqual([due('decision:b')]);
    expect(readSchedule(root).lastWork).toMatchObject({ kind: 'resume', outcome: 'done' });
  });
  it('a held lock on the only due resume tries the next job once, then idles', async () => {
    const root = fresh();
    writeSchedule(root, { due: [due('decision:a')] });
    const ran: string[] = [];
    const r = await work(on, root, { runStory: async (_t, s) => (ran.push(s), held()), pick: () => null });
    expect(r.outcome).toBe('idle');
    expect(ran).toEqual(['decision:a']);
    const r2 = await work(on, root, {
      runStory: async (_t, s) => (ran.push(s), s === 'decision:a' ? held() : done()),
      pick: () => pick,
    });
    expect(r2.outcome).toBe('done');
    expect(r2.job?.kind).toBe('pick');
  });
  it('two instances on the same fixture: the second finds the lock held and ends idle while the first finishes', async () => {
    const root = fresh();
    writeSchedule(root, { due: [due('decision:a')] });
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const lockDir = runDir(T, 'decision:a', root);
    const first = work(on, root, {
      runStory: async () => {
        writeFileSync(
          join(lockDir, 'lock.json'),
          JSON.stringify({ runId: 'x', pid: process.pid, host: 'h', startedAt: 's', heartbeatAt: 's', command: 'c' }),
        );
        await gate;
        return done();
      },
    });
    await new Promise((r) => setTimeout(r, 50));
    const second = await work(on, root, { runStory: async () => held(), pick: () => null });
    expect(second.outcome).toBe('idle');
    release();
    expect((await first).outcome).toBe('done');
  });
  it('prints the two scheduler commands and the power lines, and runs nothing', () => {
    const text = scheduleText({ ...on, clone: 'F:/github/video-knowledge-auto' }, 'F:/x', 'win32');
    expect(text).toContain('schtasks /Create /SC MINUTE /MO 15 /TN "video-knowledge tick"');
    expect(text).toContain('schtasks /Create /SC MINUTE /MO 15 /TN "video-knowledge work"');
    expect(text).toContain('cd /d F:/github/video-knowledge-auto');
    expect(text).toContain('Run a new instance in parallel');
    expect(text).toContain('powercfg /change standby-timeout-ac 0');
    expect(scheduleText(on, 'F:/x', 'linux')).toContain('*/15 * * * * cd F:/x');
  });
});
