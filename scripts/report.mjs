// node scripts/report.mjs — write <topic>/report.json for every topic with a store, using the watcher library.
// Run locally (the library lives in ../retire-sim and isn't available in CI); commit the report.json files.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, watcher } from './watcher.mjs';

for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || !existsSync(join(ROOT, d.name, 'store', 'topics.json'))) continue;
  writeFileSync(join(ROOT, d.name, 'report.json'), watcher(['report', '--json', '--store', join(d.name, 'store')]));
  console.log('wrote', d.name + '/report.json');
}
