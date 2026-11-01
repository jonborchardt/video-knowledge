// Proposals (spec §5.1): what a topic proposal is, what makes one valid, how a proposal and its independent review
// rank, and what the board reads about one. Pure over parsed files; the CLI (cli.ts) is the only writer of a
// proposal's status. Nothing here researches, fetches or touches a store: a proposal is a question an institution
// might ask, with the claims the public makes and where the evidence would come from.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Automation, loadAutomation } from '../../shared/automation';
import { commissions } from '../../config/site';
import type { Inspection } from '../../shared/inspect';
import { ROOT, readJson, topicsDir } from '../../shared/io';
import type { Proposal, ProposalReview, ProposalScores, ProposalStatus } from '../../shared/types';
import { loadStories } from '../stories';

export const PROPOSALS_DIR = 'proposals';
export const proposalPath = (slug: string, root = ROOT) => join(root, PROPOSALS_DIR, `${slug}.json`);
export const reviewPath = (slug: string, root = ROOT) => join(root, PROPOSALS_DIR, `${slug}.review.json`);

export interface Proposed {
  proposal: Proposal;
  review: ProposalReview | null;
}
/** Every proposal on disk with its review (null without one), by slug. */
export function loadProposals(root = ROOT): Proposed[] {
  const dir = join(root, PROPOSALS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json') && !n.endsWith('.review.json'))
    .map((n) => n.slice(0, -'.json'.length))
    .sort()
    .flatMap((slug) => {
      const proposal = readJson<Proposal>(proposalPath(slug, root));
      return proposal ? [{ proposal, review: readJson<ProposalReview>(reviewPath(slug, root)) }] : [];
    });
}

/** What a proposal is validated against: the topics that exist, the questions existing stories ask, the commissions. */
export interface Existing {
  topics: string[];
  questions: string[];
  commissions: string[];
}
/** The existing topics, story questions and commissions under a root. */
export function existingOf(root = ROOT): Existing {
  const dir = topicsDir(root);
  const topics = existsSync(dir) ? readdirSync(dir).filter((t) => existsSync(join(dir, t))) : [];
  const questions = topics.flatMap((t) => (loadStories(t, root)?.stories ?? []).map((s) => s.question));
  return { topics, questions, commissions: Object.keys(commissions) };
}

const SLUG = /^[a-z0-9-]{3,40}$/;
const STATUSES: ProposalStatus[] = ['proposed', 'approved', 'rejected', 'parked'];
const SCORE_KEYS: (keyof ProposalScores)[] = ['evidence', 'checkability', 'depth', 'fit', 'novelty'];
const MIN_CLAIMS = 5;
const MIN_SOURCES = 8;
const MIN_STUDIES = 4;
const MIN_WORDS = 40;
/** A claim's verb, loosely: an auxiliary or modal, or a later token ending in -s, -ed or -ing. The reviewer judges
 *  the claim; this keeps a list of noun phrases from counting as claims. */
const VERB =
  /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|will|would|should|may|might|must|need|needs)\b|\s\w{3,}(s|ed|ing)\b/i;

export const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === 'string';

function scoreProblems(scores: unknown, where: string): string[] {
  if (!isObj(scores)) return [`${where}scores is not an object`];
  const out: string[] = [];
  for (const k of SCORE_KEYS) {
    const v = scores[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
      out.push(`${where}scores.${k} is not a number in [0, 1]`);
  }
  return out;
}
function linkProblems(list: unknown, name: string, min: number, seen: Set<string>): string[] {
  if (!Array.isArray(list)) return [`${name} is not an array`];
  const out: string[] = [];
  if (list.length < min) out.push(`at least ${min} ${name} are needed (${list.length} given)`);
  list.forEach((x, i) => {
    if (!isObj(x) || !str(x.url) || !str(x.title) || !x.title.trim()) {
      out.push(`${name}[${i}] needs a url and a title`);
      return;
    }
    if (!/^https:\/\/\S+$/.test(x.url)) out.push(`${name}[${i}] URL is not https: ${x.url}`);
    const key = x.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) out.push(`${name}[${i}] duplicates an earlier URL: ${x.url}`);
    seen.add(key);
  });
  return out;
}

/** Every problem with a proposal (empty: valid). Schema, the slug, the institution, the claims, the links, the
 *  scores, the question against existing stories, the prose. `a` is automation.json's `topics` block. */
