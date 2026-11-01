// `npm run run -- story <fixture topic> <id> --fresh`: the production folder is archived whole and every stage runs
// again (spec §5.8). Nothing is copied back: the fresh run writes new artifacts, new fingerprints, new approvals.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, scriptDir, topicDir } from '../../src/shared/io';
import { archiveProduction, freshProblem, freshRunId } from '../../src/orchestration/run/fresh';
import { runDir } from '../../src/orchestration/run/journal';

const root = mkdtempSync(join(tmpdir(), 'vk-fresh-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
const T = 'test-fixture';
const S = 'decision:leap-seconds';
const dir = () => scriptDir(T, S, root);
const seed = () => {
  mkdirSync(join(dir(), 'video', 'review'), { recursive: true });
  mkdirSync(join(dir(), 'shorts', 'one'), { recursive: true });
  writeFileSync(join(dir(), 'script.json'), '{"revision":3}');
  writeFileSync(join(dir(), 'release.json'), '{"approvedBy":"x"}');
  writeFileSync(join(dir(), 'shorts', 'one', 'script.json'), '{"revision":1}');
  writeFileSync(
    join(dir(), 'publish.json'),
    JSON.stringify({
      story: S,
      outputs: {
        youtube: { kind: 'youtube-video', metadata: {}, events: [{ kind: 'uploaded', id: 'vid1' }] },
        'short:one': { kind: 'youtube-short', metadata: {}, events: [] },
      },
    }),
  );
  mkdirSync(runDir(T, S, root), { recursive: true });
  writeFileSync(join(runDir(T, S, root), 'journal.jsonl'), '{"kind":"run"}\n');
};

describe('freshRunId', () => {
  it('names a run by minute and four hex digits', () => {
    expect(freshRunId(new Date('2026-10-31T17:05:00Z'))).toMatch(/^20261031-\d{4}-[0-9a-f]{4}$/);
    expect(freshRunId()).not.toBe(freshRunId());
  });
});

describe('archiveProduction', () => {
  it('is refused for a story whose topic is not a fixture topic', () => {
    expect(freshProblem('heat-pumps')).toMatch(/fixture/);
    expect(() => archiveProduction('heat-pumps', 'decision:x', root)).toThrow(/fixture/);
    expect(freshProblem(T)).toBeNull();
  });
  it('moves the whole production folder to history, marks the old outputs superseded and starts clean', () => {
    seed();
    const r = archiveProduction(T, S, root);
    expect(r.archived).toBe(join(topicDir(T, root), 'history', r.runId));
    expect(existsSync(join(r.archived!, 'script.json'))).toBe(true);
    expect(existsSync(join(r.archived!, 'shorts', 'one', 'script.json'))).toBe(true);
    expect(existsSync(join(r.archived!, 'run', 'journal.jsonl'))).toBe(true);
    const archived = readJson<{ previous: string | null; outputs: Record<string, { status: string; id?: string }> }>(
      join(r.archived!, 'archived.json'),
    )!;
    expect(archived.outputs.youtube).toEqual({ status: 'superseded', kind: 'youtube-video', id: 'vid1' });
    expect(archived.outputs['short:one'].status).toBe('superseded');
    // the fresh folder holds the run marker and nothing of the previous production
    expect(readdirSync(dir())).toEqual(['run']);
    expect(readdirSync(runDir(T, S, root))).toEqual(['fresh.json']);
    const fresh = readJson<{ runId: string; at: string; previous: string | null }>(
      join(runDir(T, S, root), 'fresh.json'),
    )!;
    expect(fresh.runId).toBe(r.runId);
    expect(fresh.previous).toBeNull();
  });
  it('a second fresh run names the previous one, and a story with no production archives nothing', () => {
    seed();
    const r = archiveProduction(T, S, root);
    expect(readJson<{ previous: string | null }>(join(runDir(T, S, root), 'fresh.json'))!.previous).not.toBeNull();
    const none = archiveProduction(T, 'decision:never-made', root);
    expect(none.archived).toBeNull();
    expect(readdirSync(runDir(T, 'decision:never-made', root))).toEqual(['fresh.json']);
    expect(r.runId).not.toBe(none.runId);
  });
  it('refuses while a live run holds the story', () => {
    seed();
    writeFileSync(
      join(runDir(T, S, root), 'lock.json'),
      JSON.stringify({
        runId: 'r',
        pid: process.pid,
        host: 'h',
        startedAt: 'x',
        heartbeatAt: new Date().toISOString(),
        command: 'c',
      }),
    );
    expect(() => archiveProduction(T, S, root)).toThrow(/live run/);
    expect(existsSync(join(dir(), 'script.json'))).toBe(true);
  });
});
