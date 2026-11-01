// The control plane (phase 1 Task 4): disabled does nothing; a failing preflight is emailed once and clears when it
// recovers; a held lock exits at once; a pass records what is due, kills a stuck run, emails new halts, sends the digest.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { scriptDir } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import { type Halt, appendJournal, readHalt, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { automationDir, readOutbox } from '../../src/orchestration/run/notify';
import { readSchedule } from '../../src/orchestration/run/schedule';
import { PREFLIGHT_HALT, TICK_LOCK, tick } from '../../src/orchestration/run/tick';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-tick-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  for (const id of [S, 'decision:b']) {
    runDir(T, id, root);
    writeFileSync(join(scriptDir(T, id, root), 'script.json'), JSON.stringify({ story: id })); // status names it from here
  }
  return root;
};
const T0 = Date.parse('2026-11-02T20:00:00Z'); // Monday noon in Los Angeles
const on = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true },
  approvals: { ...DEFAULTS.approvals, from: 'automation@example.test' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
};
const okPre = {
  git: (args: string[]) => (args[0] === 'status' ? '' : 'main\n'),
  claude: () => true,
  env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
  freeGb: () => 100,
  launches: () => [],
};
const T = 'heat-pumps';
const S = 'decision:a';
const halt = (extra: Partial<Halt> = {}): Halt => ({
  kind: 'awaiting-person',
  stage: 'review',
  why: 'watch the draft',
  unblock: { kind: 'decide', text: 'reply OK' },
  at: new Date(T0).toISOString(),
  runId: 'r1',
  board: { stage: 'review', next: 'watch it' },
  ...extra,
});
const same = () => ({ stage: 'review', next: 'watch it' });

describe('tick', () => {
  it('does nothing while disabled, and never runs a story', async () => {
    const root = fresh();
    const mail = new FakeMail();
    const r = await tick(DEFAULTS, root, { mail, now: () => T0, preflight: okPre });
    expect(r).toEqual({ outcome: 'disabled', actions: ['tick: disabled'] });
    expect(mail.sent).toEqual([]);
    expect(existsSync(join(automationDir(root), 'schedule.json'))).toBe(false);
  });
  it('a held tick lock exits at once', async () => {
    const root = fresh();
    mkdirSync(join(automationDir(root), TICK_LOCK), { recursive: true });
    writeFileSync(
      join(automationDir(root), TICK_LOCK, 'lock.json'),
      '{"runId":"x","pid":1,"host":"h","startedAt":"s","heartbeatAt":"s","command":"tick"}',
    );
    const r = await tick(on, root, { mail: new FakeMail(), now: () => T0, alive: () => true, preflight: okPre });
    expect(r.outcome).toBe('held');
  });
  it('a dirty clone emails the preflight halt once over two ticks, records nothing due, and clears when it recovers', async () => {
    const root = fresh();
    const mail = new FakeMail();
    writeHalt(runDir(T, S, root), halt({ kind: 'timeout', why: 'hung' }));
    const dirty = { ...okPre, git: (a: string[]) => (a[0] === 'status' ? ' M src/x.ts\n' : 'main\n') };
    const r1 = await tick(on, root, { mail, now: () => T0, preflight: dirty, ask: same });
    expect(r1.outcome).toBe('preflight');
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toContain('automation/preflight (preflight)');
    expect(mail.sent[0].text).toContain('dirty: src/x.ts');
    expect(readSchedule(root).due).toBeUndefined();
    const r2 = await tick(on, root, { mail, now: () => T0 + 60_000, preflight: dirty, ask: same });
    expect(r2.outcome).toBe('preflight');
    expect(mail.sent).toHaveLength(1);
    expect(existsSync(join(automationDir(root), PREFLIGHT_HALT))).toBe(true);
    const r3 = await tick(on, root, { mail, now: () => T0 + 120_000, preflight: okPre, ask: same });
    expect(r3.outcome).toBe('ok');
    expect(r3.actions).toContain('preflight recovered');
    expect(existsSync(join(automationDir(root), PREFLIGHT_HALT))).toBe(false);
  });
  it('a dirty clone whose paths a launch record owns passes', async () => {
    const root = fresh();
    const dirty = {
      ...okPre,
      git: (a: string[]) => (a[0] === 'status' ? ' M topics/heat-pumps/report.json\n' : 'main\n'),
      launches: () => [{ paths: ['topics/heat-pumps'] }],
    };
    expect((await tick(on, root, { mail: new FakeMail(), now: () => T0, preflight: dirty })).outcome).toBe('ok');
  });
  it('a pass records the due resumes, kills a stuck run, emails the new halts once and sends the digest once', async () => {
    const root = fresh();
    const mail = new FakeMail();
    // a retryable halt past its first backoff
    writeHalt(
      runDir(T, S, root),
      halt({ kind: 'timeout', why: 'render hung', at: new Date(T0 - 20 * 60_000).toISOString() }),
    );
    // a running lock whose journal went silent for four hours
    const dir = runDir(T, 'decision:b', root);
    writeFileSync(
      join(dir, 'lock.json'),
      JSON.stringify({
        runId: 'r9',
        pid: 777,
        host: 'h',
        startedAt: new Date(T0 - 5 * 3600_000).toISOString(),
        heartbeatAt: 'x',
        command: 'c',
        childStep: 'render',
      }),
    );
    appendJournal(dir, {
      at: new Date(T0 - 4 * 3600_000).toISOString(),
      runId: 'r9',
      stage: 'video',
      next: 'n',
      step: 'render',
      kind: 'run',
      attempt: 1,
    });
    const killed: number[] = [];
    const deps = {
      mail,
      now: () => T0,
      preflight: okPre,
      ask: same,
      alive: (pid: number) => pid === 777,
      kill: (pid: number) => void killed.push(pid),
    };
    const r = await tick(on, root, deps);
    expect(r.outcome).toBe('ok');
    expect(readSchedule(root).due).toEqual([{ topic: T, storyId: S, why: 'backoff', at: new Date(T0).toISOString() }]);
    expect(killed).toEqual([777]);
    expect(readHalt(dir)?.kind).toBe('timeout');
    // the new timeout halt of decision:b is emailed (the retryable one of decision:a too: a halt is a halt)
    const subjects = mail.sent.map((m) => m.subject);
    expect(subjects.filter((s) => s.startsWith('[CoR] blocked'))).toHaveLength(2);
    expect(subjects.some((s) => s.startsWith('[CoR] weekly digest'))).toBe(true);
    expect(readSchedule(root).lastTick).toBe(new Date(T0).toISOString());
    expect(readOutbox(root).every((e) => e.sentAt)).toBe(true);
    // the next tick: nothing new to email, no second digest
    const again = await tick(on, root, { ...deps, now: () => T0 + 60_000, alive: () => false });
    expect(again.outcome).toBe('ok');
    expect(mail.sent).toHaveLength(3);
  });
});
