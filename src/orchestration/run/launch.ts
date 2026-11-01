// The launch job (spec §4.4, §4.5's git rows, phase 3 Task 4): once a story's release group is live and verified,
// today's go-live sequence (report seed, brand, build, links freeze, validate, commit, push) runs in the automation
// clone as one work-plane job with a progress record under .automation/launch/, so a crash resumes at the step it
// stopped at, a commit is never repeated and a push never forced. The deploy confirmation is the tick's: one probe
// per pass; confirmed, the social post (when the institution has an account) and the launch email follow.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Automation } from '../../shared/automation';
import { isFixtureTopic } from '../../config/site';
import type { CliResult } from '../../shared/cli';
import { ROOT, readJson, scriptDir, storySlug, topicDir, writeJsonAtomic } from '../../shared/io';
import type { MailTransport } from '../../shared/mail';
import { loadLedger, openOutput } from '../../modules/publishing';
import { liveCheck } from '../../modules/website';
import { type Halt, clearHalt, readHalt, runDir, writeHalt } from './journal';
import { acquire, aliveLocks, readLock, release } from './lock';
import { alive } from './proc';
import { automationDir, sendTracked } from './notify';
import { storiesWithLedgers } from './publish-due';
import { renderLaunched } from './requests';
import type { RunResult } from './runner';
import type { Job } from './work';

export const LAUNCH_DIR = 'launch';
export interface LaunchRecord {
  topic: string;
  storyId: string;
  startedAt: string;
  steps: Partial<Record<'pulled' | 'seeded' | 'branded' | 'built' | 'frozen' | 'validated', string>>; // ISO when done
  committed: string | null; // the sha
  pushed: string | null; // the sha pushed to origin main
  fixtureBranch?: string | null; // a fixture story: the branch the same commit was pushed as (fixture/<run id>)
  previewUrl?: string | null; // a fixture story: where the positive probe looked ('local fallback' without a preview URL)
  probes: number;
  liveAt: string | null;
  posted: boolean | 'not-configured' | null;
  emailed: boolean;
  halt?: Halt | null;
}
export const launchPath = (topic: string, storyId: string, root = ROOT) =>
  join(automationDir(root), LAUNCH_DIR, `${topic}--${storySlug(storyId)}.json`);
/** The launch's lock folder: one launch of a story at a time, across work instances. */
export const launchLockDir = (topic: string, storyId: string, root = ROOT) =>
  join(automationDir(root), LAUNCH_DIR, `${topic}--${storySlug(storyId)}.lock`);
export const readLaunch = (topic: string, storyId: string, root = ROOT) =>
  readJson<LaunchRecord>(launchPath(topic, storyId, root));
export function writeLaunch(root: string, r: LaunchRecord): void {
  mkdirSync(join(automationDir(root), LAUNCH_DIR), { recursive: true });
  writeJsonAtomic(launchPath(r.topic, r.storyId, root), r);
}
/** Every launch record under .automation/launch/. */
export function launches(root = ROOT): LaunchRecord[] {
  const dir = join(automationDir(root), LAUNCH_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => readJson<LaunchRecord>(join(dir, n)))
    .filter((r): r is LaunchRecord => !!r);
}
/** The paths a launch owns while its commit is pending: the story's topic, the site outputs. */
export const LAUNCH_PATHS = (topic: string) => [`topics/${topic}`, 'public', 'public-urls.json', 'brand'];
/** What the preflight lets stand dirty: the paths of every launch in progress (committed: null). */
export const launchPaths = (root = ROOT): { paths: string[] }[] =>
  launches(root)
    .filter((r) => !r.committed)
    .map((r) => ({ paths: LAUNCH_PATHS(r.topic) }));

export interface LaunchDeps {
  now?: () => number;
  git: (args: string[]) => string;
  /** Runs `npm run <cli> -- <args>` and waits. */
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  /** `npm run validate`. */
  validate: () => { ok: boolean; output: string };
}

/** Why the story may not be launched, or null: the main output published and verified since; no Short left
 *  approved or scheduled (each goes live from the tick before the launch). */
export function launchProblem(topic: string, storyId: string, root = ROOT): string | null {
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger) return 'no publish.json';
  const main = openOutput(topic, storyId, { root });
  if (!main.state.live) return `${main.id} is not live (${main.state.status})`;
  const ev = ledger.outputs[main.id].events;
  const published = ev.findLastIndex((e) => e.type === 'published');
  const verified = ev.slice(published).find((e) => e.type === 'verified' && e.result === 'passed');
  if (!verified) return `${main.id} is live but not verified since: npm run publish -- verify`;
  for (const id of Object.keys(ledger.outputs)) {
    if (!id.startsWith('short:')) continue;
    const s = openOutput(topic, storyId, { root, output: id });
    // an uploaded Short goes live before the launch (it is approved, scheduled, or behind on its parent link)
    if (s.state.id && !s.state.live) return `${id} is ${s.state.status}, not live yet`;
  }
  // another story of the topic with a live run writes under the same topic folder: the launch waits for it
  const mine = runDir(topic, storyId, root);
  const other = aliveLocks(root, alive).find(
    (dir) => dir !== mine && dir.replaceAll('\\', '/').includes(`/topics/${topic}/scripts/`),
  );
  if (other) return `${other.replaceAll('\\', '/').split('/').at(-2)} has a live run in this topic: the launch waits`;
  return null;
}

