// The research corpus: what the evidence gate and the script stage judge with. It is its own type, not the site's
// view model, so a page-only change to Topic cannot reach the gate. corpusOf is the one place that maps one to the other.
import type { Topic } from './topics';
import type { Corpus } from '../shared/types';
/** The one place a site Topic becomes a research Corpus: the types make the cut, so nothing the site adds later
 *  reaches the gate, and a research field the site drops fails to compile here. */
export const corpusOf = (t: Topic): Corpus => t;
