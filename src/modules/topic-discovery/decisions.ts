// Decisions on proposals (spec §5.1, §7.1): a person approves or rejects (never an automated actor), code or the
// topic runner parks with a reason, and the weekly batch parks the weak and lists the strong per institution under
// one id. Pure over parsed files; the CLI writes what these return.
import type { Automation } from '../../shared/automation';
import { requestId } from '../../shared/request';
import type { Proposal, ProposalReview } from '../../shared/types';
import { type Proposed, type Ranked, rank, weakWhy } from './proposals';

export type DecisionStatus = 'approved' | 'rejected';
export interface Decision {
  status: DecisionStatus;
  by: string;
  at: string;
  note?: string;
  via?: { channel: string; messageId?: string };
}
export type Decided = { proposal: Proposal; changed: boolean; message: string } | { problem: string };

export const isAutomated = (by: string): boolean => by.trim().toLowerCase().startsWith('automated:');

/** A person's decision on a proposal: the same decision again changes nothing (idempotent); a different one from a
 *  person replaces it (a rejected proposal may be approved later, a parked one un-parked). */
export function decideProposal(p: Proposal, review: ProposalReview | null, d: Decision): Decided {
  if (!d.by.trim()) return { problem: 'a decision needs --by <name>' };
  if (isAutomated(d.by)) return { problem: `only a person approves or rejects a proposal (got "${d.by}")` };
  if (!review) return { problem: `${p.slug} has no independent review yet: it cannot be decided` };
  if (d.status === 'rejected' && !d.note?.trim()) return { problem: 'a rejection needs --note <why>' };
  if (p.status === d.status)
    return {
      proposal: p,
      changed: false,
      message: `${p.slug}: already ${p.status} by ${p.decidedBy ?? 'unknown'} at ${p.decidedAt ?? '?'}`,
    };
  const { parkedWhy: _parked, ...rest } = p;
  const next: Proposal = {
    ...rest,
    status: d.status,
    decidedBy: d.by,
    decidedAt: d.at,
    ...(d.note?.trim() ? { note: d.note.trim() } : {}),
    ...(d.via ? { via: d.via } : {}),
  };
  if (!d.note?.trim()) delete next.note;
  return { proposal: next, changed: true, message: `${p.slug}: ${d.status} by ${d.by}` };
}

/** Code's or the topic runner's parking: an automated actor is allowed; a parked proposal stays as first parked. */
export function parkProposal(p: Proposal, why: string, by: string, at: string): Decided {
  if (!why.trim()) return { problem: 'parking needs --why <text>' };
  if (p.status === 'parked')
    return { proposal: p, changed: false, message: `${p.slug}: already parked: ${p.parkedWhy ?? ''}`.trimEnd() };
  return {
    proposal: { ...p, status: 'parked', parkedWhy: why.trim(), decidedBy: by, decidedAt: at },
    changed: true,
    message: `${p.slug}: parked: ${why.trim()}`,
  };
}

export interface BatchListed {
  slug: string;
  institution: string;
  question: string;
  overall: number;
  proposerOverall: number;
  reviewerOverall: number;
  verdict: string;
  concerns: string[];
  rationale: string;
  overlap: Proposal['overlap'];
  sources: Proposal['sources'];
}
export interface Batch {
  id: string;
  at: string;
  listed: BatchListed[];
  parked: { slug: string; why: string }[];
  unreviewed: string[];
  /** The proposals as the batch leaves them (the parked ones and the listed ones with their batch field). */
  files: Proposal[];
}

/** The week's batch over the `proposed` proposals: every weak one parked with its reason, the strong ranked and the
 *  top `proposalsPerInstitution` per institution listed under one id (`requestId('pb', ...)`; `dry-run` without a
 *  secret); an unreviewed one is neither listed nor parked. Invalid proposals are the caller's to leave out. */
export function batchOf(
  proposed: Proposed[],
  a: Automation['topics'],
  secret: string | null,
  at: string,
  by = 'automated: topics batch',
): Batch {
  const open = proposed.filter((x) => x.proposal.status === 'proposed');
  const ranked = rank(open, a);
  const files: Proposal[] = [];
  const parked: Batch['parked'] = [];
  const unreviewed: string[] = [];
  const perInstitution = new Map<string, number>();
  const listed: Ranked[] = [];
  for (const r of ranked) {
    const review = open.find((x) => x.proposal.slug === r.slug)!.review;
    if (r.unreviewed) {
      unreviewed.push(r.slug);
      continue;
    }
    if (r.weak) {
      const why = weakWhy(r, review, a);
      const d = parkProposal(open.find((x) => x.proposal.slug === r.slug)!.proposal, why, by, at);
      if ('proposal' in d) files.push(d.proposal);
      parked.push({ slug: r.slug, why });
      continue;
    }
    const n = perInstitution.get(r.institution) ?? 0;
    if (n >= a.proposalsPerInstitution) continue;
    perInstitution.set(r.institution, n + 1);
    listed.push(r);
  }
  const slugs = listed.map((r) => r.slug);
  const id = secret ? requestId('pb', secret, slugs.join(','), at) : 'dry-run';
  for (const r of listed) {
    const { overall: _o, proposerOverall: _p, reviewerOverall: _r, weak: _w, unreviewed: _u, ...proposal } = r;
    const previous = proposal.batch ? [...(proposal.batch.previous ?? []), proposal.batch.id] : [];
    files.push({
      ...(proposal as Proposal),
      batch: { id, sentAt: at, messageId: '', ...(previous.length ? { previous } : {}) },
    });
  }
  return {
    id,
    at,
    listed: listed.map((r) => {
      const review = open.find((x) => x.proposal.slug === r.slug)!.review!;
      return {
        slug: r.slug,
        institution: r.institution,
        question: r.question,
        overall: r.overall,
        proposerOverall: r.proposerOverall,
        reviewerOverall: r.reviewerOverall,
        verdict: review.verdict,
        concerns: review.concerns,
        rationale: r.rationale,
        overlap: r.overlap,
        sources: r.sources.slice(0, 3),
      };
    }),
    parked,
    unreviewed,
    files,
  };
}
