// Acceptance criterion 13 (spec §4.5, §13): every external effect survives its crash boundary once. Phase 2's rows: a
// private upload whose process dies after YouTube finished and before the record; a metadata push that dies after
// the remote update; an approval request that dies after the ledger event and before the email. Phase 3 appends
// go-live, schedule, git, X and the store. Every remote is the fake YouTube client over a state file.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, readJson, sha, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import type { ReleaseManifest } from '../../src/shared/types';
import { writeManifest } from '../../src/modules/packaging/manifest';
import {
  FAKE_CHANNEL,
  emptyFakeState,
  fakeYoutubeClient,
  readFakeState,
  writeFakeState,
} from '../../src/modules/publishing/fake-youtube';
import {
  loadLedger,
  openRequest,
  recordRequested,
  recordVerified,
  saveLedger,
  publishPath,
} from '../../src/modules/publishing/publish';
import { SESSION_FILE, push, upload } from '../../src/modules/publishing/uploader';
import { readOutbox } from '../../src/orchestration/run/notify';
import { sendReleaseRequest } from '../../src/orchestration/run/requests';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';
import { stagedRelease } from './publish-fake-cli';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const SECRET = 'a-test-secret-of-some-length';
const now = new Date('2026-10-30T12:00:00Z');

function staged() {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const review = join(f.dir, 'video', REVIEW_DIR);
  const bytes = Buffer.alloc(1024, 3);
  writeFileSync(join(review, 'fixture.mp4'), bytes);
  writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const rp = join(review, 'review.json');
  writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
  const fake = join(f.root, 'youtube-fake.json');
  writeFakeState(fake, emptyFakeState());
  const ctx = (extra: Record<string, unknown> = {}) => ({
    root: f.root,
    by: 'Jon',
    now,
    client: fakeYoutubeClient(fake),
    channel: FAKE_CHANNEL, // the declared destination the upload guard checks
    ...extra,
  });
  const events = () => loadLedger(f.topic, f.story, f.root)?.outputs.youtube.events ?? [];
  const calls = (m: string) => readFakeState(fake).calls.filter((c) => c.method === m);
  return { f, fake, ctx, events, calls, sessionPath: join(f.dir, SESSION_FILE('youtube')) };
}

describe('criterion 13: the crash boundaries this phase owns', () => {
  it('an upload that dies after YouTube finished and before the record: the resumed upload records one video and clears the session', async () => {
    const s = staged();
    writeFakeState(s.fake, {
      ...emptyFakeState(),
      fail: [{ method: 'insertVideo', kind: 'crash', status: 0, reason: 'crash', retryable: false, times: 1 }],
    });
    await expect(upload(s.f.topic, s.f.story, s.ctx())).rejects.toThrow(/crashed after insertVideo/);
    expect(existsSync(s.sessionPath)).toBe(true); // the session URI survives the crash
    expect(s.events().filter((e) => e.type === 'uploaded')).toEqual([]);
    expect(Object.keys(readFakeState(s.fake).videos)).toHaveLength(1); // the remote has the video
    const r = await upload(s.f.topic, s.f.story, s.ctx());
    expect(r[0].event?.type).toBe('uploaded');
    expect(s.events().filter((e) => e.type === 'uploaded')).toHaveLength(1);
    expect(Object.keys(readFakeState(s.fake).videos)).toHaveLength(1); // the session answered: no second video
    expect(s.calls('insertVideo')).toHaveLength(2);
    expect(existsSync(s.sessionPath)).toBe(false);
    expect((await upload(s.f.topic, s.f.story, s.ctx()).catch((e: Error) => e.message)) as string).toMatch(
      /is uploaded/,
    );
  });

  it('a push that dies after the remote update: the re-run sends the same metadata once more and records once', async () => {
    const s = staged();
    await upload(s.f.topic, s.f.story, s.ctx());
    const ledger = loadLedger(s.f.topic, s.f.story, s.f.root)!;
    ledger.outputs.youtube.metadata.title = 'A better title';
    saveLedger(publishPath(s.f.topic, s.f.story, s.f.root), ledger);
    writeFakeState(s.fake, {
      ...readFakeState(s.fake),
      fail: [{ method: 'updateVideo', kind: 'crash', status: 0, reason: 'crash', retryable: false, times: 1 }],
    });
    await expect(push(s.f.topic, s.f.story, s.ctx())).rejects.toThrow(/crashed after updateVideo/);
    expect(readFakeState(s.fake).videos[Object.keys(readFakeState(s.fake).videos)[0]].snippet.title).toBe(
      'A better title',
    ); // landed
    expect(s.events().filter((e) => e.type === 'updated')).toEqual([]);
    const r = await push(s.f.topic, s.f.story, s.ctx());
    expect(r.event?.type).toBe('updated');
    expect(s.calls('updateVideo')).toHaveLength(2); // the same metadata, sent again: idempotent on the remote
    expect(s.events().filter((e) => e.type === 'updated')).toHaveLength(1);
    expect((await push(s.f.topic, s.f.story, s.ctx())).existing).toBe(true);
  });

  it('a request that dies after the ledger event and before the email: the next job sends the same request id once', async () => {
    const s = staged();
    await upload(s.f.topic, s.f.story, s.ctx());
    recordVerified(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'Jon',
      now,
      result: 'passed',
      checks: [{ name: 'title', result: 'pass' }],
    });
    mkdirSync(join(s.f.dir, 'video', REVIEW_DIR), { recursive: true });
    writeManifest(s.f.topic, s.f.story, s.f.root);
    const manifest = readJson<ReleaseManifest>(join(s.f.dir, 'video', REVIEW_DIR, MANIFEST_FILE))!;
    const first = recordRequested(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'automation',
      now,
      manifest,
      secret: SECRET,
      expiresDays: 7,
      channel: 'email',
    });
    // the crash: nothing sent; the next job finds the request open and sends it
    const a = {
      ...DEFAULTS,
      approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test' },
    };
    const mail = new FakeMailer(s.f.root);
    const again = recordRequested(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'automation',
      now,
      manifest,
      secret: SECRET,
      expiresDays: 7,
      channel: 'email',
    });
    expect(again.existing).toBe(true);
    expect(again.event!.request).toBe(first.event!.request);
    const id = await sendReleaseRequest(s.f.topic, s.f.story, manifest, a, mail, {
      root: s.f.root,
      now: () => now.getTime(),
      env: { ...process.env, VK_NO_DOTENV: '1' },
    });
    expect(id).toBeTruthy();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toContain(first.event!.request!);
    expect(readOutbox(s.f.root).filter((e) => e.meta?.request === first.event!.request)).toHaveLength(1);
    // a second job after the send: nothing new
    expect(
      await sendReleaseRequest(s.f.topic, s.f.story, manifest, a, mail, { root: s.f.root, now: () => now.getTime() }),
    ).toBeNull();
    expect(openRequest(loadLedger(s.f.topic, s.f.story, s.f.root)!, manifest.releaseSha, now)?.messageId).toBe(id);
  }, 120_000);
});