export function validateProposal(p: unknown, existing: Existing, a: Automation['topics']): string[] {
  void a;
  if (!isObj(p)) return ['the proposal is not an object'];
  const out: string[] = [];
  if (!str(p.slug) || !SLUG.test(p.slug)) out.push(`slug must match ${SLUG} (got ${JSON.stringify(p.slug)})`);
  else if (existing.topics.includes(p.slug)) out.push(`slug ${p.slug} is an existing topic`);
  if (!str(p.institution) || !existing.commissions.includes(p.institution))
    out.push(`institution must be one of ${existing.commissions.join(', ')} (got ${JSON.stringify(p.institution)})`);
  if (!str(p.question) || words(p.question) < 4) out.push('question must be one line of at least four words');
  else if (existing.questions.some((q) => normalise(q) === normalise(p.question as string)))
    out.push(`question restates an existing story's question: ${p.question}`);
  for (const k of ['rationale', 'fit'] as const)
    if (!str(p[k]) || words(p[k] as string) < MIN_WORDS) out.push(`${k} must be at least ${MIN_WORDS} words`);
  if (!Array.isArray(p.claims)) out.push('claims is not an array');
  else {
    if (p.claims.length < MIN_CLAIMS) out.push(`at least ${MIN_CLAIMS} claims are needed (${p.claims.length} given)`);
    const seen = new Set<string>();
    p.claims.forEach((c, i) => {
      if (!str(c)) return out.push(`claims[${i}] is not a string`);
      if (words(c) < 6 || !VERB.test(c)) out.push(`claims[${i}] needs at least six words and a verb: ${c}`);
      const n = normalise(c);
      if (seen.has(n)) out.push(`claims[${i}] is the same claim as an earlier one after normalisation: ${c}`);
      seen.add(n);
    });
  }
  const urls = new Set<string>();
  out.push(...linkProblems(p.sources, 'sources', MIN_SOURCES, urls));
  out.push(...linkProblems(p.studies, 'studies', MIN_STUDIES, urls));
  if (
    !isObj(p.overlap) ||
    !Array.isArray(p.overlap.topics) ||
    !Array.isArray(p.overlap.stories) ||
    !str(p.overlap.note)
  )
    out.push('overlap needs topics[], stories[] and a note');
  const sp = scoreProblems(p.scores, '');
  out.push(...sp);
  if (!sp.length) {
    const values = SCORE_KEYS.map((k) => (p.scores as ProposalScores)[k]);
    if (new Set(values).size === 1) out.push('scores are not differentiated (every dimension is the same number)');
  }
  if (!isObj(p.generation) || !str(p.generation.model) || !str(p.generation.brief) || !str(p.generation.date))
    out.push('generation needs model, brief and date');
  if (!str(p.status) || !STATUSES.includes(p.status as ProposalStatus))
    out.push(`status must be one of ${STATUSES.join(', ')}`);
  return out;
}

/** Every problem with a review of `p` (empty: valid). */
export function validateReview(r: unknown, p: Proposal): string[] {
  if (!isObj(r)) return ['the review is not an object'];
  const out: string[] = [];
  if (r.slug !== p.slug) out.push(`review slug ${JSON.stringify(r.slug)} is not the proposal's ${p.slug}`);
  if (typeof r.fit !== 'boolean') out.push('fit must be true or false');
  if (!str(r.verdict) || words(r.verdict) < MIN_WORDS)
    out.push(`verdict must be at least ${MIN_WORDS} words a person can check`);
  if (!Array.isArray(r.concerns) || r.concerns.some((c) => !str(c))) out.push('concerns must be an array of strings');
  out.push(...scoreProblems(r.scores, 'review '));
  if (!str(r.reviewer) || !r.reviewer.trim()) out.push('reviewer is missing');
  if (!str(r.date)) out.push('date is missing');
  return out;
}

/** One side's overall: evidence and checkability weigh double. */
export const overallOf = (s: ProposalScores): number =>
  (2 * s.evidence + 2 * s.checkability + s.depth + s.fit + s.novelty) / 7;

