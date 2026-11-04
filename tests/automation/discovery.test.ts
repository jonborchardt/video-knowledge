// Weekly topic discovery as a work-plane job (spec §5.1, §4.4; phase 4 Task 3): one discovery agent per institution
// with a channel, one independent review agent per proposal in a fresh session, the batch that parks the weak and
// lists the strong per institution under one id, one email with that id, a crash before the mail that never doubles
// the batch, and an unreviewed proposal that halts no-progress for its slug alone. Every agent is the fake claude.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import type { Proposal, ProposalReview } from '../../src/shared/types';
import { proposalPath, reviewPath } from '../../src/modules/topic-discovery/proposals';
import {
  DISCOVERY_DIR,
  type DiscoveryRecord,
  discover,
  discoveryDue,
  discoveryHalts,
  readDiscovery,
} from '../../src/orchestration/run/discovery';
import { flushOutbox, readOutbox } from '../../src/orchestration/run/notify';
import { defaultRender } from '../../src/orchestration/run/tick';
import { readSchedule, writeSchedule } from '../../src/orchestration/run/schedule';
import { statusOf } from '../../src/orchestration/run/status';
import { nextJob } from '../../src/orchestration/run/work';
import { cliRoot } from '../production-helpers';

const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const FIX = join(ROOT, 'tests', 'fixtures', 'proposals');
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 60_000);
// Friday 2026-11-06 09:00 Pacific: the slot (friday 07:00) has passed
const FRIDAY = Date.parse('2026-11-06T17:00:00Z');
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, work: true, discovery: true },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  agents: { ...DEFAULTS.agents, command: `node ${FAKE_CLAUDE}` },
};
const good = () => readJson<Proposal>(join(FIX, 'good.json'))!;
const review = () => readJson<ProposalReview>(join(FIX, 'good.review.json'))!;

/** A proposal file the fake discovery agent "writes": the good fixture under another slug and question. */
function proposalText(slug: string, question: string, institution = 'spending'): string {
  return toJson({ ...good(), slug, question, institution });
}
function reviewText(slug: string, extra: Partial<ProposalReview> = {}): string {
  return toJson({ ...review(), slug, ...extra });
}

interface ScenarioEntry {
  match: string;
  actions?: { write?: string; text?: string }[];
  cost?: number;
  error?: boolean;
}
function fresh(entries: ScenarioEntry[]) {
  const root = mkdtempSync(join(tmpdir(), 'vk-discovery-'));
  roots.push(root);
  cliRoot(root);
  mkdirSync(join(root, 'proposals'), { recursive: true });
  const scenario = join(root, 'scenario.json');
  writeFileSync(scenario, JSON.stringify(entries));
  const mail = new FakeMailer(root);
  const ran: string[][] = [];
  const env = { ...process.env, FAKE_CLAUDE_SCENARIO: scenario, APPROVAL_SECRET: 'a-test-secret-of-some-length' };
  const deps = (extra: Partial<Parameters<typeof discover>[1]> = {}) => ({
    now: () => FRIDAY,
    mail,
    env,
    git: 'none' as const,
    institutions: () => ['spending', 'dubious-returns'],
    onRun: (cli: string, args: string[]) => void ran.push([cli, ...args]),
    hooks: { snapshot: () => {}, guard: () => ({ ok: true, why: '', kept: [] }) },
    ...extra,
  });
  const proposal = (slug: string) => readJson<Proposal>(proposalPath(slug, root));
  return { root, mail, ran, deps, proposal, scenario };
}

