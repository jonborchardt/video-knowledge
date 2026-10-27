// The publishing ledger (publish.json): its shape, the idempotent append, the state an output's events derive to, the
// composed upload metadata, the CLI's verbs and their refusals. Nothing here touches YouTube: the ledger records what a
// person (or later an uploader) did.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
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
  failedSince,
  flowOf,
  lastCaptions,
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
  recordVerified,
  saveLedger,
  setThumbnail,
  uploadMetadataOf,
  sourceBuild,
  nestedSource,
  openOutput,
  publishPath,
  recordChangesRequested,
} from '../src/lib/publish';
import { type Fixture, setLook, syntheticProduction, syntheticShort } from './production-helpers';

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

  it('an event may carry the captions sha it sent; old events without one stay valid', () => {
    const l = example();
    expect(ledgerProblems(l, l.video)).toEqual([]);
    l.outputs.youtube.events[0].captions = 'c1';
    expect(ledgerProblems(l, l.video)).toEqual([]);
    (l.outputs.youtube.events[0] as unknown as Record<string, unknown>).captions = 3;
    expect(ledgerProblems(l, l.video)).toEqual(['outputs.youtube.events[0].captions: not a sha']);
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

  it("takes the package's tags unless the ledger sets them", () => {
    const f = join(dir, 'video', 'review', 'review.json');
    const rp = JSON.parse(readFileSync(f, 'utf8'));
    writeFileSync(f, JSON.stringify({ ...rp, tags: ['Commission on Spending'] }));
    expect(uploadMetadataOf(dir, rel, out())!.tags).toEqual(['Commission on Spending']);
    expect(uploadMetadataOf(dir, rel, out({ tags: ['ai'] }))!.tags).toEqual(['ai']);
    writeFileSync(f, JSON.stringify(rp));
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
  }, 30_000); // two synthetic productions; slow when the suite runs in parallel

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

  it('a release build drawn with an older look is refused approval and nothing is written', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      setLook(f.dir, 'old');
      expect(() => recordApproved(f.topic, f.story, { root: f.root, by: 'Jon' })).toThrow(
        /rendered with look old.*npm run video -- final/,
      );
      expect(loadLedger(f.topic, f.story, f.root)?.outputs.youtube?.events ?? []).toHaveLength(0);
      setLook(f.dir, undefined); // a report from before builds recorded their look
      expect(() => recordApproved(f.topic, f.story, { root: f.root, by: 'Jon' })).toThrow(/before builds recorded/);
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
    expect(uploadMetadataOf(dir, rel, out('youtube-short', { source: 'x.mp4' }))!.captions).toBeNull();
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

describe('a nested production as an output source (a Short)', () => {
  const root = join(tmp, 'nested-root');
  const parent = join(root, 'topics', 't', 'scripts', 'parent');
  const shortDir = join(parent, 'shorts', 'x');
  mkdirSync(join(parent, 'video', 'review'), { recursive: true });
  mkdirSync(join(shortDir, 'video', 'review'), { recursive: true });
  writeFileSync(
    join(parent, 'video', 'review', 'review.json'),
    JSON.stringify({ title: 'Parent', mp4: 'parent.mp4', mp4Sha: 'p1', status: 'release build', captionsSha: 'pc' }),
  );
  writeFileSync(join(parent, 'video', 'review', 'description.txt'), 'Parent description\n');
  writeFileSync(
    join(shortDir, 'video', 'review', 'review.json'),
    JSON.stringify({
      title: 'Short title',
      mp4: 'parent-short-x.mp4',
      mp4Sha: 's1',
      status: 'private review build',
      captionsSha: 'sc',
      thumbnailSha: 'st',
    }),
  );
  writeFileSync(join(shortDir, 'video', 'review', 'description.txt'), 'Hook\n\n#Shorts\n');
  const source = 'topics/t/scripts/parent/shorts/x';
  const rel = (f: string) => `topics/t/scripts/parent/${f}`;
  const short = (): Output => ({ kind: 'youtube-short', derivedFrom: 'youtube', source, metadata: {}, events: [] });

  it('is judged by its own package: build, title, description, captions and thumbnail from the nested folder', () => {
    expect(nestedSource(root, short())).toBe(source);
    expect(nestedSource(root, { source: 'topics/t/scripts/parent/nowhere' })).toBeNull();
    expect(sourceBuild(root, source)).toEqual({ sha: 's1', status: 'draft' });
    const m = uploadMetadataOf(parent, rel, short(), null, root)!;
    expect(m.title).toBe('Short title');
    expect(m.description).toBe('Hook\n\n#Shorts');
    expect(m.file).toBe(`${source}/video/review/parent-short-x.mp4`);
    expect(m.captions).toEqual({ file: `${source}/video/review/captions.en.srt`, sha: 'sc', language: 'en' });
    expect(m.thumbnail).toEqual({ file: `${source}/video/review/thumbnail.png`, sha: 'st' });
    // the parent's own output is untouched
    const main = uploadMetadataOf(parent, rel, { kind: 'youtube-video', metadata: {}, events: [] }, null, root)!;
    expect(main.title).toBe('Parent');
    expect(main.file).toBe('topics/t/scripts/parent/video/review/parent.mp4');
  });
});

describe('review decisions (the review page)', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const a = <T extends object>(f: Fixture, extra: T = {} as T) => ({ root: f.root, by: 'Jon', now, ...extra });
  const note = { text: 'too fast here', scene: 'sc02', sentence: 's02', seconds: 4 };

  it('approval binds the title: a hand-edited title asks for approval again', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      const r = recordApproved(f.topic, f.story, a(f));
      expect(r.event!.title).toBeTruthy();
      expect(openOutput(f.topic, f.story, { root: f.root }).state.status).toBe('approved');
      const l = loadLedger(f.topic, f.story, f.root)!;
      l.outputs.youtube.metadata.title = 'A different title';
      saveLedger(publishPath(f.topic, f.story, f.root), l);
      expect(openOutput(f.topic, f.story, { root: f.root }).state.status).not.toBe('approved');
    } finally {
      f.cleanup();
    }
  });

  it('an old approval without a title still counts', () => {
    const out: Output = { kind: 'youtube-video', metadata: {}, events: [ev('approved', { build: 'r1' })] };
    const ctx = { topic: 't', story: 's', output: 'youtube', title: 'Anything' };
    expect(outputState(out, { sha: 'r1', status: 'release' }, 'm1', ctx).status).toBe('approved');
  });

  it('changes requested on the current build wins over an earlier approval, and a later approval wins back', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      recordApproved(f.topic, f.story, a(f));
      const r = recordChangesRequested(f.topic, f.story, a(f, { build: 'releasesha', notes: [note] }));
      expect(r.event).toMatchObject({ type: 'changes-requested', build: 'releasesha', notes: [note] });
      const s = openOutput(f.topic, f.story, { root: f.root }).state;
      expect(s.status).toBe('changes-requested');
      expect(s.requested?.notes).toEqual([note]);
      expect(s.next).toContain('/produce');
      recordApproved(f.topic, f.story, a(f, { now: new Date('2026-10-27T00:00:00Z') }));
      expect(openOutput(f.topic, f.story, { root: f.root }).state.status).toBe('approved');
    } finally {
      f.cleanup();
    }
  });

  it('changes requested on an old build does not hold a new one', () => {
    const out: Output = {
      kind: 'youtube-video',
      metadata: {},
      events: [ev('changes-requested', { build: 'r1', notes: [note] })],
    };
    const ctx = { topic: 't', story: 's', output: 'youtube' };
    expect(outputState(out, { sha: 'r1', status: 'release' }, 'm1', ctx).status).toBe('changes-requested');
    expect(outputState(out, { sha: 'r2', status: 'release' }, 'm1', ctx).status).toBe('not-uploaded');
  });

  it('request changes refuses empty notes, a stale build and a placeholder name; it is idempotent', () => {
    const f = syntheticProduction('packaged');
    try {
      expect(() => recordChangesRequested(f.topic, f.story, a(f, { build: 'draftsha', notes: [] }))).toThrow(Refusal);
      expect(() => recordChangesRequested(f.topic, f.story, a(f, { build: 'old', notes: [note] }))).toThrow(
        /current build/,
      );
      expect(() =>
        recordChangesRequested(f.topic, f.story, a(f, { by: '<name>', build: 'draftsha', notes: [note] })),
      ).toThrow(/name/);
      // a draft can be sent back (it cannot be approved)
      expect(recordChangesRequested(f.topic, f.story, a(f, { build: 'draftsha', notes: [note] })).existing).toBe(false);
      expect(recordChangesRequested(f.topic, f.story, a(f, { build: 'draftsha', notes: [note] })).existing).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it('approve refuses an automated approver and an unticked checklist', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      const rp = join(f.dir, 'video', 'review', 'review.json');
      writeFileSync(rp, JSON.stringify({ ...readJson<object>(rp), checklist: ['one', 'two'] }));
      expect(() => recordApproved(f.topic, f.story, a(f, { by: 'automated: /produce run started by Jon' }))).toThrow(
        /person/,
      );
      expect(() => recordApproved(f.topic, f.story, a(f, { checked: 1 }))).toThrow(/checklist/);
      expect(recordApproved(f.topic, f.story, a(f, { checked: 2 })).existing).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it("a Short's decisions land on short:<slug> in the parent's ledger, bound to the Short's own build and title", () => {
    const f = syntheticShort('packaged', { release: true });
    try {
      const source = relative(f.root, f.dir).split(sep).join('/');
      addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source,
        root: f.root,
      });
      recordChangesRequested(f.topic, f.story, a(f, { build: 'shortreleasesha', notes: [note] }));
      const l = loadLedger(f.topic, f.parent, f.root)!;
      expect(l.outputs['short:fixture-short'].events.map((e) => e.type)).toEqual(['changes-requested']);
      expect(l.outputs.youtube.events).toEqual([]);
      const s = openOutput(f.topic, f.story, { root: f.root }).state;
      expect(s.next).toContain(`/produce ${f.topic} ${f.story}`);
      const r = recordApproved(f.topic, f.story, a(f, { now: new Date('2026-10-27T00:00:00Z') }));
      expect(r.event).toMatchObject({ build: 'shortreleasesha' });
      expect(r.event!.title).toBe(openOutput(f.topic, f.story, { root: f.root }).metadata!.title);
      expect(openOutput(f.topic, f.story, { root: f.root }).parentLive).toBe(false);
    } finally {
      f.cleanup();
    }
  });
});

