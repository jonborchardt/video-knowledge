// Resume policy and stuck detection (phase 1 Task 3): backoff for retryable halts, `retries-spent` past the array,
// a moved board answer for the rest, the next ISO week for a budget halt, and a silent running lock killed and halted.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { scriptDir } from '../../src/shared/io';
import { type Halt, appendJournal, readHalt, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { dueResumes, retryable, stuckRows } from '../../src/orchestration/run/resume';
import { statusOf } from '../../src/orchestration/run/status';

const a = { ...DEFAULTS, runs: { ...DEFAULTS.runs, retryBackoffMinutes: [15, 60, 240], stuckAfterMinutes: 180 } };
const T = 'heat-pumps';
const S = 'decision:a';
const T0 = Date.parse('2026-11-02T10:00:00Z');
const min = (n: number) => n * 60_000;
const halt = (extra: Partial<Halt> = {}): Halt => ({
  kind: 'timeout',
  stage: 'video',
  why: 'render hung',
  unblock: { kind: 'run', text: 'npm run run -- story heat-pumps decision:a' },
  at: new Date(T0).toISOString(),
  runId: 'r1',
  board: { stage: 'video', next: 'npm run video -- spike heat-pumps decision:a' },
  ...extra,
});
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-resume-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  runDir(T, S, root);
  writeFileSync(join(scriptDir(T, S, root), 'script.json'), JSON.stringify({ story: S })); // status names the story from it
  return root;
};
const same = () => ({ stage: 'video', next: 'npm run video -- spike heat-pumps decision:a' });
const rows = (root: string, alive = () => false) => statusOf(root, alive);

describe('retryable', () => {
  it('names the halts the tick may retry on its own', () => {
    expect(retryable({ kind: 'timeout', why: 'x' })).toBe(true);
    expect(retryable({ kind: 'lock-stale', why: 'x' })).toBe(true);
    expect(retryable({ kind: 'step-failed', why: 'edge-tts: No audio was received' })).toBe(true);
    expect(retryable({ kind: 'step-failed', why: 'validation blocked' })).toBe(false);
    for (const kind of [
      'awaiting-person',
      'cap',
      'budget',
      'no-progress',
      'unexpected-edit',
      'forbidden-flag',
      'git',
      'needs-person',
    ] as const)
      expect(retryable({ kind, why: 'ECONNRESET' })).toBe(false);
  });
});

