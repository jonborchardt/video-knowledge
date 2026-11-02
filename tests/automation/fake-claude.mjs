#!/usr/bin/env node
// A stand-in for `claude -p` in tests. FAKE_CLAUDE_SCENARIO names a JSON file:
//   [{ match: '<regex on the prompt>', actions: [{ copy, to } | { write, text }], cost, error?, result?, sleepMs?,
//      sleepAfterMs?, dumpEnv?, model?, tokens?, turns? }]
// The first entry whose regex matches the prompt is applied (files relative to cwd), then a print-mode result JSON is
// printed with the real CLI's usage keys: { type: 'result', total_cost_usd, session_id, is_error, result, usage,
// modelUsage (keyed by the scenario's model, default fake-sonnet), num_turns, duration_ms, duration_api_ms,
// stop_reason, permission_denials: [] }. `sleepAfterMs` sleeps after printing (a hang after the result).
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

const t = { input: 100, output: 20, cacheRead: 0, cacheCreate: 0, ...(entry.tokens ?? {}) };
const model = entry.model ?? 'fake-sonnet';
const cost = entry.cost ?? 0;
process.stdout.write(
  JSON.stringify({
    type: 'result',
    subtype: entry.error ? 'error_during_execution' : 'success',
    is_error: Boolean(entry.error),
    duration_ms: 1000,
    duration_api_ms: 800,
    num_turns: entry.turns ?? 1,
    stop_reason: entry.error ? null : 'end_turn',
    total_cost_usd: cost,
    session_id: session,
    result: entry.result ?? `fake agent: ${entry.match ?? 'no scenario'}`,
    usage: {
      input_tokens: t.input,
      output_tokens: t.output,
      cache_read_input_tokens: t.cacheRead,
      cache_creation_input_tokens: t.cacheCreate,
    },
    modelUsage: {
      [model]: {
        inputTokens: t.input,
        outputTokens: t.output,
        cacheReadInputTokens: t.cacheRead,
        cacheCreationInputTokens: t.cacheCreate,
        webSearchRequests: 0,
        costUSD: cost,
        contextWindow: 200000,
        canonicalModel: model.replace(/-\d{8}$/, ''),
      },
    },
    permission_denials: [],
  }) + '\n',
);
if (entry.sleepAfterMs) await new Promise((r) => setTimeout(r, entry.sleepAfterMs));
process.exit(entry.error ? 1 : 0);
