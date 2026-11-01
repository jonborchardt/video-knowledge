// A correction request beside the article (spec §16: no generic request framework; register D10): the person
// approves a correction by reply like a release. `article-request.json` binds the exact `article.json` fingerprint
// the reviewed correction has; a later writer revision moves the fingerprint and voids the request; `correct
// --request` refuses any other. Pure here; the CLI writes.
import { join } from 'node:path';
import { ROOT, readJson, scriptDir } from '../../shared/io';
import { expired, expiryOf, requestId } from '../../shared/request';

export const ARTICLE_REQUEST_FILE = 'article-request.json';
export interface ArticleRequest {
  request: string; // ar-<12 hex>
  fingerprint: string; // articleFingerprint(article.json) when requested
  at: string;
  expiresAt: string;
  by: string;
  messageId?: string;
  decided?: {
    verdict: 'ok' | 'changes';
    by: string;
    at: string;
    via?: { channel: string; messageId?: string };
    notes?: string[]; // a person's CHANGES: what the next writer pass changes
  };
}
export const articleRequestPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), ARTICLE_REQUEST_FILE);
export const loadArticleRequest = (topic: string, storyId: string, root = ROOT): ArticleRequest | null =>
  readJson<ArticleRequest>(articleRequestPath(topic, storyId, root));

/** A new request for the fingerprint, or the open one when it already binds that fingerprint. */
export function requestCorrection(
  prev: ArticleRequest | null,
  fingerprint: string,
  secret: string,
  by: string,
  now: Date,
  expiresDays: number,
): { request: ArticleRequest; existing: boolean } {
  if (prev && prev.fingerprint === fingerprint && !prev.decided && !expired(prev.expiresAt, now))
    return { request: prev, existing: true };
  const at = now.toISOString();
  return {
    request: {
      request: requestId('ar', secret, fingerprint, at),
      fingerprint,
      at,
      expiresAt: expiryOf(at, expiresDays),
      by,
    },
    existing: false,
  };
}

/** Why a decision on `id` may not be applied to the article as it is now, or null. */
export function correctionProblem(
  req: ArticleRequest | null,
  id: string,
  fingerprint: string,
  now: Date,
): string | null {
  if (!req) return 'no correction request';
  if (req.request !== id) return `the open request is ${req.request}, not ${id}`;
  if (req.decided)
    return `request ${id} was decided (${req.decided.verdict}) by ${req.decided.by} at ${req.decided.at}`;
  if (expired(req.expiresAt, now)) return `request ${id} expired at ${req.expiresAt}`;
  if (req.fingerprint !== fingerprint)
    return `the article changed since request ${id} (its text was revised): a new request follows`;
  return null;
}
