// The YouTube Data API v3 as the uploader needs it: a desktop OAuth consent run once (loopback redirect), the refresh
// grant, the resumable upload protocol for videos and captions, thumbnails, update and list. Plain fetch, injectable
// for tests; no googleapis. Every failure is a YouTubeError the uploader records as a `failed` ledger event.
// Credentials: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in the environment (.env), the refresh token from
// YOUTUBE_REFRESH_TOKEN or <root>/.youtube-token.json (written by `npm run publish -- auth`). Library layer.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { ROOT, readJson } from './io';

export const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
export const TOKEN_FILE = '.youtube-token.json'; // the token store when YOUTUBE_OAUTH_CREDENTIALS_PATH is not set
const CREDENTIALS_PATH_VAR = 'YOUTUBE_OAUTH_CREDENTIALS_PATH';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';
const AUTH_HELP = 'run `npm run publish -- auth` (see README, Publishing: YouTube)';

export interface Credentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
  store?: string; // the file auth writes the refresh token into (merged into what is there)
}
/** Google's downloaded Desktop client JSON ({ installed: {...} }), or a flat file; refresh_token is what auth adds. */
interface CredentialsFile {
  installed?: { client_id?: string; client_secret?: string };
  web?: { client_id?: string; client_secret?: string };
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
}

