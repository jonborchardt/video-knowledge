// node scripts/report.mjs - write topics/<topic>/report.json for every topic with a store, using the watcher library.
// Run locally (the library lives in ../retire-sim and isn't available in CI); commit the report.json files.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TOPICS, topicDir, watcher } from './watcher.mjs';

for (const d of readdirSync(join(ROOT, TOPICS), { withFileTypes: true })) {
  if (!d.isDirectory() || !existsSync(join(topicDir(d.name), 'store', 'topics.json'))) continue;
  writeFileSync(
    join(topicDir(d.name), 'report.json'),
    watcher(['report', '--json', '--store', join(TOPICS, d.name, 'store')]),
  );
  console.log('wrote', `${TOPICS}/${d.name}/report.json`);
}
