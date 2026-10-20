// Bespoke kinds of sovereign-citizens/scripts/decision-courts-and-jurisdiction: one scene's own diagram or animation,
// named per scene in that video's render.json. Browser-safe.
import type { KindSpec } from '../kinds';

export const COURTS_AND_JURISDICTION = {
  'sc-flag-stamps': { component: 'FlagStamps', accepts: ['diagram'] }, // sc22: outlined flag with gold fringe, three verdicts stamp on
  'sc-courtroom': { component: 'Courtroom', accepts: ['animation'] }, // sc01: line-art courtroom, push-in to the sheet
  'sc-protest-strip': { component: 'ProtestStrip', accepts: ['diagram'] }, // sc15: timber, protest, later; not mentioned
  'sc-trick-vs-document': { component: 'TrickVsDocument', accepts: ['diagram'] }, // sc32: trick beside narrower document
  'sc-courts-evidence': { component: 'CourtsEvidence', accepts: ['diagram'] }, // sc38: reviews' countries, US rulings
  'sc-district-tiers': { component: 'DistrictTiers', accepts: ['diagram'] }, // sc26: District corporate, Congress, United States
  'sc-toolkit-down': { component: 'Toolkit', accepts: ['diagram'] }, // sc07: heading writes on, five blank cards deal
  'sc-toolkit-flip': { component: 'Toolkit', accepts: ['diagram'] }, // sc11: cards flip as each trick is named
  'sc-toolkit-strike': { component: 'Toolkit', accepts: ['diagram'] }, // sc47: cards struck through as named
  'sc-ticket-signature': { component: 'TicketSignature', accepts: ['animation'], cues: ['scribble', 'seal'] }, // sc44: scribble under signature; seal is the law
} as const satisfies Record<string, KindSpec>;
