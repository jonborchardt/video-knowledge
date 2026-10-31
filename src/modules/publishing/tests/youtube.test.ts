// The YouTube Data API client over a scripted fetch: credentials, the token refresh, the resumable upload protocol,
// thumbnails, captions, update, list, the error classification and the one-time desktop consent. No network.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type Credentials,
  SCOPE,
  TOKEN_FILE,
  YouTubeError,
  accessToken,
  authorize,
  classify,
  loadCredentials,
  oembedStatus,
  youtubeClient,
} from '../youtube';

const tmp = mkdtempSync(join(tmpdir(), 'vk-youtube-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>; // lower-case names
  body: Buffer | null;
}
interface Reply {
  match: RegExp;
  method?: string;
  reply: (call: Call) => Response;
}
/** A fetch that answers from a script and records every call. */
function fakeFetch(script: Reply[]) {
  const calls: Call[] = [];
  const fn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const raw = init?.body;
    const body =
      raw == null
        ? null
        : typeof raw === 'string'
          ? Buffer.from(raw)
          : raw instanceof Uint8Array
            ? Buffer.from(raw)
            : Buffer.from(await new Response(raw).arrayBuffer());
    const call = { url, method, headers, body };
    calls.push(call);
    const r = script.find((s) => s.match.test(url) && (!s.method || s.method === method));
    if (!r) throw new TypeError(`unexpected ${method} ${url}`);
    return r.reply(call);
  };
  return { fn: fn as unknown as typeof fetch, calls };
}
const json = (x: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json', ...headers } });
const apiError = (status: number, reason: string, message = reason) =>
  json({ error: { code: status, message, errors: [{ reason, message }] } }, status);
const token: Reply = {
  match: /oauth2\.googleapis\.com\/token/,
  reply: () => json({ access_token: 'tok', expires_in: 3600 }),
};
let n = 0;
/** Fresh credentials per test so the per-process token cache never crosses tests. */
const creds = (): Credentials => ({ clientId: 'cid', clientSecret: 'sec', refreshToken: `rt-${n++}` });

const mp4 = join(tmp, 'a.mp4');
writeFileSync(mp4, Buffer.alloc(300, 7));
const snippet = { title: 'T', description: 'D', tags: ['x'], categoryId: '27', defaultLanguage: 'en' };
const status = { privacyStatus: 'private' as const, selfDeclaredMadeForKids: false, containsSyntheticMedia: false };

describe('credentials', () => {
  const env = { YOUTUBE_CLIENT_ID: 'cid', YOUTUBE_CLIENT_SECRET: 'sec' };
  it('names the missing variable', () => {
    expect(() => loadCredentials(tmp, {})).toThrow(/YOUTUBE_CLIENT_ID/);
    expect(() => loadCredentials(tmp, { YOUTUBE_CLIENT_ID: 'cid' })).toThrow(/YOUTUBE_CLIENT_SECRET/);
  });
  it('needs a refresh token from the environment or the token file, else names auth', () => {
    expect(() => loadCredentials(tmp, env)).toThrow(/publish -- auth/);
    expect(loadCredentials(tmp, env, { requireToken: false }).refreshToken).toBeNull();
    expect(loadCredentials(tmp, { ...env, YOUTUBE_REFRESH_TOKEN: 'rt-env' }).refreshToken).toBe('rt-env');
    writeFileSync(join(tmp, TOKEN_FILE), JSON.stringify({ refresh_token: 'rt-file' }));
    expect(loadCredentials(tmp, env).refreshToken).toBe('rt-file');
  });
});

describe('credentials file', () => {
  const root = join(tmp, 'creds-root');
  mkdirSync(join(root, 'secrets'), { recursive: true });
  const file = join(root, 'secrets', 'youtube-oauth.json');
  const env = { YOUTUBE_OAUTH_CREDENTIALS_PATH: './secrets/youtube-oauth.json' };
  it('reads the Desktop client JSON Google hands out, and the refresh token stored next to it', () => {
    expect(() => loadCredentials(root, env)).toThrow(/does not exist/);
    writeFileSync(
      file,
      JSON.stringify({ installed: { client_id: 'gid', client_secret: 'gsec', redirect_uris: ['http://localhost'] } }),
    );
    const c = loadCredentials(root, env, { requireToken: false });
    expect(c).toMatchObject({ clientId: 'gid', clientSecret: 'gsec', refreshToken: null, store: file });
    expect(() => loadCredentials(root, env)).toThrow(/publish -- auth/);
    writeFileSync(
      file,
      JSON.stringify({ installed: { client_id: 'gid', client_secret: 'gsec' }, refresh_token: 'rtf' }),
    );
    expect(loadCredentials(root, env).refreshToken).toBe('rtf');
    expect(loadCredentials(root, { ...env, YOUTUBE_REFRESH_TOKEN: '' }).refreshToken).toBe('rtf'); // an empty .env line is unset
    expect(loadCredentials(root, { ...env, YOUTUBE_REFRESH_TOKEN: 'rte' }).refreshToken).toBe('rte');
  });
  it('auth writes the refresh token into that file and keeps the client in it', async () => {
    writeFileSync(file, JSON.stringify({ installed: { client_id: 'gid', client_secret: 'gsec' } }));
    const f = fakeFetch([
      { match: /token/, reply: () => json({ access_token: 'a', refresh_token: 'rt-store', expires_in: 3600 }) },
    ]);
    await authorize(
      loadCredentials(root, env, { requireToken: false }),
      root,
      (url) => void globalThis.fetch(`${new URL(url).searchParams.get('redirect_uri')}?code=abc`),
      f.fn,
    );
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      installed: { client_id: 'gid', client_secret: 'gsec' },
      refresh_token: 'rt-store',
    });
    expect(loadCredentials(root, env).refreshToken).toBe('rt-store');
    expect(existsSync(join(root, TOKEN_FILE))).toBe(false);
  });
});

