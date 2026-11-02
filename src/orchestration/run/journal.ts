// The runner's own record of a story run, under the story's gitignored run/ folder: one journal line per step
// attempt, the current halt (if any), and the halt kinds the runner adds beside the board's HALT_KINDS. Operational
// state only: nothing here decides a workflow stage (the board re-derives that from the artifacts).
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, scriptDir, topicDir, writeJsonAtomic } from '../../shared/io';
import type { ModelUsage } from './agent';

export const RUN_DIR = 'run';
/** A topic run's operational folder: topics/<topic>/work/run/ (the runner's markers and journal; gitignored with work/). */
export const TOPIC_RUN_DIR = 'run';
/** Under a run folder: the whole output of the finish's `npm run validate` when it failed (the halt keeps five lines). */
export const VALIDATE_LOG = 'validate.log';
export function writeValidateLog(dir: string, output: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, VALIDATE_LOG), output);
  return `${dir.replaceAll('\\', '/')}/${VALIDATE_LOG}`;
}
export const topicRunDir = (topic: string, root = ROOT): string => {
  const d = join(topicDir(topic, root), 'work', TOPIC_RUN_DIR);
  mkdirSync(d, { recursive: true });
  return d;
};
const JOURNAL = 'journal.jsonl';
const HALT = 'halt.json';

/** `topics/<topic>/scripts/<slug>/run/`, created on demand. */
export function runDir(topic: string, storyId: string, root = ROOT): string {
  const d = join(scriptDir(topic, storyId, root), RUN_DIR);
  mkdirSync(d, { recursive: true });
  return d;
}

export interface JournalEntry {
  at: string;
  runId: string;
  stage: string;
  next: string;
  step: string;
  kind: 'run' | 'prompt' | 'validate' | 'guard' | 'do' | 'halt' | 'resume' | 'finish';
  attempt: number;
  exit?: number | null;
  ms?: number;
  /** The sum over the step's agent attempts (its validator rounds), as the attempt records hold them one by one. */
  costUsd?: number;
  sessionId?: string;
  error?: string;
  /** M3 usage metadata of a prompt step (absent on every line before it: unknown, never zero). */
  modelRequested?: string;
  models?: ModelUsage[];
  turns?: number;
  apiMs?: number;
  rounds?: number;
  overCap?: boolean;
}

/** Appends one line and returns its 1-based line number (the key of the step's attempt records). */
export function appendJournal(dir: string, e: JournalEntry): number {
  mkdirSync(dir, { recursive: true });
  const line = nextLine(dir);
  appendFileSync(join(dir, JOURNAL), JSON.stringify(e) + '\n');
  return line;
}
/** The line number the next appended entry gets. */
export function nextLine(dir: string): number {
  const p = join(dir, JOURNAL);
  if (!existsSync(p)) return 1;
  return (
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => l.trim()).length + 1
  );
}

/** One `claude -p` invocation (an attempt: a round of a step), recorded under `run/agents/<journal line>-<round>.json`
 *  by the step as it runs: written open at spawn (no `finishedAt`), overwritten complete when the process ends.
 *  Usage, outcome and error metadata only: never the prompt, the reply or stdout (the step log keeps the validator's
 *  output). Failed, timed-out and resumed attempts are recorded like the rest; nothing prunes them. */
export interface AttemptRecord {
  line: number;
  round: number;
  at: string;
  finishedAt: string | null;
  step: string;
  role: string;
  modelRequested: string;
  models: ModelUsage[];
  effort: string;
  turns: number | null;
  costUsd: number;
  budgetUsd: number;
  overCap: boolean;
  ms: number;
  apiMs: number | null;
  exit: number | null;
  isError: boolean;
  subtype: string | null;
  stopReason: string | null;
  errors: string[];
  denials: string[];
  sessionId: string | null;
  resumedFrom: string | null;
  pid?: number;
  /** The run that made the attempt: part of the file name, so a crash and a resume that reach the same journal
   *  line keep both records (absent on records written before it). */
  runId?: string;
}
export const ATTEMPTS_DIR = 'agents';
export const attemptPath = (dir: string, line: number, round: number, runId?: string) =>
  join(dir, ATTEMPTS_DIR, `${line}-${round}${runId ? `-${runId}` : ''}.json`);
export function writeAttempt(dir: string, r: AttemptRecord): void {
  mkdirSync(join(dir, ATTEMPTS_DIR), { recursive: true });
  writeJsonAtomic(attemptPath(dir, r.line, r.round, r.runId), r);
}
/** Every attempt record of a run folder, by line, round, then run. */
export function readAttempts(dir: string): AttemptRecord[] {
  const d = join(dir, ATTEMPTS_DIR);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((n) => /^\d+-\d+(-[\w.-]+)?\.json$/.test(n))
    .flatMap((n) => readJson<AttemptRecord>(join(d, n)) ?? [])
    .sort((x, y) => x.line - y.line || x.round - y.round || (x.runId ?? '').localeCompare(y.runId ?? ''));
}

export function readJournal(dir: string): JournalEntry[] {
  const p = join(dir, JOURNAL);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as JournalEntry];
      } catch {
        return []; // a kill mid-append leaves a partial last line; it carries nothing a resume needs
      }
    });
}

/** How many attempts the journal records at `next` since the last `resume` or `finish` entry. */
export function attemptsAt(entries: JournalEntry[], next: string): number {
  let n = 0;
  for (const e of entries) {
    if (e.kind === 'resume' || e.kind === 'finish') n = 0;
    else if (e.next === next) n++;
  }
  return n;
}

export const RUN_HALT_KINDS = [
  'awaiting-person',
  'cap',
  'budget',
  'timeout',
  'step-failed',
  'no-progress',
  'retries-spent',
  'lock-stale',
  'unexpected-edit',
  'forbidden-flag',
  'git',
  'preflight',
  'request-expired',
  'deploy-timeout',
  'needs-person',
] as const;
export type RunHaltKind = (typeof RUN_HALT_KINDS)[number];

export interface Halt {
  kind: RunHaltKind;
  stage: string;
  why: string;
  unblock: { kind: 'run' | 'decide' | 'fix'; text: string };
  at: string;
  runId: string;
  /** The board's answer when the halt was written: a tick resumes a non-retryable halt once this moves. */
  board: { stage: string; next: string };
  /** The halt resumes by backoff without a person (a transient the release loop met: YouTube processing, a retryable
   *  API failure); never emailed, counted by `resumesSince` like a timeout. */
  retryable?: boolean;
}

export function writeHalt(dir: string, h: Halt): void {
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(join(dir, HALT), h);
}
export const readHalt = (dir: string): Halt | null => readJson<Halt>(join(dir, HALT));
export function clearHalt(dir: string): void {
  const p = join(dir, HALT);
  if (existsSync(p)) unlinkSync(p);
}
