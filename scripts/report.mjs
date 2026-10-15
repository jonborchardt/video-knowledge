// node scripts/report.mjs — write <subject>/report.json for every subject with a store, using the watcher library.
// Run locally (the library is linked from ../retire-sim and isn't available in CI); commit the report.json files.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const cli = join(ROOT, 'node_modules', 'watcher', 'src', 'cli.ts');
for (const d of readdirSync(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || !existsSync(join(ROOT, d.name, 'store', 'topics.json'))) continue;
  const json = execFileSync(process.execPath, ['--import', 'tsx', cli, 'report', '--json', '--store', join(d.name, 'store')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  writeFileSync(join(ROOT, d.name, 'report.json'), json);
  console.log('wrote', d.name + '/report.json');
}
