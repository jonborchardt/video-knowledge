// Bespoke kinds of get-rich-quick/scripts/surprise-most-new-businesses-including-online-stores, named per scene in that
// video's render.json. Browser-safe.
import type { KindSpec } from '../kinds';

export const MOST_NEW_BUSINESSES = {
  'nb-branch-closing': { component: 'BranchClosing', accepts: ['diagram'] }, // one branch of a company closes, the rest carry on
} as const satisfies Record<string, KindSpec>;
