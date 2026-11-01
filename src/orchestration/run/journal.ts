// The runner's own record of a story run, under the story's gitignored run/ folder: one journal line per step
// attempt, the current halt (if any), and the halt kinds the runner adds beside the board's HALT_KINDS. Operational
// state only: nothing here decides a workflow stage (the board re-derives that from the artifacts).
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, scriptDir, topicDir, writeJsonAtomic } from '../../shared/io';

export const RUN_DIR = 'run';
/** A topic run's operational folder: topics/<topic>/work/run/ (the runner's markers and journal; gitignored with work/). */
export const TOPIC_RUN_DIR = 'run';
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
  costUsd?: number;
  sessionId?: string;
  error?: string;
}

export function appendJournal(dir: string, e: JournalEntry): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, JOURNAL), JSON.stringify(e) + '\n');
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
