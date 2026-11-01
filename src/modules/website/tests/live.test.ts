// `npm run links -- live` (spec §4.4 step 5): one request to the matter page on the public site; live when it answers
// 200, carries the live video's id and the path is in the frozen public-urls.json. A fixture's negative probe passes
// when the production host has no such page and the path is not frozen.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { site } from '../../../config/site';
import { toJson } from '../../../shared/io';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../publishing/publish';
import { type LiveCheck, liveCheck, matterPathOf } from '../live';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load

function live() {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
  saveLedger(
    publishPath(f.topic, f.story, f.root),
    appendEvent(l, 'youtube', { at: '2026-11-01T00:00:00Z', type: 'published', by: 'Jon', id: 'vid00000000' }).ledger,
  );
  const path = matterPathOf(f.topic, f.story, f.root)!;
  writeFileSync(join(f.root, 'public-urls.json'), toJson([path, '/']));
  const requests: string[] = [];
  const serving = (pages: Record<string, string | number>) => {
    const fetchFn = (async (url: string | URL | Request) => {
      const u = String(url);
      requests.push(u);
      const page = pages[u];
      if (page === undefined) return new Response('not found', { status: 404 });
      if (typeof page === 'number') return new Response('', { status: page });
      return new Response(page, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as unknown as typeof fetch;
    return fetchFn;
  };
  return { f, path, url: `${site.url.replace(/\/$/, '')}${path}`, requests, serving };
}

describe('liveCheck', () => {
  it('is false on a stale page without the video id and true once the page carries it, with exactly one request each', async () => {
    const { f, url, requests, serving } = live();
    const stale = await liveCheck(f.topic, f.story, serving({ [url]: '<html>soon</html>' }), f.root);
    expect(stale).toMatchObject({ ok: false, url, status: 200 });
    expect(stale.why).toMatch(/does not carry the video vid00000000/);
    expect(requests).toEqual([url]);
    const ready = await liveCheck(
      f.topic,
      f.story,
      serving({ [url]: '<iframe src="https://www.youtube-nocookie.com/embed/vid00000000"></iframe>' }),
      f.root,
    );
    expect(ready).toEqual({ ok: true, url, status: 200 } satisfies LiveCheck);
    expect(requests).toEqual([url, url]);
  });
  it('a missing page, a non-200 and an unfrozen path are each a reason', async () => {
    const { f, url, path, serving } = live();
    expect((await liveCheck(f.topic, f.story, serving({}), f.root)).why).toMatch(/answered 404/);
    expect((await liveCheck(f.topic, f.story, serving({ [url]: 503 }), f.root)).why).toMatch(/answered 503/);
    writeFileSync(join(f.root, 'public-urls.json'), toJson(['/']));
    const r = await liveCheck(f.topic, f.story, serving({ [url]: 'vid00000000' }), f.root);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/not in public-urls.json/);
    const down = await liveCheck(
      f.topic,
      f.story,
      (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
      f.root,
    );
    expect(down.why).toMatch(/no answer: ECONNREFUSED/);
    expect(await liveCheck(f.topic, 'nope:x', serving({}), f.root)).toMatchObject({ ok: false });
    expect(path).toMatch(/^\/heat-pumps\//);
  });
  it("the fixture's negative probe passes when the production site has no page and the path is not frozen; the positive probe takes the preview host", async () => {
    const { f, url, path, serving } = live();
    writeFileSync(join(f.root, 'public-urls.json'), toJson(['/']));
    expect(await liveCheck(f.topic, f.story, serving({}), f.root, { expectAbsent: true })).toMatchObject({
      ok: true,
      status: 404,
    });
    const present = await liveCheck(f.topic, f.story, serving({ [url]: 'a page' }), f.root, { expectAbsent: true });
    expect(present.ok).toBe(false);
    expect(present.why).toMatch(/on the production site/);
    writeFileSync(join(f.root, 'public-urls.json'), toJson([path]));
    const frozen = await liveCheck(f.topic, f.story, serving({}), f.root, { expectAbsent: true });
    expect(frozen.why).toMatch(/in public-urls.json/);
    const preview = `https://fixture-run.preview.example${path}`;
    const r = await liveCheck(f.topic, f.story, serving({ [preview]: 'embed/vid00000000' }), f.root, {
      baseUrl: 'https://fixture-run.preview.example',
      frozen: false,
    });
    expect(r).toEqual({ ok: true, url: preview, status: 200 });
  });
});
