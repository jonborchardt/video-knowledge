// The inbox adapter (spec §4.4 step 3, §7.2, §12): a reply is applied once, by thread and by id, only from the
// approver; anything unreadable gets one clarification; a crash after the verb and before the record is caught by
// the verb's idempotence; an expired request is renewed by the tick and the reply to the renewal is applied.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { readJson } from '../../src/shared/io';
import { type InMail, FakeMail } from '../../src/shared/mail';
import { loadLedger, openRequest } from '../../src/modules/publishing/publish';
import { INBOX_FILE, decideArgs, pollInbox, readInbox, threadOf } from '../../src/orchestration/run/inbox';
import { runDir } from '../../src/orchestration/run/journal';
import { automationDir, readOutbox, sendTracked } from '../../src/orchestration/run/notify';
import { publishDue } from '../../src/orchestration/run/publish-due';
import { readSchedule } from '../../src/orchestration/run/schedule';
import { type Stage, stagedRelease, sentRequest } from './publish-fake-cli';

const stages: Stage[] = [];
afterAll(() => stages.forEach((s) => s.f.cleanup()), 120_000);
const T0 = new Date('2026-10-30T12:00:00Z');
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
let uid = 0;
const reply = (inReplyTo: string, text: string, extra: Partial<InMail> = {}): InMail => ({
  uid: ++uid,
  messageId: `<r${uid}@jon.test>`,
  inReplyTo,
  references: [inReplyTo],
  from: 'Jon <jon@example.test>',
  subject: 'Re: [CoR release] a title (rq-000000000000)',
  text: `${text}\n\n> the request`,
  html: null,
  date: T0.toISOString(),
  ...extra,
});

async function staged(opts: { expiresDays?: number } = {}) {
  const s = stagedRelease(T0, opts);
  stages.push(s);
  const mail = new FakeMail();
  const now = () => T0.getTime();
  const sent = await sentRequest(s, mail, now);
  const subject = `Re: [CoR release] ${s.manifest.outputs.youtube.title} (${s.request})`;
  const poll = (at = T0) => pollInbox(a, mail, s.f.root, { now: () => at.getTime(), run: s.run });
  return { s, mail, sent, subject, poll, now };
}

