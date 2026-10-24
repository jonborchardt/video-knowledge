// The uploader verbs over the ledger with a fake YouTube client: what they send, what they record, what they refuse,
// and how a crash or a lost session is recovered without a second upload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, sha, toJson } from '../src/lib/io';
import { type Ledger, addOutputTo, loadLedger, recordApproved, saveLedger, publishPath } from '../src/lib/publish';
import { Refusal } from '../src/lib/publish';
import { storySlug } from '../src/lib/script';
import {
  CATEGORY_DEFAULT,
  MIN_SCHEDULE_LEAD_MS,
  SESSION_FILE,
  type Session,
  goLive,
  push,
  sync,
  upload,
  uploadProblem,
} from '../src/lib/uploader';
import { type RemoteVideo, type YouTubeClient, YouTubeError } from '../src/lib/youtube';
import { type Fixture, syntheticProduction } from './production-helpers';

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
    getVideo: async (id) => ({
      id,
      privacyStatus: 'private',
      uploadStatus: 'processed',
      rejectionReason: null,
      publishAt: null,
      processingStatus: 'succeeded',
    }),
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
    expect(uploadProblem({ ...ok, tags: Array.from({ length: 51 }, () => 'tag tag!') })).toMatch(/tags.*510.*500/);
  });
});

describe('upload', () => {
  it('inserts privately, records the upload, sets the thumbnail and clears the session', async () => {
    const f = fresh();
    const client = fakeClient();
    const results = await upload(f.topic, f.story, ctx(f, client));
    expect(results.map((r) => r.message)).toEqual([
      expect.stringMatching(/recorded uploaded vid00000001/),
      'thumbnail set',
      'captions uploaded',
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
      method: 'setThumbnail',
      args: ['vid00000001', expect.stringMatching(/thumbnail\.png$/)],
    });
    expect(client.calls[2]).toMatchObject({
      method: 'insertCaptions',
      args: ['vid00000001', expect.stringMatching(/captions\.en\.srt$/), 'en', 'English'],
    });
    expect(existsSync(sessionPath(f))).toBe(false);
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
    expect(results[1].event!.type).toBe('failed');
    expect(client.calls.some((c) => c.method === 'insertCaptions')).toBe(true); // the verb went on
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
    expect(existsSync(sessionPath(f, 'short-1'))).toBe(false);
  });
});

describe('push', () => {
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
    expect(r.event!.fields).toEqual(['snippet', 'thumbnail', 'captions']);
    const u = client.calls.find((c) => c.method === 'updateVideo')!;
    expect((u.args[1] as { snippet: { title: string } }).snippet.title).toBe('A better title');
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
      args: ['vid00000001', { status: { privacyStatus: 'private', publishAt: at } }],
    });
    const again = await goLive(f.topic, f.story, ctx(f, client, { at }));
    expect(again.existing).toBe(true);
    expect(client.calls.filter((c) => c.method === 'updateVideo')).toHaveLength(1);
  });

  it('without --at it goes public now', async () => {
    const f = fresh();
    const client = fakeClient();
    await upload(f.topic, f.story, ctx(f, client));
    recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
    const r = await goLive(f.topic, f.story, ctx(f, client));
    expect(r.event).toMatchObject({ type: 'published', id: 'vid00000001', url: 'https://youtu.be/vid00000001' });
    expect(client.calls.at(-1)).toMatchObject({
      method: 'updateVideo',
      args: ['vid00000001', { status: { privacyStatus: 'public' } }],
    });
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
});
void readFileSync;
