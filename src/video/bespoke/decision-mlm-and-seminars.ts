// Bespoke kinds of get-rich-quick/scripts/decision-mlm-and-seminars: one scene's own diagram or animation, named per
// scene in that video's render.json. Browser-safe.
import type { KindSpec } from '../kinds';

export const MLM_AND_SEMINARS = {
  'phone-reply': { component: 'Phone', accepts: ['animation'] }, // the phone again, reply box open
  'phone-end': { component: 'Phone', accepts: ['animation'], fadesOut: true }, // the phone dims to black, end card line
  'tree-coins': { component: 'Tree', accepts: ['diagram'] }, // three tiers, coins travelling up
  'tree-customer': { component: 'Tree', accepts: ['diagram'] }, // a quote, then the recruit as the customer
  'tree-base': { component: 'Tree', accepts: ['diagram'] }, // many tiers, red base, amber top, labels from on-screen text
  pair: { component: 'Text', accepts: ['typography'] }, // two words with an arrow
  'fine-print': { component: 'FinePrint', accepts: ['animation'] }, // push into unreadable fine print
  waterfall: { component: 'Waterfall', accepts: ['diagram'] }, // paid out, expenses unknown, kept unknown
  pyramid: { component: 'Pyramid', accepts: ['animation'] }, // levels overflowing the globe
  'three-measures': { component: 'Composite', accepts: ['data-chart'] }, // three panels
  'base-rate': { component: 'StackedBar', accepts: ['data-chart'], percent: true }, // first two segments sum
  closing: { component: 'Composite', accepts: ['data-chart'] }, // ring, tile, three dots
} as const satisfies Record<string, KindSpec>;
