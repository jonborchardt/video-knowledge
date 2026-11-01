// The X client (phase 3 Task 5): plain fetch, OAuth 1.0a user context signed with node:crypto (HMAC-SHA1), two calls:
// POST /2/tweets and GET /2/users/:id/tweets (the read-back after a crash, spec §4.5). 429 and 5xx are retryable; a
// 403 whose body says duplicate is reported as such. The keys come from .env per commission (credsFor) and never
// leave this process.
import { createHmac, randomBytes } from 'node:crypto';

export interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  userId: string;
}
export class XError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
    public duplicate = false,
  ) {
    super(message);
  }
}
export interface XClient {
  post(text: string): Promise<{ id: string; url: string }>;
  recent(): Promise<{ id: string; text: string }[]>;
}

/** RFC 3986 percent-encoding, as OAuth 1.0a wants it. */
export const rfc3986 = (s: string): string =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** The OAuth 1.0a Authorization header for `method url` with `params` (query or form fields; a JSON body adds
 *  none): the signature base string over the sorted, encoded parameters, signed HMAC-SHA1 with the two secrets. */
export function oauthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  c: Pick<XCreds, 'apiKey' | 'apiSecret' | 'accessToken' | 'accessSecret'>,
  nonce = randomBytes(16).toString('hex'),
  timestamp = String(Math.floor(Date.now() / 1000)),
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const normalized = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join('&');
  const base = `${method.toUpperCase()}&${rfc3986(url)}&${rfc3986(normalized)}`;
  const key = `${rfc3986(c.apiSecret)}&${rfc3986(c.accessSecret)}`;
  const signature = createHmac('sha1', key).update(base).digest('base64');
  const header: Record<string, string> = { ...oauth, oauth_signature: signature };
  return (
    'OAuth ' +
    Object.keys(header)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(header[k])}"`)
      .join(', ')
  );
}

export const X_API = 'https://api.x.com/2';

export function xClient(c: XCreds, fetchFn: typeof fetch = fetch): XClient {
  const call = async (method: 'GET' | 'POST', path: string, query: Record<string, string>, body?: unknown) => {
    const url = `${X_API}${path}`;
    const qs = Object.keys(query).length
      ? '?' +
        Object.entries(query)
          .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
          .join('&')
      : '';
    const r = await fetchFn(url + qs, {
      method,
      headers: {
        authorization: oauthHeader(method, url, query, c),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await r.text();
    if (!r.ok) {
      const duplicate = r.status === 403 && /duplicate/i.test(text);
      throw new XError(
        `X ${r.status}: ${text.slice(0, 300)}`,
        r.status,
        r.status === 429 || r.status >= 500,
        duplicate,
      );
    }
    return text ? (JSON.parse(text) as { data?: unknown }) : {};
  };
  return {
    async post(text) {
      const r = (await call('POST', '/tweets', {}, { text })) as { data?: { id?: string } };
      const id = r.data?.id;
      if (!id) throw new XError('X answered without a tweet id', 0, false);
      return { id, url: `https://x.com/i/status/${id}` };
    },
    async recent() {
      const r = (await call('GET', `/users/${c.userId}/tweets`, { max_results: '5' })) as {
        data?: { id: string; text: string }[];
      };
      return r.data ?? [];
    },
  };
}

/** The environment key prefix of a commission: `X_<KEY>_` with the key upper-cased and `-` as `_`. */
export const envPrefix = (commissionKey: string) => `X_${commissionKey.toUpperCase().replace(/-/g, '_')}_`;

/** The commission's X keys from the environment: `X_<KEY>_API_KEY`, `_API_SECRET`, `_ACCESS_TOKEN`, `_ACCESS_SECRET`,
 *  `_USER_ID`; null when any is missing (not configured). */
export function credsFor(commissionKey: string, env: NodeJS.ProcessEnv = process.env): XCreds | null {
  const get = (s: string) => env[`${envPrefix(commissionKey)}${s}`]?.trim() || null;
  const apiKey = get('API_KEY');
  const apiSecret = get('API_SECRET');
  const accessToken = get('ACCESS_TOKEN');
  const accessSecret = get('ACCESS_SECRET');
  const userId = get('USER_ID');
  return apiKey && apiSecret && accessToken && accessSecret && userId
    ? { apiKey, apiSecret, accessToken, accessSecret, userId }
    : null;
}
