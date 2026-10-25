import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { absoluteOf, contentGraph, storyNode } from '../src/lib/content-graph';
import { type Cta, loadCta, resolveCtas } from '../src/lib/cta';
import { toJson, topicDir } from '../src/lib/io';
import { appendEvent, emptyLedger, type Ledger, publishPath, saveLedger } from '../src/lib/publish';
import { FILES, scriptDir } from '../src/lib/script';
import { loadStories, type Story } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';

const T = 'heat-pumps';
const TOOL_STORY = storyNode(T, 'decision:is-it-cheaper-to-run-than-gas');
const OTHER_STORY = storyNode(T, 'conflict:heat-pump-costs-less-run-heating');
const ev: Cta = { type: 'evidence', text: 'Every claim and its evidence' };

let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));
type Bare = Pick<Story, 'id' | 'claims'> & Partial<Story>;
function graphOf(stories: Bare[], live: string[] = []) {
  root = mkdtempSync(join(tmpdir(), 'cta-'));
  mkdirSync(topicDir(T, root), { recursive: true });
  const full = stories.map((x) => ({ title: x.id, question: '?', readiness: 'ready', scores: { overall: 0.5 }, ...x }));
  writeFileSync(join(topicDir(T, root), 'stories.json'), toJson({ stories: full }));
  for (const s of stories) {
    mkdirSync(scriptDir(T, s.id, root), { recursive: true });
    let l: Ledger = emptyLedger(`${T}/${s.id}`);
    if (live.includes(s.id))
      l = appendEvent(l, 'youtube', {
        at: '2026-10-01T00:00:00Z',
        type: 'published',
        by: 'Jon',
        id: 'vid00000001',
      }).ledger;
    saveLedger(publishPath(T, s.id, root), l);
  }
  return contentGraph(root, [T]);
}

describe('calls to action', () => {
  it('no cta.json gives the matter page as the primary', () => {
    const g = contentGraph();
    expect(resolveCtas(null, g, TOOL_STORY).primary).toEqual({
      type: 'evidence',
      text: 'The evidence and the full answer',
      url: absoluteOf(g, TOOL_STORY),
      node: TOOL_STORY,
      disclosure: null,
    });
  });

  it('a tool cta needs a tool for the story', () => {
    const g = contentGraph();
    const tool: Cta = { type: 'tool', target: 'tool:heating-cost', text: 'Run it with your prices' };
    const kept = resolveCtas({ primary: tool }, g, TOOL_STORY);
    expect(kept.primary.type).toBe('tool');
    expect(kept.primary.url.endsWith('#tool')).toBe(true);
    expect(resolveCtas({ primary: tool }, g, OTHER_STORY).dropped).toEqual([
      { cta: tool, why: 'no tool for this story' },
    ]);
  });

  it('a dropped primary falls back to the matter page', () => {
    const r = resolveCtas({ primary: { type: 'tool', text: 'Run it' } }, contentGraph(), OTHER_STORY);
    expect(r.primary.type).toBe('evidence');
    expect(r.dropped).toHaveLength(1);
  });

  it('a video cta needs that video live and related', () => {
    const video = (to: string): Cta => ({ type: 'video', target: `${T}/${to}#youtube`, text: 'The next question' });
    const stories = [
      { id: 'decision:a', claims: ['c1'] },
      { id: 'decision:b', claims: ['c1'] },
      { id: 'decision:c', claims: ['c9'] },
    ];
    let g = graphOf(stories);
    const a = storyNode(T, 'decision:a');
    expect(resolveCtas({ primary: ev, secondary: [video('decision:b')] }, g, a, root).dropped[0].why).toBe('not live');
    rmSync(root, { recursive: true, force: true });
    g = graphOf(stories, ['decision:b', 'decision:c']);
    expect(resolveCtas({ primary: ev, secondary: [video('decision:c')] }, g, a, root).dropped[0].why).toBe(
      'not related',
    );
    expect(resolveCtas({ primary: ev, secondary: [video('decision:b')] }, g, a, root).secondary[0].url).toBe(
      'https://www.youtube.com/watch?v=vid00000001',
    );
  });

  it('an evidence cta needs a claim the video did not assert', () => {
    const g = graphOf([{ id: 'decision:a', claims: ['c1', 'c2'] }]);
    const a = storyNode(T, 'decision:a');
    const say = (...ids: string[]) =>
      writeFileSync(
        join(scriptDir(T, 'decision:a', root), FILES.script),
        toJson({
          sections: [{ name: 'hook', sentences: [{ id: 's1', assertions: [{ claims: ids.map((id) => ({ id })) }] }] }],
        }),
      );
    say('c1');
    expect(resolveCtas({ primary: ev }, g, a, root).primary).toMatchObject({ type: 'evidence', text: ev.text });
    say('c1', 'c2');
    const r = resolveCtas({ primary: ev }, g, a, root);
    expect(r.dropped).toEqual([{ cta: ev, why: 'the video already asserts every claim' }]);
    expect(r.primary.text).toBe('The evidence and the full answer');
  });

  it('more than two secondaries is a problem', () => {
    expect(resolveCtas({ primary: ev, secondary: [ev, ev, ev] }, contentGraph(), TOOL_STORY).problems).toEqual([
      'at most 2 secondary calls to action, found 3',
    ]);
  });

  it('a commercial entry needs a disclosure and a person, never automated, and is never primary over a tool', () => {
    const g = contentGraph();
    const paid: Cta = { type: 'commercial', url: 'https://example.com/x', text: 'A product', approvedBy: 'Jon' };
    expect(resolveCtas({ primary: ev, secondary: [paid] }, g, TOOL_STORY).problems).toEqual([
      'commercial link needs a disclosure: https://example.com/x',
    ]);
    const automated = { ...paid, disclosure: 'We are paid', approvedBy: 'automated: run' };
    expect(resolveCtas({ primary: ev, secondary: [automated] }, g, TOOL_STORY).problems).toEqual([
      "commercial link needs a person's approvedBy: https://example.com/x",
    ]);
    const ok = { ...paid, disclosure: 'We are paid' };
    const r = resolveCtas({ primary: ok }, g, TOOL_STORY);
    expect(r.problems).toEqual([]);
    expect(r.primary.type).toBe('tool');
    expect(r.dropped).toEqual([{ cta: ok, why: 'not primary over a tool or evidence' }]);
    // as a secondary it shows, with its disclosure
    expect(resolveCtas({ primary: ev, secondary: [ok] }, g, TOOL_STORY).secondary[0].disclosure).toBe('We are paid');
  });

  it('a reference url must be https', () => {
    const r = resolveCtas(
      { primary: ev, secondary: [{ type: 'reference', url: 'http://x.gov', text: 'The programme' }] },
      contentGraph(),
      TOOL_STORY,
    );
    expect(r.problems).toEqual(['reference url must be https: http://x.gov']);
  });

  it('every committed cta.json resolves with no problems', () => {
    const g = contentGraph();
    for (const t of publicTopicNames()) {
      for (const s of loadStories(t)?.stories ?? []) {
        const f = loadCta(t, s.id);
        if (f) expect(resolveCtas(f, g, storyNode(t, s.id)).problems, s.id).toEqual([]);
      }
    }
  });
});
