// The four public finding labels (plan D3): what a visitor reads on every claim. Derived from the verdict the report
// already decided; no judgment happens here, and an AI guess can only ever be a reported claim.
import { STRONG } from './evidence';
import type { ClaimView } from './topics';

export const FINDING_LABELS = ['verified', 'qualification', 'unresolved', 'reported'] as const;
export type FindingLabel = (typeof FINDING_LABELS)[number];
export const VERIFIED_MIN = STRONG;

export const FINDING_TEXT: Record<FindingLabel, { name: string; meaning: string }> = {
  verified: { name: 'Verified finding', meaning: 'A study decides it, either way.' },
  qualification: { name: 'Qualification', meaning: 'True only under conditions, or partly.' },
  unresolved: { name: 'Unresolved question', meaning: 'Studied but not settled.' },
  reported: { name: 'Reported claim', meaning: 'What the videos and posts say. No study has decided it.' },
};

type Judged = Pick<ClaimView, 'verdict' | 'confidence' | 'decidedBy'>;

export function findingLabel(c: Judged): FindingLabel {
  if (!c.decidedBy) return 'reported';
  if (c.verdict === 'partly') return 'qualification';
  if ((c.verdict === 'right' || c.verdict === 'wrong') && (c.confidence ?? 0) >= VERIFIED_MIN) return 'verified';
  return 'unresolved';
}

export function labelCounts(claims: Judged[]): Record<FindingLabel, number> {
  const n = Object.fromEntries(FINDING_LABELS.map((l) => [l, 0])) as Record<FindingLabel, number>;
  for (const c of claims) n[findingLabel(c)]++;
  return n;
}
