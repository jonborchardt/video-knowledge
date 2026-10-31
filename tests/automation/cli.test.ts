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

describe('npm run run', () => {
  it('prints usage and exits 2 without a verb', () => {
    const r = runCli('run', [], { cwd: root });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).toMatch(/story <topic> <story-id>/);
  });
  it('status lists every run folder with its halt and unblock', () => {
    const rows = statusOf(root);
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
    expect(parsed[0].halt?.kind).toBe('awaiting-person');
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
