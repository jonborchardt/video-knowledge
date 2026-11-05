// The repo's CLIs as child processes. A module that needs another module's verb runs it here, by its `npm run`
// name, never by a hand-written path (two of those went stale when the files moved) and never through npm or a
// shell (so no argument is re-parsed and Windows prints no DEP0190): the same `node` that runs the parent, the
// repo's tsx and tsconfig, and the file package.json names for that script.
import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './io';

// The checkout this code lives in: its package.json, tsx and tsconfig are the code's own, whatever `ROOT` resolves
// to (a test's fixture root shadows ROOT by carrying the repo's name, so a CLI works on the fixture's topics; the
// CLIs themselves still live here).
const CODE = fileURLToPath(new URL('../..', import.meta.url));

const packageScript = (name: string): string =>
  (JSON.parse(readFileSync(join(CODE, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts?.[
    name
  ] ?? '';

/** The file `npm run <name>` runs, as package.json writes it (`tsx <file>` or `node <file>`), relative to the repo. */
export function cliScript(name: string): string {
  const m = /^(?:tsx|node) (\S+)$/.exec(packageScript(name));
  if (!m) throw new Error(`package.json has no CLI script ${name}`);
  return m[1];
}

/** `[node, [tsx, --tsconfig, <repo tsconfig>, <file>, ...args]]`: the argv that runs `npm run <name> -- <args>`
 *  without npm, from any cwd; a `.mjs` script runs under node alone, an `astro <command>` script under astro's bin. */
export function cliArgv(name: string, args: string[]): [string, string[]] {
  // `astro build` is a command of the installed package, not a file of the repo; it builds the project in the cwd
  const astro = /^astro (\S+)$/.exec(packageScript(name));
  if (astro) return [process.execPath, [join(CODE, 'node_modules', 'astro', 'bin', 'astro.mjs'), astro[1], ...args]];
  const file = join(CODE, cliScript(name));
  const runner = file.endsWith('.mjs')
    ? []
    : [join(CODE, 'node_modules', 'tsx', 'dist', 'cli.mjs'), '--tsconfig', join(CODE, 'tsconfig.json')];
  return [process.execPath, [...runner, file, ...args]];
}

/** What a child CLI run answers: the exit status and both streams (what the orchestration's steps take, so a test
 *  can run the verb in process). */
export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs `npm run <name> -- <args>` and waits: stdout and stderr captured as text unless `stdio` says otherwise.
 *  `cwd` defaults to `ROOT`; a test passes its fixture root. */
export function runCli(
  name: string,
  args: string[],
  opts: Pick<SpawnSyncOptions, 'cwd' | 'stdio' | 'env'> = {},
): SpawnSyncReturns<string> {
  const [exe, argv] = cliArgv(name, args);
  return spawnSync(exe, argv, {
    cwd: opts.cwd ?? ROOT,
    ...(opts.env && { env: opts.env }),
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  });
}
