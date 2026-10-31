// npm run run -- <verb> ...
//   story <topic> <story-id> [--approver "<name>"] [--notes-file <path>] [--until <stage>]
//                                      drive one story from the board's ready to packaged (or to <stage>) unattended: each
//                                      board step runs as a child process or a budgeted claude -p agent under its role's
//                                      permission rules; journaled under the story's run/; one run per story (exit 3 when
//                                      a live run holds it); a crash resumes with the same command. Exit 0 done, 1 halted
//                                      (HALT <kind>: <why> then UNBLOCK: <what clears it>), 2 usage or refusal.
//   status [--json]                    every run folder: running, halted (kind, why, unblock) or idle, and its spend.
// Policy: automation.json (src/shared/automation.ts). Secrets: .env, loaded here and handed to each child by verb.
import { readFileSync } from 'node:fs';
import { loadAutomation } from '../../shared/automation';
import { approverProblem } from '../../shared/approver';
import { loadDotEnv, ROOT, toJson } from '../../shared/io';
import { PRODUCTION_STAGES, type ProductionStage } from '../production';
import { runStory } from './runner';
import { renderStatus, statusOf } from './status';

const usage = () =>
  readFileSync(new URL(import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('//'))
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n');

const [verb, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

const die = (msg: string, code = 2): never => {
  console.error(msg);
  process.exit(code);
};

loadDotEnv();

switch (verb) {
  case 'story': {
    const [topic, storyId] = rest;
    if (!topic || !storyId) die(usage());
    const approver = flag('--approver');
    if (approver !== undefined) {
      const problem = approverProblem(approver);
      if (problem) die(problem);
    }
    const until = flag('--until') as ProductionStage | undefined;
    if (until && !PRODUCTION_STAGES.includes(until)) die(`--until must be one of ${PRODUCTION_STAGES.join(', ')}`);
    const notesFile = flag('--notes-file');
    const a = loadAutomation(ROOT);
    const r = await runStory(topic, storyId, a, {
      approver: approver ?? `automated: run ${new Date().toISOString().slice(0, 10)}`,
      notes: notesFile ? readFileSync(notesFile, 'utf8') : undefined,
      until,
      root: ROOT,
    });
    if (r.outcome === 'held') die(`a live run holds ${topic} ${storyId}; nothing done`, 3);
    if (r.outcome === 'halted' && r.halt) {
      console.log(`HALT ${r.halt.kind}: ${r.halt.why}`);
      console.log(`UNBLOCK: ${r.halt.unblock.text}`);
      console.log(`stage ${r.stage}; ${r.iterations} iterations; ${r.costUsd.toFixed(2)} USD`);
      process.exit(1);
    }
    console.log(`done at ${r.stage}; ${r.iterations} iterations; ${r.costUsd.toFixed(2)} USD`);
    break;
  }
  case 'status': {
    const rows = statusOf(ROOT);
    process.stdout.write(rest.includes('--json') ? toJson(rows) : renderStatus(rows));
    break;
  }
  default:
    die(usage());
}
