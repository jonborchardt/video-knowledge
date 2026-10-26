import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commissionKey, commissionOf } from '../src/config/site';
import {
  contentGraph,
  inquiryMatters,
  isPreview,
  liveClaims,
  matterOrder,
  related,
  urlOf,
  type View,
} from '../src/lib/content-graph';
import { movedRedirects } from '../src/lib/content-graph';
import { toJson, topicDir } from '../src/lib/io';
import { addOutput, appendEvent, emptyLedger, type Ledger, publishPath, saveLedger } from '../src/lib/publish';
import { scriptDir } from '../src/lib/script';
import { loadStories, type Story, storyUrlSlug } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';

// Small temp roots: a stories.json of bare stories and, where a test needs one, a publishing ledger.
const T = 'heat-pumps';
let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

type Bare = Pick<Story, 'id' | 'claims'> & Partial<Story>;
const story = (x: Bare): Story =>
  ({ title: x.id, question: `${x.id}?`, readiness: 'ready', scores: { overall: 0.5 }, ...x }) as Story;
function graphOf(
  stories: Bare[],
  ledgers: Record<string, (l: Ledger) => Ledger> = {},
  view: View = 'live',
  packaged: string[] = [],
) {
  root = mkdtempSync(join(tmpdir(), 'graph-'));
  mkdirSync(topicDir(T, root), { recursive: true });
  writeFileSync(join(topicDir(T, root), 'stories.json'), toJson({ topic: T, stories: stories.map(story) }));
  for (const [id, f] of Object.entries(ledgers)) {
    mkdirSync(scriptDir(T, id, root), { recursive: true });
    saveLedger(publishPath(T, id, root), f(emptyLedger(`${T}/${id}`)));
  }
  for (const id of packaged) {
    mkdirSync(join(scriptDir(T, id, root), 'video', 'review'), { recursive: true });
    writeFileSync(join(scriptDir(T, id, root), 'video', 'review', 'review.json'), '{}');
  }
  return contentGraph(root, [T], view);
}
const live = (l: Ledger, output: string, id: string) =>
  appendEvent(l, output, { at: '2026-10-01T00:00:00Z', type: 'published', by: 'Jon', id }).ledger;

