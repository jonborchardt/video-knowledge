import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { contentGraph } from '../src/lib/content-graph';
import { ROOT, toJson, topicDir } from '../src/lib/io';
import { storyOutputs } from '../src/lib/outputs';
import { appendEvent, emptyLedger, ledgerProblems, publishPath, saveLedger } from '../src/lib/publish';
import { rehearsalDir, rehearsalLedger, rehearsalRefusal, rehearsalSteps, removeRehearsal } from '../src/lib/rehearsal';
import { scriptDir } from '../src/lib/script';

const T = 'heat-pumps';
const AT = '2026-10-27T12:00:00.000Z';
let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

/** A temp root with bare stories; `packaged` get a video/review/review.json. */
function rootOf(stories: { id: string; partOf?: string }[], packaged: string[] = []) {
  root = mkdtempSync(join(tmpdir(), 'rehearsal-'));
  mkdirSync(topicDir(T, root), { recursive: true });
  const full = stories.map((s) => ({ title: s.id, question: `${s.id}?`, readiness: 'ready', claims: [], ...s }));
  writeFileSync(join(topicDir(T, root), 'stories.json'), toJson({ topic: T, stories: full }));
  for (const id of packaged) {
    mkdirSync(join(scriptDir(T, id, root), 'video', 'review'), { recursive: true });
    writeFileSync(join(scriptDir(T, id, root), 'video', 'review', 'review.json'), '{}');
  }
  return root;
}

describe('go-live rehearsal', () => {
  it('rehearsalLedger is a valid ledger whose only event is published', () => {
    const l = rehearsalLedger('t', 'decision:a', AT);
    expect(ledgerProblems(l, 't/decision:a')).toEqual([]);
    expect(l.outputs.youtube.events.map((e) => e.type)).toEqual(['published']);
  });

  it('the rehearsal ledger makes the story live in a temp root', () => {
    const r = rootOf([{ id: 'decision:a' }]);
    mkdirSync(scriptDir(T, 'decision:a', r), { recursive: true });
    saveLedger(publishPath(T, 'decision:a', r), rehearsalLedger(T, 'decision:a', AT));
    expect(storyOutputs(T, 'decision:a', r).video?.id).toBe('REHEARSAL00');
    expect(contentGraph(r, [T], 'live').nodes.get(`${T}/decision:a`)?.public).toBe(true);
  });

  it('rehearsalDir is outside the repo', () => {
    // On Windows a temp folder on another drive has no relative path at all: absolute, also outside.
    const r = relative(ROOT, rehearsalDir('heat-pumps', 'decision:is-it-cheaper-to-run-than-gas'));
    expect(r.startsWith('..') || isAbsolute(r), r).toBe(true);
  });

  it('rehearsalSteps runs the go-live sequence in order', () => {
    expect(rehearsalSteps('heat-pumps')).toEqual([
      'npm run report -- seed heat-pumps',
      'npm run brand',
      'npm run build',
      'npm run links -- freeze',
      'npm run quality -- --no-build',
    ]);
  });

  it('rehearsalRefusal', () => {
    const r = rootOf(
      [{ id: 'decision:a' }, { id: 'decision:b', partOf: 'decision:a' }, { id: 'decision:c' }, { id: 'decision:d' }],
      ['decision:a', 'decision:b', 'decision:d'],
    );
    expect(rehearsalRefusal(T, 'decision:a', r)).toBeNull();
    expect(rehearsalRefusal(T, 'decision:zz', r)).toMatch(/unknown story/);
    expect(rehearsalRefusal(T, 'decision:b', r)).toMatch(/follow-up.*decision:a/);
    expect(rehearsalRefusal(T, 'decision:c', r)).toMatch(/not packaged/);
    const l = appendEvent(emptyLedger(`${T}/decision:d`), 'youtube', {
      at: AT,
      type: 'published',
      by: 'Jon',
      id: 'vid00000001',
    }).ledger;
    saveLedger(publishPath(T, 'decision:d', r), l);
    expect(rehearsalRefusal(T, 'decision:d', r)).toMatch(/already live/);
  });

  it('removeRehearsal unlinks the junction before deleting', () => {
    root = mkdtempSync(join(tmpdir(), 'rehearsal-'));
    const target = join(root, 'target');
    const copy = join(root, 'copy');
    mkdirSync(target);
    mkdirSync(copy);
    writeFileSync(join(target, 'keep.txt'), 'x');
    symlinkSync(target, join(copy, 'node_modules'), 'junction');
    removeRehearsal(copy);
    expect(existsSync(copy)).toBe(false);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true);
  });
});
