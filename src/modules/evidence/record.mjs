// node src/modules/evidence/record.mjs <topic> <batches.json> [--label "<Topic label>"] [--from <video-id>]
// Record extraction batches in the compact format the agents write (see src/modules/evidence/briefs/extract.md; typed and checked
// in src/modules/evidence/batches.ts, so a malformed file stops the run before anything is written):
//   [{ "video": "<id>", "sum": "one line", "as": [
//       { "c": "<existing slug>", "s": "d"?, "q": "quote" },                  reuse a claim (s:"d" = the source denies it)
//       { "n": "New claim text", "q": "...", "v": [verdict, conf, note], "l": "pro" },   create a claim + its AI guess
//         (add "f": true to force past the near-duplicate check when the meaning really differs)
//       { "n2": "Exact text of a claim created earlier", "q": "..." } ] }]   reuse a claim created by an earlier "n"
// For each source: records its assertions, then the AI-guess verdicts of the claims it created. Evidence belongs to the
// claim, so a reused claim needs no new verdict. New claims' "l" tags go into topics/<topic>/lean.json.
// --label creates the topic on the first batch of an empty store. --from skips batches before that video (resume).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBatches } from './batches.ts';
import { ROOT, relTo, topicDir, watcher } from './watcher.mjs';

const [topic, file, ...rest] = process.argv.slice(2);
const opt = (k) => {
  const i = rest.indexOf(k);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (!topic || !file) {
  console.error(
    'usage: node src/modules/evidence/record.mjs <topic> <batches.json> [--label "<label>"] [--from <video-id>]',
  );
  process.exit(1);
}
const store = relTo(join(topicDir(topic), 'store'));
const cli = (args) => watcher([...args, '--store', store]);
const claimsNow = () =>
  JSON.parse(readFileSync(join(ROOT, store, 'topics.json'), 'utf8')).topics.find((t) => t.id === topic)?.claims ?? [];
const full = (slug) => (slug.includes('/') ? slug : `${topic}/${slug}`);
const leanFile = join(topicDir(topic), 'lean.json');
const lean = existsSync(leanFile) ? JSON.parse(readFileSync(leanFile, 'utf8')) : {};
const work = join(topicDir(topic), 'work');
mkdirSync(work, { recursive: true });

const batches = JSON.parse(readFileSync(file, 'utf8'));
// Check everything up front so a bad reference stops the run before anything is written.
const known = new Set(claimsNow().map((c) => c.id));
const bad = checkBatches(batches, topic, claimsNow());
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}

let go = !opt('--from');
for (const b of batches) {
  go ||= b.video === opt('--from');
  if (!go) continue;
  const byText = new Map(claimsNow().map((c) => [c.text, c.id]));
  const assertions = b.as.map((x) => {
    const stance = x.s === 'd' ? 'denies' : 'asserts',
      quote = x.q;
    if (x.n2) {
      const id = byText.get(x.n2);
      if (!id) throw new Error(`${b.video}: n2 claim not created yet: ${x.n2}`);
      return { claim: id, stance, quote };
    }
    return x.n
      ? { newClaim: { topic, text: x.n }, stance, quote, ...(x.f ? { force: true } : {}) }
      : { claim: full(x.c), stance, quote };
  });
  const topics = {
    primary: topic,
    secondary: [],
    ...(known.size === 0 && opt('--label') ? { newTopics: [{ id: topic, label: opt('--label') }] } : {}),
  };
  const af = join(work, `${b.video}.assertions.json`);
  writeFileSync(af, JSON.stringify({ video: b.video, ...(b.sum ? { summary: b.sum } : {}), topics, assertions }));
  const out = cli(['record', af]);
  const created = [...out.matchAll(/created (\S+\/\S+)/g)].map((m) => m[1]);
  const fresh = b.as.filter((x) => x.n);
  if (created.length !== fresh.length)
    throw new Error(`${b.video}: expected ${fresh.length} new claims, got ${created.length}\n${out}`);
  if (created.length) {
    const verdicts = fresh.map((x, i) => ({
      claim: created[i],
      method: 'prior',
      verdict: x.v[0],
      ...(x.v[1] != null ? { confidence: x.v[1] } : {}),
      note: x.v[2],
    }));
    const vf = join(work, `${b.video}.verdicts.json`);
    writeFileSync(vf, JSON.stringify({ video: b.video, verdicts }));
    cli(['record', vf]);
    fresh.forEach((x, i) => {
      if (x.l) lean[created[i]] = x.l;
    });
    writeFileSync(leanFile, JSON.stringify(lean, null, 1) + '\n');
  }
  created.forEach((id) => known.add(id));
  console.log(`${b.video}: ${assertions.length} claims, ${created.length} new`);
}
