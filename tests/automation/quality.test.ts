// Criterion 16 (spec §5.5, §13): weak work is parked, not escalated. The proposal rows (phase 4): the padded
// proposal is invalid before any person sees it; a proposal without an independent review is never batched; a weak
// or `fit: false` proposal is parked with the reviewer's reason, absent from the batch mail and present in the
// digest's parked list. Phase 5 appends the topic and script rows. These pin the instruments as they are.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { ROOT, readJson, toJson, writeJsonAtomic } from '../../src/shared/io';
import type { Proposal, ProposalReview } from '../../src/shared/types';
import {
  PROPOSALS_DIR,
  batchOf,
  loadProposals,
  proposalPath,
  reviewPath,
  validateProposal,
} from '../../src/modules/topic-discovery';
import { renderDigest } from '../../src/orchestration/run/digest';
import { proposalsDigest } from '../../src/orchestration/run/discovery-state';
import { renderBatch } from '../../src/orchestration/run/requests';

const FIX = join(ROOT, 'tests', 'fixtures', 'proposals');
const good = () => readJson<Proposal>(join(FIX, 'good.json'))!;
const review = () => readJson<ProposalReview>(join(FIX, 'good.review.json'))!;
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe('criterion 16: proposals', () => {
  it('16a: the padded proposal is invalid by code (near-identical claims, duplicate URLs, flat scores)', () => {
    const padded = readJson<Proposal>(join(FIX, 'padded.json'))!;
    const problems = validateProposal(
      padded,
      { topics: ['heat-pumps'], questions: [], commissions: ['spending'] },
      DEFAULTS.topics,
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it('16b and 16c: an unreviewed proposal is never batched; a weak or fit-false one is parked with the reason, absent from the batch mail and present in the digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-quality-'));
    roots.push(root);
    mkdirSync(join(root, PROPOSALS_DIR), { recursive: true });
    const put = (p: Proposal, r: ProposalReview | null) => {
      writeJsonAtomic(proposalPath(p.slug, root), p);
      if (r) writeJsonAtomic(reviewPath(p.slug, root), r);
    };
    put(good(), review());
    put({ ...good(), slug: 'no-review', question: 'Is a used electric car the better buy for most households?' }, null);
    put(
      { ...good(), slug: 'wrong-remit', question: 'Which supermarket is cheapest this year?' },
      {
        ...review(),
        slug: 'wrong-remit',
        fit: false,
        concerns: ['Not what things cost to own: a shopping comparison.'],
      },
    );
    put(
      {
        ...good(),
        slug: 'low-scores',
        question: 'Do loyalty cards save money?',
        scores: { evidence: 0.3, checkability: 0.4, depth: 0.3, fit: 0.6, novelty: 0.5 },
      },
      {
        ...review(),
        slug: 'low-scores',
        scores: { evidence: 0.4, checkability: 0.4, depth: 0.3, fit: 0.7, novelty: 0.5 },
      },
    );
    const at = '2026-11-06T15:00:00.000Z';
    const batch = batchOf(loadProposals(root), DEFAULTS.topics, 'a-test-secret-of-some-length', at);
    expect(batch.listed.map((x) => x.slug)).toEqual(['ev-running-costs']);
    expect(batch.unreviewed).toEqual(['no-review']);
    expect(batch.parked.map((x) => x.slug).sort()).toEqual(['low-scores', 'wrong-remit']);
    expect(batch.parked.find((x) => x.slug === 'wrong-remit')!.why).toMatch(
      /would not publish it: Not what things cost/,
    );
    expect(batch.parked.find((x) => x.slug === 'low-scores')!.why).toMatch(/under 0\.6/);
    for (const f of batch.files) writeJsonAtomic(proposalPath(f.slug, root), f);
    expect(readJson<Proposal>(proposalPath('wrong-remit', root))!.status).toBe('parked');
    expect(readJson<Proposal>(proposalPath('no-review', root))!.status).toBe('proposed'); // neither listed nor parked
    // the batch mail names the strong one only; the parked appear under "no reply needed" without a reply line
    mkdirSync(join(root, '.automation', 'discovery'), { recursive: true });
    writeFileSync(
      join(root, '.automation', 'discovery', '2026-11-06.json'),
      toJson({
        slot: '2026-11-06',
        startedAt: at,
        finishedAt: at,
        institutions: {},
        batch: { id: batch.id, listed: batch.listed, parked: batch.parked, unreviewed: batch.unreviewed, invalid: [] },
        emailed: false,
        costUsd: 0,
      }),
      { flag: 'wx' },
    );
    const mail = renderBatch(root, batch.id, a);
    expect(mail.text).toContain('APPROVE ev-running-costs');
    expect(mail.text).not.toContain('APPROVE wrong-remit');
    expect(mail.text).not.toContain('APPROVE low-scores');
    expect(mail.text).not.toContain('APPROVE no-review');
    expect(mail.text).toMatch(/Parked, no reply needed[\s\S]*wrong-remit[\s\S]*Not what things cost/);
    // the digest lists the parked ones with their reason and the pending one
    const digest = renderDigest([], { proposals: proposalsDigest(root) }, a);
    expect(digest.text).toMatch(/Parked[\s\S]*proposal wrong-remit: .*Not what things cost/);
    expect(digest.text).toMatch(/proposal low-scores/);
    expect(digest.text).toMatch(/Proposals pending[\s\S]*ev-running-costs/);
    expect(digest.text).not.toMatch(/Proposals pending[\s\S]*no-review/);
  });
});