export interface Ranked extends Proposal {
  overall: number; // the mean of both sides (the proposer's alone when unreviewed)
  proposerOverall: number;
  reviewerOverall: number; // 0 when unreviewed
  weak: boolean;
  unreviewed: boolean;
}
/** Ranked by the mean of both overalls, descending; weak when either side is under `minOverall` or the reviewer says
 *  the institution would not publish it; an unreviewed proposal is weak and last (it is never batched). */
export function rank(ps: Proposed[], a: Automation['topics']): Ranked[] {
  const rows = ps.map(({ proposal, review }): Ranked => {
    const proposerOverall = overallOf(proposal.scores);
    const reviewerOverall = review ? overallOf(review.scores) : 0;
    const unreviewed = review === null;
    const weak = unreviewed || proposerOverall < a.minOverall || reviewerOverall < a.minOverall || !review!.fit;
    return {
      ...proposal,
      overall: unreviewed ? proposerOverall : (proposerOverall + reviewerOverall) / 2,
      proposerOverall,
      reviewerOverall,
      weak,
      unreviewed,
    };
  });
  return rows.sort(
    (x, y) =>
      Number(x.unreviewed) - Number(y.unreviewed) ||
      y.overall - x.overall ||
      Number(x.weak) - Number(y.weak) ||
      x.slug.localeCompare(y.slug),
  );
}

export type ProposalCode =
  'missing' | 'invalid' | 'unreviewed' | 'proposed' | 'weak' | 'approved' | 'researched' | 'rejected' | 'parked';

/** A topic counts as researched once its stories.json has a ready story. */
export const researched = (slug: string, root = ROOT): boolean =>
  (loadStories(slug, root)?.stories ?? []).some((s) => s.readiness === 'ready');

/** The board's view of one proposal: `missing` (no file, or no review yet: code `unreviewed`), `invalid` (the problems
 *  of either file), `ready` (a valid proposal in any status; the code says which: `proposed`, `weak`, `approved`,
 *  `rejected`, `parked`), `stale` (approved and researched: nothing left to do). */
export function inspectProposal(slug: string, root = ROOT, a: Automation = loadAutomation(root)): Inspection {
  const output = `${PROPOSALS_DIR}/${slug}.json`;
  const proposal = readJson<Proposal>(proposalPath(slug, root));
  if (!proposal) return { status: 'missing', code: 'missing', findings: [`no ${output}`] };
  const review = readJson<ProposalReview>(reviewPath(slug, root));
  const existing = existingOf(root);
  // the proposal's own slug is not "an existing topic" once it has been researched into one
  const problems = validateProposal(
    proposal,
    { ...existing, topics: existing.topics.filter((t) => t !== slug || proposal.status !== 'approved') },
    a.topics,
  );
  if (review) problems.push(...validateReview(review, proposal));
  if (problems.length) return { status: 'invalid', code: 'invalid', findings: problems, output };
  if (!review) return { status: 'missing', code: 'unreviewed', findings: ['no independent review yet'], output };
  if (proposal.status === 'approved') {
    if (researched(slug, root))
      return { status: 'stale', code: 'researched', findings: ['researched: a ready story exists'], output };
    return { status: 'ready', code: 'approved', findings: [], output };
  }
  if (proposal.status === 'rejected' || proposal.status === 'parked')
    return {
      status: 'ready',
      code: proposal.status,
      findings: [proposal.status === 'parked' ? (proposal.parkedWhy ?? 'parked') : (proposal.note ?? 'rejected')],
      output,
    };
  const [r] = rank([{ proposal, review }], a.topics);
  return {
    status: 'ready',
    code: r.weak ? 'weak' : 'proposed',
    findings: r.weak ? [weakWhy(r, review, a.topics)] : [],
    output,
  };
}

/** Why a proposal is weak, for `parkedWhy`: the reviewer's first concern when the fit or their score fails, else the
 *  failing score. */
export function weakWhy(r: Ranked, review: ProposalReview | null, a: Automation['topics']): string {
  if (!review) return 'no independent review';
  if (!review.fit)
    return `the reviewer says the institution would not publish it: ${review.concerns[0] ?? review.verdict.split('. ')[0]}`;
  if (r.reviewerOverall < a.minOverall)
    return `the reviewer's overall ${r.reviewerOverall.toFixed(2)} is under ${a.minOverall}: ${review.concerns[0] ?? review.verdict.split('. ')[0]}`;
  return `the proposer's overall ${r.proposerOverall.toFixed(2)} is under ${a.minOverall}`;
}
