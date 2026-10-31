// node src/modules/evidence/record-sources.mjs <topic> <verdicts.json> [...more]
// Record study verdicts written by the source-pass agents (see src/modules/evidence/briefs/sources.md; typed and checked in
// src/modules/evidence/batches.ts, so a malformed file stops the run before anything is written):
//   [{ "claim": "<topic>/<slug>", "verdict": "partly", "confidence": 0.6, "note": "...",
//      "source": "<topic>/sources/<file>.txt#L10-L24", "applicability": "partial", "why": "lab task, not production work" }]
// Evidence belongs to the claim, so each verdict is recorded once, on the first source (by id) that makes the claim.
// To retract a verdict, record the same claim + document again with verdict "unknown" (the latest per document wins).
// A verdict that would replace one a script cites (same claim and document, another range) is refused unless
// --replace-cited is passed (src/modules/evidence/cited.ts).
// "applicability" (direct | partial | contextual) and "why" never reach the watcher: they go to
// topics/<topic>/applicability.json, keyed <claim>|<cite>, which only this script writes. An entry identical to a
// stored verdict (same source, verdict, note, confidence) is applicability-only: it updates that file and nothing else.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkStudyVerdicts, isStored, withApplicability } from './batches.ts';
import { citedPairs, replacedCited } from './cited.ts';
import { ROOT, relTo, topicDir, watcher } from './watcher.mjs';

const args = process.argv.slice(2);
const replaceCited = args.includes('--replace-cited');
const [topic, ...files] = args.filter((a) => a !== '--replace-cited');
if (!topic || !files.length) {
  console.error('usage: node src/modules/evidence/record-sources.mjs <topic> <verdicts.json> [...] [--replace-cited]');
  process.exit(1);
}
const store = relTo(join(topicDir(topic), 'store')),
  vdir = join(ROOT, store, 'videos');
const first = {},
  records = {};
for (const f of readdirSync(vdir).sort()) {
  const v = JSON.parse(readFileSync(join(vdir, f), 'utf8'));
  for (const a of v.assertions ?? []) {
    first[a.claim] ??= v.id;
    (records[a.claim] ??= []).push(...(a.verdicts ?? []));
  }
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
  recordedBy = {},
  levelOnly = [],
  missing = [];
for (const [, verdicts] of parsed)
  for (const x of verdicts) {
    if (isStored(x, records[x.claim] ?? [])) {
      levelOnly.push(x);
      continue;
    }
    const video = first[x.claim];
    if (!video) {
      missing.push(x.claim);
      continue;
    }
    (recordedBy[video] ??= []).push(x);
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
const appFile = join(topicDir(topic), 'applicability.json');
let levels = existsSync(appFile) ? JSON.parse(readFileSync(appFile, 'utf8')) : {};
let k = 0;
const writeLevels = (verdicts) => {
  levels = withApplicability(levels, verdicts);
  writeFileSync(appFile, JSON.stringify(levels, null, 1) + '\n');
  k += verdicts.length;
};
const work = join(topicDir(topic), 'work');
mkdirSync(work, { recursive: true });
let n = 0;
for (const [video, verdicts] of Object.entries(by)) {
  const f = join(work, `${video}.sources.json`);
  writeFileSync(f, JSON.stringify({ video, verdicts }));
  watcher(['record', f, '--store', store]);
  writeLevels(recordedBy[video]); // after each video, so a later watcher failure keeps the earlier ones' levels
  n += verdicts.length;
}
if (levelOnly.length) writeLevels(levelOnly);
console.log(`recorded ${n} study verdicts on ${Object.keys(by).length} sources; applicability of ${k}`);
