// `publish decide` (spec §7.2, §4.5): a person's decision applied against the exact manifest the request bound, every
// step idempotent and `decided` last, so an interrupted decide is completed by the next call and never repeated.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MANIFEST_FILE, REVIEW_DIR, readJson, sha, toJson } from '../../../shared/io';
import { Refusal } from '../../../shared/refusal';
import type { ReleaseManifest } from '../../../shared/types';
import { writeManifest } from '../../packaging/manifest';
import { ctaPath } from '../../website/cta';
import { type DecideArgs, type DecideDeps, childEnv, decide, decideProblem } from '../decide';
import { emptyFakeState, fakeYoutubeClient, readFakeState, writeFakeState } from '../fake-youtube';
import {
  addOutputTo,
  loadLedger,
  openRequest,
  recordRequested,
  recordUploaded,
  recordVerified,
  requestOf,
} from '../publish';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));
const SECRET = 'a-test-secret-of-some-length';
const now = new Date('2026-10-30T12:00:00Z');
const PAID_URL = 'https://shop.example/pump';

/** A requested release group (the video and two Shorts uploaded, verified, requested) over the fake client. */
function requested(opts: { shorts?: string[]; paid?: boolean } = {}) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const review = join(f.dir, 'video', REVIEW_DIR);
  const bytes = Buffer.alloc(1024, 3);
  writeFileSync(join(review, 'fixture.mp4'), bytes);
  writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const rp = join(review, 'review.json');
  writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
  if (opts.paid)
    writeFileSync(
      ctaPath(f.topic, f.story, f.root),
      toJson({
        primary: { type: 'inquiry', text: 'The full record' },
        secondary: [{ type: 'commercial', url: PAID_URL, text: 'The pump we sized', disclosure: 'affiliate link' }],
      }),
    );
  for (const slug of opts.shorts ?? ['one', 'two']) {
    const dir = join(f.dir, 'shorts', slug, 'video', REVIEW_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'review.json'),
      toJson({
        generatedAt: '2026-01-01',
        status: 'release build',
        buildReport: `br-${slug}`,
        mp4: `short-${slug}.mp4`,
        mp4Sha: `short${slug}sha`,
        thumbnailSha: null,
        captionsSha: null,
        seconds: 7.5,
        title: `Short ${slug}`,
        chapters: [],
        short: { parent: f.story, slug, format: 'ONE FIGURE FROM THE RECORD', fullVideo: null },
      }),
    );
    writeFileSync(join(dir, 'description.txt'), `Short ${slug}\n`);
    addOutputTo(f.topic, f.story, `short:${slug}`, 'youtube-short', {
      derivedFrom: 'youtube',
      source: relative(f.root, join(f.dir, 'shorts', slug)).replaceAll('\\', '/'),
      root: f.root,
    });
  }
  writeManifest(f.topic, f.story, f.root);
  const manifestOf = () => readJson<ReleaseManifest>(join(review, MANIFEST_FILE));
  const fake = join(f.root, 'youtube-fake.json');
  writeFakeState(fake, emptyFakeState());
  const client = fakeYoutubeClient(fake);
  const base = { root: f.root, by: 'automation', now };
  const m = manifestOf()!;
  Object.keys(m.outputs).forEach((id, i) => {
    const vid = `vid0000000${i}`;
    // the fake holds what the upload would have left
    const s = readFakeState(fake);
    s.videos[vid] = {
      snippet: {
        title: m.outputs[id].title,
        description: m.outputs[id].description,
        tags: [],
        categoryId: '27',
        defaultLanguage: 'en',
      },
      status: { privacyStatus: 'private' },
      privacyStatus: 'private',
      publishAt: null,
      uploadStatus: 'processed',
      processingStatus: 'succeeded',
      captions: [],
      thumbnail: false,
      fileSize: 1024,
      gets: 0,
    };
    writeFakeState(fake, s);
    recordUploaded(f.topic, f.story, { ...base, output: id, id: vid, visibility: 'private' });
    recordVerified(f.topic, f.story, {
      ...base,
      output: id,
      result: 'passed',
      checks: [{ name: 'title', result: 'pass' }],
    });
  });
  recordRequested(f.topic, f.story, { ...base, manifest: m, secret: SECRET, expiresDays: 7, channel: 'email' });
  const ledger = () => loadLedger(f.topic, f.story, f.root)!;
  const req = openRequest(ledger(), m.releaseSha, now)!;
  const ran: string[][] = [];
  const deps = (extra: Partial<DecideDeps> = {}): DecideDeps => ({
    client,
    run: (cli, args) => {
      ran.push([cli, ...args]);
      if (cli === 'links') {
        // website's verb: approvedBy into cta.json
        const file = readJson<{ secondary: { approvedBy?: string }[] }>(ctaPath(f.topic, f.story, f.root))!;
        file.secondary[0].approvedBy = args[args.indexOf('--by') + 1];
        writeFileSync(ctaPath(f.topic, f.story, f.root), toJson(file));
      } else if (cli === 'video') {
        // packaging: the description now carries the paid link on its one line; the manifest is rewritten
        const p = join(review, 'description.txt');
        writeFileSync(
          p,
          `${readFileSync(p, 'utf8').trimEnd()}\nPaid link (affiliate link): The pump we sized: ${PAID_URL}\n`,
        );
        writeManifest(f.topic, f.story, f.root);
      }
      return { status: 0, stdout: '', stderr: '' };
    },
    manifestOf,
    scheduleLeadMinutes: 30,
    ...extra,
  });
  const args = (extra: Partial<DecideArgs> = {}): DecideArgs => ({
    request: req.request,
    by: 'Jon',
    verdict: 'ok',
    via: { channel: 'email', messageId: '<m1@test>' },
    root: f.root,
    now,
    ...extra,
  });
  const events = (output = 'youtube') => ledger().outputs[output].events;
  const calls = (method: string) => readFakeState(fake).calls.filter((c) => c.method === method);
  const publicUpdates = () =>
    calls('updateVideo').filter(
      (c) => (c.args[1] as { status?: { privacyStatus?: string } }).status?.privacyStatus === 'public',
    );
  return { f, fake, m, req, deps, args, events, calls, publicUpdates, ran, manifestOf, ledger };
}