/** What the launch commits: this story's folder, the topic's derived files beside it (the report, the public record,
 *  the stories), and the site outputs; never another story's folder. */
export function launchStaged(topic: string, storyId: string, root = ROOT): string[] {
  const rel = (p: string) => relative(root, p).replaceAll('\\', '/');
  const dir = topicDir(topic, root);
  const files = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => rel(join(dir, e.name)))
    : [];
  return [rel(scriptDir(topic, storyId, root)), ...files, 'public', 'public-urls.json', 'brand'].filter((p) =>
    existsSync(join(root, p)),
  );
}

/** The launch jobs the work plane may start now: launchable stories without a finished or halted launch. */
export function launchJobs(a: Automation, root = ROOT): Job[] {
  const out: Job[] = [];
  for (const [topic, storyId] of storiesWithLedgers(root)) {
    if (launchProblem(topic, storyId, root)) continue;
    const held = readLock(launchLockDir(topic, storyId, root));
    if (held && alive(held.pid)) continue; // a work instance is launching it now
    const rec = readLaunch(topic, storyId, root);
    if (rec?.halt || readHalt(runDir(topic, storyId, root))) continue; // a person's
    if (rec && rec.committed && (rec.pushed || !a.launch.push)) continue; // launched
    out.push({ kind: 'launch', topic, storyId, why: 'launch: the release group is live' });
  }
  return out;
}

const LAUNCH_HALTS: Halt['kind'][] = ['git', 'deploy-timeout'];
/** The launch's halt, on the record and in the story's run folder (the board, the status rows and the halt mail
 *  read it there); cleared from both when the launch moves on. */
function haltLaunch(root: string, rec: LaunchRecord, h: Halt | null): void {
  rec.halt = h;
  writeLaunch(root, rec);
  const dir = runDir(rec.topic, rec.storyId, root);
  if (h) writeHalt(dir, h);
  else if (LAUNCH_HALTS.includes(readHalt(dir)?.kind ?? 'awaiting-person')) clearHalt(dir);
}

/** The job: refuse unless the group is live; then each step once (the record remembers), the commit once, the push
 *  once; a failure halts `git` with the step's last lines and the next job (or `npm run run -- launch`) resumes at
 *  that step. */
export async function launch(
  topic: string,
  storyId: string,
  a: Automation,
  d: LaunchDeps,
  root = ROOT,
): Promise<RunResult & { record: LaunchRecord | null }> {
  const now = d.now ?? Date.now;
  const problem = launchProblem(topic, storyId, root);
  const halted = (why: string, unblock: Halt['unblock'], record: LaunchRecord | null) => {
    const h: Halt = {
      kind: 'git',
      stage: 'launch',
      why,
      unblock,
      at: new Date(now()).toISOString(),
      runId: 'launch',
      board: { stage: 'launch', next: 'the launch' },
    };
    if (record) haltLaunch(root, record, h);
    const r: RunResult & { record: LaunchRecord | null } = {
      outcome: 'halted',
      stage: 'launch',
      halt: h,
      iterations: 0,
      costUsd: 0,
      record,
    };
    return r;
  };
  if (problem) return halted(`not launchable: ${problem}`, { kind: 'fix', text: problem }, null);
  // one launch of a story at a time (spec 4.4): a second work instance finds the lock held and ends held
  const lockDir = launchLockDir(topic, storyId, root);
  const got = acquire(lockDir, 'launch', { now, staleMinutes: a.runs.lockStaleMinutes });
  if ('held' in got)
    return {
      outcome: 'held',
      stage: 'launch',
      halt: null,
      iterations: 0,
      costUsd: 0,
      record: readLaunch(topic, storyId, root),
    };
  try {
    return await launchLocked(topic, storyId, a, d, root, now, halted);
  } finally {
    release(lockDir, got.lock);
  }
}

