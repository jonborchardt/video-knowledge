// Pins `liveClaimIds` (what the report CLI numbers as exhibits, read from stories.json and the publishing ledgers) to
// the content graph's `liveClaims` it replaced: every committed topic, plus a temp root with a live chain.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { liveClaimIds } from '../src/modules/evidence/live-claims';
import { contentGraph, liveClaims } from '../src/modules/website/content-graph';
import { appendEvent, emptyLedger, publishPath, saveLedger } from '../src/modules/publishing/publish';
import { ROOT, scriptDir, toJson, TOPICS, topicDir } from '../src/shared/io';

const sorted = (s: Set<string>) => [...s].sort();
let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));

describe('live claims equivalence', () => {
  for (const topic of readdirSync(join(ROOT, TOPICS), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)) {
    it(`${topic}: liveClaimIds equals the graph's liveClaims`, () => {
      expect(sorted(liveClaimIds(topic))).toEqual(sorted(liveClaims(contentGraph(ROOT, [topic]), topic)));
    });
  }

  it('a chain naming a missing root is never live, on both sides', () => {
    const T = 'heat-pumps';
    root = mkdtempSync(join(tmpdir(), 'live-claims-'));
    mkdirSync(topicDir(T, root), { recursive: true });
    const story = {
      id: 'decision:b',
      title: 'b',
      question: 'b?',
      readiness: 'ready',
      scores: { overall: 0.5 },
      claims: ['c2'],
      partOf: 'decision:gone',
    };
    writeFileSync(join(topicDir(T, root), 'stories.json'), toJson({ topic: T, stories: [story] }));
    mkdirSync(scriptDir(T, 'decision:gone', root), { recursive: true });
    saveLedger(
      publishPath(T, 'decision:gone', root),
      appendEvent(emptyLedger(`${T}/decision:gone`), 'youtube', {
        at: '2026-10-01T00:00:00Z',
        type: 'published',
        by: 'Jon',
        id: 'vid00000002',
      }).ledger,
    );
    expect(sorted(liveClaimIds(T, root))).toEqual([]);
    expect(sorted(liveClaims(contentGraph(root, [T]), T))).toEqual([]);
  });

  it('a chain whose first question is live makes its follow-up live; an unpublished story is not', () => {
    const T = 'heat-pumps';
    root = mkdtempSync(join(tmpdir(), 'live-claims-'));
    mkdirSync(topicDir(T, root), { recursive: true });
    const story = (id: string, claims: string[], partOf?: string) => ({
      id,
      title: id,
      question: `${id}?`,
      readiness: 'ready',
      scores: { overall: 0.5 },
      claims,
      ...(partOf && { partOf }),
    });
    writeFileSync(
      join(topicDir(T, root), 'stories.json'),
      toJson({
        topic: T,
        stories: [story('decision:a', ['c1']), story('decision:b', ['c2'], 'decision:a'), story('decision:c', ['c3'])],
      }),
    );
    mkdirSync(scriptDir(T, 'decision:a', root), { recursive: true });
    const l = emptyLedger(`${T}/decision:a`);
    saveLedger(
      publishPath(T, 'decision:a', root),
      appendEvent(l, 'youtube', { at: '2026-10-01T00:00:00Z', type: 'published', by: 'Jon', id: 'vid00000001' }).ledger,
    );
    const got = sorted(liveClaimIds(T, root));
    expect(got).toEqual(['c1', 'c2']);
    expect(got).toEqual(sorted(liveClaims(contentGraph(root, [T]), T)));
  });
});
