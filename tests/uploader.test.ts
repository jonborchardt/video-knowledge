// The uploader verbs over the ledger with a fake YouTube client: what they send, what they record, what they refuse,
// and how a crash or a lost session is recovered without a second upload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, sha, toJson } from '../src/lib/io';
import {
  type Ledger,
  addOutputTo,
  loadLedger,
  recordApproved,
  recordUploaded,
  saveLedger,
  publishPath,
} from '../src/lib/publish';
import { Refusal } from '../src/lib/publish';
import { storySlug } from '../src/lib/script';
import {
  CATEGORY_DEFAULT,
  MIN_SCHEDULE_LEAD_MS,
  SCHEDULE_GRACE_MS,
  SESSION_FILE,
  type Session,
  goLive,
  push,
  sync,
  upload,
  uploadProblem,
} from '../src/lib/uploader';
import { type RemoteVideo, type YouTubeClient, YouTubeError } from '../src/lib/youtube';
import { type Fixture, syntheticProduction, syntheticShort } from './production-helpers';

/** The packaged fixture has no media; give it an mp4 the review.json describes and the thumbnail it names. */
function withMedia(f: Fixture): Fixture {
  const review = join(f.dir, 'video', 'review');
  const bytes = Buffer.alloc(1024, 3);
  writeFileSync(join(review, 'fixture.mp4'), bytes);
  writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const rp = readJson<Record<string, unknown>>(join(review, 'review.json'))!;
  writeFileSync(join(review, 'review.json'), toJson({ ...rp, mp4Sha: sha(bytes) }));
  return f;
}
const BUILD = sha(Buffer.alloc(1024, 3));

type Calls = { method: string; args: unknown[] }[];
/** What the fake client's getVideo answers by default: a processed private video. */
const remoteOf = (id: string): RemoteVideo => ({
  id,
  privacyStatus: 'private',
  uploadStatus: 'processed',
  rejectionReason: null,
  publishAt: null,
  processingStatus: 'succeeded',
});
function fakeClient(over: Partial<YouTubeClient> = {}): YouTubeClient & { calls: Calls } {
  const calls: Calls = [];
  const rec = <K extends keyof YouTubeClient>(method: K, impl: YouTubeClient[K]) =>
    ((...args: unknown[]) => {
      calls.push({ method, args });
      return (impl as (...a: unknown[]) => unknown)(...args);
    }) as unknown as YouTubeClient[K];
  const base: YouTubeClient = {
    insertVideo: async (a) => {
      a.onSession('https://u/1');
      return { id: 'vid00000001' };
    },
    setThumbnail: async () => undefined,
    insertCaptions: async () => undefined,
    updateVideo: async () => undefined,
    getVideo: async (id) => remoteOf(id),
  };
  const c = { ...base, ...over };
  return {
    calls,
    insertVideo: rec('insertVideo', c.insertVideo),
    setThumbnail: rec('setThumbnail', c.setThumbnail),
    insertCaptions: rec('insertCaptions', c.insertCaptions),
    updateVideo: rec('updateVideo', c.updateVideo),
    getVideo: rec('getVideo', c.getVideo),
  };
}
const err = (status: number, reason: string, retryable: boolean, message = reason) =>
  new YouTubeError(message, status, reason, retryable);
const now = new Date('2026-10-26T00:00:00Z');
const ctx = (f: Fixture, client: YouTubeClient, extra: Record<string, unknown> = {}) => ({
  root: f.root,
  by: 'Jon',
  now,
  client,
  ...extra,
});
const events = (f: Fixture, output = 'youtube') => loadLedger(f.topic, f.story, f.root)!.outputs[output].events;
const sessionPath = (f: Fixture, output = 'youtube') => join(f.dir, SESSION_FILE(output));
const fixtures: Fixture[] = [];
const fresh = () => {
  const f = withMedia(syntheticProduction('packaged', { release: true }));
  fixtures.push(f);
  return f;
};
afterAll(() => fixtures.forEach((f) => f.cleanup()));