async function launchLocked(
  topic: string,
  storyId: string,
  a: Automation,
  d: LaunchDeps,
  root: string,
  now: () => number,
  halted: (
    why: string,
    unblock: Halt['unblock'],
    record: LaunchRecord | null,
  ) => RunResult & { record: LaunchRecord | null },
): Promise<RunResult & { record: LaunchRecord | null }> {
  const record: LaunchRecord = readLaunch(topic, storyId, root) ?? {
    topic,
    storyId,
    startedAt: new Date(now()).toISOString(),
    steps: {},
    committed: null,
    pushed: null,
    probes: 0,
    liveAt: null,
    posted: null,
    emailed: false,
  };
  haltLaunch(root, record, null);
  const save = () => writeLaunch(root, record);
  const tail = (s: string) => s.trim().split('\n').slice(-5).join(' | ');
  const step = async (name: keyof LaunchRecord['steps'], fn: () => Promise<string | null> | string | null) => {
    if (record.steps[name]) return null;
    const why = await fn();
    if (why) return why;
    record.steps[name] = new Date(now()).toISOString();
    save();
    return null;
  };
  const cli = async (name: string, args: string[]): Promise<string | null> => {
    const r = await d.run(name, args);
    return r.status === 0
      ? null
      : `npm run ${name} -- ${args.join(' ')} failed (exit ${r.status}): ${tail(r.stderr || r.stdout)}`;
  };
  const fail = (why: string) =>
    halted(
      why,
      {
        kind: 'fix',
        text: `fix it in the automation clone, then npm run run -- launch ${topic} ${storyId} resumes the launch (record: ${launchPath(topic, storyId, root)})`,
      },
      record,
    );
  if (!record.committed) {
    let why = await step('pulled', () => {
      // porcelain lines are "XY path": never trim the whole output (a leading space is the first line's status)
      const owned = LAUNCH_PATHS(topic);
      const unowned = d
        .git(['status', '--porcelain'])
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => l.slice(3).trim())
        .filter((p) => !owned.some((o) => p === o || p.startsWith(`${o}/`)));
      if (unowned.length) return `the clone is dirty outside the launch's paths: ${unowned.slice(0, 5).join(', ')}`;
      try {
        d.git(['pull', '--ff-only']);
        return null;
      } catch (e) {
        return `git pull --ff-only failed: ${tail((e as Error).message)}`;
      }
    });
    why ??= await step('seeded', () => cli('report', ['seed', topic]));
    why ??= await step('branded', () => cli('brand', []));
    why ??= await step('built', () => cli('build', []));
    why ??= await step('frozen', () => cli('links', ['freeze']));
    why ??= await step('validated', () => {
      const v = d.validate();
      return v.ok ? null : `npm run validate failed: ${tail(v.output)}`;
    });
    if (why) return fail(why);
    try {
      d.git(['add', '-A', '--', ...launchStaged(topic, storyId, root)]);
      const staged = d.git(['diff', '--cached', '--name-only']).trim();
      if (staged) d.git(['commit', '-q', '-m', `release(${topic}): ${storyId} is live`]); // an automated commit: no author line
      record.committed = d.git(['rev-parse', 'HEAD']).trim();
      save();
    } catch (e) {
      return fail(`git commit failed: ${tail((e as Error).message)}`);
    }
  }
  if (a.launch.push && !record.pushed) {
    try {
      d.git(['push', 'origin', `${record.committed}:refs/heads/main`]);
      record.pushed = record.committed;
      save();
    } catch (e) {
      return fail(`git push failed: ${tail((e as Error).message)}`);
    }
  }
  if (a.launch.push && isFixtureTopic(topic) && !record.fixtureBranch) {
    // the fixture's preview deployment: the same commit as a branch the host builds with FIXTURE_SITE=1 (spec §5.8)
    const branch = fixtureBranchOf(topic, storyId, root);
    try {
      d.git(['push', 'origin', `${record.committed}:refs/heads/${branch}`]);
      record.fixtureBranch = branch;
      save();
    } catch (e) {
      return fail(`git push of ${branch} failed: ${tail((e as Error).message)}`);
    }
  }
  haltLaunch(root, record, null);
  return { outcome: 'done', stage: 'launch', halt: null, iterations: 1, costUsd: 0, record };
}

/** The fixture's preview branch: `fixture/<run id>` from run/fresh.json (`manual` without one). */
export const fixtureBranchOf = (topic: string, storyId: string, root = ROOT): string =>
  `fixture/${readJson<{ runId: string }>(join(runDir(topic, storyId, root), 'fresh.json'))?.runId ?? 'manual'}`;
/** The preview URL of a branch from the configured pattern (`{branch}` slugified), or null without a pattern. */
export const previewUrlOf = (pattern: string, branch: string): string | null =>
  pattern ? pattern.replace('{branch}', branch.replace(/[^a-z0-9]+/gi, '-').toLowerCase()) : null;

export interface ProbeDeps {
  now?: () => number;
  fetchFn?: typeof fetch;
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  mail: MailTransport | null;
}

