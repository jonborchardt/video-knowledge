// `publish request` (spec §7.2): the approval request binds the release manifest's sha, is written once per release,
// refuses a release group that is not wholly uploaded, pushed and verified, voids the old request when the release
// moves, and is renewed at most once after it expires.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MANIFEST_FILE, REVIEW_DIR, readJson, toJson } from '../../../shared/io';
import { expired, expiryOf, requestId, secretFromEnv } from '../../../shared/request';
import { Refusal } from '../../../shared/refusal';
import type { ReleaseManifest } from '../../../shared/types';
import { runCli } from '../../../shared/cli';
import { writeManifest } from '../../packaging/manifest';
import { ARTICLE_FILES } from '../../article';
import {
  type Ledger,
  addOutputTo,
  appendEvent,
  emptyLedger,
  loadLedger,
  openRequest,
  publishPath,
  recordApproved,
  recordMessageSent,
  recordRequested,
  recordScheduled,
  recordUploaded,
  recordVerified,
  requestOf,
  saveLedger,
} from '../publish';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()));
const SECRET = 'a-test-secret-of-some-length';
const now = new Date('2026-10-30T12:00:00Z'); // before the real clock: the CLI test stamps events after these
const base = <T extends object>(f: Fixture, extra: T = {} as T) => ({ root: f.root, by: 'automation', now, ...extra });

/** A release fixture with one packaged Short registered in its ledger and the manifest written. */
function staged(shorts = ['one']) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  for (const slug of shorts) {
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
  return f;
}
const manifestOf = (f: Fixture) => readJson<ReleaseManifest>(join(f.dir, 'video', REVIEW_DIR, MANIFEST_FILE))!;
const upload = (f: Fixture, output: string, id: string) =>
  recordUploaded(f.topic, f.story, base(f, { output, id, visibility: 'private' }));
const verify = (f: Fixture, output: string) =>
  recordVerified(f.topic, f.story, base(f, { output, result: 'passed', checks: [{ name: 'title', result: 'pass' }] }));
/** Everything uploaded, pushed (the upload sent the current metadata) and verified: the group is ready to request. */
function ready(f: Fixture) {
  const m = manifestOf(f);
  Object.keys(m.outputs).forEach((id, i) => {
    upload(f, id, `vid0000000${i}`);
    verify(f, id);
  });
  return m;
}
const request = (f: Fixture, extra: Partial<Parameters<typeof recordRequested>[2]> = {}) =>
  recordRequested(
    f.topic,
    f.story,
    base(f, { manifest: manifestOf(f), secret: SECRET, expiresDays: 7, channel: 'email', ...extra }),
  );
const events = (f: Fixture, output = 'youtube') => loadLedger(f.topic, f.story, f.root)!.outputs[output].events;

describe('request ids', () => {
  it('differ by secret and by time, and are twelve hex characters with the prefix', () => {
    const a = requestId('rq', SECRET, 'sha1', now.toISOString());
    expect(a).toMatch(/^rq-[0-9a-f]{12}$/);
    expect(requestId('rq', 'another-secret-of-some-len', 'sha1', now.toISOString())).not.toBe(a);
    expect(requestId('rq', SECRET, 'sha1', '2026-11-02T00:00:00Z')).not.toBe(a);
    expect(requestId('pb', SECRET, 'sha1', now.toISOString())).toMatch(/^pb-/);
    expect(() => requestId('rq', '', 'x', 'y')).toThrow(/APPROVAL_SECRET/);
    expect(expired(expiryOf(now.toISOString(), 7), now)).toBe(false);
    expect(expired(expiryOf(now.toISOString(), 7), new Date(now.getTime() + 8 * 86400_000))).toBe(true);
    expect(secretFromEnv({})).toBeNull();
    expect(secretFromEnv({ APPROVAL_SECRET: 'short' })).toBeNull();
    expect(secretFromEnv({ APPROVAL_SECRET: SECRET })).toBe(SECRET);
  });
});

