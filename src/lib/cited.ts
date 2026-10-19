// The study verdicts the topic's scripts cite. The store keeps one verdict per (claim, document), latest wins, so
// record-sources checks here before a new verdict silently replaces a passage a script rests on.
// Only erasable syntax and only io.ts (which imports nothing relative): scripts/record-sources.mjs loads this file
// through node's type stripping.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, ROOT } from './io.ts';

interface CitingScript {
  sections: { sentences: { assertions?: { evidence: { kind: string; claim?: string; cite?: string }[] }[] }[] }[];
}
const docOf = (cite: string) => cite.split('#')[0];

/** "<claim>|<document file>" -> the cite, for every study evidence entry of every assertion in the topic's scripts. */
export function citedPairs(topic: string, root = ROOT): Map<string, string> {
  const out = new Map<string, string>();
  const base = join(root, topic, 'scripts');
  if (!existsSync(base)) return out;
  for (const d of readdirSync(base)) {
    const s = readJson<CitingScript>(join(base, d, 'script.json'));
    for (const a of s?.sections.flatMap((x) => x.sentences.flatMap((y) => y.assertions ?? [])) ?? [])
      for (const e of a.evidence)
        if (e.kind === 'study' && e.claim && e.cite) out.set(`${e.claim}|${docOf(e.cite)}`, e.cite);
  }
  return out;
}

/** One message per verdict that would replace a cited verdict on the same claim and document with another range. */
export function replacedCited(verdicts: { claim: string; source: string }[], cited: Map<string, string>): string[] {
  return verdicts.flatMap(({ claim, source }) => {
    const was = cited.get(`${claim}|${docOf(source)}`);
    return was && was !== source
      ? [`${claim}: ${source} would replace ${was}, which a script cites (record it on the claim it decides)`]
      : [];
  });
}
