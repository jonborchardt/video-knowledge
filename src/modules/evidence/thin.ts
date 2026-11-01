// Thinness (spec §5.5 instrument 1): whether a topic has enough sources with captions, enough documents and enough
// claims decided by a study to be worth stories; which is short, in a sentence. The verb reports; the topic runner
// decides (it parks, spec §5.2). Pure over counts; the CLI reads them from the store and the sources folder.
import type { Automation } from '../../shared/automation';

export interface ThinCounts {
  sources: number; // records in the store
  withCaptions: number; // records with a transcript
  documents: number; // sources/*.txt
  claims: number;
  decided: number; // claims with a source verdict that is right, wrong or partly
}

export function thinness(c: ThinCounts, a: Automation['topics']): { thin: boolean; why: string | null } {
  const short: string[] = [];
  if (c.withCaptions < a.minSources)
    short.push(`${c.withCaptions} of the ${a.minSources} sources with captions it needs (${c.sources} in the store)`);
  if (c.documents < a.minStudies) short.push(`${c.documents} of the ${a.minStudies} study documents it needs`);
  const ratio = c.claims ? c.decided / c.claims : 0;
  if (ratio < a.minDecided)
    short.push(
      `${c.decided} of ${c.claims} claims decided by a study (${Math.round(ratio * 100)}%, under the ${Math.round(a.minDecided * 100)}% it needs)`,
    );
  return short.length ? { thin: true, why: `the topic is thin: ${short.join('; ')}` } : { thin: false, why: null };
}
