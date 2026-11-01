// The post: the shared composer's text (what the manifest showed), posted once per output with an intent record
// before the call and the id after; a crash between the two is reconciled from the account's recent posts.
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { site } from '../../../config/site';
import { readJson, sha } from '../../../shared/io';
import { composePost, postLength } from '../../../shared/social-text';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../publishing/publish';
import { inspectPosts, loadSocial, post, postProblem, socialPath, textFor } from '../social';
import { XError, type XClient } from '../x';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));

function live(outputs: ('youtube' | 'short:one')[] = ['youtube']) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  let l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
  if (outputs.includes('short:one'))
    l.outputs['short:one'] = { kind: 'youtube-short', derivedFrom: 'youtube', metadata: {}, events: [] };
  for (const [i, o] of outputs.entries())
    l = appendEvent(l, o, { at: `2026-11-01T00:0${i}:00Z`, type: 'published', by: 'Jon', id: `vid0000000${i}` }).ledger;
  saveLedger(publishPath(f.topic, f.story, f.root), l);
  return f;
}
/** A fake X: records posts, answers the recent list, fails as planted. */
function fakeX(opts: { fail?: XError; recent?: { id: string; text: string }[]; crash?: boolean } = {}) {
  const posted: string[] = [];
  let n = 0;
  const client: XClient = {
    async post(text) {
      if (opts.fail) throw opts.fail;
      posted.push(text);
      n += 1;
      if (opts.crash) throw new Error('killed after the POST, before the record');
      return { id: `t${n}`, url: `https://x.com/i/status/t${n}` };
    },
    async recent() {
      return opts.recent ?? posted.map((text, i) => ({ id: `t${i + 1}`, text }));
    },
  };
  return { client, posted };
}

describe('composePost', () => {
  it('fits 280 with a long title and keeps the disclosure whole', () => {
    const long = 'A very long title '.repeat(20).trim();
    const text = composePost(long, 'https://commonwealthofreason.com/heat-pumps/a-very-long-slug/', site.disclosure);
    expect(postLength(text)).toBeLessThanOrEqual(280);
    expect(text.endsWith(site.disclosure)).toBe(true);
    expect(text).toMatch(/…\n\nhttps:/);
    expect(composePost('Short', 'https://x.y/', 'D')).toBe('Short\n\nhttps://x.y/\n\nD');
  });
});