describe('requestProblem (through recordRequested)', () => {
  it('refuses a Short packaged but not uploaded, an unverified output, and writes nothing', () => {
    const f = staged();
    upload(f, 'youtube', 'vid00000000');
    verify(f, 'youtube');
    expect(() => request(f)).toThrow(/short:one.*not uploaded/);
    upload(f, 'short:one', 'vid00000001');
    expect(() => request(f)).toThrow(/short:one.*verif/);
    expect(events(f).some((e) => e.type === 'approval-requested')).toBe(false);
  });

  it('refuses a draft main build, a scheduled output, metadata changed since the upload, and a stale manifest', () => {
    const draft = staged([]);
    const l = loadLedger(draft.topic, draft.story, draft.root) ?? emptyLedger(`${draft.topic}/${draft.story}`);
    const m = manifestOf(draft);
    const withDraft: Ledger = appendEvent(l, 'youtube', {
      at: now.toISOString(),
      type: 'uploaded',
      by: 'x',
      build: m.outputs.youtube.mp4Sha,
      buildStatus: 'draft',
      metadata: 'm',
      id: 'vid00000009',
      visibility: 'private',
    }).ledger;
    saveLedger(publishPath(draft.topic, draft.story, draft.root), withDraft);
    expect(() => request(draft)).toThrow(/draft/);

    const f = staged([]);
    ready(f);
    const ledger = loadLedger(f.topic, f.story, f.root)!;
    ledger.outputs.youtube.metadata.title = 'A new title';
    saveLedger(publishPath(f.topic, f.story, f.root), ledger);
    expect(() => request(f)).toThrow(/metadata|manifest/);
    delete ledger.outputs.youtube.metadata.title;
    saveLedger(publishPath(f.topic, f.story, f.root), ledger);
    expect(request(f).existing).toBe(false);

    const s = staged([]);
    ready(s);
    recordApproved(s.topic, s.story, { ...base(s), by: 'Jon', checked: 0 });
    recordScheduled(s.topic, s.story, { ...base(s), by: 'Jon', at: '2099-01-01T00:00:00Z' });
    expect(() => request(s)).toThrow(/scheduled/);
  });

  it('refuses when the article was re-locked after the manifest', () => {
    const f = staged([]);
    ready(f);
    const ar = join(f.dir, ARTICLE_FILES.release);
    writeFileSync(ar, readFileSync(ar, 'utf8').replace(/"revision": 1/, '"revision": 2'));
    expect(() => request(f)).toThrow(/article/);
    expect(() => request(f)).toThrow(Refusal);
  });
});

describe('a fixture story is requested like any other (spec 5.8)', () => {
  it('the manifest carries fixtureRun and the same checks apply', () => {
    const f = staged([]);
    const rp = join(f.dir, 'video', REVIEW_DIR, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, fixtureRun: '20261101-0307-8ee4' }));
    writeManifest(f.topic, f.story, f.root);
    expect(manifestOf(f).fixtureRun).toBe('20261101-0307-8ee4');
    expect(() => request(f)).toThrow(/not uploaded/);
    ready(f);
    expect(request(f).event?.type).toBe('approval-requested');
  });
});

