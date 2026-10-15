// node scripts/record-sources.mjs <topic> <verdicts.json> [...more]
// Record study verdicts written by the source-pass agents (see scripts/briefs/sources.md):
//   [{ "claim": "<topic>/<slug>", "verdict": "partly", "confidence": 0.6, "note": "...", "source": "<topic>/sources/<file>.txt#L10-L24" }]
// Evidence belongs to the claim, so each verdict is recorded once, on the first source (by id) that makes the claim.
// To retract a verdict, record the same claim + document again with verdict "unknown" (the latest per document wins).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const [topic, ...files] = process.argv.slice(2);
if (!topic || !files.length) { console.error('usage: node scripts/record-sources.mjs <topic> <verdicts.json> [...]'); process.exit(1); }
const store = join(topic, 'store'), vdir = join(ROOT, store, 'videos');
const first = {};
for (const f of readdirSync(vdir).sort()) {
  const v = JSON.parse(readFileSync(join(vdir, f), 'utf8'));
  for (const a of v.assertions ?? []) first[a.claim] ??= v.id;
}
const by = {}, missing = [];
for (const file of files)
  for (const x of JSON.parse(readFileSync(file, 'utf8'))) {
    const video = first[x.claim];
    if (!video) { missing.push(x.claim); continue; }
    (by[video] ??= []).push({ claim: x.claim, method: 'source', verdict: x.verdict, ...(x.confidence != null ? { confidence: x.confidence } : {}), note: x.note, source: x.source });
  }
if (missing.length) { console.error('no source makes these claims:\n' + missing.join('\n')); process.exit(1); }
const work = join(ROOT, topic, 'work');
mkdirSync(work, { recursive: true });
let n = 0;
for (const [video, verdicts] of Object.entries(by)) {
  const f = join(work, `${video}.sources.json`);
  writeFileSync(f, JSON.stringify({ video, verdicts }));
  execFileSync(process.execPath, ['--import', 'tsx', join(ROOT, 'node_modules/watcher/src/cli.ts'), 'record', f, '--store', store], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  n += verdicts.length;
}
console.log(`recorded ${n} study verdicts on ${Object.keys(by).length} sources`);