describe('uploadProblem', () => {
  const ok = { file: 'a.mp4', title: 'T', description: 'D', tags: ['a b'], thumbnail: null, sha: 'x' };
  it('names the field, the measure and the limit', () => {
    expect(uploadProblem(ok)).toBeNull();
    expect(uploadProblem({ ...ok, title: 'x'.repeat(101) })).toMatch(/title.*101.*100/);
    expect(uploadProblem({ ...ok, title: 'a <b>' })).toMatch(/title/);
    expect(uploadProblem({ ...ok, description: 'é'.repeat(2501) })).toMatch(/description.*5002.*5000/);
    expect(uploadProblem({ ...ok, tags: Array.from({ length: 51 }, () => 'tag tag!') })).toMatch(/tags.*560.*500/);
  });
  it('counts the commas between tags', () => {
    expect(uploadProblem({ ...ok, tags: Array(50).fill('abcdefghi') })).toBeNull(); // 450 + 49
    expect(uploadProblem({ ...ok, tags: Array(46).fill('abcdefghij') })).toMatch(/tags.*505.*500/); // 460 + 45
  });
  it('refuses a tag with < or >', () => {
    expect(uploadProblem({ ...ok, tags: ['fine', 'a < b'] })).toMatch(/tag.*< or >/);
  });
});

