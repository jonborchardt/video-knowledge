// node src/modules/evidence/merge-claims.mjs <merges.json> <batches.json> [...more]
// Parallel extraction agents can each create the same new claim. Before recording, rewrite those duplicates in place:
//   merges.json: { "<new claim text as written>": "<existing-slug>" | "=<canonical new claim text>" }
// A slug turns the claim into a reuse of that existing claim. "=text" points it at another new claim. `record` reads
// the files in the order given, entry by entry, and a reference (`n2`) must name a claim it has already met, so after
// the merges the first mention of each new text in that order is made its creation (`n`) and every later one a
// reference, whatever the merge agent named as canonical. A source left with the same claim twice keeps the first.
import { readFileSync, writeFileSync } from 'node:fs';

const [mergeFile, ...files] = process.argv.slice(2);
if (!mergeFile || !files.length) {
  console.error('usage: node src/modules/evidence/merge-claims.mjs <merges.json> <batches.json> [...]');
  process.exit(1);
}
const merges = JSON.parse(readFileSync(mergeFile, 'utf8'));
const all = files.map((f) => ({ f, batches: JSON.parse(readFileSync(f, 'utf8')), merged: 0 }));
for (const file of all) {
  for (const b of file.batches) {
    const seen = new Set();
    b.as = b.as.flatMap((x) => {
      const text = x.n ?? x.n2,
        to = text && merges[text];
      if (to && to !== '=' + text) {
        file.merged++;
        const keep = { ...(x.s ? { s: x.s } : {}), ...(x.q ? { q: x.q } : {}) };
        x = to.startsWith('=') ? { n2: to.slice(1), ...keep } : { c: to, ...keep };
      }
      const key = x.c ?? x.n ?? x.n2;
      if (seen.has(key)) return [];
      seen.add(key);
      return [x];
    });
  }
}
// the first mention in record order creates the claim
const created = new Set();
for (const file of all)
  for (const b of file.batches)
    for (const x of b.as) {
      const text = x.n ?? x.n2;
      if (!text) continue;
      const first = !created.has(text);
      created.add(text);
      if (first && x.n2 !== undefined) {
        delete x.n2;
        Object.assign(x, { n: text, ...x });
      } else if (!first && x.n !== undefined) {
        delete x.n;
        Object.assign(x, { n2: text, ...x });
      }
    }
for (const file of all) {
  writeFileSync(file.f, JSON.stringify(file.batches, null, 1));
  console.log(`${file.f}: merged ${file.merged}`);
}
