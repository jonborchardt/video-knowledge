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
  return { root, mail, messageId, poll, reply, proposal };
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
