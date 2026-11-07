import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { toJson } from '../../../shared/io';
import { seekUrl, storyOutputs } from '../outputs';
import {
  addOutput,
  appendEvent,
  emptyLedger,
  type Ledger,
  type PublishEvent,
  publishPath,
  saveLedger,
} from '../publish';
import { scriptDir } from '../../../shared/io';

// A bare temp root: the ledger and the committed review package are all storyOutputs reads.
const TOPIC = 'heat-pumps';
const STORY = 'decision:fixture';
const SHORT = `${STORY}/shorts/fixture-short`;
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

let root = '';
afterEach(() => rmSync(root, { recursive: true, force: true }));

function setup(events: PublishEvent[], shortEvents: PublishEvent[] = []) {
  root = mkdtempSync(join(tmpdir(), 'outputs-'));
  const review = (dir: string, x: object) => {
    mkdirSync(join(dir, 'video', 'review'), { recursive: true });
    writeFileSync(join(dir, 'video', 'review', 'review.json'), toJson(x));
  };
  review(scriptDir(TOPIC, STORY, root), { title: 'Fixture video', seconds: 300.2, chapters: CHAPTERS });
  const shortDir = scriptDir(TOPIC, SHORT, root);
  review(shortDir, { title: 'Fixture short', seconds: 40 });
  let ledger: Ledger = addOutput(emptyLedger(`${TOPIC}/${STORY}`), 'short:fixture-short', 'youtube-short', {
    derivedFrom: 'youtube',
    source: relative(root, shortDir).replaceAll('\\', '/'),
  });
  for (const e of events) ledger = appendEvent(ledger, 'youtube', e).ledger;
  for (const e of shortEvents) ledger = appendEvent(ledger, 'short:fixture-short', e).ledger;
  saveLedger(publishPath(TOPIC, STORY, root), ledger);
  return storyOutputs(TOPIC, STORY, root);
}

describe('public outputs', () => {
  it('no video until a published event', () => {
    expect(setup([ev('scheduled', '2026-11-01T00:00:00Z', { publishAt: '2026-11-02T00:00:00Z' })])).toEqual({
      video: null,
      releasing: null,
      shorts: [],
    });
  });

  it('a published main output is public with its chapters', () => {
    const { video } = setup([ev('published', '2026-11-02T10:00:00Z')]);
    expect(video).toMatchObject({
      output: 'youtube',
      kind: 'youtube-video',
      id: 'abc12345678',
      url: 'https://www.youtube.com/watch?v=abc12345678',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc12345678',
      publishedAt: '2026-11-02T10:00:00Z',
      title: 'Fixture video',
      seconds: 300.2,
    });
    expect(video!.chapters).toEqual(CHAPTERS.map(({ stamp, seconds, title }) => ({ stamp, seconds, title })));
  });

  it('unpublished after published hides it', () => {
    const out = setup([
      ev('published', '2026-11-02T10:00:00Z'),
      ev('unpublished', '2026-11-03T10:00:00Z', { note: 'taken down' }),
    ]);
    expect(out.video).toBeNull();
  });

  it('a private published event is not public', () => {
    expect(setup([ev('published', '2026-11-02T10:00:00Z', { visibility: 'private' })]).video).toBeNull();
  });

  it('a published Short appears under shorts with its shorts url', () => {
    const { shorts } = setup([], [ev('published', '2026-11-02T10:00:00Z', { id: 'shortid0001' })]);
    expect(shorts).toEqual([
      expect.objectContaining({
        output: 'short:fixture-short',
        kind: 'youtube-short',
        url: 'https://www.youtube.com/shorts/shortid0001',
        title: 'Fixture short',
        chapters: [],
      }),
    ]);
  });

  it('a re-release output not yet live leaves the live original on the page', () => {
    setup([ev('published', '2026-11-02T10:00:00Z')]);
    const path = publishPath(TOPIC, STORY, root);
    const ledger = JSON.parse(readFileSync(path, 'utf8')) as Ledger;
    saveLedger(path, addOutput(ledger, 'youtube-2', 'youtube-video'));
    expect(storyOutputs(TOPIC, STORY, root).video).toMatchObject({ output: 'youtube', id: 'abc12345678' });
  });

  describe('releasing: an approved upload the person decided ok for, before it is live', () => {
    const BUILD = 'b'.repeat(64);
    const upload = ev('uploaded', '2026-11-01T09:00:00Z', { build: BUILD, buildStatus: 'release', metadata: 'm1' });
    const approved = ev('approved', '2026-11-02T09:00:00Z', {
      build: BUILD,
      via: { channel: 'email', request: 'rq-000000000001' },
    });
    const decided = ev('decided', '2026-11-02T09:00:01Z', {
      request: 'rq-000000000001',
      verdict: 'ok',
      via: { channel: 'email', request: 'rq-000000000001' },
    });

    it('is set after approve and decide ok on the uploaded build, with the upload date; video stays null', () => {
      const out = setup([upload, approved, decided]);
      expect(out.video).toBeNull();
      expect(out.releasing).toMatchObject({
        output: 'youtube',
        id: 'abc12345678',
        url: 'https://www.youtube.com/watch?v=abc12345678',
        publishedAt: '2026-11-01T09:00:00Z',
        title: 'Fixture video',
      });
    });

    it('is null without the decision, after a later changes-requested on the build, or once published', () => {
      expect(setup([upload, approved]).releasing).toBeNull();
      expect(
        setup([upload, approved, decided, ev('changes-requested', '2026-11-02T10:00:00Z', { build: BUILD, notes: [] })])
          .releasing,
      ).toBeNull();
      const live = setup([upload, approved, decided, ev('published', '2026-11-02T11:00:00Z')]);
      expect(live.releasing).toBeNull();
      expect(live.video?.publishedAt).toBe('2026-11-02T11:00:00Z');
    });

    it("is null when the decision belongs to another build's request, or the verdict is schedule", () => {
      const other = ev('approved', '2026-11-02T09:00:00Z', {
        build: 'c'.repeat(64),
        via: { channel: 'email', request: 'rq-000000000001' },
      });
      expect(setup([upload, other, decided]).releasing).toBeNull();
      expect(setup([upload, approved, { ...decided, verdict: 'schedule' }]).releasing).toBeNull();
    });
  });

  it('seekUrl appends the whole second', () => {
    expect(seekUrl({ url: 'https://www.youtube.com/watch?v=abc12345678' }, 261.5)).toBe(
      'https://www.youtube.com/watch?v=abc12345678&t=261s',
    );
  });
});