describe('access token', () => {
  it('posts the refresh grant once per process for the same credentials', async () => {
    const c = creds();
    const f = fakeFetch([token]);
    expect(await accessToken(c, f.fn)).toBe('tok');
    expect(await accessToken(c, f.fn)).toBe('tok');
    expect(f.calls).toHaveLength(1);
    const body = new URLSearchParams(f.calls[0].body!.toString());
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe(c.refreshToken);
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('sec');
  });
  it('invalid_grant is final and names auth', async () => {
    const f = fakeFetch([
      {
        match: /token/,
        reply: () => json({ error: 'invalid_grant', error_description: 'Token has been revoked' }, 400),
      },
    ]);
    const e = await accessToken(creds(), f.fn).catch((x) => x);
    expect(e).toBeInstanceOf(YouTubeError);
    expect(e.reason).toBe('invalid_grant');
    expect(e.retryable).toBe(false);
    expect(e.message).toMatch(/publish -- auth/);
  });
});

describe('classify', () => {
  it('retries transient failures and quota, not permission or bad requests', () => {
    expect(classify(403, 'quotaExceeded')).toBe(true);
    expect(classify(403, 'uploadLimitExceeded')).toBe(true);
    expect(classify(429, 'rateLimitExceeded')).toBe(true);
    expect(classify(503, 'backendError')).toBe(true);
    expect(classify(403, 'forbidden')).toBe(false);
    expect(classify(400, 'invalidPublishAt')).toBe(false);
    expect(classify(404, 'notFound')).toBe(false);
    expect(classify(410, 'gone')).toBe(false);
  });
});