describe('content graph', () => {
  it('movedRedirects emits only for the topics it is given', () => {
    expect(movedRedirects([])).toEqual({});
  });

  it('every story of a public topic is a node in its inquiry, and its inquiry is published by its institution', () => {
    const g = contentGraph();
    for (const t of publicTopicNames()) {
      const inst = `inst:${commissionKey(commissionOf(t)!)}`;
      expect(g.edges).toContainEqual({ from: inst, to: t, kind: 'publishes' });
      for (const s of loadStories(t)?.stories ?? []) {
        expect(g.nodes.has(`${t}/${s.id}`), s.id).toBe(true);
        expect(g.edges).toContainEqual({ from: `${t}/${s.id}`, to: t, kind: 'in' });
      }
    }
  });

  it('a chain follow-up has a partOf edge to its first question', () => {
    const g = contentGraph();
    for (const t of publicTopicNames())
      for (const s of (loadStories(t)?.stories ?? []).filter((x) => x.partOf))
        expect(g.edges).toContainEqual({ from: `${t}/${s.id}`, to: `${t}/${s.partOf}`, kind: 'partOf' });
  });

  it('stories sharing claims get one shares-claims edge each way with the count', () => {
    const g = graphOf([
      { id: 'decision:a', claims: ['c1', 'c2', 'c3'] },
      { id: 'decision:b', claims: ['c2', 'c3'] },
      { id: 'decision:c', claims: ['c9'] },
    ]);
    const shares = g.edges.filter((e) => e.kind === 'shares-claims');
    expect(shares).toEqual([
      { from: `${T}/decision:a`, to: `${T}/decision:b`, kind: 'shares-claims', weight: 2 },
      { from: `${T}/decision:b`, to: `${T}/decision:a`, kind: 'shares-claims', weight: 2 },
    ]);
  });

  it('an unpublished video is a node that is not public, and urlOf gives null', () => {
    const g = graphOf([{ id: 'decision:a', claims: [] }], {
      'decision:a': (l) => l,
    });
    expect(g.nodes.get(`${T}/decision:a#youtube`)?.public).toBe(false);
    expect(urlOf(g, `${T}/decision:a#youtube`)).toBeNull();
  });

  it('a published video and its Short: madeFrom the story, the Short derivedFrom the video', () => {
    const g = graphOf([{ id: 'decision:a', claims: [] }], {
      'decision:a': (l) => {
        l = addOutput(l, 'short:s1', 'youtube-short', { derivedFrom: 'youtube' });
        return live(live(l, 'youtube', 'vid00000001'), 'short:s1', 'sho00000001');
      },
    });
    const v = `${T}/decision:a#youtube`;
    expect(g.edges).toContainEqual({ from: v, to: `${T}/decision:a`, kind: 'madeFrom' });
    expect(g.edges).toContainEqual({ from: `${T}/decision:a#short:s1`, to: v, kind: 'derivedFrom' });
    expect(urlOf(g, v)).toBe('https://www.youtube.com/watch?v=vid00000001');
    expect(urlOf(g, `${T}/decision:a#short:s1`)).toBe('https://www.youtube.com/shorts/sho00000001');
  });

  it('a tool node uses-edges from its story; a dataset is cited by an article whose figure names it', () => {
    const s = `${T}/decision:is-it-cheaper-to-run-than-gas`;
    const real = contentGraph(undefined, undefined, 'live', [s]);
    expect(real.edges).toContainEqual({ from: s, to: 'tool:heating-cost', kind: 'uses' });
    expect(urlOf(real, 'tool:heating-cost')).toBe('/heat-pumps/is-it-cheaper-to-run-than-gas/#tool');
    root = mkdtempSync(join(tmpdir(), 'graph-'));
    const dir = scriptDir(T, 'decision:a', root);
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(topicDir(T, root), 'data'));
    writeFileSync(join(topicDir(T, root), 'data', 'prices.json'), toJson({ id: 'prices', title: 'Prices', rows: [] }));
    writeFileSync(
      join(topicDir(T, root), 'stories.json'),
      toJson({ stories: [story({ id: 'decision:a', claims: [] })] }),
    );
    const figure = (ref: string) => ({ blocks: [{ kind: 'figure', ref }] });
    writeFileSync(
      join(dir, 'article-release.json'),
      toJson({ article: { meta: { headline: 'A' }, sections: [figure('data:heat-pumps/prices'), figure('a/sc01')] } }),
    );
    const g = contentGraph(root, [T], 'live', [`${T}/decision:a`]);
    expect(g.edges).toContainEqual({ from: `${T}/decision:a#article`, to: 'data:heat-pumps/prices', kind: 'cites' });
    expect(g.edges).toContainEqual({ from: `${T}/decision:a#article`, to: 'a/sc01', kind: 'cites' });
    expect(urlOf(g, 'data:heat-pumps/prices')).toBe('/heat-pumps/data/#prices');
  });

  it('every edge joins two existing nodes', () => {
    const g = contentGraph();
    for (const e of g.edges) {
      expect(g.nodes.has(e.from), e.from).toBe(true);
      expect(g.nodes.has(e.to), e.to).toBe(true);
    }
  });

  it('urlOf builds story urls from the id, never the title', () => {
    const ready = publicTopicNames().flatMap((t) =>
      (loadStories(t)?.stories ?? []).filter((x) => x.readiness === 'ready').map((x) => `${t}/${x.id}`),
    );
    const g = contentGraph(undefined, undefined, 'live', ready);
    for (const t of publicTopicNames())
      for (const s of (loadStories(t)?.stories ?? []).filter((x) => x.readiness === 'ready'))
        expect(urlOf(g, `${t}/${s.id}`)).toBe(`/${t}/${storyUrlSlug(s)}/`);
    const lv = { 'decision:a': (l: Ledger) => live(l, 'youtube', 'vid00000001') };
    const a = graphOf([{ id: 'decision:a', claims: [], title: 'One title' }], lv);
    expect(urlOf(a, `${T}/decision:a`)).toBe('/heat-pumps/a/');
    rmSync(root, { recursive: true, force: true });
    const b = graphOf([{ id: 'decision:a', claims: [], title: 'Another title' }], lv);
    expect(urlOf(b, `${T}/decision:a`)).toBe('/heat-pumps/a/');
  });

  it('chain first, never itself', () => {
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1'], chain: [{ id: 'decision:b', question: '' }] },
        { id: 'decision:b', claims: ['c1'], partOf: 'decision:a' },
        { id: 'decision:c', claims: ['c1'], scores: { overall: 0.99 } as Story['scores'] },
      ],
      {
        'decision:a': (l) => live(l, 'youtube', 'vid00000001'),
        'decision:c': (l) => live(l, 'youtube', 'vid00000002'),
      },
    );
    const r = related(g, `${T}/decision:a`).map((n) => n.id);
    expect(r[0]).toBe(`${T}/decision:b`);
    expect(r).not.toContain(`${T}/decision:a`);
  });

  it('more shared claims rank higher; ties prefer the overall score', () => {
    const sc = (overall: number) => ({ overall }) as Story['scores'];
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1', 'c2', 'c3', 'c4', 'c5'] },
        { id: 'decision:b', claims: ['c1', 'c2', 'c3'] },
        { id: 'decision:c', claims: ['c1'] },
        { id: 'decision:d', claims: ['c4', 'c5'], scores: sc(0.9) },
        { id: 'decision:e', claims: ['c4', 'c5'], scores: sc(0.1) },
        { id: 'decision:f', claims: ['c4', 'c5'], scores: sc(0.95) },
      ],
      Object.fromEntries(
        ['a', 'b', 'c', 'd', 'e', 'f'].map((x, i) => [
          `decision:${x}`,
          (l: Ledger) => live(l, 'youtube', `vid0000000${i}`),
        ]),
      ),
    );
    expect(related(g, `${T}/decision:a`, { limit: 9 }).map((n) => n.id.split(':')[1])).toEqual([
      'b',
      'f',
      'd',
      'e',
      'c',
    ]);
  });

  it('a pin leads and an exclusion is honoured', () => {
    const all = (x: string) => [`decision:${x}`, (l: Ledger) => live(l, 'youtube', `vid0000000${x}`)] as const;
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1'] },
        { id: 'decision:b', claims: ['c1'] },
        { id: 'decision:c', claims: ['c9'] },
      ],
      Object.fromEntries(['a', 'b', 'c'].map(all)),
    );
    const r = related(g, `${T}/decision:a`, { pin: [`${T}/decision:c`], exclude: [`${T}/decision:b`] }).map(
      (n) => n.id,
    );
    expect(r[0]).toBe(`${T}/decision:c`);
    expect(r).not.toContain(`${T}/decision:b`);
  });

  it('related and inquiryMatters never return a story that is not public', () => {
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1'] },
        { id: 'decision:b', claims: ['c1'] },
      ],
      { 'decision:a': (l) => live(l, 'youtube', 'vid00000001') },
    );
    expect(related(g, `${T}/decision:a`)).toEqual([]);
    expect(inquiryMatters(g, T).map((m) => m.href)).toEqual(['/heat-pumps/a/']);
  });

  it('a live view shows only stories whose video is live, and their inquiry', () => {
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1'] },
        { id: 'decision:b', claims: ['c2'] },
      ],
      { 'decision:a': (l) => live(l, 'youtube', 'vid00000001') },
    );
    expect(g.nodes.get(`${T}/decision:a`)!.public).toBe(true);
    expect(g.nodes.get(`${T}/decision:b`)!.public).toBe(false);
    expect(g.nodes.get(T)!.public).toBe(true);
  });

  it('an inquiry with no live story is not public', () => {
    expect(graphOf([{ id: 'decision:a', claims: [] }]).nodes.get(T)!.public).toBe(false);
  });

  it('a follow-up is public exactly when its first question is', () => {
    const stories = [
      { id: 'decision:a', claims: [], chain: [{ id: 'decision:b', question: '' }] },
      { id: 'decision:b', claims: [], partOf: 'decision:a' },
    ];
    const on = graphOf(stories, { 'decision:a': (l) => live(l, 'youtube', 'vid00000001') });
    expect(on.nodes.get(`${T}/decision:b`)!.public).toBe(true);
    rmSync(root, { recursive: true, force: true });
    const off = graphOf(stories, { 'decision:b': (l) => live(l, 'youtube', 'vid00000002') }, 'live', ['decision:b']);
    expect(off.nodes.get(`${T}/decision:b`)!.public).toBe(false);
  });

  it('preview adds packaged stories, never unpackaged ones', () => {
    const g = graphOf(
      [
        { id: 'decision:a', claims: [] },
        { id: 'decision:b', claims: [] },
        { id: 'decision:c', claims: [] },
      ],
      { 'decision:a': (l) => live(l, 'youtube', 'vid00000001') },
      'preview',
      ['decision:b'],
    );
    expect(['a', 'b', 'c'].map((x) => g.nodes.get(`${T}/decision:${x}`)!.public)).toEqual([true, true, false]);
    expect(isPreview(g, `${T}/decision:b`)).toBe(true);
    expect(isPreview(g, `${T}/decision:a`)).toBe(false);
  });

  it('assumeLive makes one story public in a live view', () => {
    graphOf([{ id: 'decision:b', claims: [] }]);
    const g = contentGraph(root, [T], 'live', [`${T}/decision:b`]);
    expect(g.nodes.get(`${T}/decision:b`)!.public).toBe(true);
    expect(urlOf(g, `${T}/decision:b`)).toBe('/heat-pumps/b/');
  });

  it('liveClaims is the claims of live stories only, in either view', () => {
    const g = graphOf(
      [
        { id: 'decision:a', claims: ['c1'] },
        { id: 'decision:b', claims: ['c2'] },
      ],
      { 'decision:a': (l) => live(l, 'youtube', 'vid00000001') },
      'preview',
      ['decision:b'],
    );
    expect(liveClaims(g, T)).toEqual(new Set(['c1']));
  });

  it('matterOrder puts a public video first, then the score', () => {
    const sc = (overall: number) => ({ overall }) as Story['scores'];
    const g = graphOf(
      [
        { id: 'decision:a', claims: [], scores: sc(0.9) },
        { id: 'decision:b', claims: [], scores: sc(0.1) },
        { id: 'decision:c', claims: [], scores: sc(1) },
      ],
      { 'decision:b': (l) => live(l, 'youtube', 'vid00000001') },
      'preview',
      ['decision:a', 'decision:c'],
    );
    const nodes = ['a', 'b', 'c'].map((x) => g.nodes.get(`${T}/decision:${x}`)!);
    expect(nodes.sort((x, y) => matterOrder(g, x, y)).map((n) => n.id.split(':')[1])).toEqual(['b', 'c', 'a']);
  });
});
