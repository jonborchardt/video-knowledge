// A long verb the review page starts (upload, push, sync, go-live, video final): the repo's own CLI as a child of the dev
// server, one at a time per production, its output in video/review-job.log and its state in video/review-job.json
// (both gitignored). The CLI does every check and every ledger write; this only runs it and reports how it ended.
// ponytail: the job dies with the dev server; the page then shows it as lost, and upload resumes its own session.
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, readJson, toJson } from './io';

export const JOB_FILE = 'review-job.json';
export const JOB_LOG = 'review-job.log';
export interface Job {
  label: string;
  args: string[]; // [cli, ...args]: cli is a scripts/<cli>.ts
  pid: number;
  startedAt: string;
  exitCode: number | null;
}
export type JobState = 'running' | 'done' | 'failed' | 'lost';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const paths = (dir: string) => ({ json: join(dir, 'video', JOB_FILE), log: join(dir, 'video', JOB_LOG) });

/** The last job of the production in `dir`, or null; `tail` is the end of its log. */
export function jobStatus(dir: string): { label: string; state: JobState; tail: string; startedAt: string } | null {
  const p = paths(dir);
  const job = readJson<Job>(p.json);
  if (!job) return null;
  // a job started before this process is the previous server's: its pid may be reused by now, so it is lost
  const ours = Date.parse(job.startedAt) >= Date.now() - process.uptime() * 1000;
  const state: JobState =
    job.exitCode === null ? (ours && alive(job.pid) ? 'running' : 'lost') : job.exitCode === 0 ? 'done' : 'failed';
  const log = existsSync(p.log) ? readFileSync(p.log, 'utf8') : '';
  return { label: job.label, state, tail: log.split(/\r?\n/).slice(-15).join('\n').trim(), startedAt: job.startedAt };
}

/** Starts `npm run <cli> -- <args>` (as tsx scripts/<cli>.ts, no shell, so no argument is ever re-parsed) for the
 *  production in `dir`; refuses while that production's last job is still running. */
export function startJob(dir: string, label: string, args: string[], root = ROOT): void {
  if (jobStatus(dir)?.state === 'running')
    throw new Error(`a job is running (${readJson<Job>(paths(dir).json)!.label})`);
  const [cli, ...rest] = args;
  if (!/^[a-z]+$/.test(cli ?? '')) throw new Error(`not a CLI: ${cli}`);
  const p = paths(dir);
  const fd = openSync(p.log, 'w');
  const child = spawn(
    process.execPath,
    [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join('scripts', `${cli}.ts`), ...rest],
    { cwd: root, stdio: ['ignore', fd, fd], windowsHide: true },
  );
  closeSync(fd);
  const job: Job = { label, args, pid: child.pid ?? -1, startedAt: new Date().toISOString(), exitCode: null };
  writeFileSync(p.json, toJson(job));
  const end = (code: number) => writeFileSync(p.json, toJson({ ...job, exitCode: code }));
  child.on('exit', (code) => end(code ?? 1));
  child.on('error', () => end(1));
}
