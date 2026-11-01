// Proposals (spec §5.1): validation of a proposal and of its independent review, ranking with the weak and the
// unreviewed marked, and the inspection the board reads. The padded fixture is criterion 16's adversarial proposal.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../../shared/automation';
import { readJson, toJson } from '../../../shared/io';
import type { Proposal, ProposalReview } from '../../../shared/types';
import {
  PROPOSALS_DIR,
  inspectProposal,
  loadProposals,
  proposalPath,
  rank,
  reviewPath,
  validateProposal,
  validateReview,
} from '../proposals';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'proposals');
const good = () => readJson<Proposal>(join(FIX, 'good.json'))!;
const goodReview = () => readJson<ProposalReview>(join(FIX, 'good.review.json'))!;
const padded = () => readJson<Proposal>(join(FIX, 'padded.json'))!;
const existing = {
  topics: ['heat-pumps', 'ai-coding'],
  questions: ['Is a heat pump cheaper to run than a gas boiler?'],
  commissions: ['spending', 'dubious-returns'],
};
const a = DEFAULTS.topics;
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-proposals-'));
  roots.push(root);
  mkdirSync(join(root, PROPOSALS_DIR), { recursive: true });
  return root;
};
const put = (root: string, p: Proposal, r: ProposalReview | null = null) => {
  writeFileSync(proposalPath(p.slug, root), toJson(p));
  if (r) writeFileSync(reviewPath(p.slug, root), toJson(r));
};

describe('validateProposal', () => {
  it('accepts the good fixture', () => {
    expect(validateProposal(good(), existing, a)).toEqual([]);
  });
  it('the padded proposal (near-identical claims, duplicate and non-https URLs, flat scores, thin prose) has at least three problems', () => {
    const problems = validateProposal(padded(), existing, a);
    expect(problems.length).toBeGreaterThanOrEqual(3);
    expect(problems.join('\n')).toMatch(/claims?.*(equal|same|duplicate)/i);
    expect(problems.join('\n')).toMatch(/URL/);
    expect(problems.join('\n')).toMatch(/scores are not differentiated/);
    expect(problems.join('\n')).toMatch(/rationale/);
  });
  it('refuses a slug that is an existing topic, an unknown institution, and a question an existing story asks', () => {
    expect(validateProposal({ ...good(), slug: 'heat-pumps' }, existing, a).join('\n')).toMatch(/slug.*existing topic/);
    expect(validateProposal({ ...good(), slug: 'Bad Slug' }, existing, a).join('\n')).toMatch(/slug/);
    expect(validateProposal({ ...good(), institution: 'nobody' }, existing, a).join('\n')).toMatch(/institution/);
    expect(
      validateProposal({ ...good(), question: 'Is a heat pump cheaper to run than a gas boiler??' }, existing, a).join(
        '\n',
      ),
    ).toMatch(/question.*existing story/);
  });
  it('refuses too few claims, a short claim, too few sources or studies, and a score out of range', () => {
    const g = good();
    expect(validateProposal({ ...g, claims: g.claims.slice(0, 4) }, existing, a).join('\n')).toMatch(
      /at least 5 claims/,
    );
    expect(validateProposal({ ...g, claims: [...g.claims.slice(0, 5), 'Too short.'] }, existing, a).join('\n')).toMatch(
      /six words/,
    );
    expect(validateProposal({ ...g, sources: g.sources.slice(0, 7) }, existing, a).join('\n')).toMatch(
      /at least 8 sources/,
    );
    expect(validateProposal({ ...g, studies: g.studies.slice(0, 3) }, existing, a).join('\n')).toMatch(
      /at least 4 stud/,
    );
    expect(validateProposal({ ...g, scores: { ...g.scores, depth: 1.2 } }, existing, a).join('\n')).toMatch(/depth/);
    expect(validateProposal({ ...g, status: 'nonsense' as never }, existing, a).join('\n')).toMatch(/status/);
    expect(validateProposal(null, existing, a).join('\n')).toMatch(/not an object/);
  });
});

describe('validateReview', () => {
  it('accepts the good review and refuses a slug mismatch, a short verdict and a score out of range', () => {
    expect(validateReview(goodReview(), good())).toEqual([]);
    expect(validateReview({ ...goodReview(), slug: 'other' }, good()).join('\n')).toMatch(/slug/);
    expect(validateReview({ ...goodReview(), verdict: 'Fine.' }, good()).join('\n')).toMatch(/verdict.*40 words/);
    expect(
      validateReview({ ...goodReview(), scores: { ...goodReview().scores, novelty: -0.1 } }, good()).join('\n'),
    ).toMatch(/novelty/);
    expect(validateReview({ ...goodReview(), concerns: 'none' as never }, good()).join('\n')).toMatch(/concerns/);
  });
});