export function loadCredentials(
  root = ROOT,
  env: Record<string, string | undefined> = process.env,
  opts: { requireToken?: boolean } = {},
): Credentials {
  const named = env[CREDENTIALS_PATH_VAR];
  const store = named ? resolve(root, named) : join(root, TOKEN_FILE);
  const file = readJson<CredentialsFile>(store);
  if (named && !file)
    throw new Error(
      `${CREDENTIALS_PATH_VAR} names ${named}, which does not exist: save the Desktop OAuth client's JSON from the Google Cloud console there (README, Publishing: YouTube)`,
    );
  const app = file?.installed ?? file?.web ?? file ?? {};
  const clientId = env.YOUTUBE_CLIENT_ID || app.client_id;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET || app.client_secret;
  if (!clientId || !clientSecret)
    throw new Error(
      `no OAuth client: set ${CREDENTIALS_PATH_VAR} to the Desktop client's JSON, or YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET, in .env (README, Publishing: YouTube)`,
    );
  const refreshToken = env.YOUTUBE_REFRESH_TOKEN || file?.refresh_token || null; // an empty .env line is unset
  if (!refreshToken && opts.requireToken !== false)
    throw new Error(`no refresh token: ${AUTH_HELP}, or set YOUTUBE_REFRESH_TOKEN in .env`);
  return { clientId, clientSecret, refreshToken, store };
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

const RETRYABLE_REASONS = new Set([
  'quotaExceeded',
  'uploadLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'backendError',
  'internalError',
]);
/** Whether a failure is worth the same call again later (a quota reset, a transient outage) rather than a person. */
export const classify = (status: number, reason: string): boolean =>
  status === 401 ||
  status === 408 ||
  status === 429 ||
  (status >= 500 && status <= 504) ||
  RETRYABLE_REASONS.has(reason);

/** Reads Google's error envelope into a YouTubeError. */
async function errorOf(r: Response): Promise<YouTubeError> {
  const text = await r.text().catch(() => '');
  let reason = r.statusText || `http ${r.status}`;
  let message = text.slice(0, 300);
  try {
    const j = JSON.parse(text) as {
      error?: { message?: string; errors?: { reason?: string; message?: string }[] } | string;
      error_description?: string;
    };
    if (typeof j.error === 'string') {
      reason = j.error;
      message = j.error_description ?? j.error;
    } else if (j.error) {
      reason = j.error.errors?.[0]?.reason ?? reason;
      message = j.error.message ?? j.error.errors?.[0]?.message ?? message;
    }
  } catch {
    // not JSON: keep the status text
  }
  if (reason === 'invalid_grant') return new YouTubeError(`${message}; ${AUTH_HELP}`, r.status, reason, false);
  return new YouTubeError(`${reason}: ${message}`, r.status, reason, classify(r.status, reason));
}

const form = (x: Record<string, string>) => new URLSearchParams(x).toString();
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

async function tokenRequest(body: Record<string, string>, fetchFn: typeof fetch) {
  const r = await fetchFn(TOKEN_URL, { method: 'POST', headers: FORM, body: form(body) }).catch((e: Error) => {
    throw new YouTubeError(`token request failed: ${e.message}`, 0, 'network', true);
  });
  if (!r.ok) throw await errorOf(r);
  return (await r.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
}

const tokens = new Map<string, { token: string; until: number }>(); // per refresh token, per process
/** A bearer token for the refresh token, fetched once per process and again a minute before it expires. */
export async function accessToken(creds: Credentials, fetchFn: typeof fetch = fetch, force = false): Promise<string> {
  if (!creds.refreshToken) throw new YouTubeError(`no refresh token; ${AUTH_HELP}`, 0, 'invalid_grant', false);
  const hit = tokens.get(creds.refreshToken);
  if (hit && !force && hit.until > Date.now()) return hit.token;
  const t = await tokenRequest(
    {
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    },
    fetchFn,
  );
  tokens.set(creds.refreshToken, { token: t.access_token, until: Date.now() + ((t.expires_in ?? 3600) - 60) * 1000 });
  return t.access_token;
}

/** The one-time desktop consent: a loopback server takes the code the browser brings back, the token file keeps the
 *  refresh token. `open` receives the consent URL (print it, or start the browser). */
export function authorize(
  creds: Credentials,
  root: string,
  open: (url: string) => void,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      const code = u.searchParams.get('code');
      const denied = u.searchParams.get('error');
      if (!code && !denied) {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, { 'content-type': 'text/plain' })
        .end(code ? 'Authorised. You can close this tab.' : `Consent failed: ${denied}`);
      server.close();
      if (!code) return reject(new Error(`consent failed: ${denied}`));
      try {
        const t = await tokenRequest(
          {
            grant_type: 'authorization_code',
            code,
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: redirect,
          },
          fetchFn,
        );
        if (!t.refresh_token)
          throw new Error(
            'Google returned no refresh token; revoke the app at myaccount.google.com/permissions and run auth again',
          );
        const store = creds.store ?? join(root, TOKEN_FILE);
        mkdirSync(dirname(store), { recursive: true });
        const kept = readJson<Record<string, unknown>>(store) ?? {};
        writeFileSync(store, JSON.stringify({ ...kept, refresh_token: t.refresh_token }, null, 1) + '\n', {
          mode: 0o600,
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    let redirect = '';
    server.listen(0, '127.0.0.1', () => {
      const a = server.address();
      if (!a || typeof a === 'string') return reject(new Error('loopback server has no port'));
      redirect = `http://127.0.0.1:${a.port}`;
      const url = `${AUTH_URL}?${form({
        client_id: creds.clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent',
      })}`;
      open(url);
    });
    server.on('error', reject);
  });
}

export interface Snippet {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
}
export interface VideoStatus {
  privacyStatus?: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  selfDeclaredMadeForKids?: boolean;
  containsSyntheticMedia?: boolean;
  embeddable?: boolean;
}
export interface RemoteVideo {
  id: string;
  privacyStatus: string;
  uploadStatus: string;
  rejectionReason: string | null;
  publishAt: string | null;
  processingStatus: string | null;
  // what verification reads; absent when the response did not carry it (fileDetails: owner only, once available)
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  defaultLanguage?: string;
  license?: string;
  embeddable?: boolean;
  madeForKids?: boolean;
  selfDeclaredMadeForKids?: boolean;
  containsSyntheticMedia?: boolean;
  failureReason?: string;
  ytRating?: string;
  regionRestriction?: { allowed?: string[]; blocked?: string[] };
  hasCustomThumbnail?: boolean;
  fileName?: string;
  fileSize?: number;
  fileAvailability?: string;
}
export interface RemoteCaption {
  id: string;
  language: string;
  name: string;
  trackKind: string;
  status: string;
}
export interface YouTubeClient {
  /** Resumable insert. With no `session` it opens one and reports its URI before the first byte; with one it asks
   *  YouTube how far it got and sends the rest. A finished session returns the video again. */
  insertVideo(a: {
    file: string;
    snippet: Snippet;
    status: VideoStatus;
    session: string | null;
    onSession: (uri: string) => void;
  }): Promise<{ id: string }>;
  setThumbnail(id: string, file: string): Promise<void>;
  insertCaptions(id: string, file: string, language: string, name: string): Promise<void>;
  updateVideo(id: string, body: { snippet?: Snippet; status?: VideoStatus }): Promise<void>;
  getVideo(id: string): Promise<RemoteVideo | null>;
  listCaptions(videoId: string): Promise<RemoteCaption[]>;
  deleteCaptions(trackId: string): Promise<void>;
}

/** The anonymous oEmbed status of a video (no key, no quota): 200 when it is reachable without signing in, 0 on a
 *  network error. Google documents no status; 401, 403 and 404 were observed or reported for the unreachable. */
export async function oembedStatus(id: string, fetchFn: typeof fetch = fetch): Promise<number> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`;
  try {
    return (await fetchFn(url, { method: 'GET', signal: AbortSignal.timeout(10_000) })).status;
  } catch {
    return 0;
  }
}

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
const mimeOf = (file: string) => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';

export function youtubeClient(creds: Credentials, fetchFn: typeof fetch = fetch): YouTubeClient {
  /** One authorised request; a 401 refreshes the token once and tries again. */
  async function request(
    url: string,
    init: RequestInit & { headers?: Record<string, string> },
    retried = false,
  ): Promise<Response> {
    const token = await accessToken(creds, fetchFn, retried);
    const r = await fetchFn(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } }).catch(
      (e: Error) => {
        throw new YouTubeError(`network: ${e.message}`, 0, 'network', true);
      },
    );
    if (r.status === 401 && !retried) return request(url, init, true);
    if (!r.ok && r.status !== 308) throw await errorOf(r);
    return r;
  }

  /** The resumable upload protocol, shared by videos and captions. */
  async function resumable(
    url: string,
    meta: unknown,
    file: string,
    contentType: string,
    session: string | null,
    onSession: (uri: string) => void,
  ): Promise<unknown> {
    const size = statSync(file).size;
    let uri = session;
    let from = 0;
    if (!uri) {
      const r = await request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': contentType,
          'x-upload-content-length': String(size),
        },
        body: JSON.stringify(meta),
      });
      uri = r.headers.get('location');
      if (!uri) throw new YouTubeError('no upload session uri in the response', r.status, 'noLocation', false);
      onSession(uri);
    } else {
      const r = await request(uri, { method: 'PUT', headers: { 'content-range': `bytes */${size}` } });
      if (r.status !== 308) return r.json(); // the session had finished: here is the resource
      const range = /bytes=0-(\d+)/.exec(r.headers.get('range') ?? '');
      from = range ? Number(range[1]) + 1 : 0;
    }
    const bytes = readFileSync(file); // ponytail: whole file in memory; stream it if an upload ever exceeds 2 GB
    const r = await request(uri, {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        ...(from > 0 ? { 'content-range': `bytes ${from}-${size - 1}/${size}` } : {}),
      },
      body: bytes.subarray(from),
    });
    // a 308 here is YouTube holding a partial upload: the session stands and the next run resumes it
    if (r.status === 308)
      throw new YouTubeError('upload incomplete; run the verb again to resume', 308, 'incomplete', true);
    return r.json();
  }

  return {
    async insertVideo({ file, snippet, status, session, onSession }) {
      const v = (await resumable(
        `${UPLOAD}/videos?uploadType=resumable&part=snippet,status`,
        { snippet, status },
        file,
        mimeOf(file),
        session,
        onSession,
      )) as { id: string };
      return { id: v.id };
    },
    async setThumbnail(id, file) {
      await request(`${UPLOAD}/thumbnails/set?videoId=${id}&uploadType=media`, {
        method: 'POST',
        headers: { 'content-type': mimeOf(file) },
        body: readFileSync(file),
      });
    },
    async insertCaptions(id, file, language, name) {
      await resumable(
        `${UPLOAD}/captions?uploadType=resumable&part=snippet`,
        { snippet: { videoId: id, language, name } },
        file,
        'application/octet-stream',
        null,
        () => undefined,
      );
    },
    async updateVideo(id, body) {
      const parts = Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined);
      await request(`${API}/videos?part=${parts.join(',')}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ id, ...body }),
      });
    },
    async getVideo(id) {
      const r = await request(
        `${API}/videos?part=snippet,status,contentDetails,processingDetails,fileDetails&id=${id}`,
        { method: 'GET' },
      );
      const j = (await r.json()) as {
        items?: {
          id: string;
          snippet?: {
            title?: string;
            description?: string;
            tags?: string[];
            categoryId?: string;
            defaultLanguage?: string;
          };
          status?: {
            privacyStatus?: string;
            uploadStatus?: string;
            rejectionReason?: string;
            failureReason?: string;
            publishAt?: string;
            license?: string;
            embeddable?: boolean;
            madeForKids?: boolean;
            selfDeclaredMadeForKids?: boolean;
            containsSyntheticMedia?: boolean;
          };
          contentDetails?: {
            hasCustomThumbnail?: boolean;
            contentRating?: { ytRating?: string };
            regionRestriction?: { allowed?: string[]; blocked?: string[] };
          };
          processingDetails?: { processingStatus?: string; fileAvailability?: string };
          fileDetails?: { fileName?: string; fileSize?: string };
        }[];
      };
      const v = j.items?.[0];
      if (!v) return null;
      const { snippet: sn = {}, status: st = {}, contentDetails: cd = {}, fileDetails: fd = {} } = v;
      return {
        id: v.id,
        privacyStatus: st.privacyStatus ?? 'unknown',
        uploadStatus: st.uploadStatus ?? 'unknown',
        rejectionReason: st.rejectionReason ?? null,
        publishAt: st.publishAt ?? null,
        processingStatus: v.processingDetails?.processingStatus ?? null,
        title: sn.title,
        description: sn.description,
        tags: sn.tags,
        categoryId: sn.categoryId,
        defaultLanguage: sn.defaultLanguage,
        license: st.license,
        embeddable: st.embeddable,
        madeForKids: st.madeForKids,
        selfDeclaredMadeForKids: st.selfDeclaredMadeForKids,
        containsSyntheticMedia: st.containsSyntheticMedia,
        failureReason: st.failureReason,
        ytRating: cd.contentRating?.ytRating,
        regionRestriction: cd.regionRestriction,
        hasCustomThumbnail: cd.hasCustomThumbnail,
        fileName: fd.fileName,
        fileSize: fd.fileSize === undefined ? undefined : Number(fd.fileSize),
        fileAvailability: v.processingDetails?.fileAvailability,
      };
    },
    async deleteCaptions(trackId) {
      await request(`${API}/captions?id=${trackId}`, { method: 'DELETE' });
    },
    async listCaptions(videoId) {
      const r = await request(`${API}/captions?part=snippet&videoId=${videoId}`, { method: 'GET' });
      const j = (await r.json()) as {
        items?: { id: string; snippet?: { language?: string; name?: string; trackKind?: string; status?: string } }[];
      };
      return (j.items ?? []).map((c) => ({
        id: c.id,
        language: c.snippet?.language ?? '',
        name: c.snippet?.name ?? '',
        trackKind: c.snippet?.trackKind ?? '',
        status: c.snippet?.status ?? '',
      }));
    },
  };
}