// Phase 3's rows of spec 4.5's table (criterion 13): go-live and the schedule (a decide that dies after YouTube's
// update and before `decided` is completed, never repeated); the commit and the push (launch.test.ts: killed after
// the commit, the resumed job pushes that commit once); the X post (social/tests/compose.test.ts: a POST that dies
// before the record is found on the account); the request (above). The store's rows belong to the topic runs of
// phase 4.
describe('criterion 13: the crash boundaries of phase 3', () => {
  const T1 = new Date('2026-10-30T12:00:00Z');
  const decideArgs = (s: ReturnType<typeof stagedRelease>, verdict: string, at?: string) => [
    'decide',
    s.f.topic,
    s.f.story,
    '--request',
    s.request,
    '--by',
    'Jon',
    '--verdict',
    verdict,
    ...(at ? ['--at', at] : []),
    '--via',
    'email:<m@x>',
  ];
  const crashOnce = (s: ReturnType<typeof stagedRelease>) =>
    writeFakeState(s.fake, {
      ...readFakeState(s.fake),
      fail: [{ method: 'updateVideo', status: 0, reason: 'crash', retryable: false, times: 1, kind: 'crash' }],
    });
  it('a go-live that dies after the update: the next decide finds the video public, records it observed, and decides once', async () => {
    const s = stagedRelease(T1);
    crashOnce(s);
    const args = decideArgs(s, 'ok');
    const first = await s.run('publish', args);
    expect(first.status).toBe(1);
    expect(first.stderr).toMatch(/crashed after updateVideo/);
    expect(s.events().some((e) => e.type === 'decided')).toBe(false);
    const second = await s.run('publish', args);
    expect(second.status).toBe(0);
    expect(s.publicUpdates()).toHaveLength(1);
    expect(s.events().filter((e) => e.type === 'published')).toHaveLength(1);
    expect(s.events().find((e) => e.type === 'published')?.note).toMatch(/observed public/);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    const third = await s.run('publish', args);
    expect(third.status).toBe(0);
    expect(third.stdout).toMatch(/already recorded/);
    expect(s.publicUpdates()).toHaveLength(1);
    s.f.cleanup();
  });
  it('a schedule that dies after the update: the next decide sets the same time once more and records one schedule', async () => {
    const s = stagedRelease(T1);
    crashOnce(s);
    const at = new Date(T1.getTime() + 2 * 3600_000).toISOString();
    const args = decideArgs(s, 'schedule', at);
    expect((await s.run('publish', args)).status).toBe(1);
    expect(s.events().some((e) => e.type === 'scheduled' || e.type === 'decided')).toBe(false);
    expect((await s.run('publish', args)).status).toBe(0);
    expect(s.events().filter((e) => e.type === 'scheduled')).toHaveLength(1);
    expect(s.events().find((e) => e.type === 'scheduled')?.publishAt).toBe(at);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    const sent = s
      .calls('updateVideo')
      .map((c) => (c.args[1] as { status?: { publishAt?: string } }).status?.publishAt);
    expect(sent).toEqual([at, at]); // the same instruction twice is one schedule on YouTube
    expect(s.publicUpdates()).toHaveLength(0);
    s.f.cleanup();
  });
});
