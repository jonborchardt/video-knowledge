// Exact cross-file duplicates of new claims (spec §5.2 `merge`; memory: parallel extraction agents create the same
// new claim): the canonical is the first `n` in global order (files sorted, batches in order); every later `n` with
// the same text becomes an `n2` of it, and loses the AI guess, the lean and the force flag it carried.
import type { BatchAssertion, ExtractionBatch, NewClaim } from './batches';

const isNew = (a: BatchAssertion): a is NewClaim => (a as NewClaim).n !== undefined;

export function dedupeBatches(batches: Record<string, ExtractionBatch[]>): {
  batches: Record<string, ExtractionBatch[]>;
  converted: number;
} {
  const seen = new Set<string>();
  let converted = 0;
  const out: Record<string, ExtractionBatch[]> = {};
  for (const file of Object.keys(batches).sort()) {
    out[file] = batches[file].map((b) => ({
      ...b,
      as: b.as.map((a): BatchAssertion => {
        if (!isNew(a)) return a;
        const key = a.n.trim();
        if (!seen.has(key)) {
          seen.add(key);
          return a;
        }
        converted++;
        return { n2: a.n, q: a.q, ...(a.s ? { s: a.s } : {}) };
      }),
    }));
  }
  return { batches: out, converted };
}
