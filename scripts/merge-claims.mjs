// node scripts/merge-claims.mjs <merges.json> <batches.json> [...more]
// Parallel extraction agents can each create the same new claim. Before recording, rewrite those duplicates in place:
//   merges.json: { "<new claim text as written>": "<existing-slug>" | "=<canonical new claim text>" }
// A slug turns the claim into a reuse of that existing claim. "=text" points it at another new claim created earlier
// (the batch that creates "text" must be recorded first). A source left with the same claim twice keeps the first.
import { readFileSync, writeFileSync } from 'node:fs';

const [mergeFile, ...files] = process.argv.slice(2);
if (!mergeFile || !files.length) {
  console.error('usage: node scripts/merge-claims.mjs <merges.json> <batches.json> [...]');
  process.exit(1);
}
const merges = JSON.parse(readFileSync(mergeFile, 'utf8'));
for (const f of files) {
  const batches = JSON.parse(readFileSync(f, 'utf8'));
  let n = 0;
  for (const b of batches) {
    const seen = new Set();
    b.as = b.as.flatMap((x) => {
      const text = x.n ?? x.n2,
        to = text && merges[text];
      if (to && to !== '=' + text) {
        n++;
        const keep = { ...(x.s ? { s: x.s } : {}), ...(x.q ? { q: x.q } : {}) };
        x = to.startsWith('=') ? { n2: to.slice(1), ...keep } : { c: to, ...keep };
      }
      const key = x.c ?? x.n ?? x.n2;
      if (seen.has(key)) return [];
      seen.add(key);
      return [x];
    });
  }
  writeFileSync(f, JSON.stringify(batches, null, 1));
  console.log(`${f}: merged ${n}`);
}