describe('decideProblem', () => {
  it('refuses an unknown, expired or decided request, a moved release, an automated name, a near schedule and a paid id outside the manifest', async () => {
    const s = requested();
    const l = s.ledger();
    const p = (a: Partial<Parameters<typeof decideProblem>[3]>, req = requestOf(l, s.req.request), m = s.m, at = now) =>
      decideProblem(l, m, req, { request: s.req.request, by: 'Jon', verdict: 'ok', ...a }, at, 30);
    expect(p({}, null)).toMatch(/unknown request/);
    expect(p({}, undefined, s.m, new Date('2026-12-01T00:00:00Z'))).toMatch(/expired/);
    expect(p({}, undefined, { ...s.m, releaseSha: 'moved' })).toMatch(/release changed since the request/);
    expect(p({ by: 'automated: production pick' })).toMatch(/person/);
    expect(p({ verdict: 'schedule' })).toMatch(/--at/);
    expect(p({ verdict: 'schedule', at: new Date(now.getTime() + 10 * 60_000).toISOString() })).toMatch(/lead/);
    expect(p({ paid: ['nope'] })).toMatch(/paid link nope is not in the manifest/);
    expect(p({})).toBeNull();
    // nothing written by a refusal
    await expect(decide(s.f.topic, s.f.story, s.args({ by: 'automated: x' }), s.deps())).rejects.toThrow(Refusal);
    expect(s.events().some((e) => e.type === 'approved' || e.type === 'decided')).toBe(false);
    expect(s.calls('updateVideo')).toHaveLength(0);
  });
});

