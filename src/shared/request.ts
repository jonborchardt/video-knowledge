// Request ids and expiry (spec §7.2, §16): the one shared piece of the three request shapes (a release request in
// publish.json, a proposal batch, an article correction), so they never hash differently. An id is an HMAC over the
// subject and the time, truncated: unguessable without APPROVAL_SECRET, which lives in .env and nowhere else.
import { createHmac } from 'node:crypto';

export type RequestPrefix = 'rq' | 'pb' | 'ar';

/** `<prefix>-<12 hex>`: HMAC-SHA256(secret, `<subject>:<at>`), truncated. */
export function requestId(prefix: RequestPrefix, secret: string, subject: string, at: string): string {
  if (!secret) throw new Error('a request id needs APPROVAL_SECRET');
  return `${prefix}-${createHmac('sha256', secret).update(`${subject}:${at}`).digest('hex').slice(0, 12)}`;
}

export const expired = (expiresAt: string, now: Date): boolean => Date.parse(expiresAt) <= now.getTime();

/** `expiresAt` for a request made at `at`, `days` ahead. */
export const expiryOf = (at: string, days: number): string =>
  new Date(Date.parse(at) + days * 24 * 60 * 60 * 1000).toISOString();

export function secretFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.APPROVAL_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}
