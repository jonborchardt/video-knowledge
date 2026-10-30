// Run the watcher CLI from its checkout (../retire-sim/watcher by default, or $WATCHER_DIR). It isn't an npm
// dependency, so `npm ci` works in CI where that checkout doesn't exist; only the local data scripts need it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, TOPICS, topicDir } from '../../shared/io.ts'; // one definition of the repo root, shared with the TypeScript stages

export { ROOT, TOPICS, topicDir };
const CLI = join(process.env.WATCHER_DIR ?? join(ROOT, '..', 'retire-sim', 'watcher'), 'src', 'cli.ts');

export function watcher(args, opts = {}) {
  if (!existsSync(CLI))
    throw new Error(`watcher CLI not found at ${CLI}; check out retire-sim next to this repo or set WATCHER_DIR`);
  return execFileSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

// `npm run watcher -- <args>`: pass straight through to the CLI.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    watcher(process.argv.slice(2), { stdio: 'inherit' });
  } catch (e) {
    process.exitCode = e.status ?? 1;
  }
}