/** Tick step 5: one probe per pending launch (pushed, not yet live); confirmed, the social post when the policy
 *  says so and the institution is configured, then the launch email once; past the timeout, `deploy-timeout`. */
/** One pass of probing: a story's page on the public site; for a fixture, the negative probe there (no page, not
 *  frozen) and the positive one on the preview host, or the local fallback without a preview URL (spec §5.8). */
async function probeOf(
  a: Automation,
  rec: LaunchRecord,
  fetchFn: typeof fetch | undefined,
  root: string,
): Promise<{ ok: boolean; url: string; why?: string; preview?: string | null }> {
  if (!isFixtureTopic(rec.topic)) return liveCheck(rec.topic, rec.storyId, fetchFn, root);
  const absent = await liveCheck(rec.topic, rec.storyId, fetchFn, root, { expectAbsent: true });
  if (!absent.ok) return absent;
  const preview = previewUrlOf(
    a.launch.fixturePreviewUrl,
    rec.fixtureBranch ?? fixtureBranchOf(rec.topic, rec.storyId, root),
  );
  if (!preview) return { ok: true, url: absent.url, preview: 'local fallback' };
  const present = await liveCheck(rec.topic, rec.storyId, fetchFn, root, { baseUrl: preview, frozen: false });
  return { ...present, preview: present.ok ? present.url : undefined };
}

export async function probeLaunches(a: Automation, root = ROOT, d: ProbeDeps): Promise<string[]> {
  const now = d.now ?? Date.now;
  const actions: string[] = [];
  for (const rec of launches(root)) {
    const pushed = a.launch.push ? rec.pushed : rec.committed;
    if (!pushed) continue;
    if (rec.liveAt && rec.posted !== null && (rec.emailed || !d.mail)) continue; // finished
    const tag = `${rec.topic}/${rec.storyId}`;
    if (!rec.liveAt) {
      const probe = await probeOf(a, rec, d.fetchFn, root);
      rec.probes += 1;
      if (!probe.ok) {
        const since = rec.steps.validated ?? rec.startedAt;
        if (now() - Date.parse(since) > a.launch.deployTimeoutMinutes * 60_000) {
          haltLaunch(root, rec, {
            kind: 'deploy-timeout',
            stage: 'launch',
            why: `the deploy of ${tag} is not live after ${a.launch.deployTimeoutMinutes} minutes: ${probe.why}`,
            unblock: {
              kind: 'fix',
              text: `check the deploy of ${pushed} (CI, Cloudflare); the next tick probes again`,
            },
            at: new Date(now()).toISOString(),
            runId: 'tick',
            board: { stage: 'launch', next: 'the deploy' },
          });
          actions.push(`${tag}: deploy-timeout`);
        } else {
          writeLaunch(root, rec);
          actions.push(`${tag}: not live yet (probe ${rec.probes}): ${probe.why}`);
        }
        continue;
      }
      rec.liveAt = new Date(now()).toISOString();
      if (probe.preview !== undefined) rec.previewUrl = probe.preview;
      haltLaunch(root, rec, null);
      actions.push(
        `${tag}: live at ${probe.url}${probe.preview === 'local fallback' ? ' (preview: local fallback)' : ''}`,
      );
    }
    if (rec.posted === null) {
      if (a.enabled.social && a.launch.social.video) {
        // the post: not configured is journaled, a retryable failure is tried again next tick (the mail waits), a
        // final failure halts step-failed; never a second post of the same text (the module reconciles)
        const r = await d.run('social', ['post', rec.topic, rec.storyId]);
        if (/not configured/.test(r.stdout)) rec.posted = 'not-configured';
        else if (r.status === 0) rec.posted = true;
        else if (/retryable/.test(r.stdout)) {
          actions.push(`${tag}: post retryable, again next tick`);
          writeLaunch(root, rec);
          continue;
        } else {
          rec.posted = false;
          haltLaunch(root, rec, {
            kind: 'step-failed',
            stage: 'launch',
            why: `the X post of ${tag} failed: ${(r.stdout || r.stderr).trim().split('\n').at(-1)}`,
            unblock: {
              kind: 'fix',
              text: `fix the keys or the account, then npm run social -- post ${rec.topic} ${rec.storyId}`,
            },
            at: new Date(now()).toISOString(),
            runId: 'tick',
            board: { stage: 'launch', next: 'the X post' },
          });
        }
        actions.push(`${tag}: post ${rec.posted}`);
      } else rec.posted = 'not-configured';
      writeLaunch(root, rec);
    }
    if (d.mail && !rec.emailed) {
      await sendTracked(d.mail, renderLaunched(rec, a, root), 'launch', root, {
        now,
        topic: rec.topic,
        storyId: rec.storyId,
      });
      rec.emailed = true;
      writeLaunch(root, rec);
    }
  }
  return actions;
}