describe('upload', { timeout: 30_000 }, () => {
  it('inserts privately, records the upload, sets the thumbnail and clears the session', async () => {
    const f = fresh();
    const client = fakeClient();
    const results = await upload(f.topic, f.story, ctx(f, client));
    expect(results.map((r) => r.message)).toEqual([
      expect.stringMatching(/recorded uploaded vid00000001/),
      'captions uploaded',
      'thumbnail set',
    ]);
    const [ev] = events(f);
    expect(ev).toMatchObject({ type: 'uploaded', id: 'vid00000001', build: BUILD, buildStatus: 'release', by: 'Jon' });
    expect(typeof ev.metadata).toBe('string');
    const insert = client.calls[0];
    expect(insert.method).toBe('insertVideo');
    const a = insert.args[0] as {
      file: string;
      snippet: { categoryId: string; title: string };
      status: unknown;
      session: null;
    };
    expect(a.file.replaceAll('\\', '/')).toMatch(/video\/review\/fixture\.mp4$/);
    expect(a.status).toEqual({
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: false,
    });
    expect(a.snippet.categoryId).toBe(CATEGORY_DEFAULT);
    expect(a.session).toBeNull();
    expect(client.calls[1]).toMatchObject({
      method: 'insertCaptions',
      args: ['vid00000001', expect.stringMatching(/captions\.en\.srt$/), 'en', 'English'],
    });
    expect(client.calls[2]).toMatchObject({
      method: 'setThumbnail',
      args: ['vid00000001', expect.stringMatching(/thumbnail\.png$/)],
    });
    expect(typeof ev.captions).toBe('string'); // the captions that landed
    expect(existsSync(sessionPath(f))).toBe(false);
  });

  it('accepts a release build a person approved on disk before uploading it', async () => {
    const f = fresh();
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    expect(events(f).map((e) => e.type)).toEqual(['approved', 'uploaded']);
  });

  it('refuses a second upload of the same build', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    const again = upload(f.topic, f.story, ctx(f, client));
    await expect(again).rejects.toThrow(Refusal);
    await expect(again).rejects.toThrow(/uploaded/);
    expect(client.calls.filter((c) => c.method === 'insertVideo')).toHaveLength(1);
  });

  it('a quota failure records failed, keeps the session, and the retry resumes it', async () => {
    const f = fresh();
    let attempts = 0;
    const client = fakeClient({
      insertVideo: async (a) => {
        attempts++;
        if (attempts === 1) {
          a.onSession('https://u/1');
          throw err(403, 'quotaExceeded', true, 'Quota');
        }
        expect(a.session).toBe('https://u/1');
        return { id: 'vid00000001' };
      },
    });
    await expect(upload(f.topic, f.story, ctx(f, client))).rejects.toBeInstanceOf(YouTubeError);
    expect(events(f).at(-1)).toMatchObject({ type: 'failed', step: 'upload', retryable: true, by: 'Jon' });
    expect(events(f).at(-1)!.error).toContain('quotaExceeded');
    expect(readJson<Session>(sessionPath(f))).toMatchObject({ build: BUILD, uri: 'https://u/1' });
    await upload(f.topic, f.story, ctx(f, client));
    expect(events(f).at(-1)).toMatchObject({ type: 'uploaded', id: 'vid00000001' });
    expect(existsSync(sessionPath(f))).toBe(false);
  });

  it('resumes a finished session without a new insert', async () => {
    const f = fresh();
    writeFileSync(sessionPath(f), toJson({ build: BUILD, uri: 'https://u/9', startedAt: '2026-10-25T00:00:00Z' }));
    const client = fakeClient({
      insertVideo: async (a) => {
        if (a.session !== 'https://u/9') throw new Error('a new session was opened');
        return { id: 'vid00000009' };
      },
    });
    await upload(f.topic, f.story, ctx(f, client));
    expect(events(f)[0]).toMatchObject({ type: 'uploaded', id: 'vid00000009' });
    expect(existsSync(sessionPath(f))).toBe(false);
  });

  it('refuses a session file for another build', async () => {
    const f = fresh();
    writeFileSync(sessionPath(f), toJson({ build: 'other', uri: 'https://u/8', startedAt: 'x' }));
    const client = fakeClient();
    await expect(upload(f.topic, f.story, ctx(f, client))).rejects.toThrow(/session/);
    expect(client.calls).toHaveLength(0);
  });

  it('a lost session is final and tells the person where to look', async () => {
    const f = fresh();
    writeFileSync(sessionPath(f), toJson({ build: BUILD, uri: 'https://u/7', startedAt: 'x' }));
    const client = fakeClient({
      insertVideo: async () => {
        throw err(404, 'notFound', false);
      },
    });
    await expect(upload(f.topic, f.story, ctx(f, client))).rejects.toBeInstanceOf(YouTubeError);
    const last = events(f).at(-1)!;
    expect(last).toMatchObject({ type: 'failed', step: 'upload', retryable: false });
    expect(last.error).toContain('upload-session.json');
    expect(last.error).toContain('Studio');
    expect(existsSync(sessionPath(f))).toBe(true);
  });

  it('a thumbnail failure is its own failed event after the upload is recorded', async () => {
    const f = fresh();
    const client = fakeClient({
      setThumbnail: async () => {
        throw err(403, 'forbidden', false, 'The user does not have permissions to upload custom thumbnails');
      },
    });
    const results = await upload(f.topic, f.story, ctx(f, client));
    expect(events(f).map((e) => e.type)).toEqual(['uploaded', 'failed']);
    expect(events(f)[1]).toMatchObject({ step: 'thumbnail', retryable: false, id: 'vid00000001' });
    expect(results[2].event!.type).toBe('failed');
    expect(client.calls.some((c) => c.method === 'insertCaptions')).toBe(true);
  });

  it('refuses metadata over a YouTube limit before any call', async () => {
    const f = fresh();
    writeFileSync(join(f.dir, 'video', 'review', 'description.txt'), 'x'.repeat(6000));
    const client = fakeClient();
    await expect(upload(f.topic, f.story, ctx(f, client))).rejects.toThrow(/description.*5000/);
    expect(client.calls).toHaveLength(0);
  });

  it('refuses an mp4 that is not the build review.json describes', async () => {
    const f = fresh();
    writeFileSync(join(f.dir, 'video', 'review', 'fixture.mp4'), Buffer.alloc(1024, 4));
    await expect(upload(f.topic, f.story, ctx(f, fakeClient()))).rejects.toThrow(/review\.json says/);
  });

  it('a revoked token lands in the ledger with the way back', async () => {
    const f = fresh();
    const client = fakeClient({
      insertVideo: async () => {
        throw err(400, 'invalid_grant', false, 'Token has been revoked; run `npm run publish -- auth`');
      },
    });
    await expect(upload(f.topic, f.story, ctx(f, client))).rejects.toBeInstanceOf(YouTubeError);
    expect(events(f).at(-1)!.error).toContain('publish -- auth');
  });

  it('uploads a derivative from its source file', async () => {
    const f = fresh();
    const slug = storySlug(f.story);
    const source = `topics/${f.topic}/scripts/${slug}/video/shorts/short-1.mp4`;
    mkdirSync(join(f.root, 'topics', f.topic, 'scripts', slug, 'video', 'shorts'), { recursive: true });
    writeFileSync(join(f.root, source), Buffer.alloc(512, 9));
    addOutputTo(f.topic, f.story, 'short-1', 'youtube-short', { derivedFrom: 'youtube', source, root: f.root });
    const client = fakeClient({
      insertVideo: async (a) => {
        a.onSession('https://u/s');
        return { id: 'short000001' };
      },
    });
    await upload(f.topic, f.story, ctx(f, client, { output: 'short-1' }));
    const a = client.calls[0].args[0] as { file: string };
    expect(a.file.replaceAll('\\', '/')).toMatch(/video\/shorts\/short-1\.mp4$/);
    expect(events(f, 'short-1')[0]).toMatchObject({ type: 'uploaded', id: 'short000001' });
    expect(client.calls.some((c) => c.method === 'insertCaptions')).toBe(false); // the full video's captions are not the Short's
    expect(existsSync(sessionPath(f, 'short-1'))).toBe(false);
  });
});

