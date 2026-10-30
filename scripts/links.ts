// npm run links -- <command>
//   freeze   write public-urls.json: every indexed page dist/ holds (run after npm run build); commit it
//   cta <topic> <story-id>   what each call-to-action destination carries for the story, and its cta.json resolved
//            (exit 2 on a file problem)
//   check    request every outside URL the built site and the committed descriptions link (local, networked, never
//            in CI); prints the failures and exits 1 on any
// The build test fails when a URL in public-urls.json disappears without a topics/<topic>/moved.json entry.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentGraph, distPages, related, storyNode } from '../src/lib/content-graph';
import { type Cta, loadCta, resolveCtas } from '../src/lib/cta';
import { ROOT, topicsDir } from '../src/shared/io';
import { textUrls } from '../src/lib/url';

const DIST = join(ROOT, 'dist');
const cmd = process.argv[2];

if (cmd === 'freeze') {
  const paths = [...distPages(DIST).indexed].sort();
  writeFileSync(join(ROOT, 'public-urls.json'), JSON.stringify(paths, null, 2) + '\n'); // as prettier writes it
  console.log(`public-urls.json: ${paths.length} urls`);
} else if (cmd === 'check') {
  const files = (dir: string, end: string) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith(end))
      .map((f) => readFileSync(join(dir, f), 'utf8'));
  const urls = new Set<string>();
  for (const html of files(DIST, '.html'))
    for (const [, u] of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) urls.add(u.replaceAll('&amp;', '&'));
  for (const d of files(topicsDir(ROOT), 'description.txt')) for (const u of textUrls(d)) urls.add(u);
  const failures: string[] = [];
  const ok = async (u: string) => {
    for (const method of ['HEAD', 'GET']) {
      try {
        const r = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
        if (r.ok) return null;
        if (method === 'GET') return `${r.status}`;
      } catch (e) {
        if (method === 'GET') return (e as Error).message;
      }
    }
    return null;
  };
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let u = queue.shift(); u; u = queue.shift()) {
        const why = await ok(u);
        if (why) failures.push(`${why} ${u}`);
      }
    }),
  );
  console.log(`${urls.size} outside urls, ${failures.length} failing`);
  for (const f of failures.sort()) console.log(f);
  process.exit(failures.length ? 1 : 0);
} else if (cmd === 'cta') {
  const [topic, id] = process.argv.slice(3);
  const g = contentGraph();
  const story = storyNode(topic ?? '', id ?? '');
  if (!g.stories.has(story)) {
    console.error(`usage: npm run links -- cta <topic> <story-id> (no story ${story})`);
    process.exit(1);
  }
  // What each destination type would carry for this story: the agent's menu.
  const probe = (c: Cta) => {
    const r = resolveCtas({ primary: { type: 'inquiry', text: 'x' }, secondary: [c] }, g, story);
    return r.secondary[0] ? `${r.secondary[0].url}` : `unavailable: ${r.dropped.at(-1)?.why}`;
  };
  console.log(`Destinations for ${story}:`);
  for (const type of ['tool', 'evidence', 'article', 'data', 'inquiry'] as const)
    console.log(`  ${type.padEnd(9)} ${probe({ type, text: 'x' })}`);
  const videos = related(g, story, { limit: 20 }).filter((n) => g.nodes.get(`${n.id}#youtube`)?.public);
  for (const n of videos)
    console.log(`  video     ${n.id}#youtube ${probe({ type: 'video', target: `${n.id}#youtube`, text: 'x' })}`);
  if (!videos.length) console.log('  video     none: no related story has a live video');
  console.log(
    `Related (as ranked, before pins): ${
      related(g, story)
        .map((n) => n.id)
        .join(', ') || 'none'
    }`,
  );
  const file = loadCta(topic, id);
  if (!file) console.log('No cta.json: the default applies (the matter page).');
  const r = resolveCtas(file, g, story);
  console.log(`Primary: [${r.primary.type}] ${r.primary.text} -> ${r.primary.url}`);
  for (const c of r.secondary) console.log(`Secondary: [${c.type}] ${c.text} -> ${c.url}`);
  for (const d of r.dropped) console.log(`Dropped: [${d.cta.type}] ${d.cta.text}: ${d.why}`);
  for (const p of r.problems) console.log(`PROBLEM: ${p}`);
  process.exit(r.problems.length ? 2 : 0);
} else {
  console.error('usage: npm run links -- freeze | check | cta <topic> <story-id>');
  process.exit(1);
}
