// Bespoke kinds of heat-pumps/scripts/decision-when-does-it-pay-for-itself, named per scene in that video's
// render.json. Browser-safe.
import type { KindSpec } from '../kinds';

export const WHEN_DOES_IT_PAY = {
  'hp-methods': { component: 'EvidenceCards', accepts: ['diagram'] }, // national models and field measurements, as cards
  'hp-labels': { component: 'Text', accepts: ['diagram'] }, // a labelled diagram drawn as lines built on the narration
  'hp-tiles': { component: 'StatTiles', accepts: ['data-chart'] }, // a table or dollar chart drawn as one tile per point
} as const satisfies Record<string, KindSpec>;
