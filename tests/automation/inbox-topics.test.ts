// Replies to a proposal batch (spec §5.1, §7.1, §12; phase 4 Task 4): APPROVE and REJECT lines applied once through
// `npm run topics` by the approver and the batch id, APPROVE ALL over the batch's slugs only, a slug outside the batch
// reported and skipped, a duplicate reply a no-op, another sender ignored.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { runCli } from '../../src/shared/cli';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import type { InMail } from '../../src/modules/mail';
import { FakeMailer } from './fake-mailer';
import type { Proposal, ProposalReview } from '../../src/shared/types';
import { PROPOSALS_DIR, proposalPath, reviewPath } from '../../src/modules/topic-discovery/proposals';
import { pollInbox, readInbox } from '../../src/orchestration/run/inbox';
import { automationDir } from '../../src/orchestration/run/notify';
import { tick } from '../../src/orchestration/run/tick';
import { gitOrigin } from './publish-fake-cli';
import { cliRoot } from '../production-helpers';

const FIX = join(ROOT, 'tests', 'fixtures', 'proposals');
const good = () => readJson<Proposal>(join(FIX, 'good.json'))!;
const review = () => readJson<ProposalReview>(join(FIX, 'good.review.json'))!;
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 60_000);
const T0 = Date.parse('2026-11-06T18:00:00Z');
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const BATCH = 'pb-0123456789ab';
let uid = 0;

async function staged() {
  const root = mkdtempSync(join(tmpdir(), 'vk-inbox-topics-'));
  roots.push(root);
  cliRoot(root);
  mkdirSync(join(root, PROPOSALS_DIR), { recursive: true });
  const put = (slug: string, question: string, extra: Partial<Proposal> = {}) => {
    writeFileSync(proposalPath(slug, root), toJson({ ...good(), slug, question, ...extra }));
    writeFileSync(reviewPath(slug, root), toJson({ ...review(), slug }));
  };
  const batch = { id: BATCH, sentAt: new Date(T0).toISOString(), messageId: '' };
  put('ev-running-costs', good().question, { batch });
  put('cheap-flights', 'Are budget airline fares cheaper once the extras are paid?', { batch });
  put('day-trading-courses', 'Do day-trading courses deliver the returns they advertise?', {
    institution: 'dubious-returns',
    batch,
  });
  put('parked-one', 'Are extended warranties ever worth their price?', { status: 'parked', parkedWhy: 'weak' });
  put('next-week', 'Is leasing a car dearer than buying over five years?'); // proposed, not in this batch
  const mail = new FakeMailer(root);
  const { messageId } = await mail.sendTracked(
    {
      from: a.approvals.from,
      to: a.approvals.to,
      subject: `[CoR topics] 3 proposals for your review (${BATCH})`,
      text: 'x',
    },
    'batch',
    { request: BATCH, now: () => T0 },
  );
  const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: 'a-test-secret-of-some-length' };
  const run = (cli: string, args: string[]) => runCli(cli, args, { cwd: root, env });
  const poll = () => pollInbox(a, mail, root, { now: () => T0 + 3600_000, run });
  const reply = (text: string, extra: Partial<InMail> = {}): InMail => ({
    uid: ++uid,
    messageId: `<r${uid}@jon.test>`,
    inReplyTo: messageId,
    references: [messageId],
    from: 'Jon <jon@example.test>',
    subject: `Re: [CoR topics] 3 proposals for your review (${BATCH})`,
    text: `${text}\n\n> the batch`,
    html: null,
    date: new Date(T0 + 1800_000).toISOString(),
    ...extra,
  });
  const proposal = (slug: string) => readJson<Proposal>(proposalPath(slug, root))!;
  return { root, mail, messageId, poll, reply, proposal, run };
}