describe('review fixes', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  it('a build approved again under a new title is approved', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      const l = loadLedger(f.topic, f.story, f.root)!;
      l.outputs.youtube.metadata.title = 'A better title';
      saveLedger(publishPath(f.topic, f.story, f.root), l);
      const r = recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now: new Date('2026-10-27T00:00:00Z') });
      expect(r.existing).toBe(false);
      expect(r.event!.title).toBe('A better title');
      expect(openOutput(f.topic, f.story, { root: f.root }).state.status).toBe('approved');
    } finally {
      f.cleanup();
    }
  });

  it('a scheduled upload stays scheduled through a title edit, and refuses a change request', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'aaaaaaaaaaa' });
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      recordScheduled(f.topic, f.story, { root: f.root, by: 'Jon', now, at: '2026-11-01T15:00:00Z' });
      const l = loadLedger(f.topic, f.story, f.root)!;
      l.outputs.youtube.metadata.title = 'Retitled';
      saveLedger(publishPath(f.topic, f.story, f.root), l);
      expect(openOutput(f.topic, f.story, { root: f.root }).state.status).toBe('scheduled');
      expect(() =>
        recordChangesRequested(f.topic, f.story, {
          root: f.root,
          by: 'Jon',
          now,
          build: 'releasesha',
          notes: [{ text: 'x' }],
        }),
      ).toThrow(/scheduled/);
    } finally {
      f.cleanup();
    }
  });
});