describe('push', () => {
  it('sends the captions to a Studio re-upload recorded without them, even when the metadata is current', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client)); // the API upload carried the captions
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001' }); // no --captions
    const r = await push(f.topic, f.story, ctx(f, client));
    const sent = client.calls.filter((c) => c.method === 'insertCaptions');
    expect(sent.at(-1)?.args[0]).toBe('studio00001');
    expect(r.event).toMatchObject({ type: 'updated', id: 'studio00001' });
    expect(r.event!.captions).toBeTruthy();
    const n = sent.length;
    await push(f.topic, f.story, ctx(f, client)); // now recorded: not a second track
    expect(client.calls.filter((c) => c.method === 'insertCaptions')).toHaveLength(n);
  });

  it('sends nothing when the metadata is unchanged, and the new snippet when it is', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    const unchanged = await push(f.topic, f.story, ctx(f, client));
    expect(unchanged.existing).toBe(true);
    expect(client.calls.filter((c) => c.method === 'updateVideo')).toHaveLength(0);

    const path = publishPath(f.topic, f.story, f.root);
    const l = readJson<Ledger>(path)!;
    l.outputs.youtube.metadata.title = 'A better title';
    saveLedger(path, l);
    const r = await push(f.topic, f.story, ctx(f, client));
    expect(r.event).toMatchObject({ type: 'updated', id: 'vid00000001' });
    expect(r.event!.fields).toEqual(['snippet', 'thumbnail']); // the captions YouTube has are current
    const u = client.calls.find((c) => c.method === 'updateVideo')!;
    expect((u.args[1] as { snippet: { title: string } }).snippet.title).toBe('A better title');
  });

  it('an asset failure during push is recorded after the update that landed', async () => {
    const f = fresh();
    const client = fakeClient({
      setThumbnail: async () => {
        throw err(403, 'forbidden', false);
      },
    });
    await upload(f.topic, f.story, ctx(f, client));
    const path = publishPath(f.topic, f.story, f.root);
    const l = readJson<Ledger>(path)!;
    l.outputs.youtube.metadata.title = 'Renamed';
    saveLedger(path, l);
    const r = await push(f.topic, f.story, ctx(f, client));
    expect(r.event).toMatchObject({ type: 'updated', fields: ['snippet'] });
    expect(
      events(f)
        .slice(-2)
        .map((e) => e.type),
    ).toEqual(['updated', 'failed']);
    expect(events(f).at(-1)).toMatchObject({ step: 'thumbnail', retryable: false });
  });

  it('push inserts captions only when they changed since the ones that landed, or none landed', async () => {
    const f = fresh();
    const client = fakeClient({
      insertCaptions: async () => {
        throw err(503, 'backendError', true);
      },
    });
    await upload(f.topic, f.story, ctx(f, client));
    expect(events(f).map((e) => [e.type, e.step ?? ''])).toEqual([
      ['uploaded', ''],
      ['failed', 'captions'],
    ]);
    expect(events(f)[0].captions).toBeUndefined();
    const path = publishPath(f.topic, f.story, f.root);
    const retitle = (title: string) => {
      const l = readJson<Ledger>(path)!;
      l.outputs.youtube.metadata.title = title;
      saveLedger(path, l);
    };
    retitle('One');
    const ok = fakeClient();
    const r = await push(f.topic, f.story, ctx(f, ok));
    expect(r.event!.fields).toContain('captions'); // none recorded: send them
    expect(typeof r.event!.captions).toBe('string');
    retitle('Two');
    await push(f.topic, f.story, ctx(f, ok));
    expect(ok.calls.filter((c) => c.method === 'insertCaptions')).toHaveLength(1);
    const rp = join(f.dir, 'video', 'review', 'review.json');
    writeFileSync(rp, toJson({ ...readJson<Record<string, unknown>>(rp)!, captionsSha: 'newcaptions' }));
    const r3 = await push(f.topic, f.story, ctx(f, ok));
    expect(ok.calls.filter((c) => c.method === 'insertCaptions')).toHaveLength(2);
    expect(r3.event!.captions).toBe('newcaptions');
  });

  it('a failed update leaves the metadata behind so the next push resends', async () => {
    const f = fresh();
    const client = fakeClient({
      updateVideo: async () => {
        throw err(503, 'backendError', true);
      },
    });
    await upload(f.topic, f.story, ctx(f, client));
    const path = publishPath(f.topic, f.story, f.root);
    const l = readJson<Ledger>(path)!;
    l.outputs.youtube.metadata.tags = ['heat pumps'];
    saveLedger(path, l);
    await expect(push(f.topic, f.story, ctx(f, client))).rejects.toBeInstanceOf(YouTubeError);
    expect(events(f).at(-1)).toMatchObject({ type: 'failed', step: 'update', retryable: true });
    expect(events(f).some((e) => e.type === 'updated')).toBe(false);
  });
});

