// npm run run: usage, and status over a root with a halted run.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../../src/shared/cli';
import { scriptDir } from '../../src/shared/io';
import { type Halt, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { statusOf } from '../../src/orchestration/run/status';

const root = mkdtempSync(join(tmpdir(), 'vk-cli-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
const T = 'heat-pumps';
const S = 'decision:a';
mkdirSync(scriptDir(T, S, root), { recursive: true });
writeFileSync(join(scriptDir(T, S, root), 'script.json'), JSON.stringify({ topic: T, story: S }));
const halt: Halt = {
  kind: 'awaiting-person',
  stage: 'review',
  why: 'watch the draft',
  unblock: { kind: 'decide', text: 'reply OK to the draft email' },
  at: '2026-10-31T10:00:00.000Z',
  runId: 'r1',
  board: { stage: 'review', next: 'watch it' },
};
writeHalt(runDir(T, S, root), halt);
// a second story that halted before its writer ever wrote script.json (a budget halt at `package`), and a Short's run
const EARLY = 'decision:never-started';
writeHalt(runDir(T, EARLY, root), { ...halt, kind: 'budget', why: 'week spent', stage: 'package' });
writeHalt(runDir(T, `${S}/shorts/one`, root), { ...halt, kind: 'timeout', why: 'render hung', stage: 'video' });

describe('npm run run', () => {
  it('status lists a run that halted before script.json existed, and a Short’s run', () => {
    const rows = statusOf(root);
    expect(rows.map((r) => r.storyId).sort()).toEqual([S, `${S}/shorts/one`, 'decision-never-started'].sort());
    expect(rows.find((r) => r.storyId === 'decision-never-started')?.halt?.kind).toBe('budget');
    expect(rows.find((r) => r.storyId === `${S}/shorts/one`)?.halt?.kind).toBe('timeout');
  });
  it("a run folder without script.json yet takes its story id from the topic's stories.json, so its row key is the board's (M3)", () => {
    const r2 = mkdtempSync(join(tmpdir(), 'vk-cli-ids-'));
    writeFileSync(join(r2, 'package.json'), '{"name":"video-knowledge"}');
    mkdirSync(join(r2, 'topics', T), { recursive: true });
    writeFileSync(
      join(r2, 'topics', T, 'stories.json'),
      JSON.stringify({ stories: [{ id: 'decision:just-started' }, { id: S }], rejected: [] }),
    );
    writeHalt(runDir(T, 'decision:just-started', r2), { ...halt, stage: 'script' });
    writeHalt(runDir(T, 'decision:unknown-story', r2), { ...halt, stage: 'script' });
    const ids = statusOf(r2, () => false)
      .map((x) => x.storyId)
      .sort();
    expect(ids).toEqual(['decision-unknown-story', 'decision:just-started']); // listed, resolved; unlisted, the slug
    rmSync(r2, { recursive: true, force: true });
  });
  it('prints usage and exits 2 without a verb', () => {
    const r = runCli('run', [], { cwd: root });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/story <topic> <story-id>/);
  });
  it('status lists every run folder with its halt and unblock', () => {
    const rows = statusOf(root).filter((r) => r.storyId === S);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      topic: T,
      storyId: S,
      state: 'halted',
      halt: { kind: 'awaiting-person', why: 'watch the draft' },
    });
    expect(rows[0].halt?.unblock.text).toBe('reply OK to the draft email');
    const r = runCli('run', ['status', '--json'], { cwd: root });
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as typeof rows;
    expect(parsed.find((x) => x.storyId === S)?.halt?.kind).toBe('awaiting-person');
    const text = runCli('run', ['status'], { cwd: root });
    expect(text.stdout).toMatch(/awaiting-person/);
    expect(text.stdout).toMatch(/reply OK/);
  });
  it('story refuses a placeholder approver', () => {
    const r = runCli('run', ['story', T, S, '--approver', '<your name>'], { cwd: root });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/real name/);
  });
});
