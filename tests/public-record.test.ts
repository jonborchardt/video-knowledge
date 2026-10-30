import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadPublicRecord,
  nextPublicRecord,
  noteRevision,
  publicRecordPath,
  type PublicRecord,
  publicRecordProblems,
  revisionLine,
} from '../src/shared/public-record';
import { claimStates, ledgerClaims } from '../src/lib/finding-label';
import { contentGraph, liveClaims } from '../src/modules/website';
import { ROOT, toJson, topicDir } from '../src/shared/io';
import { type ClaimView, loadTopic, publicTopicNames, type SourceView, type Verdict } from '../src/lib/topics';

const next = (
  prev: PublicRecord,
  before: Parameters<typeof nextPublicRecord>[1],
  after: { claims: ClaimView[]; sources?: SourceView[] },
  today: string,
  live: Set<string>,
) => nextPublicRecord(prev, before, ledgerClaims(after), today, live);
const claim = (id: string, verdict: Verdict | null, confidence: number | null, decidedBy: string | null = 'S') =>
  ({ id, verdict, confidence, decidedBy, sources: [] }) as unknown as ClaimView;
const src = (id: string) => ({ id }) as SourceView;
const withSrc = (c: ClaimView, ...ids: string[]) => ({ ...c, sources: ids.map(src) }) as unknown as ClaimView;
const empty = { exhibits: {}, revisions: [] };

