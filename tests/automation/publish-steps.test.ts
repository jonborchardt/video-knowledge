// The tick's due-publication step (spec §4.4 step 4): a schedule past its time is synced and verified; the Shorts
// of a published video go live in order, one per tick, a retryable failure retried next tick and the video never
// touched; a live Short's description is pushed; and the whole tick stays short.
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { FakeMail } from '../../src/shared/mail';
import { readFakeState, writeFakeState } from '../../src/modules/publishing/fake-youtube';
import { openOutput } from '../../src/modules/publishing/publish';
import { publishDue } from '../../src/orchestration/run/publish-due';
import { tick } from '../../src/orchestration/run/tick';
import { type Stage, stagedRelease } from './publish-fake-cli';

const stages: Stage[] = [];
afterAll(() => stages.forEach((s) => s.f.cleanup()));
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
    expect(state(s, 'short:two').live).toBe(false);
    expect(s.publicUpdates('vid00000001')).toHaveLength(1);
    const a4 = await publishDue(a, s.f.root, { now: () => after.getTime() + 120_000, run: s.run, mail: null });
    expect(a4.join('\n')).toMatch(/shorts\/two: go-live/);
    expect(state(s, 'short:two').live).toBe(true);
    const a5 = await publishDue(a, s.f.root, { now: () => after.getTime() + 180_000, run: s.run, mail: null });
    expect(a5).toEqual([]); // nothing left: both Shorts live and pushed
    expect(s.publicUpdates('vid00000000')).toHaveLength(0); // the video was never touched again
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

  it('a tick with the inbox and the due step over fakes completes in under 5 s', async () => {
    const s = stagedRelease(T0);
    stages.push(s);
    expect((await decided(s, 'ok')).status).toBe(0);
    const mail = new FakeMail();
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
