import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  claimStates,
  loadPublicRecord,
  nextPublicRecord,
  noteRevision,
  publicRecordPath,
  publicRecordProblems,
  revisionLine,
} from '../src/lib/public-record';
import { ROOT, topicDir } from '../src/lib/io';
import { copyTopic } from './production-helpers';
import { type ClaimView, loadTopic, publicTopicNames, type SourceView, type Verdict } from '../src/lib/topics';

const claim = (id: string, verdict: Verdict | null, confidence: number | null, decidedBy: string | null = 'S') =>
  ({ id, verdict, confidence, decidedBy }) as ClaimView;
const src = (id: string) => ({ id }) as SourceView;
const empty = { exhibits: {}, revisions: [] };

describe('public record', () => {
  it('seeds exhibits 1..n in source-id order with no revisions', () => {
    const r = nextPublicRecord(empty, null, { claims: [], sources: [src('b'), src('a')] }, '2026-10-24');
    expect(r).toEqual({ exhibits: { a: 1, b: 2 }, revisions: [] });
  });

  it('keeps numbers, appends a new source, and a removed source keeps its number', () => {
    const r = nextPublicRecord(
      { exhibits: { a: 1, b: 2 }, revisions: [] },
      null,
      { claims: [], sources: [src('b'), src('c')] },
      'd',
    );
    expect(r.exhibits).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('records a label change and a verdict flip, not a confidence-only change', () => {
    const before = claimStates({
      claims: [claim('x', 'right', 0.9), claim('y', 'right', 0.9), claim('z', 'right', 0.8)],
    });
    const after = {
      claims: [claim('x', 'partly', 0.9), claim('y', 'wrong', 0.9), claim('z', 'right', 0.95)],
      sources: [],
    };
    const r = nextPublicRecord(empty, before, after, '2026-11-02');
    expect(r.revisions.map((v) => v.id)).toEqual(['x', 'y']);
    expect(r.revisions[1]).toEqual({
      at: '2026-11-02',
      kind: 'claim',
      id: 'y',
      from: { label: 'verified', verdict: 'right' },
      to: { label: 'verified', verdict: 'wrong' },
      note: '',
    });
  });

  it('records a removed claim, not an added one', () => {
    const r = nextPublicRecord(
      empty,
      claimStates({ claims: [claim('x', 'right', 0.9)] }),
      { claims: [claim('n', 'right', 0.9)], sources: [] },
      'd',
    );
    expect(r.revisions).toEqual([expect.objectContaining({ id: 'x', to: null })]);
  });

  it('applying the same state twice adds nothing', () => {
    const t = { claims: [claim('x', 'partly', 0.9)], sources: [src('a')] };
    const once = nextPublicRecord(empty, claimStates({ claims: [claim('x', 'right', 0.9)] }), t, 'd');
    expect(nextPublicRecord(noteRevision(once, 'x', 'new study'), claimStates(t), t, 'e').revisions).toHaveLength(1);
  });

  it('an unexplained revision is a problem; noteRevision explains the latest one', () => {
    const r = nextPublicRecord(
      empty,
      claimStates({ claims: [claim('x', 'right', 0.9)] }),
      { claims: [claim('x', 'wrong', 0.9)], sources: [] },
      'd',
    );
    expect(publicRecordProblems(r)).toEqual(['revision 0 (x, d): no note']);
    expect(publicRecordProblems(noteRevision(r, 'x', 'Smith 2026 overturned it'))).toEqual([]);
    expect(() => noteRevision(empty, 'x', 'n')).toThrow('no unexplained revision of x');
  });

  it('flags a bad shape and duplicate or non-positive exhibit numbers', () => {
    expect(publicRecordProblems(null)).not.toEqual([]);
    expect(publicRecordProblems({ exhibits: { a: 1, b: 1, c: 0 }, revisions: [] })).toHaveLength(2);
  });

  it('revisionLine', () => {
    const r = { at: '2026-11-02', kind: 'claim' as const, id: 'x', from: null, to: null, note: 'n' };
    expect(revisionLine(r)).toBe('Revised 2026-11-02: n');
  });

  it('every public topic has a public record with exhibit numbers for its sources and no unexplained revision', () => {
    for (const n of publicTopicNames()) {
      expect(existsSync(publicRecordPath(n)), n).toBe(true);
      const rec = loadPublicRecord(n);
      expect(publicRecordProblems(rec), n).toEqual([]);
      for (const s of loadTopic(n).sources) expect(rec.exhibits[s.id], `${n} ${s.id}`).toBeGreaterThan(0);
    }
  });

  it('npm run report puts the old report back when the new one cannot be read, so no change goes unrecorded', () => {
    const c = copyTopic('heat-pumps');
    try {
      copyFileSync(join(ROOT, 'package.json'), join(c.root, 'package.json')); // ROOT resolves to the copy
      symlinkSync(join(ROOT, 'node_modules'), join(c.root, 'node_modules'), 'junction'); // tsx, for the watcher spawn
      const watcher = join(c.root, 'fake-watcher');
      mkdirSync(join(watcher, 'src'), { recursive: true });
      writeFileSync(join(watcher, 'src', 'cli.ts'), "process.stdout.write('{ not json');\n");
      const report = join(topicDir('heat-pumps', c.root), 'report.json');
      const old = readFileSync(report, 'utf8');
      const r = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'scripts', 'report.ts')], {
        cwd: c.root,
        env: { ...process.env, WATCHER_DIR: watcher },
        encoding: 'utf8',
      });
      expect(r.stderr).toMatch(/JSON/); // it got as far as reading the new report
      expect(r.status).not.toBe(0);
      expect(readFileSync(report, 'utf8')).toBe(old);
    } finally {
      c.cleanup();
    }
  }, 60_000);
});
