// The publishing ledger (publish.json): its shape, the idempotent append, the state an output's events derive to, the
// composed upload metadata, the CLI's verbs and their refusals. Nothing here touches YouTube: the ledger records what a
// person (or later an uploader) did.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, sha } from '../src/lib/io';
import { storySlug } from '../src/lib/script';
import {
  type Ledger,
  type Output,
  type PublishEvent,
  Refusal,
  addOutput,
  addOutputTo,
  appendEvent,
  currentBuild,
  emptyLedger,
  eventKey,
  flowOf,
  ledgerProblems,
  loadLedger,
  mainOutput,
  outputState,
  outputStates,
  parentUrlOf,
  recordApproved,
  recordFailed,
  recordPublished,
  recordScheduled,
  recordSimple,
  recordUpdated,
  recordUploaded,
  saveLedger,
  setThumbnail,
  uploadMetadataOf,
} from '../src/lib/publish';
import { type Fixture, syntheticProduction } from './production-helpers';

const tmp = mkdtempSync(join(tmpdir(), 'vk-publish-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const ev = (type: PublishEvent['type'], extra: Partial<PublishEvent> = {}, at = '2026-10-24T09:00:00Z'): PublishEvent =>
  ({ at, type, by: 'Jon', ...extra }) as PublishEvent;
const uploaded = (build: string, id: string, at?: string) =>
  ev('uploaded', { build, buildStatus: 'release', metadata: 'm1', id, visibility: 'private' }, at);

/** The spec's example ledger. */
const example = (): Ledger => ({
  video: 'ai-coding/decision:how-much-faster',
  outputs: {
    youtube: {
      kind: 'youtube-video',
      metadata: { tags: ['ai coding'], thumbnail: { file: 'video/publish/thumbnail.png', sha: 'abc' } },
      events: [
        uploaded('9b2dfb11fb', 'dQw4w9WgXcQ', '2026-10-24T09:00:00Z'),
        ev('approved', { build: '9b2dfb11fb', id: 'dQw4w9WgXcQ', note: 'clean' }, '2026-10-25T18:12:00Z'),
        ev('scheduled', { id: 'dQw4w9WgXcQ', publishAt: '2026-10-28T15:00:00Z' }, '2026-10-25T18:15:00Z'),
        ev('published', { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }, '2026-10-28T15:01:00Z'),
        ev('updated', { id: 'dQw4w9WgXcQ', metadata: 'a91f22d0c4', fields: ['thumbnail'] }, '2026-11-02T10:00:00Z'),
      ],
    },
    'short-1': {
      kind: 'youtube-short',
      derivedFrom: 'youtube',
      source: 'video/shorts/short-1.mp4',
      metadata: { title: 'Developers were slower with AI' },
      events: [ev('failed', { step: 'upload', error: 'quota exceeded', retryable: true, by: 'uploader' })],
    },
  },
});

describe('ledger', () => {
  it('starts with one youtube output', () => {
    expect(emptyLedger('t/s').outputs.youtube.kind).toBe('youtube-video');
    expect(emptyLedger('t/s').video).toBe('t/s');
  });

  it("accepts the spec's example", () => {
    expect(ledgerProblems(example(), 'ai-coding/decision:how-much-faster')).toEqual([]);
  });

  it('names the field that is wrong', () => {
    const bad = (mutate: (l: Ledger) => void) => {
      const l = example();
      mutate(l);
      return ledgerProblems(l, 'ai-coding/decision:how-much-faster');
    };
    expect(bad((l) => (l.video = 'other'))[0]).toMatch(/video/);
    expect(bad((l) => ((l.outputs.youtube.events[0] as { type: string }).type = 'liked'))[0]).toMatch(/type/);
    expect(bad((l) => delete (l.outputs.youtube.events[1] as Partial<PublishEvent>).by)[0]).toMatch(/by/);
    expect(bad((l) => (l.outputs['short-1'].derivedFrom = 'nope'))[0]).toMatch(/derivedFrom/);
    expect(bad((l) => delete l.outputs.youtube.events[0].build)[0]).toMatch(/build/);
    expect(bad((l) => delete l.outputs.youtube.events[2].publishAt)[0]).toMatch(/publishAt/);
    expect(bad((l) => delete l.outputs['short-1'].events[0].error)[0]).toMatch(/error/);
    expect(bad((l) => (l.outputs.youtube.events[3].at = '2026-01-01T00:00:00Z'))[0]).toMatch(/at .* before/);
    expect(
      bad((l) => ((l.outputs.youtube.metadata as Record<string, unknown>).containsSyntheticMedia = 'yes'))[0],
    ).toMatch(/containsSyntheticMedia/);
  });

  it('appends once per key', () => {
    let l = emptyLedger('t/s');
    const first = appendEvent(l, 'youtube', uploaded('b1', 'id1'));
    expect(first.existing).toBeNull();
    const again = appendEvent(first.ledger, 'youtube', uploaded('b1', 'id1', '2026-10-25T00:00:00Z'));
    expect(again.existing).toEqual(first.ledger.outputs.youtube.events[0]);
    expect(again.ledger.outputs.youtube.events).toHaveLength(1);
    l = appendEvent(again.ledger, 'youtube', uploaded('b1', 'id2')).ledger; // the same build, another id: a re-upload
    expect(l.outputs.youtube.events).toHaveLength(2);
    const f = ev('failed', { step: 'upload', error: 'x' });
    l = appendEvent(appendEvent(l, 'youtube', f).ledger, 'youtube', f).ledger;
    expect(l.outputs.youtube.events.filter((e) => e.type === 'failed')).toHaveLength(2);
    expect(eventKey(f)).toBeNull();
    // publish, unpublish, publish again is three events; a repeat of the latest is not
    const pub = ev('published', { id: 'id1' });
    l = appendEvent(l, 'youtube', pub).ledger;
    expect(appendEvent(l, 'youtube', pub).existing).toEqual(pub);
    l = appendEvent(l, 'youtube', ev('unpublished', { id: 'id1', note: 'oops' })).ledger;
    l = appendEvent(l, 'youtube', pub).ledger;
    expect(l.outputs.youtube.events.filter((e) => e.type === 'published')).toHaveLength(2);
    // metadata A, B, A: every update is its own event (the verb refuses an unchanged sha itself)
    const upd = (m: string) => ev('updated', { id: 'id1', metadata: m, fields: ['thumbnail'] });
    l = [upd('a'), upd('b'), upd('a')].reduce((x, e) => appendEvent(x, 'youtube', e).ledger, l);
    expect(l.outputs.youtube.events.filter((e) => e.type === 'updated')).toHaveLength(3);
    // a reschedule is a new event
    const sch = (at: string) => ev('scheduled', { id: 'id1', publishAt: at });
    l = appendEvent(
      appendEvent(l, 'youtube', sch('2026-11-01T00:00:00Z')).ledger,
      'youtube',
      sch('2026-11-02T00:00:00Z'),
    ).ledger;
    expect(l.outputs.youtube.events.filter((e) => e.type === 'scheduled')).toHaveLength(2);
  });

  it('refuses an event for an output that does not exist', () => {
    expect(() => appendEvent(emptyLedger('t/s'), 'nope', uploaded('b1', 'id1'))).toThrow(/nope/);
  });

  it('the main output is the last live youtube video', () => {
    let l = emptyLedger('t/s');
    expect(mainOutput(l)).toBe('youtube');
    l = appendEvent(l, 'youtube', ev('retracted', { note: 'wrong channel' })).ledger;
    expect(mainOutput(l)).toBeNull();
    l = addOutput(l, 'youtube-2', 'youtube-video');
    expect(mainOutput(l)).toBe('youtube-2');
    expect(mainOutput(addOutput(emptyLedger('t/s'), 'blog', 'blog-post'))).toBe('youtube');
  });

  it('adds an output once', () => {
    const l = addOutput(emptyLedger('t/s'), 'short-1', 'youtube-short', { derivedFrom: 'youtube' });
    expect(l.outputs['short-1']).toEqual({ kind: 'youtube-short', derivedFrom: 'youtube', metadata: {}, events: [] });
    expect(() => addOutput(l, 'short-1', 'youtube-short')).toThrow(/exists/);
    expect(() => addOutput(l, 'short-2', 'youtube-short', { derivedFrom: 'nope' })).toThrow(/derivedFrom/);
  });

  it('saves atomically and round-trips', () => {
    const path = join(tmp, 'publish.json');
    saveLedger(path, example());
    expect(readJson<Ledger>(path)).toEqual(example());
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });
});

describe('outputState', () => {
  const release = { sha: 'r1', status: 'release' } as const;
  const draft = { sha: 'd1', status: 'draft' } as const;
  const ctx = {
    topic: 'ai-coding',
    story: 'decision:how-much-faster',
    output: 'youtube',
    now: new Date('2026-10-26T00:00:00Z'),
  };
  const out = (...events: PublishEvent[]): Output => ({ kind: 'youtube-video', metadata: {}, events });
  const up = (build: string, id: string, status: 'draft' | 'release' = 'release') =>
    ev('uploaded', { build, buildStatus: status, metadata: 'm1', id, visibility: 'private' });

  it('starts not uploaded', () => {
    const s = outputState(out(), release, 'm1', ctx);
    expect(s.status).toBe('not-uploaded');
    expect(s.next).toContain('npm run publish -- upload ai-coding decision:how-much-faster');
    expect(s.next).not.toContain('uploaded');
  });

  it('an uploaded draft waits for final, an uploaded release for approve', () => {
    expect(outputState(out(up('d1', 'id1', 'draft')), draft, 'm1', ctx).next).toContain('npm run video -- final');
    const s = outputState(out(up('r1', 'id1')), release, 'm1', ctx);
    expect(s.status).toBe('uploaded');
    expect(s.id).toBe('id1');
    expect(s.next).toContain('npm run publish -- approve ai-coding decision:how-much-faster --by');
  });

  it('a new build after an upload is build-behind; the old upload is superseded once the new one lands', () => {
    const s = outputState(out(up('d1', 'id1', 'draft')), release, 'm1', ctx);
    expect(s.status).toBe('build-behind');
    expect(s.next).toContain('npm run publish -- upload ai-coding');
    expect(s.superseded).toEqual([]);
    const s2 = outputState(out(up('d1', 'id1', 'draft'), up('r1', 'id2')), release, 'm1', ctx);
    expect(s2.status).toBe('uploaded');
    expect(s2.superseded).toEqual(['id1']);
    expect(s2.uploadedBuild).toBe('r1');
  });

  it('approved, then scheduled, which falls due', () => {
    const base = [up('r1', 'id1'), ev('approved', { build: 'r1', id: 'id1' })];
    expect(outputState(out(...base), release, 'm1', ctx).status).toBe('approved');
    expect(outputState(out(...base), release, 'm1', ctx).next).toContain('npm run publish -- go-live ai-coding');
    const soon = outputState(
      out(...base, ev('scheduled', { id: 'id1', publishAt: '2026-10-28T15:00:00Z' })),
      release,
      'm1',
      ctx,
    );
    expect(soon.status).toBe('scheduled');
    expect(soon.due).toBe(false);
    const due = outputState(
      out(...base, ev('scheduled', { id: 'id1', publishAt: '2026-10-20T15:00:00Z' })),
      release,
      'm1',
      ctx,
    );
    expect(due.due).toBe(true);
    expect(due.next).toContain('npm run publish -- sync ai-coding');
  });

  it('published stays published when the build on disk moves on', () => {
    const o = out(
      up('r1', 'id1'),
      ev('approved', { build: 'r1' }),
      ev('published', { id: 'id1', url: 'https://youtu.be/id1' }),
    );
    const s = outputState(o, { sha: 'r2', status: 'release' }, 'm1', ctx);
    expect(s.status).toBe('published');
    expect(s.url).toBe('https://youtu.be/id1');
    expect(s.next).toContain('npm run publish -- add ai-coding decision:how-much-faster youtube-2');
  });

  it('metadata behind, until an update records the new sha', () => {
    const o = out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' }));
    const s = outputState(o, release, 'm2', ctx);
    expect(s.status).toBe('metadata-behind');
    expect(s.live).toBe(true); // still live: the board keeps it in the published column
    expect(s.next).toContain('npm run publish -- push ai-coding');
    o.events.push(ev('updated', { id: 'id1', metadata: 'm2', fields: ['thumbnail'] }));
    expect(outputState(o, release, 'm2', ctx).status).toBe('published');
  });

  it('publish, unpublish, publish again', () => {
    const o = out(
      up('r1', 'id1'),
      ev('approved', { build: 'r1' }),
      ev('scheduled', { id: 'id1', publishAt: '2026-10-20T00:00:00Z' }),
      ev('published', { id: 'id1' }),
      ev('unpublished', { id: 'id1', note: 'typo' }),
    );
    const s = outputState(o, release, 'm1', ctx);
    expect(s.status).toBe('approved'); // the old schedule is history
    expect(s.live).toBe(false);
    o.events.push(ev('published', { id: 'id1' }));
    expect(outputState(o, release, 'm1', ctx).live).toBe(true);
  });

  it('an output with its own source file is judged against that file, not the video build', () => {
    const src = join(tmp, 'shorts', 's1.mp4');
    mkdirSync(join(tmp, 'shorts'), { recursive: true });
    writeFileSync(src, 'short bytes');
    const own = sha(readFileSync(src));
    const l = addOutput(emptyLedger('t/s'), 'short-1', 'youtube-short', { source: 'shorts/s1.mp4' });
    const c = { topic: 't', story: 's', root: tmp };
    const behind = appendEvent(l, 'short-1', uploaded('r1', 'id9')).ledger; // recorded against the main video's build
    expect(outputStates(behind, release, () => null, c)['short-1'].status).toBe('build-behind');
    const right = appendEvent(l, 'short-1', uploaded(own, 'id9')).ledger;
    expect(outputStates(right, release, () => null, c)['short-1'].status).toBe('uploaded');
  });

  it('a failure is an overlay on the state before it', () => {
    const o = out(up('r1', 'id1'), ev('failed', { step: 'approve', error: 'boom', retryable: true }));
    const s = outputState(o, release, 'm1', ctx);
    expect(s.status).toBe('uploaded');
    expect(s.failed?.error).toBe('boom');
    expect(s.next).toContain('retry');
  });

  it('retracted', () => {
    expect(outputState(out(ev('retracted', { note: 'no' })), release, 'm1', ctx).status).toBe('retracted');
  });

  it('survives a missing review package', () => {
    const o = out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' }));
    const s = outputState(o, null, null, ctx);
    expect(s.status).toBe('published');
    const fresh = outputState(out(up('r1', 'id1')), null, null, ctx);
    expect(fresh.status).toBe('uploaded');
    expect(fresh.next).toContain('package');
  });

  it('reads the current build from the review package', () => {
    const dir = join(tmp, 'cb');
    expect(currentBuild(dir)).toBeNull();
    mkdirSync(join(dir, 'video', 'review'), { recursive: true });
    writeFileSync(
      join(dir, 'video', 'review', 'review.json'),
      JSON.stringify({ mp4Sha: 'abc', status: 'release build' }),
    );
    expect(currentBuild(dir)).toEqual({ sha: 'abc', status: 'release' });
    writeFileSync(
      join(dir, 'video', 'review', 'review.json'),
      JSON.stringify({ mp4Sha: 'abd', status: 'private review build' }),
    );
    expect(currentBuild(dir)).toEqual({ sha: 'abd', status: 'draft' });
  });
});

describe('uploadMetadataOf', () => {
  const dir = join(tmp, 'meta');
  mkdirSync(join(dir, 'video', 'review'), { recursive: true });
  writeFileSync(
    join(dir, 'video', 'review', 'review.json'),
    JSON.stringify({
      title: 'How Fast?',
      mp4: 'slug.mp4',
      mp4Sha: 'r1',
      status: 'release build',
      thumbnailSha: 'card1',
    }),
  );
  writeFileSync(join(dir, 'video', 'review', 'description.txt'), 'How fast?\n\nChapters\n0:00 Hook\n');
  const rel = (f: string) => `topics/t/scripts/slug/${f}`;
  const out = (metadata: Output['metadata'] = {}): Output => ({ kind: 'youtube-video', metadata, events: [] });

  it('comes from the review package when nothing overrides it', () => {
    const m = uploadMetadataOf(dir, rel, out())!;
    expect(m.title).toBe('How Fast?');
    expect(m.description).toBe('How fast?\n\nChapters\n0:00 Hook');
    expect(m.file).toBe('topics/t/scripts/slug/video/review/slug.mp4');
    expect(m.thumbnail).toEqual({ file: 'topics/t/scripts/slug/video/review/thumbnail.png', sha: 'card1' });
    expect(m.tags).toEqual([]);
  });

  it('applies the overrides', () => {
    const m = uploadMetadataOf(dir, rel, out({ title: 'Faster?', descriptionAppend: 'More.', tags: ['ai'] }))!;
    expect(m.title).toBe('Faster?');
    expect(m.description).toBe('How fast?\n\nChapters\n0:00 Hook\n\nMore.');
    expect(m.tags).toEqual(['ai']);
    expect(m.sha).not.toBe(uploadMetadataOf(dir, rel, out())!.sha);
  });

  it('a new thumbnail changes the sha and nothing else', () => {
    const a = uploadMetadataOf(dir, rel, out())!;
    const b = uploadMetadataOf(dir, rel, out({ thumbnail: { file: 'video/publish/thumbnail.png', sha: 'mine' } }))!;
    expect(b.thumbnail).toEqual({ file: 'video/publish/thumbnail.png', sha: 'mine' });
    expect(b.sha).not.toBe(a.sha);
    expect({ ...a, sha: 0, thumbnail: 0 }).toEqual({ ...b, sha: 0, thumbnail: 0 });
  });

  it('hashes the same with CRLF and LF', () => {
    const a = uploadMetadataOf(dir, rel, out())!.sha;
    writeFileSync(join(dir, 'video', 'review', 'description.txt'), 'How fast?\r\n\r\nChapters\r\n0:00 Hook\r\n');
    expect(uploadMetadataOf(dir, rel, out())!.sha).toBe(a);
  });

  it('is null without a review package', () => {
    expect(uploadMetadataOf(join(tmp, 'nowhere'), rel, out())).toBeNull();
  });
});

describe('verbs', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const rel = syntheticProduction('packaged', { release: true });
  const rel2 = syntheticProduction('packaged', { release: true });
  const draft = syntheticProduction('packaged');
  afterAll(() => [rel, rel2, draft].forEach((f) => f.cleanup()));
  const a = <T extends object>(f: Fixture, extra: T = {} as T) => ({ root: f.root, by: 'Jon', now, ...extra });
  const events = (f: Fixture, output = 'youtube') => loadLedger(f.topic, f.story, f.root)!.outputs[output].events;

  it('records an upload once per build and id, with the build and the metadata it sent', () => {
    const r = recordUploaded(rel.topic, rel.story, a(rel, { id: 'dQw4w9WgXcQ', visibility: 'private' }));
    expect(r.existing).toBe(false);
    expect(r.event).toMatchObject({ type: 'uploaded', build: 'releasesha', buildStatus: 'release', id: 'dQw4w9WgXcQ' });
    const meta = uploadMetadataOf(rel.dir, (f) => f, loadLedger(rel.topic, rel.story, rel.root)!.outputs.youtube)!;
    expect(r.event!.metadata).toBe(meta.sha);
    expect(recordUploaded(rel.topic, rel.story, a(rel, { id: 'dQw4w9WgXcQ' })).existing).toBe(true);
    expect(events(rel)).toHaveLength(1);
  });

  it('a public upload needs the build approved first, and lands as published', () => {
    const pub = () => recordUploaded(rel.topic, rel.story, a(rel, { id: 'aaaaaaaaaaa', visibility: 'public' }));
    expect(pub).toThrow(Refusal);
    expect(pub).toThrow(/approved/);
    recordApproved(rel.topic, rel.story, a(rel, { note: 'checklist clean' }));
    recordUploaded(
      rel.topic,
      rel.story,
      a(rel, { id: 'aaaaaaaaaaa', visibility: 'public', url: 'https://youtu.be/aaaaaaaaaaa' }),
    );
    expect(events(rel).map((e) => e.type)).toEqual(['uploaded', 'approved', 'uploaded', 'published']);
    expect(events(rel).at(-1)).toMatchObject({ id: 'aaaaaaaaaaa', url: 'https://youtu.be/aaaaaaaaaaa' });
  });

  it('approve needs a real name and a build it can stand on', () => {
    expect(() => recordApproved(rel2.topic, rel2.story, a(rel2, { by: '<your name>' }))).toThrow(/name/);
    expect(() => recordApproved(draft.topic, draft.story, a(draft))).toThrow(/draft|upload/); // a draft nobody has uploaded
    const r = recordApproved(rel2.topic, rel2.story, a(rel2)); // the local release build is enough
    expect(r.event).toMatchObject({ type: 'approved', build: 'releasesha' });
    expect(recordApproved(rel2.topic, rel2.story, a(rel2)).existing).toBe(true);
  });

  it('scheduled needs an approved upload and a future time; published follows', () => {
    expect(() => recordScheduled(draft.topic, draft.story, a(draft, { at: '2026-11-01T00:00:00Z' }))).toThrow(Refusal);
    recordUploaded(rel2.topic, rel2.story, a(rel2, { id: 'bbbbbbbbbbb' }));
    expect(() => recordScheduled(rel2.topic, rel2.story, a(rel2, { at: '2026-10-01T00:00:00Z' }))).toThrow(/past/);
    expect(recordScheduled(rel2.topic, rel2.story, a(rel2, { at: '2026-11-01T00:00:00Z' })).event).toMatchObject({
      type: 'scheduled',
      id: 'bbbbbbbbbbb',
      publishAt: '2026-11-01T00:00:00Z',
    });
    expect(recordPublished(rel2.topic, rel2.story, a(rel2)).event).toMatchObject({
      type: 'published',
      id: 'bbbbbbbbbbb',
    });
    expect(() => recordPublished(draft.topic, draft.story, a(draft))).toThrow(Refusal);
  });

  it('updated records a changed metadata sha and nothing when unchanged', () => {
    expect(recordUpdated(rel2.topic, rel2.story, a(rel2, { fields: ['title'] })).existing).toBe(true);
    const png = join(rel2.dir, 'video', 'publish', 'thumbnail.png');
    mkdirSync(join(rel2.dir, 'video', 'publish'), { recursive: true });
    writeFileSync(png, 'not really a png');
    expect(setThumbnail(rel2.topic, rel2.story, { root: rel2.root, file: png })).toMatch(/^[0-9a-f]{10}$/);
    const t = loadLedger(rel2.topic, rel2.story, rel2.root)!.outputs.youtube.metadata.thumbnail!;
    expect(t.file).toMatch(/^topics\/.*\/video\/publish\/thumbnail\.png$/);
    const r = recordUpdated(rel2.topic, rel2.story, a(rel2, { fields: ['thumbnail'] }));
    expect(r.existing).toBe(false);
    expect(r.event).toMatchObject({ type: 'updated', fields: ['thumbnail'] });
  });

  it('unpublish, then publish again', () => {
    recordSimple(rel2.topic, rel2.story, 'unpublished', a(rel2, { note: 'typo in the title card' }));
    const r = recordPublished(rel2.topic, rel2.story, a(rel2));
    expect(r.existing).toBe(false);
    expect(r.event!.type).toBe('published');
  });

  it('a draft build is accepted only by final and never goes public', () => {
    const d2 = syntheticProduction('packaged');
    const d3 = syntheticProduction('packaged');
    try {
      // final accepts a draft nobody uploaded
      expect(recordApproved(d3.topic, d3.story, a(d3, { build: 'draftsha', accepted: true })).event).toMatchObject({
        type: 'approved',
        build: 'draftsha',
      });
      recordUploaded(d2.topic, d2.story, a(d2, { id: 'eeeeeeeeeee' }));
      expect(() => recordApproved(d2.topic, d2.story, a(d2))).toThrow(/draft/);
      expect(recordApproved(d2.topic, d2.story, a(d2, { build: 'draftsha', accepted: true })).existing).toBe(false);
      expect(() => recordUploaded(d2.topic, d2.story, a(d2, { id: 'fffffffffff', visibility: 'public' }))).toThrow(
        /draft/,
      );
      expect(() => recordScheduled(d2.topic, d2.story, a(d2, { at: '2026-11-01T00:00:00Z' }))).toThrow(/draft/);
      expect(() => recordPublished(d2.topic, d2.story, a(d2))).toThrow(/draft/);
    } finally {
      d2.cleanup();
      d3.cleanup();
    }
  });

  it('refuses a missing or non-image thumbnail', () => {
    expect(() => setThumbnail(rel2.topic, rel2.story, { root: rel2.root, file: join(rel2.dir, 'nope.png') })).toThrow(
      Refusal,
    );
    expect(() =>
      setThumbnail(rel2.topic, rel2.story, { root: rel2.root, file: join(rel2.dir, 'script.json') }),
    ).toThrow(/png|jpe?g/i);
  });

  it('refuses a follow-up story and a YouTube URL in place of an id', () => {
    expect(() =>
      recordUploaded('heat-pumps', 'decision:when-does-it-pay-for-itself', a(rel, { id: 'ccccccccccc' })),
    ).toThrow(/follow-up/);
    expect(() => recordUploaded(draft.topic, draft.story, a(draft, { id: 'https://youtu.be/dQw4w9WgXcQ' }))).toThrow(
      /dQw4w9WgXcQ/,
    );
    expect(() => recordUploaded(draft.topic, draft.story, a(draft, { id: 'short' }))).toThrow(/id/);
  });

  it('a draft upload waits for final; failures and simple events append', () => {
    recordUploaded(draft.topic, draft.story, a(draft, { id: 'ddddddddddd' }));
    expect(events(draft)[0]).toMatchObject({ buildStatus: 'draft', build: 'draftsha' });
    recordFailed(draft.topic, draft.story, a(draft, { step: 'upload', error: 'quota', retryable: true }));
    recordFailed(draft.topic, draft.story, a(draft, { step: 'upload', error: 'quota', retryable: true }));
    expect(events(draft).filter((e) => e.type === 'failed')).toHaveLength(2);
    recordSimple(draft.topic, draft.story, 'retracted', a(draft, { note: 'wrong channel' }));
    expect(events(draft).at(-1)!.type).toBe('retracted');
  });

  it('adds an output', () => {
    addOutputTo(draft.topic, draft.story, 'short-1', 'youtube-short', { root: draft.root, derivedFrom: 'youtube' });
    expect(loadLedger(draft.topic, draft.story, draft.root)!.outputs['short-1'].derivedFrom).toBe('youtube');
    expect(() => addOutputTo(draft.topic, draft.story, 'short-1', 'youtube-short', { root: draft.root })).toThrow(
      /exists/,
    );
    expect(() =>
      addOutputTo(draft.topic, draft.story, 'blog', 'blog-post', { root: draft.root, source: 'nope.md' }),
    ).toThrow(/nope\.md/);
  });
});

describe('derivative flows', () => {
  const ctx = { topic: 't', story: 's', output: 'blog', now: new Date('2026-10-26T00:00:00Z') };
  const blog = (...events: PublishEvent[]): Output => ({
    kind: 'blog-post',
    source: 'blog/post.md',
    metadata: {},
    events,
  });

  it('a blog post needs no upload: made, approved, published', () => {
    expect(flowOf('blog-post')).toBe('generic');
    expect(flowOf('youtube-short')).toBe('youtube');
    const made = outputState(blog(), null, null, ctx);
    expect(made.status).toBe('not-uploaded');
    expect(made.next).toContain('npm run publish -- approve t s --output blog');
    expect(outputState(blog(ev('approved', { build: 'src1' })), null, null, ctx).status).toBe('approved');
    const live = outputState(
      blog(
        ev('approved', { build: 'src1' }),
        ev('published', { id: 'https://example.org/post', url: 'https://example.org/post' }),
      ),
      null,
      null,
      ctx,
    );
    expect(live.status).toBe('published');
    expect(live.url).toBe('https://example.org/post');
  });

  it('a derivative waits for its parent to be live', () => {
    const l = addOutput(emptyLedger('t/s'), 'short-1', 'youtube-short', { derivedFrom: 'youtube' });
    const states = outputStates(l, null, () => null, { topic: 't', story: 's' });
    expect(states['short-1'].status).toBe('not-uploaded');
    expect(states['short-1'].next).toMatch(/publish youtube first/);
    const live = appendEvent(
      appendEvent(appendEvent(l, 'youtube', uploaded('r1', 'id1')).ledger, 'youtube', ev('approved', { build: 'r1' }))
        .ledger,
      'youtube',
      ev('published', { id: 'id1' }),
    ).ledger;
    expect(outputStates(live, null, () => null, { topic: 't', story: 's' })['short-1'].next).not.toMatch(/first/);
  });

  it('a short is uploaded and approved as its own file', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      const src = `topics/${f.topic}/scripts/${storySlug(f.story)}/video/shorts/short-1.mp4`;
      mkdirSync(join(f.dir, 'video', 'shorts'), { recursive: true });
      writeFileSync(join(f.root, src), 'short bytes');
      addOutputTo(f.topic, f.story, 'short-1', 'youtube-short', { root: f.root, derivedFrom: 'youtube', source: src });
      const r = recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', output: 'short-1', id: 'ggggggggggg' });
      expect(r.event!.build).toBe(sha(readFileSync(join(f.root, src))));
    } finally {
      f.cleanup();
    }
  });

  it('approve and publish a generic output through the verbs', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      mkdirSync(join(f.root, 'blog'), { recursive: true });
      writeFileSync(join(f.root, 'blog', 'post.md'), '# post');
      addOutputTo(f.topic, f.story, 'blog', 'blog-post', { root: f.root, source: 'blog/post.md' });
      const a = { root: f.root, by: 'Jon', output: 'blog' };
      expect(() => recordPublished(f.topic, f.story, { ...a, url: 'https://example.org/p' })).toThrow(Refusal);
      const ok = recordApproved(f.topic, f.story, a);
      expect(ok.event!.build).toMatch(/^[0-9a-f]{10}$/); // the source file's sha stands in for the build
      const pub = recordPublished(f.topic, f.story, { ...a, url: 'https://example.org/p' });
      expect(pub.event).toMatchObject({ type: 'published', id: 'https://example.org/p', url: 'https://example.org/p' });
    } finally {
      f.cleanup();
    }
  });
});

