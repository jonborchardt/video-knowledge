// Resume policy and stuck detection (phase 1 Task 3): backoff for retryable halts counted across the halts the runner
// rewrites, `retries-spent` past the array, a moved board answer for the rest, the next ISO week for a budget halt,
// a running lock with a stale heartbeat and a silent journal killed and halted, the fixture never due.
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
const entry = (at: number, runId: string, kind: 'resume' | 'halt' | 'finish', step: string = kind) => ({
  at: new Date(at).toISOString(),
  runId,
  stage: 'video',
  next: '',
  step,
  kind,
  attempt: 1,
  ...(kind === 'halt' && { error: 'render hung' }),
});
const lockOf = (pid: number, heartbeatAt: string, childStep = 'render') =>
  JSON.stringify({
    runId: 'r9',
    pid,
    host: 'h',
    startedAt: new Date(T0).toISOString(),
    heartbeatAt,
    command: 'c',
    childStep,
  });

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
  it('honours the backoff per attempt across the halts a failed resume rewrites, and ends in retries-spent', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    appendJournal(dir, entry(T0 - min(1), 'r1', 'halt', 'timeout'));
    writeHalt(dir, halt());
    const due = (t: number) => dueResumes(a, root, { now: () => t, rows: rows(root), ask: same });
    expect(due(T0 + min(10))).toEqual([]);
    expect(due(T0 + min(15)).map((d) => d.why)).toEqual(['backoff']);
    // the work plane resumed once and the step failed again: the runner writes a halt entry and rewrites halt.json
    // with a new `at` (as it does); the attempt count must still grow
    appendJournal(dir, entry(T0 + min(16), 'r2', 'resume'));
    appendJournal(dir, entry(T0 + min(17), 'r2', 'halt', 'timeout'));
    writeHalt(dir, halt({ at: new Date(T0 + min(17)).toISOString(), runId: 'r2' }));
    expect(due(T0 + min(30))).toEqual([]);
    expect(due(T0 + min(17 + 59))).toEqual([]);
    expect(due(T0 + min(17 + 60))).toHaveLength(1);
    appendJournal(dir, entry(T0 + min(78), 'r3', 'resume'));
    appendJournal(dir, entry(T0 + min(79), 'r3', 'halt', 'timeout'));
    writeHalt(dir, halt({ at: new Date(T0 + min(79)).toISOString(), runId: 'r3' }));
    expect(due(T0 + min(79 + 239))).toEqual([]);
    expect(due(T0 + min(79 + 240))).toHaveLength(1);
    appendJournal(dir, entry(T0 + min(320), 'r4', 'resume'));
    appendJournal(dir, entry(T0 + min(321), 'r4', 'halt', 'timeout'));
    writeHalt(dir, halt({ at: new Date(T0 + min(321)).toISOString(), runId: 'r4' }));
    // the fourth attempt is not made: the halt becomes retries-spent, which is not retryable (so it is emailed)
    expect(due(T0 + min(2000))).toEqual([]);
    const h = readHalt(dir)!;
    expect(h.kind).toBe('retries-spent');
    expect(h.why).toMatch(/3 retries/);
    expect(retryable(h)).toBe(false);
  });
  it("a retryable step-failed halt (the release loop's) ends in a retries-spent that is not retryable and keeps its date", () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    const h = halt({ kind: 'step-failed', why: 'youtube: verify failed: 503', retryable: true, stage: 'release' });
    for (let i = 0; i < 3; i++) {
      appendJournal(dir, entry(T0 + min(i * 10), 'r', 'resume'));
      appendJournal(dir, entry(T0 + min(i * 10 + 1), 'r', 'halt', 'step-failed'));
    }
    writeHalt(dir, h);
    const t1 = T0 + min(100);
    expect(dueResumes(a, root, { now: () => t1, rows: rows(root), ask: same })).toEqual([]);
    const spent = readHalt(dir)!;
    expect(spent.kind).toBe('retries-spent');
    expect(spent.retryable).toBeUndefined();
    expect(retryable(spent)).toBe(false); // so notifyHalts emails it, once
    // a later tick leaves it as it is: the same halt, the same date (one halt key, one mail)
    expect(dueResumes(a, root, { now: () => t1 + min(30), rows: rows(root), ask: same })).toEqual([]);
    expect(readHalt(dir)).toEqual(spent);
  });
  it('a finished stage or a halt of another kind resets the count', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    for (let i = 0; i < 3; i++) {
      appendJournal(dir, entry(T0 + min(i * 10), 'r', 'resume'));
      appendJournal(dir, entry(T0 + min(i * 10 + 1), 'r', 'halt', 'timeout'));
    }
    appendJournal(dir, entry(T0 + min(40), 'r', 'halt', 'awaiting-person')); // a person's halt in between
    appendJournal(dir, entry(T0 + min(50), 'r', 'resume'));
    appendJournal(dir, entry(T0 + min(51), 'r', 'halt', 'timeout'));
    writeHalt(dir, halt({ at: new Date(T0 + min(51)).toISOString() }));
    // one attempt since the other halt: the second backoff (60 minutes) applies, not retries-spent
    expect(dueResumes(a, root, { now: () => T0 + min(51 + 59), rows: rows(root), ask: same })).toEqual([]);
    expect(dueResumes(a, root, { now: () => T0 + min(51 + 60), rows: rows(root), ask: same })).toHaveLength(1);
    expect(readHalt(dir)!.kind).toBe('timeout');
  });
  it('an alive lock is never due', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeHalt(dir, halt());
    writeFileSync(join(dir, 'lock.json'), lockOf(1, new Date(T0).toISOString()));
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
  it('the fixture is never due, whatever its halt (it is excluded from every automatic selection)', () => {
    const root = fresh();
    const F = 'test-fixture';
    const id = 'decision:most-discussed-claims';
    const dir = runDir(F, id, root);
    writeFileSync(join(scriptDir(F, id, root), 'script.json'), JSON.stringify({ story: id }));
    writeHalt(dir, halt());
    expect(
      dueResumes(a, root, { now: () => T0 + min(1000), rows: rows(root), ask: () => ({ stage: 'x', next: 'y' }) }),
    ).toEqual([]);
  });
});