describe('public record', () => {
  it('seeds exhibits 1..n in source-id order with no revisions', () => {
    const claims = [withSrc(claim('c', 'right', 0.9), 'b', 'a')];
    const r = next(empty, null, { claims, sources: [src('b'), src('a')] }, '2026-10-24', new Set(['c']));
    expect(r).toEqual({ exhibits: { a: 1, b: 2 }, revisions: [] });
  });

  it('keeps numbers, appends a new source, and a removed source keeps its number', () => {
    const r = next(
      { exhibits: { a: 1, b: 2 }, revisions: [] },
      null,
      { claims: [withSrc(claim('k', 'right', 0.9), 'b', 'c')], sources: [src('b'), src('c')] },
      'd',
      new Set(['k']),
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
    const r = next(empty, before, after, '2026-11-02', new Set(['x', 'y', 'z']));
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
    const r = next(
      empty,
      claimStates({ claims: [claim('x', 'right', 0.9)] }),
      { claims: [claim('n', 'right', 0.9)], sources: [] },
      'd',
      new Set(['x', 'n']),
    );
    expect(r.revisions).toEqual([expect.objectContaining({ id: 'x', to: null })]);
  });

  it('numbers only the sources of live claims, in id order, after the current max', () => {
    const after = {
      claims: [withSrc(claim('c1', 'right', 0.9), 'z', 'b'), withSrc(claim('c2', 'wrong', 0.9), 'a')],
      sources: [src('a'), src('b'), src('z')],
    };
    expect(next(empty, null, after, 'T', new Set(['c1'])).exhibits).toEqual({ b: 1, z: 2 });
    const prev = { exhibits: { b: 1, z: 2 }, revisions: [] };
    expect(next(prev, null, after, 'T', new Set(['c1', 'c2'])).exhibits).toEqual({ b: 1, z: 2, a: 3 });
  });

  it('records revisions only for live claims', () => {
    const before = claimStates({ claims: [claim('c1', 'right', 0.9), claim('c2', 'right', 0.9)] });
    const after = { claims: [claim('c1', 'wrong', 0.9), claim('c2', 'wrong', 0.9)], sources: [] };
    const r = next(empty, before, after, 'T', new Set(['c1']));
    expect(r.revisions.map((v) => v.id)).toEqual(['c1']);
  });

  it('applying the same state twice adds nothing', () => {
    const t = { claims: [claim('x', 'partly', 0.9)], sources: [src('a')] };
    const lv = new Set(['x']);
    const once = next(empty, claimStates({ claims: [claim('x', 'right', 0.9)] }), t, 'd', lv);
    expect(next(noteRevision(once, 'x', 'new study'), claimStates(t), t, 'e', lv).revisions).toHaveLength(1);
  });

  it('an unexplained revision is a problem; noteRevision explains the latest one', () => {
    const r = next(
      empty,
      claimStates({ claims: [claim('x', 'right', 0.9)] }),
      { claims: [claim('x', 'wrong', 0.9)], sources: [] },
      'd',
      new Set(['x']),
    );
    expect(publicRecordProblems(r)).toEqual(['revision 0 (x, d): no note']);
    expect(publicRecordProblems(noteRevision(r, 'x', 'Smith 2026 overturned it'))).toEqual([]);
    expect(() => noteRevision(empty, 'x', 'n')).toThrow('no unexplained revision of x');
  });

  it('accepts an article revision in its own shape, and a report run keeps it', () => {
    const art = { at: 'd', kind: 'article' as const, id: 'q:s', from: null, to: null, sentences: ['s3'], note: 'n' };
    const rec = { exhibits: {}, revisions: [art] };
    expect(publicRecordProblems(rec)).toEqual([]);
    expect(publicRecordProblems({ exhibits: {}, revisions: [{ ...art, sentences: [] }] })).toEqual([
      'revision 0: malformed',
    ]);
    expect(
      publicRecordProblems({ exhibits: {}, revisions: [{ ...art, from: { label: 'verified', verdict: 'right' } }] }),
    ).toEqual(['revision 0: malformed']);
    const t = { claims: [claim('q:s', 'wrong', 0.9)], sources: [] };
    const nxt = next(rec, claimStates({ claims: [claim('q:s', 'right', 0.9)] }), t, 'e', new Set(['q:s']));
    expect(nxt.revisions[0]).toEqual(art);
    expect(nxt.revisions).toHaveLength(2);
    expect(() => noteRevision({ ...rec, revisions: [{ ...art, note: '' }] }, 'q:s', 'x')).toThrow();
  });

  it('flags a bad shape and duplicate or non-positive exhibit numbers', () => {
    expect(publicRecordProblems(null)).not.toEqual([]);
    expect(publicRecordProblems({ exhibits: { a: 1, b: 1, c: 0 }, revisions: [] })).toHaveLength(2);
  });

  it('revisionLine', () => {
    const r = { at: '2026-11-02', kind: 'claim' as const, id: 'x', from: null, to: null, note: 'n' };
    expect(revisionLine(r)).toBe('Revised 2026-11-02: n');
  });

  it('every public topic has a public record with exhibit numbers for the sources of its live claims and no unexplained revision', () => {
    for (const n of publicTopicNames()) {
      expect(existsSync(publicRecordPath(n)), n).toBe(true);
      const rec = loadPublicRecord(n);
      expect(publicRecordProblems(rec), n).toEqual([]);
      const lv = liveClaims(contentGraph(ROOT, [n]), n);
      for (const c of loadTopic(n).claims.filter((c) => lv.has(c.id)))
        for (const s of c.sources) expect(rec.exhibits[s.id], `${n} ${s.id}`).toBeGreaterThan(0);
    }
  });

  it('npm run report puts the old report back when the new one cannot be read, so no change goes unrecorded', () => {
    // A one-claim topic in a temp root (its package.json makes ROOT the copy) and a watcher that prints a broken report.
    const root = mkdtempSync(join(tmpdir(), 'vk-report-'));
    try {
      copyFileSync(join(ROOT, 'package.json'), join(root, 'package.json'));
      symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'junction'); // tsx, for the watcher spawn
      const dir = topicDir('fixture', root);
      mkdirSync(join(dir, 'store', 'videos'), { recursive: true });
      writeFileSync(join(dir, 'store', 'topics.json'), '[]\n');
      const claim = { id: 'fixture/x', text: 'x', asserted: 1, denied: 0, effective: 'right', confidence: 0.9 };
      const old = toJson({
        topics: [
          {
            id: 'fixture',
            label: 'Fixture',
            claims: [{ ...claim, note: null, source: 'fixture/sources/s.txt', documents: ['s.txt'] }],
            commonlyWrong: [],
            contested: [],
            surprises: [],
          },
        ],
        videos: [],
      });
      writeFileSync(join(dir, 'report.json'), old);
      const watcher = join(root, 'fake-watcher');
      mkdirSync(join(watcher, 'src'), { recursive: true });
      writeFileSync(join(watcher, 'src', 'cli.ts'), "process.stdout.write('{ not json');\n");
      const r = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'scripts', 'report.ts')], {
        cwd: root,
        env: { ...process.env, WATCHER_DIR: watcher },
        encoding: 'utf8',
      });
      expect(r.stderr).toMatch(/JSON/); // it got as far as reading the new report
      expect(r.status).not.toBe(0);
      expect(readFileSync(join(dir, 'report.json'), 'utf8')).toBe(old);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
