// The social module (spec §4.5's X row, §15, phase 3 Task 5): one post per live output from the institution's X
// account, recorded in topics/<topic>/scripts/<slug>/social.json with an intent before the call and the id after,
// so a crash between the two is reconciled by reading the account's recent posts back, never by posting twice.
// Optional per institution: no handle or keys means "not configured", never a halt. It never imports publishing's
// verbs or the store; it reads the ledger through the publishing read API only.
import { join } from 'node:path';
import { commissionKey, commissionOf } from '../../config/site';
import { ROOT, readJson, scriptDir, sha, writeJsonAtomic } from '../../shared/io';
import type { Inspection } from '../../shared/inspect';
import { composePost } from '../../shared/social-text';
import { type Ledger, storyOutputs } from '../publishing';
import { type XClient, XError, credsFor, envPrefix } from './x';

export const SOCIAL_FILE = 'social.json';
export interface Post {
  at: string;
  account: string;
  text: string;
  textSha: string;
  id: string | null;
  url?: string;
  status: 'posting' | 'posted' | 'failed';
  error?: string;
  retryable?: boolean;
}
export interface SocialFile {
  outputs: Record<string, { posts: Post[] }>;
}
export const socialPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), SOCIAL_FILE);
export const loadSocial = (topic: string, storyId: string, root = ROOT): SocialFile | null =>
  readJson<SocialFile>(socialPath(topic, storyId, root));
const save = (topic: string, storyId: string, root: string, f: SocialFile) =>
  writeJsonAtomic(socialPath(topic, storyId, root), f);

/** The institution's X account for a topic: the commission's public handle, or the handle beside its keys in .env
 *  (`X_<KEY>_HANDLE`, a test account); null when the institution has no account or no keys. */
export function accountFor(
  topic: string,
  env: NodeJS.ProcessEnv = process.env,
): { key: string; handle: string; creds: NonNullable<ReturnType<typeof credsFor>> } | null {
  const c = commissionOf(topic);
  if (!c) return null;
  const key = commissionKey(c);
  const handle = c.x ?? env[`${envPrefix(key)}HANDLE`]?.trim() ?? null;
  const creds = credsFor(key, env);
  return handle && creds ? { key, handle, creds } : null;
}

/** Why the output may not be posted about, or null: it must be live, and the same text is posted once. */
export function postProblem(
  ledger: Ledger | null,
  social: SocialFile | null,
  output: string,
  textSha: string,
  topic: string,
  storyId: string,
  root = ROOT,
): string | null {
  if (!ledger?.outputs[output]) return `no output ${output} in the ledger`;
  const outs = storyOutputs(topic, storyId, root);
  const live = output === 'youtube' ? outs.video : outs.shorts.find((s) => s.output === output);
  if (!live) return `${output} is not live`;
  if (social?.outputs[output]?.posts.some((p) => p.status === 'posted' && p.textSha === textSha))
    return `already posted (${textSha})`;
  return null;
}

/** The text for an output: the composed title, its watch URL, the disclosure once (the manifest showed the same). */
export function textFor(
  topic: string,
  storyId: string,
  output: string,
  disclosure: string,
  root = ROOT,
): { text: string; textSha: string } | null {
  const outs = storyOutputs(topic, storyId, root);
  const v = output === 'youtube' ? outs.video : outs.shorts.find((s) => s.output === output);
  if (!v) return null;
  const text = composePost(v.title, v.url, disclosure);
  return { text, textSha: sha(text) };
}

export interface PostDeps {
  client: XClient;
  now?: () => number;
}
export type PostResult =
  | { status: 'posted'; id: string | null; url?: string; reconciled?: boolean }
  | { status: 'failed'; error: string; retryable: boolean };

/** Posts about one live output, once: the intent record before the call, the id after; a `posting` record without
 *  `posted` (a crash) is reconciled from the account's recent posts before anything is posted again; X's
 *  duplicate refusal is recorded as posted with no id. */
