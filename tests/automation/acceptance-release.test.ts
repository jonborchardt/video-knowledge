// Milestone 2 acceptance criteria (spec §13) of phase 3, end to end over every fake: 4 (a reply is applied once and
// the right way), 5 (a schedule is honoured and read back), 6 (the Shorts follow their video in order), 7 (the site
// update is one resumable launch, committed and pushed once), 8 (the deploy is confirmed before anything is posted),
// 9 (the X post is per institution and never duplicated), 18 (every effect has its hand verb). The clock is the
// test's; YouTube, X, mail and git are the fakes and a bare origin.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { readJson, toJson } from '../../src/shared/io';
import type { InMail } from '../../src/modules/mail';
import { FakeMailer } from './fake-mailer';
import { matterPathOf } from '../../src/modules/website/live';
import { readFakeState, writeFakeState } from '../../src/modules/publishing/fake-youtube';
import { openOutput } from '../../src/modules/publishing/publish';
import { loadSocial } from '../../src/modules/social/social';
import type { XClient } from '../../src/modules/social/x';
import { readInbox } from '../../src/orchestration/run/inbox';
import { launch, launchJobs, launchProblem, readLaunch } from '../../src/orchestration/run/launch';
import { tick } from '../../src/orchestration/run/tick';
import { work } from '../../src/orchestration/run/work';
import { type Stage, X_TEST_ENV, gitOrigin, stagedRelease, sentRequest } from './publish-fake-cli';

const stages: Stage[] = [];
afterAll(() => stages.forEach((s) => s.f.cleanup()), 120_000);
const T0 = new Date('2026-10-30T12:00:00Z'); // Friday 05:00 in Los Angeles
const policy = (x = false) => ({
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true, work: true, social: x },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
  launch: { ...DEFAULTS.launch, push: true, deployTimeoutMinutes: 40 },
});
const okPre = {
  git: (args: string[]) => (args[0] === 'status' ? '' : 'main\n'),
  claude: () => true,
  env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
  freeGb: () => 100,
  launches: () => [],
  channels: () => [],
};
let uid = 0;
const reply = (inReplyTo: string, subject: string, text: string): InMail => ({
  uid: ++uid,
  messageId: `<r${uid}@jon.test>`,
  inReplyTo,
  references: [inReplyTo],
  from: 'Jon <jon@example.test>',
  subject: `Re: ${subject}`,
  text: `${text}\n\n> the request`,
  html: null,
  date: T0.toISOString(),
});
function fakeX() {
  const posted: string[] = [];
  const client: XClient = {
    async post(text) {
      posted.push(text);
      return { id: `t${posted.length}`, url: `https://x.com/i/status/t${posted.length}` };
    },
    async recent() {
      return posted.map((text, i) => ({ id: `t${i + 1}`, text }));
    },
  };
  return { client, posted };
}

/** The whole scenario with the given X (an account, or none) and an optional one-time Short failure. */
async function scenario(opts: { x: boolean; shortFails?: boolean }) {
  const x = opts.x ? fakeX() : null;
  const s = stagedRelease(T0, { shorts: ['one', 'two'], x: x && { client: x.client, handle: '@CORSpendingTest' } });
  stages.push(s);
  const origin = gitOrigin(s.f.root);
  const a = policy(opts.x);
  const mail = new FakeMailer(s.f.root);
  let now = T0.getTime();
  const clock = () => now;
  const advance = (ms: number) => {
    now += ms;
    s.clock.now = new Date(now);
  };
  const sent = await sentRequest(s, mail, clock);
  const subject = mail.sent[0].subject;
  const path = matterPathOf(s.f.topic, s.f.story, s.f.root)!;
  const page = { live: false };
  const fetchFn = (async (u: string | URL | Request) =>
    String(u) === `https://commonwealthofreason.com${path}` && page.live
      ? new Response(`<iframe src="https://www.youtube-nocookie.com/embed/vid00000000"></iframe>`, { status: 200 })
      : new Response('soon', { status: page.live ? 404 : 200 })) as unknown as typeof fetch;
  const ticks: string[][] = [];
  const oneTick = async () => {
    const r = await tick(a, s.f.root, {
      mail,
      now: clock,
      preflight: okPre,
      run: s.run,
      fetchFn,
      env: opts.x ? X_TEST_ENV : {}, // the institution's X keys, as .env would hold them (none: not configured)
    });
    ticks.push(r.actions);
    return r;
  };
  const launchRan: string[] = [];
  const launchDeps = {
    now: clock,
    git: (args: string[]) => origin.git(...args),
    run: (cli: string, args: string[]) => {
      launchRan.push([cli, ...args].join(' '));
      if (cli === 'links' && args[0] === 'freeze')
        writeFileSync(join(s.f.root, 'public-urls.json'), toJson([path, '/']));
      return { status: 0, stdout: '', stderr: '' };
    },
    validate: () => ({ ok: true, output: '' }),
  };
  const oneWork = () =>
    work(a, s.f.root, {
      now: clock,
      runLaunch: (t, sid, auto) => launch(t, sid, auto, launchDeps, s.f.root),
      runStory: async () => ({ outcome: 'done', stage: 'packaged', halt: null, iterations: 0, costUsd: 0 }),
    });
  const state = (output: string) => openOutput(s.f.topic, s.f.story, { root: s.f.root, output }).state;
  // the mails that are this scenario's: the weekly digest the first tick owes is not
  const mails = () => mail.sent.filter((m) => !/digest/i.test(m.subject));
  return {
    s,
    x,
    a,
    mail,
    mails,
    sent,
    subject,
    advance,
    clock,
    oneTick,
    oneWork,
    ticks,
    launchRan,
    origin,
    page,
    state,
    path,
  };
}