describe('dueResumes', () => {
  it('honours the backoff per attempt and ends in retries-spent', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeHalt(dir, halt());
    const due = (t: number) => dueResumes(a, root, { now: () => t, rows: rows(root), ask: same });
    expect(due(T0 + min(10))).toEqual([]);
    expect(due(T0 + min(15)).map((d) => d.why)).toEqual(['backoff']);
    // the work plane resumed once: the second attempt waits 60 minutes from the halt
    appendJournal(dir, {
      at: new Date(T0 + min(16)).toISOString(),
      runId: 'r2',
      stage: 'video',
      next: '',
      step: 'resume',
      kind: 'resume',
      attempt: 1,
    });
    expect(due(T0 + min(30))).toEqual([]);
    expect(due(T0 + min(60))).toHaveLength(1);
    appendJournal(dir, {
      at: new Date(T0 + min(61)).toISOString(),
      runId: 'r3',
      stage: 'video',
      next: '',
      step: 'resume',
      kind: 'resume',
      attempt: 1,
    });
    expect(due(T0 + min(239))).toEqual([]);
    expect(due(T0 + min(240))).toHaveLength(1);
    appendJournal(dir, {
      at: new Date(T0 + min(241)).toISOString(),
      runId: 'r4',
      stage: 'video',
      next: '',
      step: 'resume',
      kind: 'resume',
      attempt: 1,
    });
    // the fourth attempt is not made: the halt becomes retries-spent, which is not retryable (so it is emailed)
    expect(due(T0 + min(1000))).toEqual([]);
    const h = readHalt(dir)!;
    expect(h.kind).toBe('retries-spent');
    expect(h.why).toMatch(/3 retries/);
    expect(retryable(h)).toBe(false);
  });
  it('an alive lock is never due', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeHalt(dir, halt());
    writeFileSync(
      join(dir, 'lock.json'),
      JSON.stringify({
        runId: 'r',
        pid: 1,
        host: 'h',
        startedAt: new Date(T0).toISOString(),
        heartbeatAt: new Date(T0).toISOString(),
        command: 'c',
      }),
    );
    expect(dueResumes(a, root, { now: () => T0 + min(100), rows: rows(root, () => true), ask: same })).toEqual([]);
  });
  it('a person-only halt is due once the board moved, not before, and reads stuck after the limit', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeHalt(
      dir,
      halt({
        kind: 'awaiting-person',
        why: 'revision limit',
        unblock: { kind: 'decide', text: 'authorise a corrective pass' },
      }),
    );
    const later = T0 + min(200);
    expect(dueResumes(a, root, { now: () => later, rows: rows(root), ask: same })).toEqual([]);
    expect(stuckRows(a, root, { now: () => later, rows: rows(root), ask: same }).stuck.map((r) => r.storyId)).toEqual([
      S,
    ]);
    expect(stuckRows(a, root, { now: () => T0 + min(100), rows: rows(root), ask: same }).stuck).toEqual([]);
    const moved = () => ({ stage: 'script', next: 'npm run script -- validate heat-pumps decision:a' });
    expect(dueResumes(a, root, { now: () => later, rows: rows(root), ask: moved }).map((d) => d.why)).toEqual([
      'moved',
    ]);
    expect(stuckRows(a, root, { now: () => later, rows: rows(root), ask: moved }).stuck).toEqual([]);
  });
  it('a budget halt is due in the next ISO week', () => {
    const root = fresh();
    writeHalt(runDir(T, S, root), halt({ kind: 'budget', why: 'week spent', at: '2026-11-04T10:00:00.000Z' }));
    expect(dueResumes(a, root, { now: () => Date.parse('2026-11-06T10:00:00Z'), rows: rows(root), ask: same })).toEqual(
      [],
    );
    expect(
      dueResumes(a, root, { now: () => Date.parse('2026-11-09T10:00:00Z'), rows: rows(root), ask: same }).map(
        (d) => d.why,
      ),
    ).toEqual(['week-rolled']);
  });
});

describe('stuck locks', () => {
  it('a running lock whose journal went silent past the limit is killed and halted timeout', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeFileSync(
      join(dir, 'lock.json'),
      JSON.stringify({
        runId: 'r9',
        pid: 4242,
        host: 'h',
        startedAt: new Date(T0).toISOString(),
        heartbeatAt: new Date(T0).toISOString(),
        command: 'c',
        childStep: 'npm run video -- spike heat-pumps decision:a',
      }),
    );
    appendJournal(dir, {
      at: new Date(T0).toISOString(),
      runId: 'r9',
      stage: 'video',
      next: 'spike',
      step: 'npm run video -- spike heat-pumps decision:a',
      kind: 'run',
      attempt: 1,
    });
    const killed: number[] = [];
    const deps = { alive: () => true, kill: (pid: number) => void killed.push(pid), ask: same };
    expect(stuckRows(a, root, { ...deps, now: () => T0 + min(100), rows: rows(root, () => true) }).killed).toEqual([]);
    const r = stuckRows(a, root, { ...deps, now: () => T0 + min(181), rows: rows(root, () => true) });
    expect(r.killed.map((x) => x.storyId)).toEqual([S]);
    expect(killed).toEqual([4242]);
    const h = readHalt(dir)!;
    expect(h.kind).toBe('timeout');
    expect(h.why).toMatch(/killed \(pid 4242\)/);
    expect(h.unblock.text).toBe('npm run run -- story heat-pumps decision:a');
  });
});