describe('going live is a person, on the latest decision, after the parent', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const a = <T extends object>(f: Fixture, extra: T = {} as T) => ({ root: f.root, by: 'Jon', now, ...extra });
  it('a public upload refuses a build sent back since its approval, and an automated run', () => {
    const f = syntheticProduction('packaged', { release: true });
    try {
      recordApproved(f.topic, f.story, a(f));
      const pub = (by = 'Jon') =>
        recordUploaded(f.topic, f.story, a(f, { by, id: 'aaaaaaaaaaa', visibility: 'public' as const }));
      expect(() => pub('automated: /produce run started by Jon')).toThrow(/person/);
      recordChangesRequested(f.topic, f.story, a(f, { build: 'releasesha', notes: [{ text: 'too fast' }] }));
      expect(() => pub()).toThrow(/not approved/);
      expect(loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events.map((e) => e.type)).toEqual([
        'approved',
        'changes-requested',
      ]);
    } finally {
      f.cleanup();
    }
  });

  it('the hand verbs refuse an automated run and a Short before its parent is live', () => {
    const f = syntheticShort('packaged', { release: true });
    try {
      const source = relative(f.root, f.dir).split(sep).join('/');
      addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source,
        root: f.root,
      });
      recordUploaded(f.topic, f.story, a(f, { id: 'bbbbbbbbbbb' }));
      recordApproved(f.topic, f.story, a(f));
      expect(() => recordPublished(f.topic, f.story, a(f))).toThrow(/youtube first/);
      expect(() => recordScheduled(f.topic, f.story, a(f, { at: '2026-11-01T00:00:00Z' }))).toThrow(/youtube first/);
      expect(() => recordPublished(f.topic, f.story, a(f, { by: 'automated: x' }))).toThrow(/person/);
      expect(recordPublished(f.topic, f.story, a(f, { observed: true })).event!.type).toBe('published'); // sync saw it
    } finally {
      f.cleanup();
    }
  });
});

