#!/usr/bin/env node
// A stand-in for `claude -p` in tests. FAKE_CLAUDE_SCENARIO names a JSON file:
//   [{ match: '<regex on the prompt>', actions: [{ copy, to } | { write, text }], cost, error?, result?, sleepMs?, dumpEnv? }]
// The first entry whose regex matches the prompt is applied (files relative to cwd), then a print-mode result JSON is
// printed: { type: 'result', total_cost_usd, session_id, is_error, result, permission_denials: [] }.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
if (process.env.FAKE_CLAUDE_LOG) writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify(argv) + '\n', { flag: 'a' });
const prompt = argv[argv.indexOf('-p') + 1] ?? '';
const resumeAt = argv.indexOf('--resume');
const session = resumeAt >= 0 ? argv[resumeAt + 1] : `fake-${Math.random().toString(36).slice(2, 8)}`;
const scenario = process.env.FAKE_CLAUDE_SCENARIO
  ? JSON.parse(readFileSync(process.env.FAKE_CLAUDE_SCENARIO, 'utf8'))
  : [];
const entry = scenario.find((e) => new RegExp(e.match).test(prompt)) ?? { actions: [], cost: 0 };

const out = (p) => {
  const full = resolve(process.cwd(), p);
  mkdirSync(dirname(full), { recursive: true });
  return full;
};
for (const action of entry.actions ?? []) {
  if (action.copy) copyFileSync(resolve(process.cwd(), action.copy), out(action.to));
  else if (action.write !== undefined) writeFileSync(out(action.write), action.text ?? '');
  else if (action.append !== undefined) writeFileSync(out(action.append), action.text ?? '', { flag: 'a' });
}
if (entry.dumpEnv) writeFileSync(out(entry.dumpEnv), JSON.stringify(process.env, null, 1));
if (entry.sleepMs) await new Promise((r) => setTimeout(r, entry.sleepMs));
if (entry.log) process.stderr.write(entry.log + '\n');

process.stdout.write(
  JSON.stringify({
    type: 'result',
    subtype: entry.error ? 'error_during_execution' : 'success',
    total_cost_usd: entry.cost ?? 0,
    session_id: session,
    is_error: Boolean(entry.error),
    result: entry.result ?? `fake agent: ${entry.match ?? 'no scenario'}`,
    permission_denials: [],
  }) + '\n',
);
process.exit(entry.error ? 1 : 0);
