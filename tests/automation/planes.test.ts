// Acceptance criterion 15: the control plane stays responsive while long work runs. A work instance sleeps in a
// "render" holding the story lock; a tick started meanwhile completes its pass (and emails a halt) in seconds; a
// second work instance started during the sleep ends idle within a second because the lock is held.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { scriptDir } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import { type Halt, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { acquire, release } from '../../src/orchestration/run/lock';
import { writeSchedule } from '../../src/orchestration/run/schedule';
import { tick } from '../../src/orchestration/run/tick';
import { work } from '../../src/orchestration/run/work';
import { writeLaunch } from '../../src/orchestration/run/launch';
import { stagedRelease, sentRequest } from './publish-fake-cli';

const root = mkdtempSync(join(tmpdir(), 'vk-planes-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
for (const id of ['decision:render', 'decision:blocked']) {
  runDir('heat-pumps', id, root);
  writeFileSync(join(scriptDir('heat-pumps', id, root), 'script.json'), JSON.stringify({ story: id })); // status names it
}
const on = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true, work: true },
  approvals: { ...DEFAULTS.approvals, from: 'automation@example.test' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const okPre = {
  git: (args: string[]) => (args[0] === 'status' ? '' : 'main\n'),
  claude: () => true,
  env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
  freeGb: () => 100,
  launches: () => [],
  channels: () => [],
};
const T = 'heat-pumps';
const halt: Halt = {
  kind: 'awaiting-person',
  stage: 'review',
  why: 'watch the draft',
  unblock: { kind: 'decide', text: 'reply OK' },
  at: '2026-11-02T10:00:00.000Z',
  runId: 'r1',
  board: { stage: 'review', next: 'watch it' },
};

describe('the two planes (criterion 15)', () => {
  it('a tick finishes and emails while a work job sleeps in a render; a second work instance idles at once', async () => {
    writeSchedule(root, { due: [{ topic: T, storyId: 'decision:render', why: 'backoff', at: 'x' }] });
    writeHalt(runDir(T, 'decision:blocked', root), halt);
    const lockDir = runDir(T, 'decision:render', root);
    const first = work(on, root, {
      runStory: async () => {
        const got = acquire(lockDir, 'story', {});
        if ('held' in got) throw new Error('unexpected');
        await new Promise((r) => setTimeout(r, 3000)); // the "render"
        release(lockDir, got.lock);
        return { outcome: 'done', stage: 'packaged', halt: null, iterations: 1, costUsd: 0 };
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    const mail = new FakeMailer(root);
    const t0 = Date.now();
    const report = await tick(on, root, { mail, preflight: okPre, ask: () => ({ stage: 'review', next: 'watch it' }) });
    expect(report.outcome).toBe('ok');
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(mail.sent.some((m) => m.subject.includes('decision:blocked'))).toBe(true);
    const t1 = Date.now();
    const second = await work(on, root, {
      runStory: async () => ({ outcome: 'held', stage: '', halt: null, iterations: 0, costUsd: 0 }),
      pick: () => null,
    });
    expect(second.outcome).toBe('idle');
    expect(Date.now() - t1).toBeLessThan(1000);
    expect((await first).outcome).toBe('done');
  }, 20_000);
});

// Phase 3: the control plane applies a reply and probes a launch while a work instance sleeps in a job.
describe('the two planes with the publication steps (criterion 15)', () => {
  it('a tick applies an OK reply and confirms a deploy in seconds while a work job sleeps', async () => {
    const T1 = new Date('2026-10-30T12:00:00Z');
    const s = stagedRelease(T1);
    const mail = new FakeMailer(s.f.root);
    const sent = await sentRequest(s, mail, () => T1.getTime());
    mail.deliver({
      uid: 1,
      messageId: '<r1@jon.test>',
      inReplyTo: sent,
      references: [sent],
      from: 'Jon <jon@example.test>',
      subject: `Re: ${mail.sent[0].subject}`,
      text: 'OK\n\n> the request',
      html: null,
      date: T1.toISOString(),
    });
    // another story's launch, pushed and awaiting its deploy
    writeLaunch(s.f.root, {
      topic: s.f.topic,
      storyId: 'decision:other',
      startedAt: T1.toISOString(),
      steps: { validated: T1.toISOString() },
      committed: 'abc',
      pushed: 'abc',
      probes: 0,
      liveAt: null,
      posted: null,
      emailed: false,
    });
    const policy = {
      ...on,
      approvals: { ...on.approvals, to: 'jon@example.test', approverName: 'Jon' },
      launch: { ...on.launch, push: true },
    };
    const lockDir = runDir(s.f.topic, 'decision:sleeping', s.f.root);
    const sleeping = work(policy, s.f.root, {
      launches: () => [{ kind: 'launch', topic: s.f.topic, storyId: 'decision:sleeping', why: 'test' }],
      runLaunch: async () => {
        const got = acquire(lockDir, 'launch', {});
        if ('held' in got) throw new Error('unexpected');
        await new Promise((r) => setTimeout(r, 3000)); // the "launch" (a build)
        release(lockDir, got.lock);
        return { outcome: 'done', stage: 'launch', halt: null, iterations: 1, costUsd: 0 };
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    const t0 = Date.now();
    const report = await tick(policy, s.f.root, {
      mail,
      now: () => T1.getTime() + 60_000,
      preflight: { ...okPre, channels: () => [] },
      run: s.run,
      fetchFn: (async () => new Response('embed/vid00000000', { status: 200 })) as unknown as typeof fetch,
    });
    expect(report.outcome).toBe('ok');
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(report.actions.join('\n')).toMatch(/inbox: 1 fetched, 1 applied/);
    expect(s.events().find((e) => e.type === 'decided')).toMatchObject({ verdict: 'ok' });
    expect(s.publicUpdates('vid00000000')).toHaveLength(0); // the page goes up first (plan B): private until the probe
    expect(report.actions.join('\n')).toMatch(/decision:other: (live at|not live yet|no publish.json)/);
    expect((await sleeping).outcome).toBe('done');
    s.f.cleanup();
  }, 20_000);
});