describe('a Studio upload recorded by hand', () => {
  const now = new Date('2026-10-26T00:00:00Z');
  const later = new Date('2026-10-26T01:00:00Z');
  const later2 = new Date('2026-10-26T02:00:00Z');
  const fixtures: Fixture[] = [];
  afterAll(() => fixtures.forEach((f) => f.cleanup()));
  const fresh = (release = true) => {
    const f = syntheticProduction('packaged', { release });
    fixtures.push(f);
    return f;
  };
  const events = (f: Fixture) => loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
  const reviewPath = (f: Fixture) => join(f.dir, 'video', 'review', 'review.json');
  const patchReview = (f: Fixture, extra: Record<string, unknown>) =>
    writeFileSync(reviewPath(f), JSON.stringify({ ...readJson<object>(reviewPath(f)), ...extra }));

  it('uploaded --captions records the package captions sha so push does not resend them', () => {
    const f = fresh();
    const r = recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001', captionsSent: true });
    expect(r.event!.captions).toBe(openOutput(f.topic, f.story, { root: f.root }).metadata!.captions!.sha);
    expect(lastCaptions(loadLedger(f.topic, f.story, f.root)!.outputs.youtube)).toBe(r.event!.captions);
  });

  it('uploaded --captions is refused when the package has none', () => {
    const f = fresh();
    patchReview(f, { captionsSha: null });
    expect(() =>
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001', captionsSent: true }),
    ).toThrow(/has no captions/);
  });

  it('approve after a Studio re-upload of the same build names the latest upload', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'apiupload01' });
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now: later, id: 'studio00001' });
    const a = recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now: later2 });
    expect(a.event!.id).toBe('studio00001');
    expect(openOutput(f.topic, f.story, { root: f.root }).state).toMatchObject({
      status: 'approved',
      id: 'studio00001',
    });
  });

  it('a public Studio upload of the release build after a recorded draft upload records uploaded and published', () => {
    const f = fresh(false);
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'apiupload01' });
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now, build: 'draftsha', accepted: true });
    patchReview(f, { status: 'release build', mp4Sha: 'releasesha' }); // final made the release build
    expect(openOutput(f.topic, f.story, { root: f.root }).build).toMatchObject({
      sha: 'releasesha',
      status: 'release',
    });
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now: later });
    const r = recordUploaded(f.topic, f.story, {
      root: f.root,
      by: 'Jon',
      now: later2,
      id: 'studio00001',
      visibility: 'public',
    });
    expect(r.event).toMatchObject({ type: 'uploaded', buildStatus: 'release', visibility: 'public' });
    expect(events(f).at(-1)).toMatchObject({ type: 'published', id: 'studio00001' });
  });

  it('the CLI approve passes --checked and refuses without it', () => {
    const f = fresh();
    patchReview(f, { checklist: ['watched it', 'captions read'] });
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001' });
    expect(() => recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', checked: 0 })).toThrow(
      /pass --checked \d+/,
    );
    const n = readJson<{ checklist: string[] }>(reviewPath(f))!.checklist.length;
    expect(recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', checked: n }).event!.type).toBe('approved');
  });

  it('the release next step names --checked', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001' });
    expect(openOutput(f.topic, f.story, { root: f.root }).state.next).toContain('--checked <n>');
  });
});

