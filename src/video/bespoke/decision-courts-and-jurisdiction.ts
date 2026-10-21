// Bespoke kinds of sovereign-citizens/scripts/decision-courts-and-jurisdiction: one scene's own diagram or animation,
// named per scene in that video's render.json. Prefix kind names `sc-courts-`. Browser-safe.
import type { KindSpec } from '../kinds';

export const COURTS_AND_JURISDICTION = {
  'sc-courts-kit': { component: 'CourtsKit', accepts: ['diagram'] }, // sc04: four kit cards slide out of a case, ground strip, gavel
  'sc-courts-shop': { component: 'ShopProtest', accepts: ['animation'] }, // sc09: shop takes deliveries, invoice stamped; shrinks to a card, three struck-through cards
  'sc-courts-timeline': { component: 'DistrictTimeline', accepts: ['diagram'] }, // sc19: the District 1871-1874, municipal corporation under the United States, abolished
  'sc-courts-nationals': { component: 'NationalCircles', accepts: ['diagram'] }, // sc30: citizen circle inside the national circle, the crescent of non-citizen nationals, a form bounces off
} as const satisfies Record<string, KindSpec>;
