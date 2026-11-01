// Near-duplicate collisions between new claims and the claims a topic already has (spec §5.2 `merge`): the watcher
// refuses a new claim whose wording is within its duplicate threshold of an existing one unless it is forced, so
// the collisions are found before `record`. The similarity is the watcher's own (`src/similar.ts` in its checkout,
// loaded by file URL at run time, never into this repo's module graph) with the same formula as a fallback; the pure
// function takes it as an argument.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Collision {
  claim: string; // the new claim's text
  against: string; // the existing claim's id (or the other new claim's text)
  score: number;
}
export type Similarity = (a: string, b: string) => number;
export const DUPLICATE_THRESHOLD = 0.6;

/** Every new claim within `threshold` of an existing claim, or of an earlier new claim, with the score. */
export function collisions(
  newClaims: string[],
  existing: { id: string; text: string }[],
  similarity: Similarity,
  threshold = DUPLICATE_THRESHOLD,
): Collision[] {
  const out: Collision[] = [];
  newClaims.forEach((c, i) => {
    for (const e of existing) {
      const score = similarity(c, e.text);
      if (score >= threshold) out.push({ claim: c, against: e.id, score });
    }
    for (let j = 0; j < i; j++) {
      const score = similarity(c, newClaims[j]);
      if (score >= threshold) out.push({ claim: c, against: newClaims[j], score });
    }
  });
  return out;
}

// ---- the watcher's formula, kept in step with ../retire-sim/watcher/src/similar.ts as the fallback ---------------
const STOP = new Set(
  'the a an and or of to in on for with is are was were be been it its this that these those as at by from into than then there their they them you your we our he she his her not'.split(
    ' ',
  ),
);
const tokens = (text: string): string[] => {
  const out: string[] = [];
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/))
    if (w.length >= 3 && !STOP.has(w) && !out.includes(w)) out.push(w);
  return out;
};
const stem = (t: string): string => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const bigrams = (ts: string[]): Set<string> => new Set(ts.slice(1).map((t, i) => `${ts[i]} ${t}`));
const NEGATION = /\b(no|not|never|none|nothing|without|cannot|can't|don't|doesn't|isn't|aren't|won't|shouldn't)\b/i;
export function localSimilarity(a: string, b: string): number {
  const ta = tokens(a).map(stem);
  const tb = tokens(b).map(stem);
  const s = 0.7 * jaccard(new Set(ta), new Set(tb)) + 0.3 * jaccard(bigrams(ta), bigrams(tb));
  const neg = (t: string) => NEGATION.test(t.replace(/\([^)]*\)/g, ' '));
  return neg(a) !== neg(b) ? s * 0.5 : s;
}

/** The watcher's `similarity` when its checkout is there (`WATCHER_DIR` or ../retire-sim/watcher beside the repo),
 *  else the local copy of its formula; says which. */
export async function similarityFn(root: string): Promise<{ similarity: Similarity; from: 'watcher' | 'local' }> {
  const dir = process.env.WATCHER_DIR ?? join(root, '..', 'retire-sim', 'watcher');
  const file = join(dir, 'src', 'similar.ts');
  if (existsSync(file) && !process.env.VK_LOCAL_SIMILARITY) {
    try {
      const mod = (await import(pathToFileURL(file).href)) as { similarity?: Similarity };
      if (typeof mod.similarity === 'function') return { similarity: mod.similarity, from: 'watcher' };
    } catch {
      /* the fallback below */
    }
  }
  return { similarity: localSimilarity, from: 'local' };
}