describe('verification events', () => {
  const now = new Date('2026-10-27T00:00:00Z');
  const fixtures: Fixture[] = [];
  afterAll(() => fixtures.forEach((f) => f.cleanup()));
  const fresh = () => {
    const f = syntheticProduction('packaged', { release: true });
    fixtures.push(f);
    return f;
  };
  const events = (f: Fixture) => loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
  const a = (f: Fixture) => ({ root: f.root, by: 'Jon', now });

  it('a verification is recorded with its checks and validated', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { ...a(f), id: 'studio00001' });
    const r = recordVerified(f.topic, f.story, {
      ...a(f),
      result: 'passed',
      checks: [{ name: 'title', result: 'pass' }],
    });
    expect(r.event).toMatchObject({ type: 'verified', id: 'studio00001', result: 'passed', build: 'releasesha' });
    expect(r.event!.metadata).toBe(openOutput(f.topic, f.story, { root: f.root }).metadata!.sha);
    const bad = {
      video: 'v',
      outputs: {
        youtube: {
          kind: 'youtube-video',
          metadata: {},
          events: [
            {
              at: '2026-10-27T00:00:00Z',
              type: 'verified',
              by: 'Jon',
              id: 'x',
              result: 'maybe',
              checks: [{ result: 'pass' }],
            },
          ],
        },
      },
    };
    expect(ledgerProblems(bad, 'v')).toEqual(
      expect.arrayContaining([expect.stringMatching(/result/), expect.stringMatching(/checks\[0\]\.name/)]),
    );
  });

  it('a repeat of the latest verification is the same event', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { ...a(f), id: 'studio00001' });
    const pass = { result: 'passed' as const, checks: [{ name: 'title', result: 'pass' as const }] };
    const fail = { result: 'failed' as const, checks: [{ name: 'title', result: 'fail' as const, detail: 'differs' }] };
    recordVerified(f.topic, f.story, { ...a(f), ...pass });
    expect(recordVerified(f.topic, f.story, { ...a(f), ...pass }).existing).toBe(true);
    recordVerified(f.topic, f.story, { ...a(f), ...fail });
    expect(recordVerified(f.topic, f.story, { ...a(f), ...pass }).existing).toBe(false);
    expect(events(f).filter((e) => e.type === 'verified')).toHaveLength(3);
  });

  it('the same failure after a push is a new verification', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { ...a(f), id: 'studio00001' });
    const fail = { result: 'failed' as const, checks: [{ name: 'title', result: 'fail' as const, detail: 'differs' }] };
    recordVerified(f.topic, f.story, { ...a(f), ...fail });
    recordUpdated(f.topic, f.story, { ...a(f), fields: ['snippet'] }); // push resent it
    const again = recordVerified(f.topic, f.story, { ...a(f), ...fail });
    expect(again.existing).toBe(false);
    expect(failedSince(loadLedger(f.topic, f.story, f.root)!.outputs.youtube, ['title'])).toBe(true);
  });

  it('a verification does not hide a failure and is shown on the state', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { ...a(f), id: 'studio00001' });
    recordFailed(f.topic, f.story, { ...a(f), step: 'thumbnail', error: 'forbidden', retryable: false });
    recordVerified(f.topic, f.story, { ...a(f), result: 'passed', checks: [{ name: 'title', result: 'pass' }] });
    const s = openOutput(f.topic, f.story, { root: f.root }).state;
    expect(s.failed?.step).toBe('thumbnail');
    expect(s.verification?.result).toBe('passed');
    expect(s.status).toBe('uploaded');
  });

  it('refuses a verification before any upload', () => {
    const f = fresh();
    expect(() => recordVerified(f.topic, f.story, { ...a(f), result: 'passed', checks: [] })).toThrow(
      /nothing uploaded/,
    );
    expect(existsSync(publishPath(f.topic, f.story, f.root))).toBe(false);
  });

  it('failedSince reads only a verification after the last upload or update', () => {
    const f = fresh();
    recordUploaded(f.topic, f.story, { ...a(f), id: 'studio00001' });
    recordVerified(f.topic, f.story, {
      ...a(f),
      result: 'failed',
      checks: [{ name: 'title', result: 'fail', detail: 'differs' }],
    });
    const out = () => loadLedger(f.topic, f.story, f.root)!.outputs.youtube;
    expect(failedSince(out(), ['title'])).toBe(true);
    expect(failedSince(out(), ['captions'])).toBe(false);
    recordUpdated(f.topic, f.story, { ...a(f), fields: ['snippet'] });
    expect(failedSince(out(), ['title'])).toBe(false);
  });
});
