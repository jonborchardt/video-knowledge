// The four public finding labels (plan D3): what a visitor reads on every claim. Derived from the verdict the report
// already decided; no judgment happens here, and an AI guess can only ever be a reported claim.
import { STRONG } from '../shared/evidence-gate';
import { FINDING_LABELS, type ClaimState, type FindingLabel } from '../shared/types';
import type { ClaimView } from './topics';

export { FINDING_LABELS, type FindingLabel };

export const FINDING_TEXT: Record<FindingLabel, { name: string; meaning: string }> = {
  verified: { name: 'Verified claim', meaning: 'A study decides it, either way.' },
  qualification: { name: 'Qualified claim', meaning: 'True only under conditions, or partly.' },
  unresolved: { name: 'Unresolved claim', meaning: 'Studied but not settled.' },
  reported: { name: 'Reported claim', meaning: 'What the videos and posts say. No study has decided it.' },
};

type Judged = Pick<ClaimView, 'verdict' | 'confidence' | 'decidedBy'>;

export function findingLabel(c: Judged): FindingLabel {
  if (!c.decidedBy) return 'reported';
  if (c.verdict === 'partly') return 'qualification';
  if ((c.verdict === 'right' || c.verdict === 'wrong') && (c.confidence ?? 0) >= STRONG) return 'verified';
  return 'unresolved';
}

export function labelCounts(claims: Judged[]): Record<FindingLabel, number> {
  const n = Object.fromEntries(FINDING_LABELS.map((l) => [l, 0])) as Record<FindingLabel, number>;
  for (const c of claims) n[findingLabel(c)]++;
  return n;
}

/** The ledger's view of a topic's claims (`nextPublicRecord`): labels are decided here, never in the ledger. */
export const ledgerClaims = (t: { claims: ClaimView[] }) =>
  t.claims.map((c) => ({
    id: c.id,
    sources: c.sources,
    state: { label: findingLabel(c), verdict: c.verdict } as ClaimState,
  }));

export const claimStates = (t: { claims: ClaimView[] }): Record<string, ClaimState> =>
  Object.fromEntries(ledgerClaims(t).map((c) => [c.id, c.state]));