describe('decide', () => {
  it('ok: approves every output, syncs, goes live with the video only, then records decided', async () => {
    const s = requested();
    const r = await decide(s.f.topic, s.f.story, s.args(), s.deps());
    expect(r.existing).toBe(false);
    for (const id of ['youtube', 'short:one', 'short:two']) {
      const ap = s.events(id).filter((e) => e.type === 'approved');
      expect(ap).toHaveLength(1);
      expect(ap[0].via).toEqual({
        channel: 'email',
        messageId: '<m1@test>',
        request: s.req.request,
        checklist: 'asserted-by-email',
      });
    }
    expect(s.publicUpdates()).toHaveLength(1);
    expect(s.publicUpdates()[0].args[0]).toBe('vid00000000');
    expect(s.events().filter((e) => e.type === 'published')).toHaveLength(1);
    expect(s.events('short:one').some((e) => e.type === 'published' || e.type === 'scheduled')).toBe(false);
    const d = s.events().filter((e) => e.type === 'decided');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      request: s.req.request,
      verdict: 'ok',
      by: 'Jon',
      via: { channel: 'email', request: s.req.request },
    });
    expect(s.events().at(-1)!.type).toBe('decided');
    // a second identical decide prints the existing decision and calls nothing
    const again = await decide(s.f.topic, s.f.story, s.args(), s.deps());
    expect(again.existing).toBe(true);
    expect(s.publicUpdates()).toHaveLength(1);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
  });

  it('schedule: the video is scheduled, the Shorts only approved', async () => {
    const s = requested();
    const at = new Date(now.getTime() + 2 * 3600_000).toISOString();
    await decide(s.f.topic, s.f.story, s.args({ verdict: 'schedule', at }), s.deps());
    expect(s.events().filter((e) => e.type === 'scheduled')).toHaveLength(1);
    expect(s.events().find((e) => e.type === 'scheduled')!.publishAt).toBe(at);
    expect(s.publicUpdates()).toHaveLength(0);
    expect(s.calls('updateVideo')).toHaveLength(1);
    expect(s.events('short:two').filter((e) => e.type === 'approved')).toHaveLength(1);
    expect(s.events('short:two').some((e) => e.type === 'scheduled')).toBe(false);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({ verdict: 'schedule', publishAt: at });
  });

  it('changes: the notes go to the video (and a Short named by its output id), nothing goes live', async () => {
    const s = requested();
    await decide(
      s.f.topic,
      s.f.story,
      s.args({
        verdict: 'changes',
        notes: [{ text: 'the hook is slow', scene: 'sc1' }, { text: 'short:one the caption is cut' }],
      }),
      s.deps(),
    );
    expect(s.events().find((e) => e.type === 'changes-requested')!.notes).toEqual([
      { text: 'the hook is slow', scene: 'sc1' },
    ]);
    expect(s.events('short:one').find((e) => e.type === 'changes-requested')!.notes).toEqual([
      { text: 'the caption is cut' },
    ]);
    expect(s.events().some((e) => e.type === 'approved')).toBe(false);
    expect(s.calls('updateVideo')).toHaveLength(0);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({ verdict: 'changes' });
  });

  it('a decide that died after go-live and before decided is completed, not repeated (criterion 13)', async () => {
    const s = requested();
    writeFakeState(s.fake, {
      ...readFakeState(s.fake),
      fail: [{ method: 'updateVideo', status: 0, reason: 'crash', retryable: false, times: 1, kind: 'crash' }],
    });
    await expect(decide(s.f.topic, s.f.story, s.args(), s.deps())).rejects.toThrow(/crashed after updateVideo/);
    expect(s.events().some((e) => e.type === 'decided')).toBe(false);
    expect(s.events().some((e) => e.type === 'published')).toBe(false);
    const r = await decide(s.f.topic, s.f.story, s.args(), s.deps());
    expect(r.existing).toBe(false);
    expect(s.publicUpdates()).toHaveLength(1); // the sync found it public: no second update
    const published = s.events().filter((e) => e.type === 'published');
    expect(published).toHaveLength(1);
    expect(published[0].note).toMatch(/observed public on read-back/);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(s.events().filter((e) => e.type === 'approved')).toHaveLength(1);
  });

  it('paid: approves the link through the website verb, re-packages, and the release sha stands', async () => {
    const s = requested({ paid: true });
    const id = s.m.ctas.commercial[0].id;
    expect(s.m.ctas.commercial[0]).toMatchObject({ n: 1, approvedBy: null });
    expect(s.m.outputs.youtube.description).not.toContain(PAID_URL);
    await decide(s.f.topic, s.f.story, s.args({ paid: [id] }), s.deps());
    expect(s.ran).toEqual([
      ['links', 'cta', 'approve', s.f.topic, s.f.story, id, '--by', 'Jon'],
      ['video', 'package', s.f.topic, s.f.story],
    ]);
    const after = s.manifestOf()!;
    expect(after.releaseSha).toBe(s.m.releaseSha);
    expect(after.ctas.commercial[0].approvedBy).toBe('Jon');
    expect(after.outputs.youtube.description).toContain(`Paid link (affiliate link): The pump we sized: ${PAID_URL}`);
    expect(after.outputs.youtube.metadataSha).not.toBe(s.m.outputs.youtube.metadataSha);
    // the metadata moved: pushed before the sync, then live
    expect(
      s
        .calls('updateVideo')
        .map((c) =>
          (c.args[1] as { snippet?: unknown; status?: { privacyStatus?: string } }).snippet ? 'push' : 'go-live',
        ),
    ).toEqual(['push', 'go-live']);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({ paid: [id] });
    expect(s.events().some((e) => e.type === 'published')).toBe(true);
  });

  it('a decide that died after go-live is completed even once the request expired (the video is live)', async () => {
    const s = requested();
    writeFakeState(s.fake, {
      ...readFakeState(s.fake),
      fail: [{ method: 'updateVideo', status: 0, reason: 'crash', retryable: false, times: 1, kind: 'crash' }],
    });
    await expect(decide(s.f.topic, s.f.story, s.args(), s.deps())).rejects.toThrow(/crashed/);
    const later = new Date(now.getTime() + 30 * 86400_000);
    const r = await decide(s.f.topic, s.f.story, s.args({ now: later }), s.deps());
    expect(r.existing).toBe(false);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(s.events().filter((e) => e.type === 'published')).toHaveLength(1);
    // a fresh (not completing) decide on an expired request is still refused
    const t = requested();
    await expect(decide(t.f.topic, t.f.story, t.args({ now: later }), t.deps())).rejects.toThrow(/expired/);
  });

  it("the children decide runs (links, video package) get no secret from decide's environment", () => {
    const env = childEnv({
      PATH: '/bin',
      YOUTUBE_CLIENT_SECRET: 's',
      APPROVAL_SECRET: 'a',
      AZURE_SPEECH_KEY: 'k',
      MAIL_PASSWORD: 'p',
      X_SPENDING_API_SECRET: 'x',
      HOME: 'h',
    });
    expect(env).toEqual({ PATH: '/bin', HOME: 'h', VK_NO_DOTENV: '1' });
  });

  it('a release that moved since the request (a re-packaged Short) is refused and writes nothing', async () => {
    const s = requested();
    const p = join(s.f.dir, 'shorts', 'one', 'video', REVIEW_DIR, 'description.txt');
    writeFileSync(p, 'Short one, reworded\n');
    writeManifest(s.f.topic, s.f.story, s.f.root);
    await expect(decide(s.f.topic, s.f.story, s.args(), s.deps())).rejects.toThrow(/release changed since the request/);
    expect(s.events().some((e) => e.type === 'approved' || e.type === 'decided')).toBe(false);
  });
});