describe('pollInbox: proposal batches', () => {
  it('applies two approvals and one rejection by the approver with the message id; a second identical reply changes nothing', async () => {
    const s = await staged();
    s.mail.deliver(
      s.reply(
        'APPROVE ev-running-costs\nAPPROVE day-trading-courses\nREJECT cheap-flights: too close to the consumer-rights matter',
      ),
    );
    const r = await s.poll();
    expect(r.applied).toEqual([`${BATCH}: approve ev-running-costs, day-trading-courses; reject cheap-flights`]);
    expect(s.proposal('ev-running-costs')).toMatchObject({
      status: 'approved',
      decidedBy: 'Jon',
      via: { channel: 'email', messageId: s.mail.inbox[0].messageId },
    });
    expect(s.proposal('day-trading-courses').status).toBe('approved');
    expect(s.proposal('cheap-flights')).toMatchObject({
      status: 'rejected',
      note: 'too close to the consumer-rights matter',
    });
    expect(s.mail.sent).toHaveLength(1); // the batch mail only: nothing to report back
    const before = s.proposal('ev-running-costs').decidedAt;
    s.mail.deliver(
      s.reply(
        'APPROVE ev-running-costs\nAPPROVE day-trading-courses\nREJECT cheap-flights: too close to the consumer-rights matter',
      ),
    );
    const r2 = await s.poll();
    expect(r2.applied).toHaveLength(1); // idempotent verbs: the same decisions, nothing changed
    expect(s.proposal('ev-running-costs').decidedAt).toBe(before);
    expect(readInbox(s.root).handled.map((h) => h.outcome)).toEqual([
      expect.stringMatching(/^applied:topics/),
      expect.stringMatching(/^applied:topics/),
    ]);
  }, 180_000);

  it('APPROVE ALL approves every batched slug and no parked or unbatched one; a slug outside the batch is reported back and skipped', async () => {
    const s = await staged();
    s.mail.deliver(s.reply('APPROVE ALL\nAPPROVE next-week\nREJECT parked-one: no'));
    const r = await s.poll();
    expect(r.applied).toHaveLength(1);
    for (const slug of ['ev-running-costs', 'cheap-flights', 'day-trading-courses'])
      expect(s.proposal(slug).status).toBe('approved');
    expect(s.proposal('next-week').status).toBe('proposed');
    expect(s.proposal('parked-one').status).toBe('parked');
    expect(s.mail.sent).toHaveLength(2);
    const back = s.mail.sent[1];
    expect(back.to).toBe('jon@example.test');
    expect(back.inReplyTo).toBe(s.mail.inbox[0].messageId);
    expect(back.text).toMatch(/next-week.*not in batch/);
    expect(back.text).toMatch(/parked-one.*not in batch/);
    expect(back.text).toMatch(/Applied: APPROVE (?=.*ev-running-costs)(?=.*cheap-flights)(?=.*day-trading-courses)/);
  }, 180_000);

  it('a reply nobody can read gets the topics hint; another sender and a wrong batch id are ignored', async () => {
    const s = await staged();
    s.mail.deliver(s.reply('looks good to me'));
    s.mail.deliver(s.reply('APPROVE ALL', { from: 'someone@else.test' }));
    s.mail.deliver(s.reply('APPROVE ALL', { subject: 'Re: [CoR topics] 3 proposals (pb-ffffffffffff)' }));
    const r = await s.poll();
    expect(r.applied).toEqual([]);
    expect(r.clarified).toEqual([BATCH]);
    expect(r.ignored).toHaveLength(2);
    expect(r.ignored[0]).toMatch(/not from the approver/);
    expect(r.ignored[1]).toMatch(/batch id/);
    expect(s.mail.sent).toHaveLength(2);
    expect(s.mail.sent[1].text).toMatch(/APPROVE <slug>/);
    for (const slug of ['ev-running-costs', 'cheap-flights', 'day-trading-courses'])
      expect(s.proposal(slug).status).toBe('proposed');
  }, 180_000);
});