describe('goLive', () => {
  it('needs the approval, then publishes or schedules exactly once', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    await expect(goLive(f.topic, f.story, ctx(f, client))).rejects.toThrow(/approved/);
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });

    const soon = new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS / 2).toISOString();
    await expect(goLive(f.topic, f.story, ctx(f, client, { at: soon }))).rejects.toThrow(/5 minutes/);
    expect(client.calls.filter((c) => c.method === 'updateVideo')).toHaveLength(0);

    const at = '2026-10-28T15:00:00.000Z';
    const r = await goLive(f.topic, f.story, ctx(f, client, { at }));
    expect(r.event).toMatchObject({ type: 'scheduled', publishAt: at, id: 'vid00000001' });
    expect(client.calls.at(-1)).toMatchObject({
      method: 'updateVideo',
      args: [
        'vid00000001',
        {
          status: {
            privacyStatus: 'private',
            publishAt: at,
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: false,
          },
        },
      ],
    });
    const again = await goLive(f.topic, f.story, ctx(f, client, { at }));
    expect(again.existing).toBe(true);
    expect(client.calls.filter((c) => c.method === 'updateVideo')).toHaveLength(1);
  });

  it('refuses before an upload even when the local build is approved', async () => {
    const f = fresh();
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const client = fakeClient();
    await expect(goLive(f.topic, f.story, ctx(f, client))).rejects.toThrow(/upload/);
    expect(client.calls).toHaveLength(0);
  });

  it('without --at it goes public now', async () => {
    const f = fresh();
    const client = fakeClient({ getVideo: async (id) => ({ ...remoteOf(id), privacyStatus: 'public' }) });
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const r = await goLive(f.topic, f.story, ctx(f, client));
    expect(r.event).toMatchObject({ type: 'published', id: 'vid00000001', url: 'https://youtu.be/vid00000001' });
    expect(client.calls.at(-2)).toMatchObject({
      method: 'updateVideo',
      args: [
        'vid00000001',
        { status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: false } },
      ],
    });
  });

  it('go-live records failed, not published, when YouTube keeps the video private', async () => {
    const f = fresh();
    const client = fakeClient(); // getVideo answers privacyStatus 'private'
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const r = await goLive(f.topic, f.story, ctx(f, client));
    expect(r.event).toMatchObject({ type: 'failed', step: 'go-live', retryable: false });
    expect(r.event!.error).toContain('YouTube Studio');
    expect(events(f).some((e) => e.type === 'published')).toBe(false);
    expect(client.calls.map((c) => c.method)).toEqual(expect.arrayContaining(['updateVideo', 'getVideo']));
  });
});

