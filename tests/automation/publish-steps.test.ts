// The tick's due-publication step (spec §4.4 step 4): a schedule past its time is synced and verified; the Shorts
// of a published video go live in order, one per tick, a retryable failure retried next tick and the video never
// touched; a live Short's description is pushed; and the whole tick stays short.
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { FakeMailer } from './fake-mailer';
import { readFakeState, writeFakeState } from '../../src/modules/publishing/fake-youtube';
import { openOutput } from '../../src/modules/publishing/publish';
import { readJson } from '../../src/shared/io';
import { runDir } from '../../src/orchestration/run/journal';
import { join } from 'node:path';
import { publishDue } from '../../src/orchestration/run/publish-due';
import { tick } from '../../src/orchestration/run/tick';
import { loadLedger } from '../../src/modules/publishing/publish';
import { type Stage, stagedRelease } from './publish-fake-cli';

const stages: Stage[] = [];
afterAll(() => stages.forEach((s) => s.f.cleanup()), 120_000);
const T0 = new Date('2026-10-30T12:00:00Z');
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const decided = async (s: Stage, verdict: 'ok' | 'schedule', at?: string) =>
  s.run('publish', [
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
    'email:<m1@test>',
  ]);
const state = (s: Stage, output: string) => openOutput(s.f.topic, s.f.story, { root: s.f.root, output }).state;

