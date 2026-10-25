// npm run shorts -- <command> <topic> <story-id> [...]
//   discover <topic> <story-id>        candidates for Shorts from the parent's validated script and storyboard; writes
//                                      topics/<topic>/scripts/<slug>/shorts.json (merges shorts-review.json; see scripts/briefs/shorts.md)
//   show <topic> <story-id> [key]      the candidates, or one with its sentences, qualifications and cited passages
// A Short is then produced as <story-id>/shorts/<slug> through the same CLIs as a video (npm run board -- next, /produce).
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { passageReader } from '../src/lib/evidence';
import { toJson, ROOT } from '../src/lib/io';
import { sentences, shortId, shortOf } from '../src/lib/script';
import {
  type ShortCandidate,
  discoverShorts,
  loadShortParent,
  loadShorts,
  loadShortsReview,
  shortsPath,
  staleShortReviewKeys,
} from '../src/lib/shorts';

const [cmd, topic, storyId, key] = process.argv.slice(2);
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 5)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !topic || !storyId) usage();
const rel = (f: string) => relative(ROOT, f).replaceAll('\\', '/');
const pad = (s: string | number, w: number) => String(s).padEnd(w);

function list(cs: ShortCandidate[]) {
  console.log(`${pad('key', 6)}${pad('scene', 7)}${pad('readiness', 14)}${pad('format', 28)}${pad('slug', 32)}figures`);
  for (const c of cs)
    console.log(
      `${pad(c.key, 6)}${pad(c.scene, 7)}${pad(c.readiness, 14)}${pad(c.format ?? '-', 28)}${pad(c.slug ?? '-', 32)}${c.figures.join(', ')}`,
    );
}

try {
  const short = shortOf(storyId);
  if (short) throw new Error(`${storyId} is a Short; run discover on its parent ${short.parent}`);
  switch (cmd) {
    case 'discover': {
      const parent = loadShortParent(topic, storyId);
      const review = loadShortsReview(topic, storyId);
      const file = discoverShorts(parent, review);
      writeFileSync(shortsPath(topic, storyId), toJson(file));
      list(file.candidates);
      for (const r of file.rejected) console.log(`rejected ${r.key}: ${r.reason}`);
      const ready = file.candidates.filter((c) => c.readiness === 'ready');
      console.log(
        `wrote ${rel(shortsPath(topic, storyId))}: ${file.candidates.length} candidates, ${ready.length} ready${ready.length ? ` (${ready.map((c) => shortId(storyId, c.slug!)).join(', ')})` : ''}, ${file.rejected.length} rejected`,
      );
      const stale = review ? staleShortReviewKeys(file, review) : [];
      if (stale.length) {
        console.error(`shorts-review.json names candidates discovery does not draft: ${stale.join(', ')}`);
        process.exitCode = 2;
      }
      break;
    }
    case 'show': {
      const file = loadShorts(topic, storyId);
      if (!file) throw new Error(`no ${rel(shortsPath(topic, storyId))}; run discover first`);
      if (!key) {
        list(file.candidates);
        break;
      }
      const c = file.candidates.find((x) => x.key === key);
      if (!c) throw new Error(`no candidate ${key} (${file.candidates.map((x) => x.key).join(', ')})`);
      const parent = loadShortParent(topic, storyId);
      const text = new Map(sentences(parent.script).map((s) => [s.id, s.text]));
      const read = passageReader();
      console.log(
        `${c.key} (${c.scene}, ${c.section}) [${c.readiness}]${c.slug ? ` -> ${shortId(storyId, c.slug)}` : ''}`,
      );
      for (const b of c.blocking) console.log(`  blocking: ${b}`);
      if (c.hook) console.log(`  hook: ${c.hook}`);
      if (c.format) console.log(`  format: ${c.format}`);
      for (const id of c.sentences) console.log(`  ${id}: ${text.get(id)}`);
      console.log(`  claims: ${c.claims.join(', ')}`);
      for (const q of c.qualifications)
        console.log(
          `  qualification (${q.assertion}): ${q.text}${q.carriedBy.length ? ` [carried by ${q.carriedBy.map((id) => `${id}: ${text.get(id)}`).join(' | ')}]` : ''}`,
        );
      for (const carry of c.carries) console.log(`  carries: ${carry}`);
      if (c.chart)
        console.log(`  chart: ${c.chart.type} ${c.chart.points.map((p) => `${p.label} ${p.display}`).join('; ')}`);
      for (const cite of c.cites) {
        const p = read(cite);
        console.log(`  ${cite}`);
        if (p) console.log(`    | ${p.trim().split('\n').slice(0, 8).join('\n    | ')}`);
      }
      break;
    }
    default:
      usage();
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
}