describe('sync', () => {
  const remote = (over: Partial<RemoteVideo>): RemoteVideo => ({
    id: 'vid00000001',
    privacyStatus: 'private',
    uploadStatus: 'processed',
    rejectionReason: null,
    publishAt: null,
    processingStatus: 'succeeded',
    ...over,
  });
  it('records a scheduled video that went public', async () => {
    const f = fresh();
    const client = fakeClient({ getVideo: async () => remote({ privacyStatus: 'public' }) });
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    await goLive(f.topic, f.story, ctx(f, client, { at: '2026-10-28T15:00:00.000Z' }));
    const r = await sync(f.topic, f.story, ctx(f, client));
    expect('event' in r && r.event).toMatchObject({ type: 'published', id: 'vid00000001' });
  });

  it('a rejection and a deletion are final failures; otherwise it reports the remote state', async () => {
    const f = fresh();
    const client = fakeClient({
      getVideo: async () => remote({ uploadStatus: 'rejected', rejectionReason: 'copyright' }),
    });
    await upload(f.topic, f.story, ctx(f, client));
    const r = await sync(f.topic, f.story, ctx(f, client));
    expect('event' in r && r.event).toMatchObject({ type: 'failed', step: 'sync', retryable: false });
    expect('event' in r && r.event!.error).toContain('copyright');

    const gone = fakeClient({ getVideo: async () => null });
    const g = await sync(f.topic, f.story, ctx(f, gone));
    expect('event' in g && g.event!.error).toContain('not on YouTube');

    const plain = await sync(f.topic, f.story, ctx(f, fakeClient()));
    expect(plain).toMatchObject({ privacyStatus: 'private', processingStatus: 'succeeded' });
  });

  it('refuses before an upload', async () => {
    const f = fresh();
    await expect(sync(f.topic, f.story, ctx(f, fakeClient()))).rejects.toThrow(Refusal);
  });

  it('sync flags a schedule that passed while the video stayed private', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const at = '2026-10-28T15:00:00.000Z';
    await goLive(f.topic, f.story, ctx(f, client, { at }));
    const T = Date.parse(at);
    const n = events(f).length;
    const inGrace = await sync(f.topic, f.story, ctx(f, client, { now: new Date(T + 10 * 60_000) }));
    expect(inGrace).toMatchObject({ privacyStatus: 'private' });
    expect(events(f)).toHaveLength(n);
    expect(SCHEDULE_GRACE_MS).toBe(15 * 60_000);
    const late = await sync(f.topic, f.story, ctx(f, client, { now: new Date(T + 20 * 60_000) }));
    expect('event' in late && late.event).toMatchObject({ type: 'failed', step: 'sync', retryable: false });
    expect('event' in late && late.event!.error).toContain('still private');
    const n2 = events(f).length;
    const again = await sync(f.topic, f.story, ctx(f, client, { now: new Date(T + 30 * 60_000) }));
    expect('existing' in again && again.existing).toBe(true); // the same finding is not recorded twice
    expect(events(f)).toHaveLength(n2);
  });
});
void readFileSync;

describe('goLive on a Short', () => {
  it('refuses while the parent video is not live, and calls nothing', async () => {
    const f = syntheticShort('packaged', { release: true });
    fixtures.push(f);
    const source = relative(f.root, f.dir).split(sep).join('/');
    addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
      derivedFrom: 'youtube',
      source,
      root: f.root,
    });
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'bbbbbbbbbbb' });
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const client = fakeClient();
    await expect(goLive(f.topic, f.story, ctx(f, client))).rejects.toThrow(/youtube first/);
    expect(client.calls).toEqual([]);
  });
});

describe('goLive refusals before any call', () => {
  it('refuses an automated run', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const n = client.calls.length;
    await expect(goLive(f.topic, f.story, ctx(f, client, { by: 'automated: /produce run' }))).rejects.toThrow(/person/);
    expect(client.calls).toHaveLength(n);
  });
});