/** The standard scenario: spending proposes two (one strong, one the reviewer fails), dubious-returns one strong. */
const standard = (): ScenarioEntry[] => [
  {
    match: 'discover\\.md[\\s\\S]*Institution: spending',
    actions: [
      { write: 'proposals/ev-running-costs.json', text: proposalText('ev-running-costs', good().question) },
      {
        write: 'proposals/cheap-flights.json',
        text: proposalText('cheap-flights', 'Are budget airline fares really cheaper once the extras are paid?'),
      },
    ],
    cost: 0.6,
  },
  {
    match: 'discover\\.md[\\s\\S]*Institution: dubious-returns',
    actions: [
      {
        write: 'proposals/day-trading-courses.json',
        text: proposalText(
          'day-trading-courses',
          'Do day-trading courses deliver the returns they advertise?',
          'dubious-returns',
        ),
      },
    ],
    cost: 0.5,
  },
  {
    match: 'proposal-review\\.md[\\s\\S]*Proposal: ev-running-costs',
    actions: [{ write: 'proposals/ev-running-costs.review.json', text: reviewText('ev-running-costs') }],
    cost: 0.3,
  },
  {
    match: 'proposal-review\\.md[\\s\\S]*Proposal: cheap-flights',
    actions: [
      {
        write: 'proposals/cheap-flights.review.json',
        text: reviewText('cheap-flights', {
          fit: false,
          concerns: [
            'Airline pricing is a consumer-rights story, not a cost-of-ownership one; the remit says what things cost to own and run.',
          ],
        }),
      },
    ],
    cost: 0.3,
  },
  {
    match: 'proposal-review\\.md[\\s\\S]*Proposal: day-trading-courses',
    actions: [{ write: 'proposals/day-trading-courses.review.json', text: reviewText('day-trading-courses') }],
    cost: 0.3,
  },
];