describe('post', () => {
  const by = (f: Fixture) => textFor(f.topic, f.story, 'youtube', site.disclosure, f.root)!;
  it('refuses an output that is not live, posts once, and is idempotent on the same text', async () => {
    const f = live();
    expect(textFor(f.topic, f.story, 'short:one', site.disclosure, f.root)).toBeNull();
    const ledger = loadLedger(f.topic, f.story, f.root)!;
    expect(postProblem(ledger, null, 'short:one', 'x', f.topic, f.story, f.root)).toMatch(/no output short:one/);
    const t = by(f);
    expect(t.text).toContain('https://www.youtube.com/watch?v=vid00000000');
    expect(t.textSha).toBe(sha(t.text));
    expect(postProblem(ledger, null, 'youtube', t.textSha, f.topic, f.story, f.root)).toBeNull();
    const x = fakeX();
    const r1 = await post(f.topic, f.story, 'youtube', '@CORSpending', t, { client: x.client }, f.root);
    expect(r1).toEqual({ status: 'posted', id: 't1', url: 'https://x.com/i/status/t1' });
    const file = readJson<{ outputs: Record<string, { posts: { status: string; id: string | null }[] }> }>(
      socialPath(f.topic, f.story, f.root),
    )!;
    expect(file.outputs.youtube.posts).toHaveLength(1);
    expect(file.outputs.youtube.posts[0]).toMatchObject({ status: 'posted', id: 't1', textSha: t.textSha });
    expect(
      postProblem(
        loadLedger(f.topic, f.story, f.root),
        loadSocial(f.topic, f.story, f.root),
        'youtube',
        t.textSha,
        f.topic,
        f.story,
        f.root,
      ),
    ).toMatch(/already posted/);
    const r2 = await post(f.topic, f.story, 'youtube', '@CORSpending', t, { client: x.client }, f.root);
    expect(r2).toMatchObject({ status: 'posted', id: 't1' });
    expect(x.posted).toHaveLength(1);
  });
  it('a 429 leaves the intent as posting with a retryable error; a 403 duplicate is posted with no id', async () => {
    const f = live();
    const t = by(f);
    const r = await post(
      f.topic,
      f.story,
      'youtube',
      '@a',
      t,
      { client: fakeX({ fail: new XError('X 429: slow', 429, true) }).client },
      f.root,
    );
    expect(r).toEqual({ status: 'failed', error: 'X 429: slow', retryable: true });
    const p1 = loadSocial(f.topic, f.story, f.root)!.outputs.youtube.posts[0];
    expect(p1).toMatchObject({ status: 'posting', retryable: true, error: 'X 429: slow' });
    const dup = await post(
      f.topic,
      f.story,
      'youtube',
      '@a',
      t,
      { client: fakeX({ fail: new XError('X 403: duplicate content', 403, false, true), recent: [] }).client },
      f.root,
    );
    expect(dup).toEqual({ status: 'posted', id: null });
    expect(loadSocial(f.topic, f.story, f.root)!.outputs.youtube.posts).toHaveLength(1);
    expect(loadSocial(f.topic, f.story, f.root)!.outputs.youtube.posts[0]).toMatchObject({
      status: 'posted',
      id: null,
    });
  });
  it('a crash after the POST and before the record is reconciled from the recent posts: one POST, one posted (criterion 13)', async () => {
    const f = live();
    const t = by(f);
    const x = fakeX({ crash: true });
    await expect(post(f.topic, f.story, 'youtube', '@a', t, { client: x.client }, f.root)).rejects.toThrow(/killed/);
    expect(loadSocial(f.topic, f.story, f.root)!.outputs.youtube.posts[0]).toMatchObject({
      status: 'posting',
      id: null,
    });
    const again = fakeX({ recent: [{ id: 't1', text: t.text }] });
    const r = await post(f.topic, f.story, 'youtube', '@a', t, { client: again.client }, f.root);
    expect(r).toEqual({ status: 'posted', id: 't1', url: 'https://x.com/i/status/t1', reconciled: true });
    expect(again.posted).toEqual([]);
    expect(x.posted).toHaveLength(1);
    expect(loadSocial(f.topic, f.story, f.root)!.outputs.youtube.posts).toHaveLength(1);
  });
  it('inspectPosts: not configured is ready; a live output without a post is stale; a final failure is invalid', async () => {
    const f = live(['youtube', 'short:one']);
    expect(inspectPosts(f.topic, f.story, f.root, false)).toMatchObject({ status: 'ready', code: 'not-configured' });
    expect(inspectPosts(f.topic, f.story, f.root, true)).toMatchObject({ status: 'missing' });
    const t = by(f);
    await post(f.topic, f.story, 'youtube', '@a', t, { client: fakeX().client }, f.root);
    const stale = inspectPosts(f.topic, f.story, f.root, true);
    expect(stale.status).toBe('stale');
    expect(stale.findings).toEqual(['short:one is live without a post']);
    const ts = textFor(f.topic, f.story, 'short:one', site.disclosure, f.root)!;
    await post(f.topic, f.story, 'short:one', '@a', ts, { client: fakeX().client }, f.root);
    expect(inspectPosts(f.topic, f.story, f.root, true).status).toBe('ready');
    await post(
      f.topic,
      f.story,
      'youtube',
      '@a',
      { text: 'another', textSha: sha('another') },
      { client: fakeX({ fail: new XError('X 401: bad', 401, false) }).client },
      f.root,
    );
    expect(inspectPosts(f.topic, f.story, f.root, true)).toMatchObject({
      status: 'invalid',
      findings: ['youtube: X 401: bad'],
    });
    expect(inspectPosts(f.topic, f.story, f.root, true).output).toMatch(/social\.json$/);
    expect(join('a', 'b')).toBeTruthy();
  });
});
