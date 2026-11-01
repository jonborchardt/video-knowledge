// `npm run topics` as a child (spec §5.1, §7.1): decisions are a person's and idempotent, parking is code's, the batch
// parks the weak and lists the strong per institution with one id, and the two agent roles touch one file each.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/shared/automation';
import { runCli } from '../src/shared/cli';
import { readJson, toJson } from '../src/shared/io';
import type { Proposal, ProposalReview } from '../src/shared/types';
import { PROPOSALS_DIR, proposalPath, reviewPath } from '../src/modules/topic-discovery/proposals';
import { agentArgs } from '../src/orchestration/run/agent';
import { grantFor } from '../src/orchestration/run/roles';
import { cliRoot } from './production-helpers';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'proposals');
const good = () => readJson<Proposal>(join(FIX, 'good.json'))!;
const goodReview = () => readJson<ProposalReview>(join(FIX, 'good.review.json'))!;
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })), 60_000);

function fresh() {
  const root = mkdtempSync(join(tmpdir(), 'vk-topics-cli-'));
  roots.push(root);
  cliRoot(root);
  mkdirSync(join(root, PROPOSALS_DIR), { recursive: true });
  const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: 'a-test-secret-of-some-length' };
  const topics = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
    runCli('topics', args, { cwd: root, env: { ...env, ...extra } });
  const put = (p: Proposal, r: ProposalReview | null = goodReview()) => {
    writeFileSync(proposalPath(p.slug, root), toJson(p));
    if (r) writeFileSync(reviewPath(p.slug, root), toJson({ ...r, slug: p.slug }));
  };
  const read = (slug: string) => readJson<Proposal>(proposalPath(slug, root))!;
  return { root, topics, put, read };
}
/** A strong proposal under another slug and question (the question rule forbids a repeat). */
const variant = (slug: string, question: string, extra: Partial<Proposal> = {}): Proposal => ({
  ...good(),
  slug,
  question,
  ...extra,
});

