// Words for a verdict badge: a certainty adverb from the confidence band, then the verdict.
// Bands (confidence in the verdict): >= .9 almost certainly, .75-.89 very likely, .6-.74 probably,
// below .6 "leans" (an AI guess is capped at .5, so every unverified guess reads as a lean).
import type { Verdict } from './topics';

export type VerdictLabel = { text: string; colour: string };

const WORD: Record<'right' | 'wrong' | 'partly', string> = { right: 'right', wrong: 'wrong', partly: 'partly right' };
// Four strengths per verdict colour; the lean band also gets a dashed border, so a guess never looks settled.
const TONE = {
  right: ['text-success', 'text-success/85', 'text-success/70', 'text-success/60 border-dashed'],
  wrong: ['text-destructive', 'text-destructive/85', 'text-destructive/70', 'text-destructive/60 border-dashed'],
  partly: ['text-warning', 'text-warning/85', 'text-warning/70', 'text-warning/60 border-dashed'],
};
export const BANDS = [
  { min: 0.9, adverb: 'Almost certainly' },
  { min: 0.75, adverb: 'Very likely' },
  { min: 0.6, adverb: 'Probably' },
  { min: 0, adverb: 'Leans' },
];

export function verdictLabel(verdict: Verdict | null, confidence?: number | null): VerdictLabel {
  if (verdict === null) return { text: 'Unjudged', colour: 'text-muted-foreground' };
  if (verdict === 'untestable' || verdict === 'unknown')
    return { text: verdict[0].toUpperCase() + verdict.slice(1), colour: 'text-muted-foreground' };
  const band = BANDS.findIndex((b) => (confidence ?? 0) >= b.min);
  return { text: `${BANDS[band].adverb} ${WORD[verdict]}`, colour: TONE[verdict][band] };
}