describe('recordRequested', () => {
  it('writes the request once per release and prints the existing one on a repeat', () => {
    const f = staged();
    const m = ready(f);
    const r = request(f);
    expect(r.existing).toBe(false);
    expect(r.event).toMatchObject({
      type: 'approval-requested',
      release: m.releaseSha,
      outputs: ['youtube', 'short:one'],
      channel: 'email',
      expiresAt: expiryOf(now.toISOString(), 7),
    });
    expect(r.event!.request).toBe(requestId('rq', SECRET, m.releaseSha, now.toISOString()));
    const again = request(f, { now: new Date(now.getTime() + 60_000) });
    expect(again.existing).toBe(true);
    expect(again.event!.request).toBe(r.event!.request);
    const ledger = loadLedger(f.topic, f.story, f.root)!;
    const id = r.event!.request!;
    expect(openRequest(ledger, undefined, now)?.request).toBe(r.event!.request);
    expect(openRequest(ledger, m.releaseSha, now)?.request).toBe(r.event!.request);
    expect(openRequest(ledger, 'othersha', now)).toBeNull();
    expect(requestOf(ledger, id)?.release).toBe(m.releaseSha);
    // the sent message is recorded against it
    const sent = recordMessageSent(f.topic, f.story, base(f, { request: id, messageId: '<m1@x>' }));
    expect(sent.event).toMatchObject({ type: 'message-sent', request: r.event!.request, messageId: '<m1@x>' });
    expect(recordMessageSent(f.topic, f.story, base(f, { request: id, messageId: '<m1@x>' })).existing).toBe(true);
  });

  it('a new release voids the open request and gets a new id', () => {
    const f = staged();
    ready(f);
    const first = request(f).event!;
    // the Short is re-packaged: a new build, uploaded and verified; the manifest moves
    const rp = join(f.dir, 'shorts', 'one', 'video', REVIEW_DIR, 'review.json');
    writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: 'shortonesha2' }));
    writeManifest(f.topic, f.story, f.root);
    const ledger = loadLedger(f.topic, f.story, f.root)!;
    expect(openRequest(ledger, manifestOf(f).releaseSha, now)).toBeNull(); // not for this release
    expect(openRequest(ledger, undefined, now)?.request).toBe(first.request); // still open in the ledger
    upload(f, 'short:one', 'vid00000005');
    verify(f, 'short:one');
    const second = request(f, { now: new Date(now.getTime() + 3600_000) }).event!;
    expect(second.request).not.toBe(first.request);
    const ev = events(f);
    const voided = ev.find((e) => e.type === 'decided' && e.request === first.request);
    expect(voided).toMatchObject({ verdict: 'void' });
    expect(ev.indexOf(voided!)).toBeLessThan(
      ev.indexOf(ev.find((e) => e.request === second.request && e.type === 'approval-requested')!),
    );
    expect(openRequest(loadLedger(f.topic, f.story, f.root)!, undefined, now)?.request).toBe(second.request);
  });

  it('is null after expiry; --renew writes one renewal and refuses a second', () => {
    const f = staged([]);
    ready(f);
    const first = request(f).event!;
    const later = new Date(now.getTime() + 8 * 86400_000);
    expect(openRequest(loadLedger(f.topic, f.story, f.root)!, undefined, later)).toBeNull();
    expect(() => request(f, { now: later })).toThrow(/expired.*--renew/);
    const renewed = request(f, { now: later, renew: true }).event!;
    expect(renewed.request).not.toBe(first.request);
    expect(renewed.renewed).toBe(1);
    expect(events(f).find((e) => e.type === 'decided' && e.request === first.request)).toMatchObject({
      verdict: 'expired',
    });
    expect(openRequest(loadLedger(f.topic, f.story, f.root)!, undefined, later)?.request).toBe(renewed.request);
    const evenLater = new Date(later.getTime() + 8 * 86400_000);
    expect(() => request(f, { now: evenLater, renew: true })).toThrow(/renewed once already|a person decides/);
    expect(() => request(f, { now: later, renew: true })).not.toThrow(); // the open renewal: idempotent
  });

  it('the CLI needs APPROVAL_SECRET and a channel, prints the manifest and the request, and --dry-run writes nothing', () => {
    const f = staged([]);
    ready(f);
    const env = { ...process.env, APPROVAL_SECRET: SECRET, VK_NO_DOTENV: '1' };
    const run = (args: string[], e = env) =>
      runCli('publish', ['request', f.topic, f.story, ...args], { cwd: f.root, env: e } as never);
    const noSecret = run(['--channel', 'email'], { ...env, APPROVAL_SECRET: '' });
    expect(noSecret.status).toBe(2);
    expect(noSecret.stderr).toMatch(/APPROVAL_SECRET/);
    const dry = run(['--channel', 'email', '--dry-run']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/"releaseSha"/);
    expect(events(f).some((e) => e.type === 'approval-requested')).toBe(false);
    const real = run(['--channel', 'email']);
    expect(real.status).toBe(0);
    expect(real.stdout).toMatch(/approval-requested/);
    expect(events(f).some((e) => e.type === 'approval-requested')).toBe(true);
    expect(run(['--channel', 'email']).stdout).toMatch(/already recorded/);
  }, 120_000);
});