describe('the tick over a proposal batch (plan A, A2)', () => {
  const on = { ...a, enabled: { ...a.enabled, tick: true } };
  const pre = (git: (args: string[]) => string) => ({
    git,
    claude: () => true,
    env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
    freeGb: () => 100,
    launches: () => [],
    channels: () => [],
  });
  const noGit = (args: string[]) => (args[0] === 'status' ? '' : 'main\n');
  const HOUR = 3600_000;

  it('a line whose verb crashes is retried, never called a refusal: no reply and no handled record while it fails, one halt mail, then applied once (N5)', async () => {
    const s = await staged();
    mkdirSync(join(s.root, 'topics'), { recursive: true });
    s.mail.deliver(s.reply('APPROVE ev-running-costs\nAPPROVE cheap-flights'));
    let crash = true;
    const run = (cli: string, args: string[]) =>
      crash && args[1] === 'cheap-flights'
        ? { status: 1, stdout: '', stderr: 'EBUSY: the proposal file is locked\n' }
        : s.run(cli, args);
    const go = (at: number) => tick(on, s.root, { mail: s.mail, now: () => at, preflight: pre(noGit), run });
    const halts = () => s.mail.sent.filter((m) => m.subject.includes(`batch:${BATCH}`));
    const replies = () => s.mail.sent.filter((m) => m.subject.startsWith('Re:'));
    const r1 = await go(T0 + HOUR);
    expect(r1.actions.join('\n')).toMatch(/1 failed/);
    expect(s.proposal('ev-running-costs').status).toBe('approved');
    expect(s.proposal('cheap-flights').status).toBe('proposed');
    expect(readInbox(s.root).handled).toHaveLength(0);
    expect(replies()).toHaveLength(0);
    expect(halts()).toHaveLength(1);
    expect(halts()[0].text).toContain('EBUSY: the proposal file is locked');
    expect(halts()[0].text).toContain('npm run topics -- approve cheap-flights');
    // the same failure on the next tick: tried again, nothing more is mailed
    await go(T0 + 2 * HOUR);
    expect(halts()).toHaveLength(1);
    expect(replies()).toHaveLength(0);
    const first = s.proposal('ev-running-costs').decidedAt;
    crash = false;
    await go(T0 + 3 * HOUR);
    expect(s.proposal('cheap-flights').status).toBe('approved');
    expect(s.proposal('ev-running-costs').decidedAt).toBe(first); // the line that had succeeded is not applied twice
    expect(readInbox(s.root).handled).toHaveLength(1);
    expect(replies()).toHaveLength(0); // every line applied: nothing to report back
    const notified = readJson<Record<string, { storyId: string }>>(join(automationDir(s.root), 'notified.json')) ?? {};
    expect(Object.values(notified).filter((n) => n.storyId.startsWith('batch:'))).toEqual([]);
  }, 180_000);

  it('commits the proposal a reply decided, and only that file; what someone else staged stays staged', async () => {
    const s = await staged();
    mkdirSync(join(s.root, 'topics'), { recursive: true });
    const g = gitOrigin(s.root);
    writeFileSync(join(s.root, 'notes.txt'), 'someone else is in the middle of this\n');
    g.git('add', 'notes.txt');
    // the preflight's whole-tree status is faked clean (the staged note would stop it); every other call is git's
    const git = (args: string[]) => (args[0] === 'status' && !args.includes('--') ? '' : g.git(...args));
    s.mail.deliver(s.reply('APPROVE ev-running-costs'));
    await tick(on, s.root, { mail: s.mail, now: () => T0 + HOUR, preflight: pre(git), run: s.run });
    expect(s.proposal('ev-running-costs').status).toBe('approved');
    expect(g.git('show', '--name-only', '--format=%s', 'HEAD').trim().split(/\n+/)).toEqual([
      'tick: topics approve ev-running-costs',
      'proposals/ev-running-costs.json',
    ]);
    expect(g.git('status', '--porcelain').trim()).toBe('A  notes.txt');
  }, 180_000);

  it('a commit that fails stops the tick writing for that pass: the file stays as written and the reply is replayed', async () => {
    const s = await staged();
    mkdirSync(join(s.root, 'topics'), { recursive: true });
    s.mail.deliver(s.reply('APPROVE ev-running-costs'));
    let ran = 0;
    const run = (cli: string, args: string[]) => (ran++, s.run(cli, args));
    // clean before the verb, dirty after it, and the commit refused
    const broken = (args: string[]) => {
      if (args[0] === 'commit') throw new Error("fatal: Unable to create '.git/index.lock': File exists.");
      if (args[0] === 'status') return args.includes('--') && ran ? ' M proposals/ev-running-costs.json\n' : '';
      return 'main\n';
    };
    const r1 = await tick(on, s.root, { mail: s.mail, now: () => T0 + HOUR, preflight: pre(broken), run });
    const said = r1.actions.join('\n');
    expect(said).toMatch(
      /inbox failed: commit failed after topics approve \(proposals\/ev-running-costs\.json left as written\)/,
    );
    expect(said).toContain('due publications skipped: a commit failed earlier in this pass');
    expect(said).toContain('deploy probes skipped: a commit failed earlier in this pass');
    expect(s.proposal('ev-running-costs').status).toBe('approved'); // the decision is on disk
    expect(readInbox(s.root).handled).toHaveLength(0); // and the reply is not marked handled
    // after the hand commit the reply is replayed: the verb answers "already", nothing is decided twice
    const first = s.proposal('ev-running-costs').decidedAt;
    await tick(on, s.root, { mail: s.mail, now: () => T0 + 2 * HOUR, preflight: pre(noGit), run });
    expect(s.proposal('ev-running-costs').decidedAt).toBe(first);
    expect(readInbox(s.root).handled).toHaveLength(1);
  }, 180_000);
});