describe('npm run topics', () => {
  it('approve records the person, the note and the via, is idempotent, refuses an automated actor and a proposal without a review', () => {
    const c = fresh();
    c.put(good());
    c.put(variant('no-review', 'Is a used electric car a better buy than a new petrol car for most households?'), null);
    const r = c.topics(['approve', 'ev-running-costs', '--by', 'Jon', '--note', 'yes please', '--via', 'email:<m1@x>']);
    expect(r.status, r.stderr).toBe(0);
    expect(c.read('ev-running-costs')).toMatchObject({
      status: 'approved',
      decidedBy: 'Jon',
      note: 'yes please',
      via: { channel: 'email', messageId: '<m1@x>' },
    });
    expect(c.read('ev-running-costs').decidedAt).toMatch(/^\d{4}-/);
    const again = c.topics(['approve', 'ev-running-costs', '--by', 'Someone Else']);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/already approved by Jon/);
    expect(c.read('ev-running-costs').decidedBy).toBe('Jon');
    const auto = c.topics(['approve', 'no-review', '--by', 'automated: discovery']);
    expect(auto.status).toBe(2);
    expect(auto.stderr).toMatch(/person/);
    const unreviewed = c.topics(['approve', 'no-review', '--by', 'Jon']);
    expect(unreviewed.status).toBe(2);
    expect(unreviewed.stderr).toMatch(/review/);
    expect(c.read('no-review').status).toBe('proposed');
    expect(c.topics(['approve', 'nothing-here', '--by', 'Jon']).status).toBe(2);
    expect(c.topics(['validate', 'ev-running-costs']).status).toBe(0);
    expect(c.topics(['validate', 'ev-running-costs', '--review']).status).toBe(0);
    expect(c.topics(['validate', 'no-review', '--review']).status).toBe(2);
  }, 120_000);

  it('reject needs a note; park writes the reason, allows an automated actor and is idempotent; a later approve un-parks', () => {
    const c = fresh();
    c.put(good());
    expect(c.topics(['reject', 'ev-running-costs', '--by', 'Jon']).status).toBe(2);
    const r = c.topics(['reject', 'ev-running-costs', '--by', 'Jon', '--note', 'too close to the batteries matter']);
    expect(r.status, r.stderr).toBe(0);
    expect(c.read('ev-running-costs')).toMatchObject({ status: 'rejected', note: 'too close to the batteries matter' });
    c.put(variant('thin-one', 'Does leasing a car cost more than buying it over five years?'));
    const p = c.topics(['park', 'thin-one', '--why', 'the studies are thin', '--by', 'automated: topic run r1']);
    expect(p.status, p.stderr).toBe(0);
    expect(c.read('thin-one')).toMatchObject({ status: 'parked', parkedWhy: 'the studies are thin' });
    const p2 = c.topics(['park', 'thin-one', '--why', 'another reason']);
    expect(p2.status).toBe(0);
    expect(p2.stdout).toMatch(/already parked/);
    expect(c.read('thin-one').parkedWhy).toBe('the studies are thin');
    const un = c.topics(['approve', 'thin-one', '--by', 'Jon', '--note', 'I added sources by hand']);
    expect(un.status, un.stderr).toBe(0);
    expect(c.read('thin-one')).toMatchObject({ status: 'approved', decidedBy: 'Jon' });
    expect(c.read('thin-one').parkedWhy).toBeUndefined();
  }, 120_000);

  it("batch: --dry-run lists at most two strong per institution and writes nothing; batch parks the weak with the reviewer's first concern and writes one id into each listed file", () => {
    const c = fresh();
    c.put(good());
    c.put(variant('ev-two', 'Does a heat pump need a bigger electricity supply than most homes have?'));
    c.put(
      variant('ev-three', 'Is solar with a battery a better investment than solar alone for a typical household?', {
        scores: { evidence: 0.7, checkability: 0.7, depth: 0.6, fit: 0.7, novelty: 0.5 },
      }),
    );
    c.put(
      variant('weak-fit', 'Which supermarket is cheapest for a weekly shop this year?', {
        institution: 'dubious-returns',
      }),
      {
        ...goodReview(),
        fit: false,
        concerns: ["Not a promised-returns question: the Commission on Spending's remit, not this one."],
      },
    );
    c.put(
      variant('other-strong', 'Do day-trading courses deliver the returns they advertise to beginners?', {
        institution: 'dubious-returns',
      }),
    );
    c.put(variant('unreviewed', 'Are extended warranties on appliances ever worth their price?'), null);
    const dry = c.topics(['batch', '--dry-run']);
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stdout).toMatch(/spending: ev-running-costs, ev-two/);
    expect(dry.stdout).toMatch(/dubious-returns: other-strong/);
    expect(dry.stdout).not.toMatch(/ev-three/); // the third strong one waits for the next batch
    expect(dry.stdout).toMatch(/parked.*weak-fit/);
    expect(dry.stdout).toMatch(/unreviewed/);
    expect(c.read('weak-fit').status).toBe('proposed'); // a dry run writes nothing
    expect(c.read('ev-running-costs').batch).toBeUndefined();
    const real = c.topics(['batch']);
    expect(real.status, real.stderr).toBe(0);
    const out = JSON.parse(real.stdout) as {
      id: string;
      listed: { slug: string; institution: string }[];
      parked: { slug: string; why: string }[];
      unreviewed: string[];
    };
    expect(out.id).toMatch(/^pb-[0-9a-f]{12}$/);
    expect(out.listed.map((x) => x.slug)).toEqual(['ev-running-costs', 'ev-two', 'other-strong']);
    expect(out.parked).toEqual([
      { slug: 'weak-fit', why: expect.stringMatching(/would not publish it: Not a promised-returns/) },
    ]);
    expect(out.unreviewed).toEqual(['unreviewed']);
    expect(c.read('weak-fit')).toMatchObject({ status: 'parked' });
    for (const slug of ['ev-running-costs', 'ev-two', 'other-strong'])
      expect(c.read(slug).batch).toMatchObject({ id: out.id, messageId: '' });
    expect(c.read('ev-three').batch).toBeUndefined();
    const sent = c.topics(['sent', out.id, '--message-id', '<b1@x>']);
    expect(sent.status, sent.stderr).toBe(0);
    expect(c.read('ev-two').batch?.messageId).toBe('<b1@x>');
    // the next batch lists ev-three and keeps the earlier id in the re-listed ones' history
    const next = JSON.parse(c.topics(['batch']).stdout) as { id: string; listed: { slug: string }[] };
    expect(next.id).not.toBe(out.id);
    expect(next.listed.map((x) => x.slug)).toEqual(['ev-running-costs', 'ev-two', 'other-strong']); // still two per institution, ranked
    expect(c.read('ev-running-costs').batch?.previous).toEqual([out.id]);
    // without the secret a real batch is refused and writes nothing
    const noSecret = c.topics(['batch'], { APPROVAL_SECRET: '' });
    expect(noSecret.status).toBe(2);
    expect(noSecret.stderr).toMatch(/APPROVAL_SECRET/);
  }, 120_000);

  it("show ranks the proposals with the reviewer's overall; context prints the institution, the topics and the earlier proposals", () => {
    const c = fresh();
    c.put(good());
    c.put(
      variant('rejected-one', 'Are store loyalty cards worth the data they collect?', {
        status: 'rejected',
        decidedBy: 'Jon',
        note: 'done before',
      }),
    );
    const show = c.topics(['show']);
    expect(show.status, show.stderr).toBe(0);
    expect(show.stdout).toMatch(/ev-running-costs/);
    expect(show.stdout).toMatch(/0\.7[0-9]/);
    const one = c.topics(['show', 'ev-running-costs']);
    expect(one.stdout).toMatch(/The question is one a viewer/);
    const ctx = c.topics(['context', 'spending']);
    expect(ctx.status, ctx.stderr).toBe(0);
    expect(ctx.stdout).toMatch(/Commission on Spending/);
    expect(ctx.stdout).toMatch(/What things actually cost/);
    expect(ctx.stdout).toMatch(/rejected-one.*rejected/);
    expect(c.topics(['context', 'nobody']).status).toBe(2);
  }, 120_000);

  it('the two agent roles have no shell, and one Edit rule each naming different files', () => {
    const a = { ...DEFAULTS, agents: { ...DEFAULTS.agents, command: 'claude' } };
    const req = (role: 'discovery' | 'proposalReview') => ({
      role,
      subject: { topic: 'proposals', slug: 'ev-running-costs' },
      prompt: 'x',
      cwd: '.',
      budgetUsd: 1,
      timeoutMs: 1000,
      appendSystem: 'u',
    });
    const d = agentArgs(a, req('discovery'));
    const r = agentArgs(a, req('proposalReview'));
    for (const args of [d, r]) expect(args.some((x) => x.startsWith('Bash('))).toBe(false);
    const allowed = (args: string[]) =>
      args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'));
    const edits = (args: string[]) => allowed(args).filter((x) => x.startsWith('Edit('));
    expect(edits(d)).toEqual(['Edit(proposals/*.json)']);
    expect(edits(r)).toEqual(['Edit(proposals/ev-running-costs.review.json)']);
    expect(grantFor('discovery', { topic: 'proposals' }).newFilesOnly).toEqual(['proposals/*.json']);
  });
});
