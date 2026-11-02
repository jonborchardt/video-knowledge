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
// the first mention in record order creates the claim and carries what a creation needs (the AI guess `v`, the
// lean `l`, the force flag `f`); every later mention is a reference without them
const CREATION_FIELDS = ['v', 'l', 'f'];
const firstOf = new Map();
const created = new Set(); // texts some mention creates; the rest refer to claims the store already has
const fields = new Map(); // per text: the creation's fields, from whichever mention carries them
for (const file of all)
  for (const b of file.batches)
    for (const x of b.as) {
      const text = x.n ?? x.n2;
      if (!text) continue;
      if (x.v !== undefined) created.add(text); // the guess travels only with a creation (check-batch)
      if (!firstOf.has(text)) firstOf.set(text, x);
      const f = fields.get(text) ?? {};
      for (const k of CREATION_FIELDS) if (x[k] !== undefined && f[k] === undefined) f[k] = x[k];
      fields.set(text, f);
    }
for (const file of all)
  for (const b of file.batches)
    for (const x of b.as) {
      const text = x.n ?? x.n2;
      if (!text) continue;
      const creation = created.has(text) && firstOf.get(text) === x;
      delete x.n;
      delete x.n2;
      for (const k of CREATION_FIELDS) delete x[k];
      if (creation) Object.assign(x, { n: text }, fields.get(text));
      else x.n2 = text;
    }
for (const file of all) {
  writeFileSync(file.f, JSON.stringify(file.batches, null, 1));
  console.log(`${file.f}: merged ${file.merged}`);
}