describe('captions and the parent link in the composed metadata', () => {
  const dir = join(tmp, 'meta2');
  mkdirSync(join(dir, 'video', 'review'), { recursive: true });
  const review = (extra: Record<string, unknown>) =>
    writeFileSync(
      join(dir, 'video', 'review', 'review.json'),
      JSON.stringify({ title: 'T', mp4: 'slug.mp4', mp4Sha: 'r1', status: 'release build', ...extra }),
    );
  const rel = (f: string) => `topics/t/scripts/slug/${f}`;
  const out = (kind = 'youtube-video', extra: Partial<Output> = {}): Output => ({
    kind,
    metadata: {},
    events: [],
    ...extra,
  });

  it('carries the package captions and hashes them', () => {
    review({});
    const none = uploadMetadataOf(dir, rel, out())!;
    expect(none.captions).toBeNull();
    review({ captionsSha: 'c1' });
    const m = uploadMetadataOf(dir, rel, out())!;
    expect(m.captions).toEqual({
      file: 'topics/t/scripts/slug/video/review/captions.en.srt',
      sha: 'c1',
      language: 'en',
    });
    expect(m.sha).not.toBe(none.sha);
  });

  it('a derivative links the full video once its parent is live; a main output never does', () => {
    review({});
    const short = out('youtube-short', { derivedFrom: 'youtube' });
    const linked = uploadMetadataOf(dir, rel, short, 'https://youtu.be/parent00001')!;
    expect(linked.description.endsWith('\n\nFull video: https://youtu.be/parent00001')).toBe(true);
    expect(linked.sha).not.toBe(uploadMetadataOf(dir, rel, short, null)!.sha);
    expect(uploadMetadataOf(dir, rel, out(), 'https://youtu.be/parent00001')!.description).not.toContain('Full video');
  });

  it('parentUrlOf is the parent output live url, or null', () => {
    let l = addOutput(emptyLedger('t/s'), 'short-1', 'youtube-short', { derivedFrom: 'youtube' });
    expect(parentUrlOf(l, l.outputs['short-1'])).toBeNull();
    expect(parentUrlOf(l, l.outputs.youtube)).toBeNull();
    l = appendEvent(l, 'youtube', uploaded('r1', 'parent00001')).ledger;
    expect(parentUrlOf(l, l.outputs['short-1'])).toBeNull();
    l = appendEvent(l, 'youtube', ev('published', { id: 'parent00001' })).ledger;
    expect(parentUrlOf(l, l.outputs['short-1'])).toBe('https://youtu.be/parent00001');
    l = appendEvent(l, 'youtube', ev('unpublished', { id: 'parent00001', note: 'x' })).ledger;
    expect(parentUrlOf(l, l.outputs['short-1'])).toBeNull();
  });

  it('a published short tells the person to set the related video in Studio', () => {
    const o: Output = {
      kind: 'youtube-short',
      derivedFrom: 'youtube',
      source: 'x.mp4',
      metadata: {},
      events: [uploaded('s1', 'short000001'), ev('approved', { build: 's1' }), ev('published', { id: 'short000001' })],
    };
    const s = outputState(o, { sha: 's1', status: 'release' }, 'm1', { topic: 't', story: 's', output: 'short-1' });
    expect(s.status).toBe('published');
    expect(s.next).toMatch(/related video.*YouTube Studio/);
  });
});
