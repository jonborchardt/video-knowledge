// The tick's preflight (spec §4.4 step 2): the clone, a clean tree on main (a launch job's own dirty paths excepted),
// a Claude that answers, the mailbox when the tick is on, free disk for renders, the watcher when discovery is on.
// A failure is a `preflight` halt, emailed once; the tick does nothing else that pass.
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Automation } from '../../shared/automation';
import { mailConfigFromEnv } from '../../shared/mail';

export interface Preflight {
  ok: boolean;
  problems: string[]; // stable sentences (the halt's key hashes them): the same problem reads the same every tick
  details: string[]; // the specifics (paths, numbers), for the unblock text
}

export interface PreflightDeps {
  git: (args: string[]) => string;
  claude: () => boolean;
  env: NodeJS.ProcessEnv;
  freeGb: (path: string) => number;
  /** Launch jobs in progress (phase 3): the dirty paths each owns while its commit is pending. */
  launches: () => { paths: string[] }[];
  /** Stories with a live run (their folders, relative to the root): the runner commits only at its finish, so their
   *  artifacts, and the shared folders a graphics agent writes, are dirty for the length of a run. */
  running?: () => string[];
  tmpDir?: string;
  watcherDir?: (env: NodeJS.ProcessEnv, root: string) => string | null;
}

const defaultWatcher = (env: NodeJS.ProcessEnv, root: string): string | null => {
  const d = env.WATCHER_DIR || join(root, '..', 'retire-sim', 'watcher');
  return existsSync(d) ? d : null;
};

/** The folders a live story run may leave dirty besides its own: what the runner commits at the finish. */
export const RUN_SHARED_DIRS = ['src/modules/video/bespoke', 'src/modules/video/remotion/scenes', 'music'];

export function preflight(a: Automation, root: string, deps: PreflightDeps): Preflight {
  const problems: string[] = [];
  const details: string[] = [];
  const problem = (stable: string, detail?: string) => {
    problems.push(stable);
    if (detail) details.push(detail);
  };
  if (a.clone && resolve(a.clone) !== resolve(root))
    problem(
      'this checkout is not the automation clone',
      `automation.json names the clone ${a.clone}; this checkout is ${root}: run the tick there`,
    );
  let dirty: string[] = [];
  try {
    dirty = deps
      .git(['status', '--porcelain'])
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter(Boolean);
  } catch (e) {
    problem('git status failed', (e as Error).message.split('\n')[0]);
  }
  const running = deps.running?.() ?? [];
  const owned = new Set([
    ...deps.launches().flatMap((l) => l.paths),
    ...running,
    ...(running.length ? RUN_SHARED_DIRS : []),
  ]);
  const unowned = dirty.filter((p) => ![...owned].some((o) => p === o || p.startsWith(`${o}/`)));
  if (unowned.length)
    problem('the clone is dirty', `dirty: ${unowned.slice(0, 5).join(', ')}${unowned.length > 5 ? ', ...' : ''}`);
  try {
    const branch = deps.git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch !== a.git.commitOn && a.git.commitOn === 'main')
      problem('the clone is not on main', `the clone is on ${branch}, not main`);
  } catch (e) {
    problem('git rev-parse failed', (e as Error).message.split('\n')[0]);
  }
  if (!deps.claude()) problem(`${a.agents.command} -p did not answer within 60 s: is Claude Code logged in?`);
  if (a.enabled.tick && !mailConfigFromEnv(deps.env))
    problem('mail is not configured: MAIL_SMTP_HOST, MAIL_IMAP_HOST, MAIL_USER and MAIL_PASSWORD in .env');
  if (a.enabled.tick && !a.notifications.to)
    problem('automation.json notifications.to is empty: nothing could be emailed');
  const tmp = deps.tmpDir ?? tmpdir();
  const free = deps.freeGb(tmp);
  if (free < a.runs.minFreeGb)
    problem(
      `free disk below ${a.runs.minFreeGb} GB on the drive of ${tmp}`,
      `${free.toFixed(1)} GB free; renders need ${a.runs.minFreeGb}`,
    );
  if (a.enabled.discovery && !(deps.watcherDir ?? defaultWatcher)(deps.env, root))
    problem('the watcher checkout is missing (../retire-sim/watcher or WATCHER_DIR): discovery needs it');
  return { ok: problems.length === 0, problems, details };
}