describe('pollInbox', () => {
  it('applies OK once: the same reply delivered twice is one decided and one go-live', async () => {
    const { s, mail, sent, subject, poll } = await staged();
    mail.deliver(reply(sent, 'OK', { subject }));
    const r1 = await poll();
    expect(r1.applied).toEqual([`${s.request}: ok`]);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(s.publicUpdates()).toHaveLength(1);
    expect(s.events().find((e) => e.type === 'published')?.via).toMatchObject({ channel: 'email', request: s.request });
    // the same message again (a fetch after a crash between fetch and record): handled, nothing applied twice
    const copy = { ...mail.inbox[0], uid: ++uid };
    mail.deliver(copy);
    const r2 = await poll();
    expect(r2.applied).toEqual([]);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(s.publicUpdates()).toHaveLength(1);
    const file = readInbox(s.f.root);
    expect(file.handled.map((h) => h.outcome)).toEqual(['applied:ok']);
    expect(file.lastUid).toBe(copy.uid);
    expect(readSchedule(s.f.root).due?.[0]).toMatchObject({ topic: s.f.topic, storyId: s.f.story, why: 'moved' });
  });

  it('ignores a reply from another address, one outside a request thread, and one whose id disagrees with the thread', async () => {
    const { s, mail, sent, subject, poll } = await staged();
    mail.deliver(reply(sent, 'OK', { subject, from: 'someone@else.test' }));
    mail.deliver(reply('<unknown@x>', 'OK', { subject, references: [] }));
    mail.deliver(reply(sent, 'OK', { subject: 'Re: something rq-0123456789ab' }));
    const r = await poll();
    expect(r.applied).toEqual([]);
    expect(r.ignored).toHaveLength(3);
    expect(r.ignored[0]).toMatch(/not from the approver/);
    expect(r.ignored[1]).toMatch(/not a reply to a request/);
    expect(r.ignored[2]).toMatch(/request id/);
    expect(s.events().some((e) => e.type === 'decided' || e.type === 'approved')).toBe(false);
    expect(mail.sent).toHaveLength(1); // nothing answered
    expect(readInbox(s.f.root).handled).toHaveLength(3);
  });

  it('an ambiguous reply gets one clarification naming OK, nothing is applied, the request stays open; the reply to the clarification is applied', async () => {
    const { s, mail, sent, subject, poll, now } = await staged();
    mail.deliver(reply(sent, 'looks fine, go', { subject }));
    const r = await poll();
    expect(r.clarified).toEqual([s.request]);
    expect(mail.sent).toHaveLength(2);
    const c = mail.sent[1];
    expect(c.to).toBe('jon@example.test');
    expect(c.inReplyTo).toBe(mail.inbox[0].messageId);
    expect(c.text).toMatch(/could not read your reply/);
    expect(c.text).toMatch(/\bOK\b/);
    expect(c.text).toMatch(/CHANGES:/);
    expect(readOutbox(s.f.root).at(-1)).toMatchObject({ kind: 'reply', request: s.request });
    expect(s.events().some((e) => e.type === 'decided' || e.type === 'approved')).toBe(false);
    expect(openRequest(loadLedger(s.f.topic, s.f.story, s.f.root)!, undefined, new Date(now()))?.request).toBe(
      s.request,
    );
    // the same again is still one clarification per message, and the answer to it threads back to the request
    await poll();
    expect(mail.sent).toHaveLength(2);
    mail.deliver(reply(c.messageId, 'OK', { subject, references: [sent, c.messageId] }));
    const r2 = await poll();
    expect(r2.applied).toEqual([`${s.request}: ok`]);
    expect(s.publicUpdates()).toHaveLength(1);
  });

  it('a crash between decide and the inbox record is completed on the next poll without a second go-live (criterion 13)', async () => {
    const { s, mail, sent, subject } = await staged();
    mail.deliver(reply(sent, 'OK', { subject }));
    let crash = true;
    const run: typeof s.run = async (cli, args) => {
      const r = await s.run(cli, args);
      if (crash && args[0] === 'decide') throw new Error('killed after decide, before the record');
      return r;
    };
    await expect(pollInbox(a, mail, s.f.root, { now: () => T0.getTime(), run })).rejects.toThrow(/killed/);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(readInbox(s.f.root).handled).toHaveLength(0);
    crash = false;
    const r = await pollInbox(a, mail, s.f.root, { now: () => T0.getTime(), run });
    expect(r.applied).toEqual([`${s.request}: ok`]);
    expect(s.events().filter((e) => e.type === 'decided')).toHaveLength(1);
    expect(s.publicUpdates()).toHaveLength(1);
    expect(readInbox(s.f.root).handled).toHaveLength(1);
  });

  it('a reply to an expired request is refused by mail; the tick renews once; the reply to the renewal is applied', async () => {
    const { s, mail, sent, subject, now } = await staged({ expiresDays: 1 });
    const later = new Date(T0.getTime() + 2 * 86400_000);
    s.clock.now = later;
    mail.deliver(reply(sent, 'OK', { subject }));
    const r = await pollInbox(a, mail, s.f.root, { now: () => later.getTime(), run: s.run });
    expect(r.refused).toHaveLength(1);
    expect(r.refused[0]).toMatch(/expired/);
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[1].text).toMatch(/could not be applied: .*expired/);
    expect(s.events().some((e) => e.type === 'decided' && e.verdict === 'ok')).toBe(false);
    // the tick's due step: one renewal, a new request mail through the outbox
    const actions = await publishDue(a, s.f.root, { now: () => later.getTime(), run: s.run, mail });
    expect(actions.join('\n')).toMatch(/renew/);
    const renewed = openRequest(loadLedger(s.f.topic, s.f.story, s.f.root)!, undefined, later)!;
    expect(renewed.request).not.toBe(s.request);
    expect(renewed.renewed).toBe(1);
    expect(mail.sent).toHaveLength(3);
    expect(mail.sent[2].subject).toContain(renewed.request);
    expect(readOutbox(s.f.root).find((e) => e.request === renewed.request)?.kind).toBe('release-request');
    mail.deliver(reply(mail.sent[2].messageId, 'OK', { subject: mail.sent[2].subject }));
    const r2 = await pollInbox(a, mail, s.f.root, { now: () => later.getTime(), run: s.run });
    expect(r2.applied).toEqual([`${renewed.request}: ok`]);
    expect(s.publicUpdates()).toHaveLength(1);
    // a second expiry is a person's: the halt, no second renewal
    const again = new Date(later.getTime() + 10 * 86400_000);
    const s2 = stagedRelease(T0, { expiresDays: 1 });
    stages.push(s2);
    const m2 = new FakeMail();
    await sentRequest(s2, m2, now);
    s2.clock.now = later;
    await publishDue(a, s2.f.root, { now: () => later.getTime(), run: s2.run, mail: m2 });
    expect(m2.sent).toHaveLength(2);
    s2.clock.now = again;
    const acts = await publishDue(a, s2.f.root, { now: () => again.getTime(), run: s2.run, mail: m2 });
    expect(acts.join('\n')).toMatch(/request-expired/);
    expect(m2.sent).toHaveLength(2);
    const halt = readJson<{ kind: string }>(join(runDir(s2.f.topic, s2.f.story, s2.f.root), 'halt.json'));
    expect(halt?.kind).toBe('request-expired');
  });

  it('a decide that fails (exit 1) leaves the message for the next poll, halts the story step-failed, and the tick goes on', async () => {
    const { s, mail, sent, subject } = await staged();
    mail.deliver(reply(sent, 'OK', { subject }));
    let fail = true;
    const run: typeof s.run = async (cli, args) =>
      fail && args[0] === 'decide'
        ? { status: 1, stdout: '', stderr: 'YouTube kept vid00000000 private after go-live\n' }
        : s.run(cli, args);
    const r = await pollInbox(a, mail, s.f.root, { now: () => T0.getTime(), run });
    expect(r.failed).toEqual([`${s.request}: YouTube kept vid00000000 private after go-live`]);
    expect(readInbox(s.f.root).handled).toHaveLength(0);
    const halt = readJson<{ kind: string; why: string }>(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'));
    expect(halt).toMatchObject({ kind: 'step-failed' });
    expect(halt?.why).toMatch(/publish decide .*kept vid00000000 private/);
    expect(mail.sent).toHaveLength(1); // the halt mail is the tick's (notifyHalts), not the inbox's
    fail = false;
    const r2 = await pollInbox(a, mail, s.f.root, { now: () => T0.getTime(), run });
    expect(r2.applied).toEqual([`${s.request}: ok`]);
    expect(readJson(join(runDir(s.f.topic, s.f.story, s.f.root), 'halt.json'))).toBeNull(); // cleared on success
  });

  it('a later reply on a decided request is answered once and never applied; the same decision again is a copy', async () => {
    const { s, mail, sent, subject, poll } = await staged();
    mail.deliver(reply(sent, 'OK', { subject }));
    await poll();
    mail.deliver(reply(sent, 'CHANGES: the figure is wrong', { subject }));
    const r = await poll();
    expect(r.refused).toEqual([`${s.request}: already decided (ok)`]);
    expect(s.events().some((e) => e.type === 'changes-requested')).toBe(false);
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[1].text).toMatch(/already decided.*ok/);
    expect(readInbox(s.f.root).handled.map((h) => h.outcome)).toEqual(['applied:ok', 'refused:already decided (ok)']);
    mail.deliver(reply(sent, 'OK', { subject }));
    const r2 = await poll();
    expect(r2.applied).toEqual([`${s.request}: ok`]); // a copy of the same decision: nothing to say
    expect(mail.sent).toHaveLength(2);
    expect(s.publicUpdates()).toHaveLength(1);
  });

  it('CHANGES: with placed notes and PAID OK reach decide as arguments', async () => {
    const { s, mail, sent, subject, poll } = await staged();
    mail.deliver(reply(sent, 'CHANGES:\n[0:12 sc2 s3] the figure is wrong\nshort:one the caption is cut', { subject }));
    const r = await poll();
    expect(r.applied).toEqual([`${s.request}: changes`]);
    expect(s.events().find((e) => e.type === 'changes-requested')?.notes).toEqual([
      { text: 'the figure is wrong', seconds: 12, scene: 'sc2', sentence: 's3' },
    ]);
    expect(s.events('short:one').find((e) => e.type === 'changes-requested')?.notes).toEqual([
      { text: 'the caption is cut' },
    ]);
    expect(s.publicUpdates()).toHaveLength(0);
    const d = { verdict: 'ok' as const, paid: 'all' as const };
    const args = decideArgs(s.f.topic, s.f.story, s.request, 'Jon', d, '<m@x>', s.f.root);
    expect(args.slice(0, 3)).toEqual(['decide', s.f.topic, s.f.story]);
    expect(args).toContain('--via');
    expect(args[args.indexOf('--via') + 1]).toBe('email:<m@x>');
    expect(args.filter((x) => x === '--paid')).toHaveLength(s.manifest.ctas.commercial.length);
    const numbered = decideArgs(
      s.f.topic,
      s.f.story,
      s.request,
      'Jon',
      { verdict: 'ok', paid: [1] },
      '<m@x>',
      s.f.root,
    );
    expect(numbered.filter((x) => x === '--paid')).toHaveLength(Math.min(1, s.manifest.ctas.commercial.length));
  });

  it('a draft reply: OK records the acceptance for the release loop; CHANGES: records the notes on the draft', async () => {
    const s = stagedRelease(T0);
    stages.push(s);
    const mail = new FakeMail();
    const now = () => T0.getTime();
    // the draft request mail, as sendDraftRequest leaves it: the outbox entry and run/draft-request.json
    const build = 'draftsha';
    const { messageId } = await sendTracked(
      mail,
      { from: 'automation@example.test', to: 'jon@example.test', subject: '[CoR draft] a title', text: 'watch it' },
      'draft-request',
      s.f.root,
      { topic: s.f.topic, storyId: s.f.story, now },
    );
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(runDir(s.f.topic, s.f.story, s.f.root), { recursive: true });
    writeFileSync(
      join(s.f.dir, 'run', 'draft-request.json'),
      JSON.stringify({ [build]: { messageId, at: T0.toISOString() } }),
    );
    mail.deliver(reply(messageId, 'OK', { subject: 'Re: [CoR draft] a title' }));
    const r = await pollInbox(a, mail, s.f.root, { now, run: s.run });
    expect(r.applied).toEqual([`${s.f.story}: draft ok`]);
    const accepted = readJson<{ build: string; by: string }>(join(s.f.dir, 'run', 'draft-accepted.json'));
    expect(accepted).toMatchObject({ build, by: 'Jon' });
    expect(readSchedule(s.f.root).due?.[0]).toMatchObject({ storyId: s.f.story, why: 'moved' });
    expect(threadOf(mail.inbox[0], readOutbox(s.f.root))?.kind).toBe('draft-request');
    expect(existsSync(join(automationDir(s.f.root), INBOX_FILE))).toBe(true);
  });
});
