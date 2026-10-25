import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { toJson } from '../src/lib/io';
import { seekUrl, storyOutputs } from '../src/lib/outputs';
import {
  addOutput,
  appendEvent,
  emptyLedger,
  type Ledger,
  loadLedger,
  type PublishEvent,
  publishPath,
  saveLedger,
} from '../src/lib/publish';
import { type Fixture, syntheticProduction, syntheticShort } from './production-helpers';

const CHAPTERS = [
  { scene: 'sc01', seconds: 0, stamp: '0:00', title: 'Hook' },
  { scene: 'sc05', seconds: 261.5, stamp: '4:21', title: 'The answer' },
];
const ev = (type: PublishEvent['type'], at: string, x: Partial<PublishEvent> = {}): PublishEvent => ({
  at,
  type,
  by: 'Jon',
  id: 'abc12345678',
  ...x,
});

let f: Fixture | null = null;
afterEach(() => {
  f?.cleanup();
  f = null;
});

function main(events: PublishEvent[]) {
  f = syntheticProduction('packaged');
  const rj = join(f.dir, 'video', 'review', 'review.json');
  writeFileSync(rj, toJson({ ...JSON.parse(readFileSync(rj, 'utf8')), seconds: 300.2, chapters: CHAPTERS }));
  let ledger: Ledger = emptyLedger(`${f.topic}/${f.story}`);
  for (const e of events) ledger = appendEvent(ledger, 'youtube', e).ledger;
  saveLedger(publishPath(f.topic, f.story, f.root), ledger);
  return storyOutputs(f.topic, f.story, f.root);
}

describe('public outputs', () => {
  it('no video until a published event', () => {
    expect(main([ev('scheduled', '2026-11-01T00:00:00Z', { publishAt: '2026-11-02T00:00:00Z' })])).toEqual({
      video: null,
      shorts: [],
    });
  });

  it('a published main output is public with its chapters', () => {
    const { video } = main([ev('published', '2026-11-02T10:00:00Z')]);
    expect(video).toMatchObject({
      output: 'youtube',
      kind: 'youtube-video',
      id: 'abc12345678',
      url: 'https://www.youtube.com/watch?v=abc12345678',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc12345678',
      publishedAt: '2026-11-02T10:00:00Z',
      seconds: 300.2,
    });
    expect(video!.chapters).toEqual(CHAPTERS.map(({ stamp, seconds, title }) => ({ stamp, seconds, title })));
  });

  it('unpublished after published hides it', () => {
    const out = main([
      ev('published', '2026-11-02T10:00:00Z'),
      ev('unpublished', '2026-11-03T10:00:00Z', { note: 'taken down' }),
    ]);
    expect(out.video).toBeNull();
  });

  it('a private published event is not public', () => {
    expect(main([ev('published', '2026-11-02T10:00:00Z', { visibility: 'private' })]).video).toBeNull();
  });

  it('a published Short appears under shorts with its shorts url', () => {
    const s = syntheticShort('packaged');
    f = s;
    const path = publishPath(s.topic, s.parent, s.root);
    let ledger = loadLedger(s.topic, s.parent, s.root) ?? emptyLedger(`${s.topic}/${s.parent}`);
    if (!ledger.outputs['short:fixture-short'])
      ledger = addOutput(ledger, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source: relative(s.root, s.dir).replaceAll('\\', '/'),
      });
    ledger = appendEvent(
      ledger,
      'short:fixture-short',
      ev('published', '2026-11-02T10:00:00Z', { id: 'shortid0001' }),
    ).ledger;
    saveLedger(path, ledger);
    const { shorts } = storyOutputs(s.topic, s.parent, s.root);
    expect(shorts).toHaveLength(1);
    expect(shorts[0]).toMatchObject({
      output: 'short:fixture-short',
      kind: 'youtube-short',
      url: 'https://www.youtube.com/shorts/shortid0001',
      chapters: [],
    });
  });

  it('seekUrl appends the whole second', () => {
    const v = { url: 'https://www.youtube.com/watch?v=abc12345678' } as Parameters<typeof seekUrl>[0];
    expect(seekUrl(v, 261.5)).toBe('https://www.youtube.com/watch?v=abc12345678&t=261s');
  });
});