describe('rank', () => {
  it('orders by the mean of both overalls, marks weak (a low side or fit false) and unreviewed (last)', () => {
    const g = good();
    const r = goodReview();
    const strong = { proposal: g, review: r };
    const lowReviewer = {
      proposal: { ...g, slug: 'low-reviewer' },
      review: {
        ...r,
        slug: 'low-reviewer',
        scores: { evidence: 0.4, checkability: 0.4, depth: 0.5, fit: 0.9, novelty: 0.5 },
      },
    };
    const noFit = { proposal: { ...g, slug: 'no-fit' }, review: { ...r, slug: 'no-fit', fit: false } };
    const unreviewed = { proposal: { ...g, slug: 'unreviewed' }, review: null };
    const ranked = rank([unreviewed, lowReviewer, noFit, strong], a);
    expect(ranked.map((x) => x.slug)).toEqual(['ev-running-costs', 'no-fit', 'low-reviewer', 'unreviewed']);
    expect(ranked[0].weak).toBe(false);
    expect(ranked[0].proposerOverall).toBeCloseTo(5.55 / 7, 3);
    expect(ranked[0].overall).toBeCloseTo((5.55 / 7 + 5.3 / 7) / 2, 3);
    expect(ranked[0].reviewerOverall).toBeCloseTo(0.7571, 3);
    expect(ranked.find((x) => x.slug === 'no-fit')!.weak).toBe(true);
    expect(ranked.find((x) => x.slug === 'low-reviewer')!.weak).toBe(true);
    expect(ranked.find((x) => x.slug === 'unreviewed')).toMatchObject({ weak: true, unreviewed: true });
  });
});

describe('inspectProposal and loadProposals', () => {
  it('codes: missing, unreviewed, proposed, weak, approved (ready), researched (stale), rejected, parked, invalid', () => {
    const root = fresh();
    const g = good();
    const r = goodReview();
    expect(inspectProposal('nothing', root, DEFAULTS)).toMatchObject({ status: 'missing', code: 'missing' });
    put(root, g);
    expect(inspectProposal(g.slug, root, DEFAULTS)).toMatchObject({ status: 'missing', code: 'unreviewed' });
    put(root, g, r);
    expect(inspectProposal(g.slug, root, DEFAULTS)).toMatchObject({ status: 'ready', code: 'proposed' });
    put(root, { ...g, slug: 'weak' }, { ...r, slug: 'weak', fit: false });
    expect(inspectProposal('weak', root, DEFAULTS)).toMatchObject({ status: 'ready', code: 'weak' });
    put(root, { ...g, slug: 'approved', status: 'approved', decidedBy: 'Jon' }, { ...r, slug: 'approved' });
    const ok = inspectProposal('approved', root, DEFAULTS);
    expect(ok).toMatchObject({ status: 'ready', code: 'approved' });
    expect(ok.output).toBe('proposals/approved.json');
    mkdirSync(join(root, 'topics', 'approved'), { recursive: true });
    writeFileSync(
      join(root, 'topics', 'approved', 'stories.json'),
      toJson({ stories: [{ id: 'decision:x', question: 'Q?', readiness: 'ready' }] }),
    );
    expect(inspectProposal('approved', root, DEFAULTS)).toMatchObject({ status: 'stale', code: 'researched' });
    put(root, { ...g, slug: 'rejected', status: 'rejected', decidedBy: 'Jon', note: 'no' }, { ...r, slug: 'rejected' });
    expect(inspectProposal('rejected', root, DEFAULTS)).toMatchObject({ status: 'ready', code: 'rejected' });
    put(root, { ...g, slug: 'parked', status: 'parked', parkedWhy: 'thin' }, { ...r, slug: 'parked' });
    expect(inspectProposal('parked', root, DEFAULTS)).toMatchObject({ status: 'ready', code: 'parked' });
    put(root, padded(), { ...r, slug: 'padded-topic' });
    const bad = inspectProposal('padded-topic', root, DEFAULTS);
    expect(bad.status).toBe('invalid');
    expect(bad.code).toBe('invalid');
    expect(bad.findings.length).toBeGreaterThanOrEqual(3);
    // a proposal whose question an existing story in this root already asks is invalid too
    mkdirSync(join(root, 'topics', 'heat-pumps'), { recursive: true });
    writeFileSync(
      join(root, 'topics', 'heat-pumps', 'stories.json'),
      toJson({ stories: [{ id: 'decision:y', question: g.question, readiness: 'needs-review' }] }),
    );
    expect(inspectProposal(g.slug, root, DEFAULTS).status).toBe('invalid');
    const all = loadProposals(root);
    expect(all.map((x) => x.proposal.slug).sort()).toEqual(
      ['approved', g.slug, 'padded-topic', 'parked', 'rejected', 'weak'].sort(),
    );
    expect(all.find((x) => x.proposal.slug === g.slug)!.review?.slug).toBe(g.slug);
  });
});
