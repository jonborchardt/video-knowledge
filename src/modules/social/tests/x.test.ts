// The X client: OAuth 1.0a signing against the documented vector, the two calls, and what each answer means.
import { describe, expect, it } from 'vitest';
import { XError, credsFor, oauthHeader, rfc3986, xClient } from '../x';

// X's developer documentation, "Creating a signature": the example request and keys, the URL as docs.x.com now
// prints it (api.x.com); the signature below is the one that URL yields.
const DOC = {
  apiKey: 'xvz1evFS4wEEPTGEFPHBog',
  apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
  accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
  accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
};
const NONCE = 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg';
const TIMESTAMP = '1318622958';

describe('oauthHeader', () => {
  it('signs the documented example request to the documented signature', () => {
    const header = oauthHeader(
      'POST',
      'https://api.x.com/1.1/statuses/update.json',
      { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
      DOC,
      NONCE,
      TIMESTAMP,
    );
    expect(header.startsWith('OAuth ')).toBe(true);
    expect(header).toContain(`oauth_consumer_key="${DOC.apiKey}"`);
    expect(header).toContain(`oauth_nonce="${NONCE}"`);
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain(`oauth_timestamp="${TIMESTAMP}"`);
    expect(header).toContain(`oauth_token="${DOC.accessToken}"`);
    expect(header).toContain('oauth_version="1.0"');
    expect(header).toContain(`oauth_signature="${rfc3986('Ls93hJiZbQ3akF3HF3x1Bz8/zU4=')}"`);
  });
  it('percent-encodes as RFC 3986 wants', () => {
    expect(rfc3986('Hello Ladies + Gentlemen, a signed OAuth request!')).toBe(
      'Hello%20Ladies%20%2B%20Gentlemen%2C%20a%20signed%20OAuth%20request%21',
    );
    expect(rfc3986("a'b(c)*")).toBe('a%27b%28c%29%2A');
  });
});

describe('xClient', () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const answer = (status: number, body: unknown) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
  const creds = { ...DOC, userId: '12345' };
  it('posts a tweet with a signed header and a JSON body, and reads the account back', async () => {
    const c = xClient(creds, answer(201, { data: { id: '1', text: 'hi' } }));
    expect(await c.post('hi')).toEqual({ id: '1', url: 'https://x.com/i/status/1' });
    expect(calls.at(-1)!.url).toBe('https://api.x.com/2/tweets');
    expect(calls.at(-1)!.init.method).toBe('POST');
    expect(String((calls.at(-1)!.init.headers as Record<string, string>).authorization)).toMatch(
      /^OAuth oauth_consumer_key=/,
    );
    expect(calls.at(-1)!.init.body).toBe(JSON.stringify({ text: 'hi' }));
    const r = xClient(creds, answer(200, { data: [{ id: '1', text: 'hi' }] }));
    expect(await r.recent()).toEqual([{ id: '1', text: 'hi' }]);
    expect(calls.at(-1)!.url).toBe('https://api.x.com/2/users/12345/tweets?max_results=5');
  });
  it('a 429 or a 5xx is retryable, a 403 duplicate is marked, a 401 is final', async () => {
    const err = async (status: number, body: string) => {
      try {
        await xClient(creds, answer(status, body)).post('x');
      } catch (e) {
        return e as XError;
      }
      throw new Error('no error');
    };
    expect(await err(429, 'slow down')).toMatchObject({ status: 429, retryable: true, duplicate: false });
    expect(await err(503, 'down')).toMatchObject({ status: 503, retryable: true });
    expect(await err(403, '{"detail":"You are not allowed to create a Tweet with duplicate content."}')).toMatchObject({
      status: 403,
      retryable: false,
      duplicate: true,
    });
    expect(await err(401, 'bad')).toMatchObject({ status: 401, retryable: false, duplicate: false });
  });
});

describe('credsFor', () => {
  it('reads the five keys of a commission from the environment, null when any is missing', () => {
    const env = {
      X_SPENDING_API_KEY: 'k',
      X_SPENDING_API_SECRET: 's',
      X_SPENDING_ACCESS_TOKEN: 't',
      X_SPENDING_ACCESS_SECRET: 'ts',
      X_SPENDING_USER_ID: '1',
      X_PUBLIC_HEALTH_API_KEY: 'k',
    };
    expect(credsFor('spending', env)).toEqual({
      apiKey: 'k',
      apiSecret: 's',
      accessToken: 't',
      accessSecret: 'ts',
      userId: '1',
    });
    expect(credsFor('public-health', env)).toBeNull();
    expect(credsFor('nope', env)).toBeNull();
  });
});
