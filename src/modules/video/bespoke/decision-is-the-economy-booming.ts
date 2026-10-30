// Bespoke kinds of inflation-2026/scripts/decision-is-the-economy-booming: one scene's own diagram or animation, named
// per scene in that video's render.json. Prefix kind names `eb-`. Browser-safe.
import type { KindSpec } from '../kinds';

export const IS_THE_ECONOMY_BOOMING = {
  'eb-real-pay': { component: 'RealPayColumns', accepts: ['diagram'], passage: true }, // sc12: monthly real pay vs a year earlier, columns drop below zero from April
} as const satisfies Record<string, KindSpec>;