describe('insertVideo', () => {
  const insert = /upload\/youtube\/v3\/videos\?/;
  it('opens a session, hands its uri over before the first byte, then puts the file', async () => {
    const order: string[] = [];
    const f = fakeFetch([
      token,
      {
        match: insert,
        method: 'POST',
        reply: () => {
          order.push('post');
          return new Response('', { status: 200, headers: { location: 'https://u/1' } });
        },
      },
      {
        match: /^https:\/\/u\/1$/,
        method: 'PUT',
        reply: () => {
          order.push('put');
          return json({ id: 'vid00000001' });
        },
      },
    ]);
    const r = await youtubeClient(creds(), f.fn).insertVideo({
      file: mp4,
      snippet,
      status,
      session: null,
      onSession: (uri) => order.push(`session ${uri}`),
    });
    expect(r).toEqual({ id: 'vid00000001' });
    expect(order).toEqual(['post', 'session https://u/1', 'put']);
    const post = f.calls.find((c) => insert.test(c.url))!;
    expect(post.url).toContain('uploadType=resumable');
    expect(post.url).toContain('part=snippet,status');
    expect(post.headers['x-upload-content-length']).toBe('300');
    expect(post.headers['x-upload-content-type']).toBe('video/mp4');
    expect(post.headers.authorization).toBe('Bearer tok');
    expect(JSON.parse(post.body!.toString())).toEqual({ snippet, status });
    const put = f.calls.find((c) => c.url === 'https://u/1')!;
    expect(put.body!.length).toBe(300);
    expect(put.headers['content-type']).toBe('video/mp4');
  });

  it('resumes a session from the range YouTube reports', async () => {
    let puts = 0;
    const f = fakeFetch([
      token,
      {
        match: /^https:\/\/u\/2$/,
        method: 'PUT',
        reply: () =>
          ++puts === 1
            ? new Response('', { status: 308, headers: { range: 'bytes=0-99' } })
            : json({ id: 'vid00000002' }),
      },
    ]);
    const r = await youtubeClient(creds(), f.fn).insertVideo({
      file: mp4,
      snippet,
      status,
      session: 'https://u/2',
      onSession: () => {
        throw new Error('no new session expected');
      },
    });
    expect(r.id).toBe('vid00000002');
    const [probe, rest] = f.calls.filter((c) => c.url === 'https://u/2');
    expect(probe.headers['content-range']).toBe('bytes */300');
    expect(probe.body === null || probe.body.length === 0).toBe(true);
    expect(rest.headers['content-range']).toBe('bytes 100-299/300');
    expect(rest.body!.length).toBe(200);
    expect(f.calls.some((c) => insert.test(c.url))).toBe(false);
  });

  it('a partial upload (308 on the last put) is a retryable YouTubeError, not a bad json read', async () => {
    const f = fakeFetch([
      token,
      {
        match: insert,
        method: 'POST',
        reply: () => new Response('', { status: 200, headers: { location: 'https://u/9' } }),
      },
      { match: /^https:\/\/u\/9$/, method: 'PUT', reply: () => new Response(null, { status: 308 }) },
    ]);
    const r = youtubeClient(creds(), f.fn).insertVideo({
      file: mp4,
      snippet,
      status,
      session: null,
      onSession: () => undefined,
    });
    await expect(r).rejects.toMatchObject({ name: 'YouTubeError', retryable: true });
  });

  it('a finished session returns the video without another put', async () => {
    const f = fakeFetch([
      token,
      { match: /^https:\/\/u\/3$/, method: 'PUT', reply: () => json({ id: 'vid00000003' }) },
    ]);
    const r = await youtubeClient(creds(), f.fn).insertVideo({
      file: mp4,
      snippet,
      status,
      session: 'https://u/3',
      onSession: () => undefined,
    });
    expect(r.id).toBe('vid00000003');
    expect(f.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('refreshes the token once on a 401 and retries; a second 401 surfaces', async () => {
    let puts = 0;
    const f = fakeFetch([
      token,
      {
        match: /^https:\/\/u\/4$/,
        method: 'PUT',
        reply: () => (++puts === 1 ? apiError(401, 'authError') : json({ id: 'vid00000004' })),
      },
    ]);
    const r = await youtubeClient(creds(), f.fn).insertVideo({
      file: mp4,
      snippet,
      status,
      session: 'https://u/4',
      onSession: () => undefined,
    });
    expect(r.id).toBe('vid00000004');
    expect(f.calls.filter((c) => /token/.test(c.url))).toHaveLength(2);

    const g = fakeFetch([token, { match: /^https:\/\/u\/5$/, method: 'PUT', reply: () => apiError(401, 'authError') }]);
    const e = await youtubeClient(creds(), g.fn)
      .insertVideo({ file: mp4, snippet, status, session: 'https://u/5', onSession: () => undefined })
      .catch((x) => x);
    expect(e).toBeInstanceOf(YouTubeError);
    expect(e.status).toBe(401);
  });

  it('turns an API error into a classified YouTubeError', async () => {
    const f = fakeFetch([
      token,
      { match: insert, method: 'POST', reply: () => apiError(403, 'quotaExceeded', 'Quota') },
    ]);
    const e = await youtubeClient(creds(), f.fn)
      .insertVideo({ file: mp4, snippet, status, session: null, onSession: () => undefined })
      .catch((x) => x);
    expect(e).toBeInstanceOf(YouTubeError);
    expect(e.status).toBe(403);
    expect(e.reason).toBe('quotaExceeded');
    expect(e.retryable).toBe(true);
    expect(e.message).toContain('Quota');
    const g = fakeFetch([
      token,
      { match: /^https:\/\/u\/6$/, method: 'PUT', reply: () => new Response('', { status: 404 }) },
    ]);
    const lost = await youtubeClient(creds(), g.fn)
      .insertVideo({ file: mp4, snippet, status, session: 'https://u/6', onSession: () => undefined })
      .catch((x) => x);
    expect(lost.status).toBe(404);
    expect(lost.retryable).toBe(false);
  });

  it('a network failure is retryable', async () => {
    const f = fakeFetch([token]);
    const e = await youtubeClient(creds(), f.fn)
      .insertVideo({ file: mp4, snippet, status, session: null, onSession: () => undefined })
      .catch((x) => x);
    expect(e).toBeInstanceOf(YouTubeError);
    expect(e.retryable).toBe(true);
  });
});

describe('thumbnail, captions, update, list', () => {
  const png = join(tmp, 't.png');
  writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  const srt = join(tmp, 'c.srt');
  writeFileSync(srt, '1\n00:00:00,000 --> 00:00:01,000\nHi\n');

  it('posts the thumbnail bytes as media', async () => {
    const f = fakeFetch([token, { match: /thumbnails\/set/, method: 'POST', reply: () => json({}) }]);
    await youtubeClient(creds(), f.fn).setThumbnail('vid00000001', png);
    const c = f.calls.find((x) => /thumbnails/.test(x.url))!;
    expect(c.url).toContain('videoId=vid00000001');
    expect(c.url).toContain('uploadType=media');
    expect(c.headers['content-type']).toBe('image/png');
    expect(c.body).toEqual(readFileSync(png));
  });

  it('inserts captions through the same resumable protocol', async () => {
    const f = fakeFetch([
      token,
      {
        match: /upload\/youtube\/v3\/captions\?/,
        method: 'POST',
        reply: () => new Response('', { status: 200, headers: { location: 'https://u/c' } }),
      },
      { match: /^https:\/\/u\/c$/, method: 'PUT', reply: () => json({ id: 'cap1' }) },
    ]);
    await youtubeClient(creds(), f.fn).insertCaptions('vid00000001', srt, 'en', 'English');
    const post = f.calls.find((x) => /captions/.test(x.url))!;
    expect(post.url).toContain('part=snippet');
    expect(JSON.parse(post.body!.toString())).toEqual({
      snippet: { videoId: 'vid00000001', language: 'en', name: 'English' },
    });
    expect(post.headers['x-upload-content-type']).toBe('application/octet-stream');
    const put = f.calls.find((x) => x.url === 'https://u/c')!;
    expect(put.body!.toString()).toBe(readFileSync(srt, 'utf8'));
  });

  it('updates only the parts given', async () => {
    const f = fakeFetch([token, { match: /youtube\/v3\/videos\?/, method: 'PUT', reply: () => json({}) }]);
    const client = youtubeClient(creds(), f.fn);
    await client.updateVideo('vid00000001', {
      status: { privacyStatus: 'private', publishAt: '2026-10-28T15:00:00Z' },
    });
    const c = f.calls.find((x) => x.method === 'PUT')!;
    expect(c.url).toContain('part=status');
    expect(c.url).not.toContain('snippet');
    expect(JSON.parse(c.body!.toString())).toEqual({
      id: 'vid00000001',
      status: { privacyStatus: 'private', publishAt: '2026-10-28T15:00:00Z' },
    });
    await client.updateVideo('vid00000001', { snippet, status: { privacyStatus: 'public' } });
    expect(f.calls.at(-1)!.url).toContain('part=snippet,status');
  });

  it('reads a video back, or null when it is gone', async () => {
    const f = fakeFetch([
      token,
      {
        match: /youtube\/v3\/videos\?/,
        method: 'GET',
        reply: (c) =>
          c.url.includes('id=gone')
            ? json({ items: [] })
            : json({
                items: [
                  {
                    id: 'vid00000001',
                    status: { privacyStatus: 'private', uploadStatus: 'processed', publishAt: '2026-10-28T15:00:00Z' },
                    processingDetails: { processingStatus: 'succeeded' },
                  },
                ],
              }),
      },
    ]);
    const client = youtubeClient(creds(), f.fn);
    expect(await client.getVideo('vid00000001')).toEqual({
      id: 'vid00000001',
      privacyStatus: 'private',
      uploadStatus: 'processed',
      rejectionReason: null,
      publishAt: '2026-10-28T15:00:00Z',
      processingStatus: 'succeeded',
    });
    expect(f.calls.at(-1)!.url).toContain('part=snippet,status,contentDetails,processingDetails,fileDetails');
    expect(await client.getVideo('gone')).toBeNull();
  });

  it('getVideo reads snippet, status, contentDetails, processing and file details in one call', async () => {
    const f = fakeFetch([
      token,
      {
        match: /\/youtube\/v3\/videos\?/,
        reply: () =>
          json({
            items: [
              {
                id: 'vid00000001',
                snippet: { title: 'T', description: 'D', tags: ['a'], categoryId: '27', defaultLanguage: 'en' },
                status: {
                  privacyStatus: 'public',
                  uploadStatus: 'processed',
                  license: 'youtube',
                  embeddable: true,
                  madeForKids: false,
                  selfDeclaredMadeForKids: false,
                  containsSyntheticMedia: false,
                },
                contentDetails: { hasCustomThumbnail: true, contentRating: {} },
                processingDetails: { processingStatus: 'succeeded', fileAvailability: 'available' },
                fileDetails: { fileName: 'x.mp4', fileSize: '1024' },
              },
            ],
          }),
      },
    ]);
    const v = await youtubeClient(creds(), f.fn).getVideo('vid00000001');
    expect(f.calls.at(-1)!.url).toContain('part=snippet,status,contentDetails,processingDetails,fileDetails');
    expect(v).toMatchObject({
      title: 'T',
      tags: ['a'],
      hasCustomThumbnail: true,
      fileSize: 1024,
      fileAvailability: 'available',
      privacyStatus: 'public',
    });
  });

  it('listCaptions maps the snippet of each track', async () => {
    const f = fakeFetch([
      token,
      {
        match: /youtube\/v3\/captions\?/,
        method: 'GET',
        reply: () =>
          json({
            items: [
              { id: 'c1', snippet: { language: 'en', name: 'English', trackKind: 'standard', status: 'serving' } },
            ],
          }),
      },
    ]);
    const tracks = await youtubeClient(creds(), f.fn).listCaptions('vid00000001');
    expect(f.calls.at(-1)!.url).toContain('captions?part=snippet&videoId=vid00000001');
    expect(tracks).toEqual([{ id: 'c1', language: 'en', trackKind: 'standard', status: 'serving' }]);
  });

  it('deleteCaptions deletes the track by id', async () => {
    const f = fakeFetch([
      token,
      { match: /youtube\/v3\/captions\?/, method: 'DELETE', reply: () => new Response(null, { status: 204 }) },
    ]);
    await youtubeClient(creds(), f.fn).deleteCaptions('cap1');
    expect(f.calls.at(-1)!.url).toContain('captions?id=cap1');
  });

  it('oembedStatus asks anonymously and returns the status, 0 on a network error', async () => {
    const f = fakeFetch([{ match: /youtube\.com\/oembed\?/, reply: () => json({}, 403) }]);
    expect(await oembedStatus('vid00000001', f.fn)).toBe(403);
    expect(f.calls[0].headers.authorization).toBeUndefined();
    expect(f.calls[0].url).toContain(encodeURIComponent('https://www.youtube.com/watch?v=vid00000001'));
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await oembedStatus('vid00000001', down)).toBe(0);
  });
});

describe('authorize', () => {
  it('runs the loopback consent and writes the token file', async () => {
    const root = join(tmp, 'auth-root');
    mkdirSync(root, { recursive: true });
    const f = fakeFetch([
      {
        match: /token/,
        reply: () => json({ access_token: 'a', refresh_token: 'rt-new', expires_in: 3600 }),
      },
    ]);
    let consent = '';
    await authorize(
      { clientId: 'cid', clientSecret: 'sec', refreshToken: null },
      root,
      (url) => {
        consent = url;
        const redirect = new URL(url).searchParams.get('redirect_uri')!;
        void globalThis.fetch(`${redirect}?code=abc`); // the browser coming back
      },
      f.fn,
    );
    const u = new URL(consent);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('scope')).toBe(SCOPE);
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('client_id')).toBe('cid');
    const body = new URLSearchParams(f.calls[0].body!.toString());
    expect(body.get('code')).toBe('abc');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe(u.searchParams.get('redirect_uri'));
    expect(JSON.parse(readFileSync(join(root, TOKEN_FILE), 'utf8'))).toEqual({ refresh_token: 'rt-new' });
  });
});
