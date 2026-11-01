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
  problems: string[];
}

export interface PreflightDeps {
  git: (args: string[]) => string;
  claude: () => boolean;
  env: NodeJS.ProcessEnv;
  freeGb: (path: string) => number;
  /** Launch jobs in progress (phase 3): the dirty paths each owns while its commit is pending. */
  launches: () => { paths: string[] }[];
  tmpDir?: string;
  watcherDir?: (env: NodeJS.ProcessEnv, root: string) => string | null;
}

const defaultWatcher = (env: NodeJS.ProcessEnv, root: string): string | null => {
  const d = env.WATCHER_DIR || join(root, '..', 'retire-sim', 'watcher');
  return existsSync(d) ? d : null;
};

export function preflight(a: Automation, root: string, deps: PreflightDeps): Preflight {
  const problems: string[] = [];
  if (a.clone && resolve(a.clone) !== resolve(root))
    problems.push(`automation.json names the clone ${a.clone}; this checkout is ${root}: run the tick there`);
  let dirty: string[] = [];
  try {
    dirty = deps
      .git(['status', '--porcelain'])
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter(Boolean);
  } catch (e) {
    problems.push(`git status failed: ${(e as Error).message.split('\n')[0]}`);
  }
  const owned = new Set(deps.launches().flatMap((l) => l.paths));
  const unowned = dirty.filter((p) => ![...owned].some((o) => p === o || p.startsWith(`${o}/`)));
  if (unowned.length)
    problems.push(`the clone is dirty: ${unowned.slice(0, 5).join(', ')}${unowned.length > 5 ? ', ...' : ''}`);
  try {
    const branch = deps.git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch !== a.git.commitOn && a.git.commitOn === 'main') problems.push(`the clone is on ${branch}, not main`);
  } catch (e) {
    problems.push(`git rev-parse failed: ${(e as Error).message.split('\n')[0]}`);
  }
  if (!deps.claude()) problems.push(`${a.agents.command} -p did not answer within 60 s: is Claude Code logged in?`);
  if (a.enabled.tick && !mailConfigFromEnv(deps.env))
    problems.push('mail is not configured: MAIL_SMTP_HOST, MAIL_IMAP_HOST, MAIL_USER and MAIL_PASSWORD in .env');
  const tmp = deps.tmpDir ?? tmpdir();
  const free = deps.freeGb(tmp);
  if (free < a.runs.minFreeGb)
    problems.push(`${free.toFixed(1)} GB free on the drive of ${tmp}; renders need ${a.runs.minFreeGb}`);
  if (a.enabled.discovery && !(deps.watcherDir ?? defaultWatcher)(deps.env, root))
    problems.push('the watcher checkout is missing (../retire-sim/watcher or WATCHER_DIR): discovery needs it');
  return { ok: problems.length === 0, problems };
}
