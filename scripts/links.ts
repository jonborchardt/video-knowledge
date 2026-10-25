// npm run links -- <command>
//   freeze   write public-urls.json: every indexed page dist/ holds (run after npm run build); commit it
//   check    request every outside URL the built site and the committed descriptions link (local, networked, never
//            in CI); prints the failures and exits 1 on any
// The build test fails when a URL in public-urls.json disappears without a topics/<topic>/moved.json entry.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { distPages } from '../src/lib/content-graph';
import { ROOT } from '../src/lib/io';

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
  for (const d of files(join(ROOT, 'topics'), 'description.txt'))
    for (const [u] of d.matchAll(/https?:\/\/\S+/g)) urls.add(u);
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
} else {
  console.error('usage: npm run links -- freeze | check');
  process.exit(1);
}