describe('publishDue', () => {
  it('a schedule past its time is synced (published, observed) and verified; the Shorts then go live in order, one per tick', async () => {
    const s = stagedRelease(T0, { shorts: ['one', 'two'] });
    stages.push(s);
    const at = new Date(T0.getTime() + 2 * 3600_000).toISOString();
    expect((await decided(s, 'schedule', at)).status).toBe(0);
    expect(state(s, 'youtube').status).toBe('scheduled');
    const before = new Date(T0.getTime() + 3600_000);
    const a1 = await publishDue(a, s.f.root, { now: () => before.getTime(), run: s.run, mail: null });
    expect(a1).toEqual([]);
    // YouTube publishes at the time
    const fs = readFakeState(s.fake);
    fs.videos.vid00000000.privacyStatus = 'public';
    writeFakeState(s.fake, fs);
    const after = new Date(T0.getTime() + 2 * 3600_000 + 60_000);
    s.clock.now = after;
    const a2 = await publishDue(a, s.f.root, { now: () => after.getTime(), run: s.run, mail: null });
    expect(a2.join('\n')).toMatch(/sync/);
    expect(state(s, 'youtube').live).toBe(true);
    expect(s.events().find((e) => e.type === 'published')?.note).toMatch(/observed/);
    expect(s.events().filter((e) => e.type === 'verified')).toHaveLength(2);
    expect(s.publicUpdates()).toHaveLength(0); // the schedule did it, not an update
    // next tick: the first Short goes live with the tick's via; the second waits its turn
    const a3 = await publishDue(a, s.f.root, { now: () => after.getTime() + 60_000, run: s.run, mail: null });
    expect(a3.join('\n')).toMatch(/shorts\/one: push/); // its description gains the parent's link first
    expect(a3.join('\n')).toMatch(/shorts\/one: go-live/);
    expect(state(s, 'short:one').live).toBe(true);
    expect(s.events('short:one').find((e) => e.type === 'published')?.via).toEqual({
      channel: 'tick',
      request: s.request,
    });
    expect(s.events('short:one').find((e) => e.type === 'published')?.by).toBe('Jon'); // the decision's person
    expect(state(s, 'short:two').live).toBe(false);
    expect(s.publicUpdates('vid00000001')).toHaveLength(1);
    const a4 = await publishDue(a, s.f.root, { now: () => after.getTime() + 120_000, run: s.run, mail: null });
    expect(a4.join('\n')).toMatch(/shorts\/two: go-live/);
    expect(state(s, 'short:two').live).toBe(true);
    const a5 = await publishDue(a, s.f.root, { now: () => after.getTime() + 180_000, run: s.run, mail: null });
    expect(a5).toEqual([]); // nothing left: both Shorts live and pushed
    expect(s.publicUpdates('vid00000000')).toHaveLength(0); // the video was never touched again
  });

  it('a video that decide published is read back once by the next tick (the launch needs it verified since)', async () => {
    const s = stagedRelease(T0, { shorts: [] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    expect(state(s, 'youtube').live).toBe(true);
    const before = s.events().filter((e) => e.type === 'verified').length;
    const a1 = await publishDue(a, s.f.root, { now: () => T0.getTime() + 60_000, run: s.run, mail: null });
    expect(a1.join('\n')).toMatch(/verify \(0\)/);
    expect(s.events().filter((e) => e.type === 'verified')).toHaveLength(before + 1);
    expect(s.events().at(-1)).toMatchObject({ type: 'verified', result: 'passed' });
    const a2 = await publishDue(a, s.f.root, { now: () => T0.getTime() + 120_000, run: s.run, mail: null });
    expect(a2).toEqual([]); // once
  });

  it('a read-back names the tick; the go-live of a Short still names the person who decided', async () => {
    const s = stagedRelease(T0, { shorts: ['one'] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    await publishDue(a, s.f.root, { now: () => T0.getTime() + 60_000, run: s.run, mail: null });
    await publishDue(a, s.f.root, { now: () => T0.getTime() + 120_000, run: s.run, mail: null });
    const ledger = loadLedger(s.f.topic, s.f.story, s.f.root)!;
    const reads = (o: string) => {
      const ev = ledger.outputs[o].events;
      return ev.slice(ev.findLastIndex((e) => e.type === 'published')).filter((e) => e.type === 'verified');
    };
    expect(reads('youtube').map((e) => e.by)).toEqual(['automated: tick']);
    expect(reads('short:one').map((e) => e.by)).toEqual(['automated: tick']);
    const humans = (o: string, type: string) =>
      ledger.outputs[o].events.filter((e) => e.type === type).map((e) => e.by);
    expect(humans('youtube', 'approved')).toEqual(['Jon']);
    expect(humans('youtube', 'decided')).toEqual(['Jon']);
    expect(humans('youtube', 'published')).toEqual(['Jon']);
    expect(humans('short:one', 'published')).toEqual(['Jon']);
  });

  it('a verify that keeps failing after the publish is retried twice, then the story halts step-failed naming verify', async () => {
    const s = stagedRelease(T0, { shorts: [] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    const fs = readFakeState(s.fake);
    fs.videos.vid00000000.thumbnail = false; // YouTube lost the thumbnail: verify fails on it
    writeFakeState(s.fake, fs);
    const halt = () =>
      readJson<{ kind: string; why: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    for (let i = 1; i <= 3; i++) {
      const acts = await publishDue(a, s.f.root, { now: () => T0.getTime() + i * 60_000, run: s.run, mail: null });
      expect(acts.join('\n')).toMatch(/verify \(1\)/);
    }
    // the ledger keeps one copy of an identical failing read; the reads are counted beside the journal
    expect(s.events().filter((e) => e.type === 'verified' && e.result === 'failed')).toHaveLength(1);
    expect(
      readJson<Record<string, { tries: number }>>(join(runDir(s.f.topic, s.f.story, s.f.root), 'retries.json'))?.[
        'verify|youtube'
      ]?.tries,
    ).toBe(3);
    const fourth = await publishDue(a, s.f.root, { now: () => T0.getTime() + 4 * 60_000, run: s.run, mail: null });
    expect(fourth.join('\n')).not.toMatch(/verify \(/); // the reads are spent: the halt, no fourth read
    expect(halt()).toMatchObject({ kind: 'step-failed' });
    expect(halt()?.why).toMatch(/verif.*fail/);
    const again = await publishDue(a, s.f.root, { now: () => T0.getTime() + 4 * 60_000, run: s.run, mail: null });
    expect(again.join('\n')).not.toMatch(/verify/); // halted: a person's
  });

  it("a Short's final go-live failure halts the story step-failed, once; the video is untouched", async () => {
    const s = stagedRelease(T0, { shorts: ['one'] });
    stages.push(s);
    const fs = readFakeState(s.fake);
    fs.fail.push({ method: 'updateVideo', status: 403, reason: 'forbidden', retryable: false, times: 1, after: 2 });
    writeFakeState(s.fake, fs);
    expect((await decided(s, 'ok')).status).toBe(0);
    const acts = await publishDue(a, s.f.root, { now: () => T0.getTime() + 60_000, run: s.run, mail: null });
    expect(acts.join('\n')).toMatch(/shorts\/one: go-live \(1\)/);
    expect(state(s, 'short:one').failed?.retryable).toBe(false);
    const halt = readJson<{ kind: string; why: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    expect(halt).toMatchObject({ kind: 'step-failed' });
    expect(halt?.why).toMatch(/short:one.*go-live/);
    const again = await publishDue(a, s.f.root, { now: () => T0.getTime() + 120_000, run: s.run, mail: null });
    expect(again.join('\n')).not.toMatch(/go-live/);
    expect(s.publicUpdates('vid00000000')).toHaveLength(1);
  });

  it('the Shorts of a video made live by hand (no decided request) wait for a person; a decided request names the actor', async () => {
    const s = stagedRelease(T0, { shorts: ['one'] });
    stages.push(s);
    // the person published the video in Studio and recorded it: approved and published by hand, no decision
    const { recordApproved, recordPublished } = await import('../../src/modules/publishing/publish');
    const list = readJson<{ checklist?: string[] }>(join(s.f.dir, 'video', 'review', 'review.json'))?.checklist ?? [];
    recordApproved(s.f.topic, s.f.story, { root: s.f.root, by: 'Jon', now: T0, checked: list.length });
    recordPublished(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'Jon',
      now: new Date(T0.getTime() + 1000),
      url: 'https://youtu.be/vid00000000',
    });
    recordApproved(s.f.topic, s.f.story, {
      root: s.f.root,
      by: 'Jon',
      now: new Date(T0.getTime() + 2000),
      output: 'short:one',
      checked: 0,
    });
    s.clock.now = new Date(T0.getTime() + 60_000);
    const acts = await publishDue(a, s.f.root, { now: () => T0.getTime() + 60_000, run: s.run, mail: null });
    expect(acts.join('\n')).toMatch(/short:one waits: no decided request/);
    expect(state(s, 'short:one').live).toBe(false);
    expect(s.publicUpdates('vid00000001')).toHaveLength(0);
  });

  it("a Short's go-live 5xx is a retryable failure: the next tick retries that Short only", async () => {
    const s = stagedRelease(T0, { shorts: ['one', 'two'] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    expect(state(s, 'youtube').live).toBe(true);
    const fs = readFakeState(s.fake);
    // the Short's push (its parent link) passes; its go-live meets the 5xx
    fs.fail.push({ method: 'updateVideo', status: 503, reason: 'backendError', retryable: true, times: 1, after: 1 });
    writeFakeState(s.fake, fs);
    const t1 = T0.getTime() + 60_000;
    const a1 = await publishDue(a, s.f.root, { now: () => t1, run: s.run, mail: null });
    expect(a1.join('\n')).toMatch(/shorts\/one: go-live \(1\)/); // the verb records the failure, then exits 1
    expect(state(s, 'short:one').failed?.retryable).toBe(true);
    expect(state(s, 'short:one').live).toBe(false);
    expect(state(s, 'short:two').live).toBe(false);
    const a2 = await publishDue(a, s.f.root, { now: () => t1 + 60_000, run: s.run, mail: null });
    expect(a2.join('\n')).toMatch(/shorts\/one: go-live/);
    expect(state(s, 'short:one').live).toBe(true);
    expect(state(s, 'short:two').live).toBe(false);
    expect(s.publicUpdates('vid00000000')).toHaveLength(1);
    expect(s.publicUpdates('vid00000001')).toHaveLength(2);
  });

  it("a Short's go-live failing retryably every tick is tried three times, then the story halts step-failed once", async () => {
    const s = stagedRelease(T0, { shorts: ['one'] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    const fs = readFakeState(s.fake);
    fs.fail.push({ method: 'updateVideo', status: 503, reason: 'backendError', retryable: true, times: 9, after: 1 });
    writeFakeState(s.fake, fs);
    const halt = () =>
      readJson<{ kind: string; why: string; at: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    for (let i = 1; i <= 3; i++) {
      const acts = await publishDue(a, s.f.root, { now: () => T0.getTime() + i * 60_000, run: s.run, mail: null });
      expect(acts.join('\n'), `tick ${i}`).toMatch(/shorts\/one: go-live( retry)? \(1\)/);
    }
    expect(s.publicUpdates('vid00000001')).toHaveLength(3);
    expect(halt()).toMatchObject({ kind: 'step-failed' });
    expect(halt()?.why).toMatch(/short:one: go-live keeps failing after 3 tries/);
    const at = halt()!.at;
    const fourth = await publishDue(a, s.f.root, { now: () => T0.getTime() + 4 * 60_000, run: s.run, mail: null });
    expect(fourth.join('\n')).not.toMatch(/go-live/); // spent: no fourth try, the same halt
    expect(s.publicUpdates('vid00000001')).toHaveLength(3);
    expect(halt()!.at).toBe(at);
  });

  it('a sync that keeps failing after the scheduled time is tried three times, then the story halts step-failed', async () => {
    const s = stagedRelease(T0, { shorts: [] });
    stages.push(s);
    const at = new Date(T0.getTime() + 3600_000).toISOString();
    expect((await decided(s, 'schedule', at)).status).toBe(0);
    const fs = readFakeState(s.fake);
    fs.fail.push({ method: 'getVideo', status: 500, reason: 'backendError', retryable: true, times: 9 });
    writeFakeState(s.fake, fs);
    const late = T0.getTime() + 3600_000 + 60_000;
    s.clock.now = new Date(late);
    for (let i = 1; i <= 3; i++) {
      const acts = await publishDue(a, s.f.root, { now: () => late + i * 60_000, run: s.run, mail: null });
      expect(acts.join('\n'), `tick ${i}`).toMatch(/sync \(1\)/);
    }
    const halt = readJson<{ kind: string; why: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    expect(halt).toMatchObject({ kind: 'step-failed' });
    expect(halt?.why).toMatch(/sync after its scheduled time .* keeps failing/);
    const fourth = await publishDue(a, s.f.root, { now: () => late + 4 * 60_000, run: s.run, mail: null });
    expect(fourth).toEqual([]);
    expect(state(s, 'youtube').status).toBe('scheduled'); // the ledger is untouched: YouTube's state is unknown
  });

  it("a live Short's verification that keeps failing is read three times, then the story halts naming the Short", async () => {
    const s = stagedRelease(T0, { shorts: ['one'] });
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    const fs = readFakeState(s.fake);
    fs.videos.vid00000001.uploadStatus = 'failed'; // YouTube failed the Short's upload: its verification fails on upload
    writeFakeState(s.fake, fs);
    const t1 = T0.getTime() + 60_000;
    const a1 = await publishDue(a, s.f.root, { now: () => t1, run: s.run, mail: null }); // the video's read, the Short live
    expect(a1.join('\n')).toMatch(/shorts\/one: go-live \(0\)/);
    expect(state(s, 'short:one').live).toBe(true);
    expect(s.events('short:one').at(-1)).toMatchObject({ type: 'verified', result: 'failed' });
    for (let i = 2; i <= 4; i++) {
      const acts = await publishDue(a, s.f.root, { now: () => T0.getTime() + i * 60_000, run: s.run, mail: null });
      expect(acts.join('\n'), `tick ${i}`).toMatch(/shorts\/one: verify \(1\)/);
    }
    const fifth = await publishDue(a, s.f.root, { now: () => T0.getTime() + 5 * 60_000, run: s.run, mail: null });
    expect(fifth.join('\n')).not.toMatch(/verify/);
    const halt = readJson<{ kind: string; why: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    expect(halt).toMatchObject({ kind: 'step-failed' });
    expect(halt?.why).toMatch(/short:one: the verification keeps failing/);
  });

  it('a tick with the inbox and the due step over fakes completes in under 5 s', async () => {
    const s = stagedRelease(T0);
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    const mail = new FakeMailer(s.f.root);
    const okPre = {
      git: (args: string[]) => (args[0] === 'status' ? '' : 'main\n'),
      claude: () => true,
      env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
      freeGb: () => 100,
      launches: () => [],
    };
    const started = Date.now();
    const r = await tick(a, s.f.root, { mail, now: () => T0.getTime() + 60_000, preflight: okPre, run: s.run });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(r.outcome).toBe('ok');
    expect(r.actions.join('\n')).toMatch(/shorts\/one: go-live/);
    expect(state(s, 'short:one').live).toBe(true);
  });
});
