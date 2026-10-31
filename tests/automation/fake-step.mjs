#!/usr/bin/env node
// A stand-in for a module CLI in runner tests: sleeps, prints, dumps its environment, fails once, exits as told.
//   --sleep <ms>  --print <text>  --exit <code>  --dump-env <path>  --once-file <path> (exit 2 until the file exists)
import { existsSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
if (opt('--dump-env')) writeFileSync(opt('--dump-env'), JSON.stringify(process.env, null, 1));
if (opt('--sleep')) await new Promise((r) => setTimeout(r, Number(opt('--sleep'))));
if (opt('--print')) process.stdout.write(opt('--print') + '\n');
const once = opt('--once-file');
if (once) {
  if (existsSync(once)) process.exit(0);
  writeFileSync(once, 'seen');
  process.stdout.write('findings: one sentence lacks an assertion\n');
  process.exit(2);
}
process.exit(Number(opt('--exit') ?? 0));