describe('phase 3 acceptance: OK at <time>, the Shorts, the launch, the probe, the post, the mail', () => {
  it('runs the whole release from the reply to the launch mail with every effect counted once', async () => {
    const c = await scenario({ x: true });
    const { s, mail } = c;
    const before = c.origin.originHead();
    // the reply: a schedule for 15:00 Pacific today (22:00Z)
    mail.deliver(reply(c.sent, c.subject, 'OK at 15:00\nPAID OK'));
    const t1 = await c.oneTick();
    expect(t1.outcome).toBe('ok');
    expect(t1.actions.join('\n')).toMatch(/inbox: 1 fetched, 1 applied/);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({
      verdict: 'schedule',
      publishAt: '2026-10-30T22:00:00.000Z',
    });
    expect(c.state('youtube').status).toBe('scheduled');
    expect(s.publicUpdates()).toHaveLength(0);
    expect(readInbox(s.f.root).handled.map((h) => h.outcome)).toEqual(['applied:schedule']);
    // before the time nothing moves; after it YouTube publishes and the tick reads it back
    c.advance(3600_000);
    const t2 = await c.oneTick();
    expect(t2.actions.join('\n')).not.toMatch(/sync|go-live/);
    c.advance(10 * 3600_000);
    const fs = readFakeState(s.fake);
    fs.videos.vid00000000.privacyStatus = 'public';
    writeFakeState(s.fake, fs);
    const t3 = await c.oneTick();
    expect(t3.actions.join('\n')).toMatch(/sync \(0\)/);
    expect(c.state('youtube').live).toBe(true);
    expect(s.events().filter((e) => e.type === 'verified')).toHaveLength(2);
    expect(launchJobs(c.a, s.f.root)).toEqual([]); // the Shorts are not live yet: no launch
    // the Shorts follow, one per tick, in order, with the tick's via
    const t4 = await c.oneTick();
    expect(t4.actions.join('\n')).toMatch(/shorts\/one: go-live \(0\)/);
    expect(c.state('short:one').live).toBe(true);
    expect(c.state('short:two').live).toBe(false);
    const t5 = await c.oneTick();
    expect(t5.actions.join('\n')).toMatch(/shorts\/two: go-live \(0\)/);
    expect(c.state('short:two').live).toBe(true);
    expect(s.events('short:two').find((e) => e.type === 'published')?.via).toEqual({
      channel: 'tick',
      request: s.request,
    });
    expect(s.publicUpdates('vid00000000')).toHaveLength(0); // the schedule published it; never updated again
    expect(s.publicUpdates()).toHaveLength(2);
    // the launch: the work plane's first job, one commit on main, one push to the origin
    expect(launchProblem(s.f.topic, s.f.story, s.f.root)).toBeNull();
    expect(launchJobs(c.a, s.f.root)).toEqual([
      { kind: 'launch', topic: s.f.topic, storyId: s.f.story, why: 'launch: the release group is live' },
    ]);
    const w = await c.oneWork();
    expect(w.job?.kind).toBe('launch');
    expect(w.outcome).toBe('done');
    expect(c.launchRan).toEqual([`report seed ${s.f.topic}`, 'brand', 'build', 'links freeze']);
    const rec = readLaunch(s.f.topic, s.f.story, s.f.root)!;
    expect(rec.pushed).toBe(rec.committed);
    expect(c.origin.originHead()).toBe(rec.committed);
    expect(c.origin.originHead()).not.toBe(before);
    expect(launchJobs(c.a, s.f.root)).toEqual([]); // launched: no launch job is left for the work plane
    // the probe: a stale page posts and mails nothing; the live page posts once and mails once
    const t6 = await c.oneTick();
    expect(t6.actions.join('\n')).toMatch(/not live yet \(probe 1\)/);
    expect(c.x!.posted).toEqual([]);
    expect(c.mails()).toHaveLength(1);
    c.page.live = true;
    const t7 = await c.oneTick();
    expect(t7.actions.join('\n')).toMatch(/live at/);
    expect(t7.actions.join('\n')).toMatch(/post true/);
    expect(c.x!.posted).toHaveLength(1);
    expect(c.x!.posted[0]).toContain('vid00000000'); // the watch URL the ledger recorded
    expect(loadSocial(s.f.topic, s.f.story, s.f.root)!.outputs.youtube.posts[0]).toMatchObject({
      status: 'posted',
      id: 't1',
    });
    expect(c.mails()).toHaveLength(2);
    expect(c.mails()[1].subject).toMatch(/live/);
    expect(c.mails()[1].text).toContain('https://x.com/i/status/t1');
    expect(c.mails()[1].text).toMatch(/relatedVideo/);
    expect(c.mails()[1].text).toMatch(/endScreen/);
    expect(c.mails()[1].text).toMatch(/cards/);
    // later ticks change nothing
    const t8 = await c.oneTick();
    expect(t8.actions.filter((x) => /post|live at|go-live|sync/.test(x))).toEqual([]);
    expect(c.x!.posted).toHaveLength(1);
    expect(c.mails()).toHaveLength(2);
    expect(s.publicUpdates()).toHaveLength(2);
    expect(readJson<{ posts: unknown[] }>(join(s.f.root, 'x-fake.json'))).toBeNull(); // the fake X is in process
  }, 300_000);

  it('a Short failing once is retried next tick and the video is never touched; an institution without X posts nothing and the mail says so', async () => {
    const c = await scenario({ x: false });
    const { s, mail } = c;
    // the one tick applies OK, goes live with the video and reaches the first Short: its go-live meets a 503
    // (the video's update, then the Short's push, pass)
    const fs = readFakeState(s.fake);
    fs.fail.push({ method: 'updateVideo', status: 503, reason: 'backendError', retryable: true, times: 1, after: 2 });
    writeFakeState(s.fake, fs);
    mail.deliver(reply(c.sent, c.subject, 'OK'));
    const t1 = await c.oneTick();
    expect(c.state('youtube').live).toBe(true);
    expect(s.publicUpdates('vid00000000')).toHaveLength(1);
    expect(t1.actions.join('\n')).toMatch(/shorts\/one: go-live \(1\)/);
    expect(c.state('short:one').failed?.retryable).toBe(true);
    expect(c.state('short:one').live).toBe(false);
    c.advance(60_000);
    const t2 = await c.oneTick();
    expect(t2.actions.join('\n')).toMatch(/shorts\/one: go-live retry \(0\)/);
    expect(c.state('short:one').live).toBe(true);
    expect(c.state('short:two').live).toBe(false);
    c.advance(60_000);
    await c.oneTick();
    expect(c.state('short:two').live).toBe(true);
    expect(s.publicUpdates('vid00000000')).toHaveLength(1);
    expect(launchProblem(s.f.topic, s.f.story, s.f.root)).toBeNull();
    expect((await c.oneWork()).outcome).toBe('done');
    c.page.live = true;
    const t5 = await c.oneTick();
    expect(t5.actions.join('\n')).toMatch(/live at/);
    expect(readLaunch(s.f.topic, s.f.story, s.f.root)!.posted).toBe('not-configured');
    expect(s.ran.some((r) => r[0] === 'social')).toBe(false); // social is off: never called
    expect(c.mails()).toHaveLength(2);
    expect(c.mails()[1].text).toMatch(/X: not configured/);
  }, 300_000);

  it('CHANGES: records the send-back with its placed notes and nothing goes live; an ambiguous reply gets one clarification and nothing is applied', async () => {
    const c = await scenario({ x: false });
    const { s, mail } = c;
    mail.deliver(reply(c.sent, c.subject, 'looks fine, go'));
    const t1 = await c.oneTick();
    expect(t1.actions.join('\n')).toMatch(/1 clarified/);
    expect(c.mails()).toHaveLength(2);
    expect(c.mails()[1].text).toMatch(/\bOK\b/);
    expect(s.events().some((e) => e.type === 'decided' || e.type === 'approved')).toBe(false);
    mail.deliver(
      reply(
        c.mails()[1].messageId,
        c.subject,
        'CHANGES:\n[0:12 sc2 s3] the figure on screen is wrong\nthe pacing drags in the setup',
      ),
    );
    const t2 = await c.oneTick();
    expect(t2.actions.join('\n')).toMatch(/1 applied/);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({ verdict: 'changes' });
    expect(s.events().find((e) => e.type === 'changes-requested')?.notes).toEqual([
      { text: 'the figure on screen is wrong', seconds: 12, scene: 'sc2', sentence: 's3' },
      { text: 'the pacing drags in the setup' },
    ]);
    expect(c.state('youtube').status).toBe('changes-requested');
    expect(s.publicUpdates()).toHaveLength(0);
    expect(launchJobs(c.a, s.f.root)).toEqual([]);
    expect(c.mails()).toHaveLength(2);
  }, 300_000);
});