describe('stuck locks', () => {
  it('a running lock whose heartbeat went stale and whose journal is silent past the limit is killed and halted timeout', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    appendJournal(dir, {
      ...entry(T0, 'r9', 'resume'),
      kind: 'run',
      step: 'npm run video -- spike heat-pumps decision:a',
    });
    const killed: number[] = [];
    const deps = { alive: () => true, kill: (pid: number) => void killed.push(pid), ask: same };
    // a live runner heartbeats every minute: a silent journal alone (a long render) is never stuck
    writeFileSync(join(dir, 'lock.json'), lockOf(4242, new Date(T0 + min(181) - 30_000).toISOString()));
    expect(stuckRows(a, root, { ...deps, now: () => T0 + min(181), rows: rows(root, () => true) }).killed).toEqual([]);
    expect(killed).toEqual([]);
    // a stale heartbeat but a journal entry within the limit: not yet
    writeFileSync(join(dir, 'lock.json'), lockOf(4242, new Date(T0).toISOString()));
    expect(stuckRows(a, root, { ...deps, now: () => T0 + min(100), rows: rows(root, () => true) }).killed).toEqual([]);
    // both stale: killed, the lock released, halted timeout
    const r = stuckRows(a, root, { ...deps, now: () => T0 + min(181), rows: rows(root, () => true) });
    expect(r.killed.map((x) => x.storyId)).toEqual([S]);
    expect(killed).toEqual([4242]);
    const h = readHalt(dir)!;
    expect(h.kind).toBe('timeout');
    expect(h.why).toMatch(/killed \(pid 4242\)/);
    expect(h.unblock.text).toBe('npm run run -- story heat-pumps decision:a');
  });
});
