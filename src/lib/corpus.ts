// The research corpus: what the evidence gate and the script stage judge with. It is its own type, not the site's
// view model, so a page-only change to Topic cannot reach the gate. corpusOf is the one place that maps one to the other.
import type { Topic } from './topics';
import type { RecordedApplicability } from './batches';

import type { Verdict } from '../shared/types';
export interface CorpusVerdict {
  by: string; // 'AI guess' or the study's display name
  verdict: Verdict;
  confidence: number | null;
  note: string;
  cite: string | null; // '<topic>/sources/<file>.txt#L10-L24', a path in the repo
  date: string | null; // YYYY-MM-DD the verdict was recorded; a later record on the same document supersedes
  applicability?: RecordedApplicability; // recorded with the verdict (applicability.json); a ceiling, absent means none
}
export interface CorpusSource {
  id: string;
  title: string;
  channel: string;
  kind: 'video' | 'post';
  href: string;
  stance: 'asserts' | 'denies';
  quote: string;
}
export interface CorpusClaim {
  id: string;
  text: string;
  verdict: Verdict | null;
  confidence: number | null;
  decidedBy: string | null; // a study's display name, or null when the AI guess decides
  lean: string | null;
  sources: CorpusSource[]; // every source that asserts or denies it, with its quote
  verdicts: CorpusVerdict[]; // every recorded judgment: the AI guess and each study
}
export interface Corpus {
  name: string;
  claims: CorpusClaim[];
  sameStudy?: Record<string, string>; // '<summary file>.txt' -> '<primary file>.txt' when two documents report one study
  docNames?: Record<string, string>; // '<file>.txt' -> display name
}

/** The one place a site Topic becomes a research Corpus: the types make the cut, so nothing the site adds later
 *  reaches the gate, and a research field the site drops fails to compile here. */
export const corpusOf = (t: Topic): Corpus => t;