export async function post(
  topic: string,
  storyId: string,
  output: string,
  account: string,
  text: { text: string; textSha: string },
  d: PostDeps,
  root = ROOT,
): Promise<PostResult> {
  const now = () => new Date((d.now ?? Date.now)()).toISOString();
  const f = loadSocial(topic, storyId, root) ?? { outputs: {} };
  const o = (f.outputs[output] ??= { posts: [] });
  const done = o.posts.find((p) => p.status === 'posted' && p.textSha === text.textSha);
  if (done) return { status: 'posted', id: done.id, url: done.url };
  const pending = o.posts.find((p) => p.status === 'posting' && p.textSha === text.textSha);
  if (pending) {
    // the remote may have it: read back before any repeat
    let recent: { id: string; text: string }[];
    try {
      recent = await d.client.recent();
    } catch (e) {
      if (e instanceof XError && e.retryable) return { status: 'failed', error: e.message, retryable: true };
      throw e;
    }
    const hit = recent.find((r) => r.text.trim() === text.text.trim());
    if (hit) {
      Object.assign(pending, { status: 'posted', id: hit.id, url: `https://x.com/i/status/${hit.id}`, at: now() });
      delete pending.error;
      delete pending.retryable;
      save(topic, storyId, root, f);
      return { status: 'posted', id: hit.id, url: pending.url, reconciled: true };
    }
  }
  const record: Post = pending ?? {
    at: now(),
    account,
    text: text.text,
    textSha: text.textSha,
    id: null,
    status: 'posting',
  };
  if (!pending) o.posts.push(record);
  save(topic, storyId, root, f); // the intent, before the call
  try {
    const r = await d.client.post(text.text);
    Object.assign(record, { status: 'posted', id: r.id, url: r.url, at: now() });
    delete record.error;
    delete record.retryable;
    save(topic, storyId, root, f);
    return { status: 'posted', id: r.id, url: r.url };
  } catch (e) {
    if (!(e instanceof XError)) throw e;
    if (e.duplicate) {
      Object.assign(record, {
        status: 'posted',
        id: null,
        at: now(),
        error: 'X refused a duplicate: posted earlier; the id follows from a read-back',
      });
      save(topic, storyId, root, f);
      return { status: 'posted', id: null };
    }
    if (!e.retryable) Object.assign(record, { status: 'failed', error: e.message, retryable: false, at: now() });
    else Object.assign(record, { error: e.message, retryable: true }); // stays `posting`: reconciled before any retry
    save(topic, storyId, root, f);
    return { status: 'failed', error: e.message, retryable: e.retryable };
  }
}

/** The module's inspection for the board: missing (no file), invalid (a failed post), stale (a live output without a
 *  post while the institution has an account), ready. */
export function inspectPosts(
  topic: string,
  storyId: string,
  root = ROOT,
  configured = !!accountFor(topic),
): Inspection {
  const f = loadSocial(topic, storyId, root);
  const rel = `topics/${topic}/scripts/${scriptDir(topic, storyId, '').split(/[\\/]/).filter(Boolean).at(-1)}/${SOCIAL_FILE}`;
  if (!configured) return { status: 'ready', code: 'not-configured', findings: [], output: rel };
  if (!f) return { status: 'missing', code: 'missing', findings: ['no social.json'], output: rel };
  const failed = Object.entries(f.outputs).flatMap(([id, o]) =>
    o.posts.filter((p) => p.status === 'failed' && !p.retryable).map((p) => `${id}: ${p.error}`),
  );
  if (failed.length) return { status: 'invalid', code: 'failed', findings: failed, output: rel };
  const outs = storyOutputs(topic, storyId, root);
  const live = [outs.video?.output, ...outs.shorts.map((s) => s.output)].filter((x): x is string => !!x);
  const unposted = live.filter((id) => !f.outputs[id]?.posts.some((p) => p.status === 'posted'));
  if (unposted.length)
    return {
      status: 'stale',
      code: 'unposted',
      findings: unposted.map((id) => `${id} is live without a post`),
      output: rel,
    };
  return { status: 'ready', code: 'ready', findings: [], output: rel };
}