describe('discovery', () => {
  it('is due once per slot when enabled, and never when the flag is off or the slot has not come', () => {
    const c = fresh([]);
    expect(discoveryDue(a, c.root, FRIDAY)).toBe(true);
    expect(discoveryDue({ ...a, enabled: { ...a.enabled, discovery: false } }, c.root, FRIDAY)).toBe(false);
    // a slot never run is due at once (a missed Friday runs on Saturday); with last week's slot recorded, this
    // week's is not due before its hour
    expect(discoveryDue(a, c.root, Date.parse('2026-11-06T13:00:00Z'))).toBe(true); // Friday 05:00 Pacific, nothing ever ran
    writeSchedule(c.root, { discovery: { lastSlot: '2026-10-30' } });
    expect(discoveryDue(a, c.root, Date.parse('2026-11-06T13:00:00Z'))).toBe(false); // last week's done, this week's hour not come
    expect(discoveryDue(a, c.root, FRIDAY)).toBe(true);
    expect(nextJob(a, c.root, { pick: () => null, now: () => FRIDAY })).toMatchObject({ kind: 'discovery' });
    expect(
      nextJob({ ...a, enabled: { ...a.enabled, discovery: false } }, c.root, { pick: () => null, now: () => FRIDAY }),
    ).toBeNull();
  });

  it('runs one discovery agent per institution and one fresh review agent per proposal, parks the weak, lists the strong under one id, emails once, and records the message id', async () => {
    const c = fresh(standard());
    const r = await discover(a, c.deps(), c.root);
    expect(r.outcome, JSON.stringify(r.halt)).toBe('done');
    const rec = readDiscovery(c.root, '2026-11-06')!;
    expect(Object.keys(rec.institutions).sort()).toEqual(['dubious-returns', 'spending']);
    expect(rec.institutions.spending.proposals.sort()).toEqual(['cheap-flights', 'ev-running-costs']);
    expect(rec.institutions['dubious-returns'].proposals).toEqual(['day-trading-courses']);
    // sessions: the review of a proposal is never the session that wrote it
    const writer = rec.institutions.spending.session;
    const reviews = rec.institutions.spending.reviews;
    expect(writer).toMatch(/^fake-/);
    for (const slug of ['cheap-flights', 'ev-running-costs']) expect(reviews[slug].session).not.toBe(writer);
    expect(reviews['cheap-flights'].session).not.toBe(reviews['ev-running-costs'].session);
    // the batch: the weak one parked with the reviewer's first concern, the strong listed, one id in each listed file
    expect(rec.batch?.id).toMatch(/^pb-[0-9a-f]{12}$/);
    expect(rec.batch?.listed.map((x) => x.slug).sort()).toEqual(['day-trading-courses', 'ev-running-costs']);
    expect(c.proposal('cheap-flights')).toMatchObject({ status: 'parked' });
    expect(c.proposal('cheap-flights')!.parkedWhy).toMatch(/would not publish it: Airline pricing/);
    expect(c.proposal('ev-running-costs')!.batch?.id).toBe(rec.batch!.id);
    expect(c.proposal('cheap-flights')!.batch).toBeUndefined();
    // one email: the id in the subject and the body, the reviewer's verdict in full, the parked list at the end
    expect(c.mail.sent).toHaveLength(1);
    const m = c.mail.sent[0];
    expect(m.to).toBe('jon@example.test');
    expect(m.subject).toBe(`[CoR topics] 2 proposals for your review (${rec.batch!.id})`);
    expect(m.text).toContain(rec.batch!.id);
    expect(m.text).toContain('APPROVE ev-running-costs');
    expect(m.text).toContain('REJECT ev-running-costs: <why>');
    expect(m.text).toContain('APPROVE ALL');
    expect(m.text).toContain(review().verdict);
    expect(m.text).toMatch(/Parked, no reply needed[\s\S]*cheap-flights/);
    expect(m.text).not.toMatch(/Parked, no reply needed[\s\S]*APPROVE cheap-flights/);
    expect(c.proposal('ev-running-costs')!.batch?.messageId).toBe(m.messageId);
    expect(readOutbox(c.root).at(-1)).toMatchObject({
      kind: 'batch',
      request: rec.batch!.id,
      sentAt: expect.any(String),
    });
    expect(rec.emailed).toBe(true);
    expect(readSchedule(c.root).discovery?.lastSlot).toBe('2026-11-06');
    expect(rec.costUsd).toBeCloseTo(2.0, 5);
    // the usage of each agent, per model (no journal here: the record is the attempt list)
    expect(rec.institutions.spending.modelRequested).toBe('opus');
    expect(rec.institutions.spending.models?.[0]).toMatchObject({ model: 'fake-sonnet', costUsd: 0.6 });
    expect(rec.institutions.spending.turns).toBe(1);
    expect(rec.institutions.spending.ms).toBeGreaterThan(0);
    expect(reviews['cheap-flights'].models?.[0].model).toBe('fake-sonnet');
    expect(reviews['cheap-flights'].modelRequested).toBe('opus');
    // the same slot is not due again; the next Friday is
    expect(discoveryDue(a, c.root, FRIDAY + 60_000)).toBe(false);
    expect(discoveryDue(a, c.root, FRIDAY + 7 * 24 * 3600_000)).toBe(true);
    expect(c.ran.some((x) => x[0] === 'topics' && x[1] === 'batch')).toBe(true);
    expect(c.ran.some((x) => x[0] === 'topics' && x[1] === 'sent')).toBe(true);
  }, 180_000);

  it('a review agent that errors leaves its proposal unreviewed: neither batched nor parked, a no-progress halt for that slug only, the rest goes out', async () => {
    const entries = standard().map((e) =>
      e.match.includes('Proposal: cheap-flights') ? { ...e, actions: [], error: true } : e,
    );
    const c = fresh(entries);
    const r = await discover(a, c.deps(), c.root);
    expect(r.outcome).toBe('done'); // the job finishes: the halt is the slug's, not the job's
    const rec = readDiscovery(c.root, '2026-11-06')!;
    expect(rec.batch?.listed.map((x) => x.slug).sort()).toEqual(['day-trading-courses', 'ev-running-costs']);
    expect(rec.batch?.unreviewed).toEqual(['cheap-flights']);
    expect(c.proposal('cheap-flights')).toMatchObject({ status: 'proposed' });
    expect(existsSync(reviewPath('cheap-flights', c.root))).toBe(false);
    const halts = discoveryHalts(c.root);
    expect(halts).toHaveLength(1);
    expect(halts[0]).toMatchObject({ slug: 'cheap-flights', halt: { kind: 'no-progress' } });
    expect(halts[0].halt.unblock.text).toMatch(/proposal-review\.md|npm run topics/);
    // the status rows carry it (so the halt mail and the digest do)
    const row = statusOf(c.root, () => false).find((x) => x.storyId === 'cheap-flights');
    expect(row).toMatchObject({ topic: 'proposals', state: 'halted' });
    expect(row?.halt?.kind).toBe('no-progress');
    expect(c.mail.sent).toHaveLength(1);
    expect(c.mail.sent[0].text).not.toContain('APPROVE cheap-flights');
  }, 180_000);

  it('a crash after the schedule record and before the mail: the next job resumes without a second batch or a second agent, and the mail goes out once with the recorded id', async () => {
    const c = fresh(standard());
    c.mail.failNext = 'before'; // the send throws after the outbox entry exists
    await expect(discover(a, c.deps(), c.root)).rejects.toThrow(/connection lost/);
    const rec1 = readDiscovery(c.root, '2026-11-06')!;
    expect(rec1.emailed).toBe(false);
    expect(rec1.batch?.id).toMatch(/^pb-/);
    expect(readOutbox(c.root)).toHaveLength(1);
    expect(readOutbox(c.root)[0].sentAt).toBeNull();
    expect(readSchedule(c.root).discovery?.lastSlot).toBe('2026-11-06');
    expect(discoveryDue(a, c.root, FRIDAY + 60_000)).toBe(true); // unfinished: due again
    const agentRuns = c.ran.length;
    const log = join(c.root, 'claude.log');
    const r2 = await discover(a, c.deps({ env: { ...c.deps().env, FAKE_CLAUDE_LOG: log } }), c.root);
    expect(r2.outcome).toBe('done');
    expect(existsSync(log)).toBe(false); // no agent ran again
    const rec2 = readDiscovery(c.root, '2026-11-06')!;
    expect(rec2.batch?.id).toBe(rec1.batch?.id); // the same batch
    expect(rec2.emailed).toBe(true); // the outbox entry exists with its id: the job never makes a second one
    expect(readOutbox(c.root)).toHaveLength(1);
    expect(c.mail.sent).toHaveLength(0); // not sent by the job: the outbox resend carries it
    const entry = readOutbox(c.root)[0];
    expect(c.proposal('ev-running-costs')!.batch?.messageId).toBe(entry.messageId); // recorded from the entry
    expect(c.ran.length).toBeGreaterThan(agentRuns); // only `topics sent` ran again
    expect(discoveryDue(a, c.root, FRIDAY + 60_000)).toBe(false);
    // the tick's outbox flush, ten minutes on: the same message id, re-rendered from the proposal files
    const resent = await flushOutbox(
      c.mail,
      c.root,
      () => FRIDAY + 11 * 60_000,
      defaultRender(a, () => [], undefined, c.root),
    );
    expect(resent).toEqual([entry.messageId]);
    expect(c.mail.sent).toHaveLength(1);
    expect(c.mail.sent[0].messageId).toBe(entry.messageId);
    expect(c.mail.sent[0].subject).toContain(rec1.batch!.id);
    expect(c.mail.sent[0].text).toContain('APPROVE ev-running-costs');
    expect(c.mail.sent[0].text).toMatch(/Parked, no reply needed[\s\S]*cheap-flights/);
  }, 180_000);

  it('the fixture commission is never asked, an institution without a channel is skipped, and a second instance is held', async () => {
    const c = fresh(standard());
    const seen: string[] = [];
    const r = await discover(
      a,
      c.deps({ institutions: undefined, onInstitution: (k: string) => void seen.push(k) }),
      c.root,
    );
    expect(r.outcome).toBe('done');
    expect(seen).toEqual(['spending']); // the only commission with a handle today; test-fixture is a fixture topic, not a commission
    const d = fresh(standard());
    const lockDir = join(d.root, '.automation', DISCOVERY_DIR);
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(
      join(lockDir, 'lock.json'),
      '{"runId":"x","pid":1,"host":"h","startedAt":"s","heartbeatAt":"s","command":"discovery"}',
    );
    const held = await discover(a, d.deps({ alive: () => true }), d.root);
    expect(held.outcome).toBe('held');
    expect(readFileSync(join(lockDir, 'lock.json'), 'utf8')).toContain('"pid":1');
    const rec: DiscoveryRecord | null = readDiscovery(d.root, '2026-11-06');
    expect(rec).toBeNull();
  }, 180_000);
});
