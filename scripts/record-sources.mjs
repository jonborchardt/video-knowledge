// node scripts/record-sources.mjs <topic> <verdicts.json> [...more]
// Record study verdicts written by the source-pass agents (see scripts/briefs/sources.md; typed and checked in
// src/lib/batches.ts, so a malformed file stops the run before anything is written):
//   [{ "claim": "<topic>/<slug>", "verdict": "partly", "confidence": 0.6, "note": "...", "source": "<topic>/sources/<file>.txt#L10-L24" }]
// Evidence belongs to the claim, so each verdict is recorded once, on the first source (by id) that makes the claim.
// To retract a verdict, record the same claim + document again with verdict "unknown" (the latest per document wins).
// A verdict that would replace one a script cites (same claim and document, another range) is refused unless
// --replace-cited is passed (src/lib/cited.ts).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkStudyVerdicts } from '../src/lib/batches.ts';
import { citedPairs, replacedCited } from '../src/lib/cited.ts';
import { ROOT, TOPICS, topicDir, watcher } from './watcher.mjs';

const args = process.argv.slice(2);
const replaceCited = args.includes('--replace-cited');
const [topic, ...files] = args.filter((a) => a !== '--replace-cited');
if (!topic || !files.length) {
  console.error('usage: node scripts/record-sources.mjs <topic> <verdicts.json> [...] [--replace-cited]');
  process.exit(1);
}
const store = join(TOPICS, topic, 'store'),
  vdir = join(ROOT, store, 'videos');
const first = {};
for (const f of readdirSync(vdir).sort()) {
  const v = JSON.parse(readFileSync(join(vdir, f), 'utf8'));
  for (const a of v.assertions ?? []) first[a.claim] ??= v.id;
}
const parsed = files.map((file) => [file, JSON.parse(readFileSync(file, 'utf8'))]);
const malformed = parsed.flatMap(([file, x]) => checkStudyVerdicts(x).map((p) => `${file} ${p}`));
if (malformed.length) {
  console.error(malformed.join('\n'));
  process.exit(1);
}
const replaced = replacedCited(
  parsed.flatMap(([, x]) => x),
  citedPairs(topic, ROOT),
);
if (replaced.length && !replaceCited) {
  console.error(replaced.join('\n') + '\nnothing recorded; pass --replace-cited to replace them anyway');
  process.exit(1);
}
const by = {},
  missing = [];
for (const [, verdicts] of parsed)
  for (const x of verdicts) {
    const video = first[x.claim];
    if (!video) {
      missing.push(x.claim);
      continue;
    }
    (by[video] ??= []).push({
      claim: x.claim,
      method: 'source',
      verdict: x.verdict,
      ...(x.confidence != null ? { confidence: x.confidence } : {}),
      note: x.note,
      source: x.source,
    });
  }
if (missing.length) {
  console.error('no source makes these claims:\n' + missing.join('\n'));
  process.exit(1);
}
const work = join(topicDir(topic), 'work');
mkdirSync(work, { recursive: true });
let n = 0;
for (const [video, verdicts] of Object.entries(by)) {
  const f = join(work, `${video}.sources.json`);
  writeFileSync(f, JSON.stringify({ video, verdicts }));
  watcher(['record', f, '--store', store]);
  n += verdicts.length;
}
console.log(`recorded ${n} study verdicts on ${Object.keys(by).length} sources`);
