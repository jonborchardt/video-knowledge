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
import type { Mailer } from './mailer';
import { type PublishEvent, decidedOk, loadLedger, openOutput } from '../../modules/publishing';
import { accountFor, loadSocial } from '../../modules/social';
import { liveCheck } from '../../modules/website';
import { type Halt, clearHalt, readHalt, runDir, writeHalt } from './journal';
import { acquire, aliveLocks, readLock, release } from './lock';
import { alive } from './proc';
import { automationDir } from './notify';
import { MAX_TRIES, countTry, storiesWithLedgers, triesOf } from './publish-due';
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
  /** How many ticks ran `social -- post` for it (a retryable failure is tried again, POST_ATTEMPTS times). */
  postAttempts?: number;
  emailed: boolean;
  halt?: Halt | null;
}
/** How many ticks try the X post before a retryable failure becomes the person's (`step-failed`). */
export const POST_ATTEMPTS = 3;
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

/** The main output as the launch reads it: its state, and the person's `decided ok` when the video is approved and
 *  not yet public (plan B: the page is deployed on the decision, the tick goes live after the probe). */
function releaseOf(topic: string, storyId: string, root: string) {
  const main = openOutput(topic, storyId, { root });
  const decided = !main.state.live && main.state.status === 'approved' ? decidedOk(main.out) : null;
  return { main, decided };
}

/** Why the story may not be launched, or null: the main output published and verified since, or approved and
 *  decided ok (the page goes up before the video); no live run of another story in the topic. */
export function launchProblem(topic: string, storyId: string, root = ROOT): string | null {
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger) return 'no publish.json';
  const { main, decided } = releaseOf(topic, storyId, root);
  if (!main.state.live && !decided) return `${main.id} is not live (${main.state.status})`;
  if (main.state.live) {
    const ev = ledger.outputs[main.id].events;
    const published = ev.findLastIndex((e) => e.type === 'published');
    const verified = ev.slice(published).find((e) => e.type === 'verified' && e.result === 'passed');
    if (!verified) return `${main.id} is live but not verified since: npm run publish -- verify`;
  }
  // another story of the topic with a live run writes under the same topic folder: the launch waits for it
  const mine = runDir(topic, storyId, root);
  const other = aliveLocks(root, alive).find(
    (dir) => dir !== mine && dir.replaceAll('\\', '/').includes(`/topics/${topic}/scripts/`),
  );
  if (other) return `${other.replaceAll('\\', '/').split('/').at(-2)} has a live run in this topic: the launch waits`;
  return null;
}

/** Why the launch may not be announced yet (the X post, the launch mail), or null: the main output live and verified
 *  since its publish, every uploaded Short live (each goes live from the tick after the video). */
export function announceProblem(topic: string, storyId: string, root = ROOT): string | null {
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger) return 'no publish.json';
  const main = openOutput(topic, storyId, { root });
  if (!main.state.live) return `${main.id} is not live (${main.state.status})`;
  const ev = ledger.outputs[main.id].events;
  const published = ev.findLastIndex((e) => e.type === 'published');
  if (!ev.slice(published).some((e) => e.type === 'verified' && e.result === 'passed'))
    return `${main.id} is live but not verified since: npm run publish -- verify`;
  for (const id of Object.keys(ledger.outputs)) {
    if (!id.startsWith('short:')) continue;
    const s = openOutput(topic, storyId, { root, output: id });
    if (s.state.id && !s.state.live) return `${id} is ${s.state.status}, not live yet`;
  }
  return null;
}

/** A finished launch record of an earlier decision on a video still private: a new `decided ok` (a withdrawn release
 *  decided again, the same upload) rebuilds and deploys the page before the tick goes live on it. */
function launchStale(rec: LaunchRecord | null, decided: PublishEvent | null): boolean {
  return !!rec?.committed && !!decided && Date.parse(decided.at) > Date.parse(rec.startedAt);
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
    const { main, decided } = releaseOf(topic, storyId, root);
    if (rec && rec.committed && (rec.pushed || !a.launch.push) && !launchStale(rec, decided)) continue; // launched
    out.push({
      kind: 'launch',
      topic,
      storyId,
      why: main.state.live ? 'launch: the release group is live' : 'launch: the release is decided',
    });
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
  const { main, decided } = releaseOf(topic, storyId, root);
  const previous = readLaunch(topic, storyId, root);
  // a record of an earlier decision on the still-private video is stale: the page is built and deployed again
  const record: LaunchRecord = (launchStale(previous, decided) ? null : previous) ?? {
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
    const label = `npm run ${name} -- ${args.join(' ')}`;
    try {
      const r = await d.run(name, args);
      return r.status === 0 ? null : `${label} failed (exit ${r.status}): ${tail(r.stderr || r.stdout)}`;
    } catch (e) {
      return `${label} did not start: ${tail((e as Error).message)}`;
    }
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
      // an automated commit: no author line
      if (staged)
        d.git(['commit', '-q', '-m', `release(${topic}): ${storyId} is ${main.state.live ? 'live' : 'releasing'}`]);
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
  mail: Mailer | null;
  /** The environment the institution's X keys are read from (whether it is configured); the tick's process env. */
  env?: NodeJS.ProcessEnv;
  /** One launch only (`npm run run -- probe`); the tick probes them all. */
  only?: { topic: string; storyId: string };
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
    if (d.only && (rec.topic !== d.only.topic || rec.storyId !== d.only.storyId)) continue;
    const pushed = a.launch.push ? rec.pushed : rec.committed;
    if (!pushed) continue;
    if (rec.liveAt && rec.posted !== null && (rec.emailed || !d.mail)) continue; // finished
    const tag = `${rec.topic}/${rec.storyId}`;
    // the page is up (or being deployed) for a video no longer approved for release (withdrawn after the decision,
    // plan B): nothing to probe for and nothing to publish until a person decides again
    const { main, decided } = releaseOf(rec.topic, rec.storyId, root);
    if (!main.state.live && !decided) {
      actions.push(`${tag}: ${main.id} is ${main.state.status}: the launch waits for a decision`);
      continue;
    }
    // a new decision since this record's launch: the work plane rebuilds and deploys the page first (launchStale in
    // launchJobs); the old page would carry the same id, so it is not probed and nothing goes live on it
    if (launchStale(rec, decided)) {
      actions.push(`${tag}: a new decision (${decided!.at}): the launch rebuilds the page first`);
      continue;
    }
    // a go-live the tick halted on (a final failure, a refusal) is a person's: nothing runs until the person took
    // the video live by hand, which clears the halt and lets the announcement follow
    if (rec.halt?.kind === 'step-failed' && /go-live/.test(rec.halt.board.next)) {
      if (!main.state.live) {
        actions.push(`${tag}: go-live halted: ${rec.halt.why}`);
        continue;
      }
      // the same halt in the run folder goes too (haltLaunch clears only the launch's own kinds there)
      const dir = runDir(rec.topic, rec.storyId, root);
      if (readHalt(dir)?.why === rec.halt.why) clearHalt(dir);
      haltLaunch(root, rec, null);
    }
    if (!rec.liveAt) {
      const probe = await probeOf(a, rec, d.fetchFn, root);
      rec.probes += 1;
      if (!probe.ok) {
        const since = rec.steps.validated ?? rec.startedAt;
        if (now() - Date.parse(since) > a.launch.deployTimeoutMinutes * 60_000) {
          // written once: a stable why (the probe's reason, which changes between ticks, goes in the unblock text),
          // so the halt keeps one key and one date across the ticks that keep probing, and is emailed once
          if (rec.halt?.kind !== 'deploy-timeout' || !readHalt(runDir(rec.topic, rec.storyId, root)))
            haltLaunch(root, rec, {
              kind: 'deploy-timeout',
              stage: 'launch',
              why: `the deploy of ${tag} is not live after ${a.launch.deployTimeoutMinutes} minutes`,
              unblock: {
                kind: 'fix',
                text: `check the deploy of ${pushed} (CI, Cloudflare): ${probe.why}; the next tick probes again`,
              },
              at: new Date(now()).toISOString(),
              runId: 'tick',
              board: { stage: 'launch', next: 'the deploy' },
            });
          else writeLaunch(root, rec);
          actions.push(`${tag}: deploy-timeout (${probe.why})`);
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
    // the page is up: a video the person decided ok for goes live now, under that decision (plan B); the verb's
    // own refusals hold (an unapproved build, an automated actor); a retryable failure is tried MAX_TRIES ticks
    // since the decision, then a person's; a final one (YouTube kept it private) is a person's at once
    if (decided) {
      const dir = runDir(rec.topic, rec.storyId, root);
      const key = 'go-live|youtube';
      const fix = `fix it, then npm run publish -- go-live ${rec.topic} ${rec.storyId} --by "<name>"`;
      const goLiveHalt = (why: string) =>
        haltLaunch(root, rec, {
          kind: 'step-failed',
          stage: 'launch',
          why,
          unblock: { kind: 'fix', text: fix },
          at: new Date(now()).toISOString(),
          runId: 'tick',
          board: { stage: 'launch', next: 'the go-live' },
        });
      if (main.state.failed && !main.state.failed.retryable) {
        // recorded by the verb (YouTube kept it private): a person's; said once, the halt key stays stable
        if (rec.halt?.kind !== 'step-failed')
          goLiveHalt(`${main.id}: ${main.state.failed.step} failed: ${main.state.failed.error}`);
        actions.push(`${tag}: go-live failed finally: a person's`);
        continue;
      }
      if (main.state.failed?.retryable && triesOf(dir, key, decided.at) >= MAX_TRIES) {
        actions.push(`${tag}: go-live keeps failing (${MAX_TRIES} tries): a person's`);
        continue;
      }
      const r = await d.run('publish', [
        'go-live',
        rec.topic,
        rec.storyId,
        '--by',
        decided.by,
        '--via',
        `tick:${decided.request}`,
      ]);
      actions.push(`${tag}: go-live${main.state.failed ? ' retry' : ''} (${r.status})`);
      const after = openOutput(rec.topic, rec.storyId, { root }).state;
      if (after.failed && !after.failed.retryable)
        goLiveHalt(`${main.id}: ${after.failed.step} failed: ${after.failed.error}`);
      else if (after.failed?.retryable) {
        const tries = countTry(dir, key, decided.at);
        if (tries >= MAX_TRIES)
          goLiveHalt(`${main.id}: go-live keeps failing after ${tries} tries: ${after.failed.error}`);
      } else if (r.status !== 0 && !after.live) {
        // refused (exit 2: the kit redrawn since the approval, the build not uploaded) or failed without a record:
        // a person's at once, never run again from here
        const why = (r.stderr || r.stdout).trim().split('\n').at(-1) ?? `exit ${r.status}`;
        goLiveHalt(`${main.id}: go-live ${r.status === 2 ? 'refused' : 'failed'}: ${why}`);
      }
      if (r.status === 0 && after.live)
        await d.run('publish', ['verify', rec.topic, rec.storyId, '--by', 'automated: tick']);
    }
    // the announcement (the post, the mail) only once the video is live and verified and every Short is live
    const wait = announceProblem(rec.topic, rec.storyId, root);
    if (wait) {
      actions.push(`${tag}: ${wait}; the post and the mail wait`);
      continue;
    }
    if (rec.posted === null) {
      // the post, when the policy says so and the institution has an account (the social read API, from the
      // environment): the CLI is the effect; the outcome is the module's record (social.json), never the CLI's text.
      // A record still `posting` (a retryable failure, a crash) is tried again next tick, POST_ATTEMPTS times, the
      // mail waiting; a failed record, or the attempts spent, halts step-failed; the module posts one text once.
      if (!(a.enabled.social && a.launch.social.video) || !accountFor(rec.topic, d.env ?? process.env))
        rec.posted = 'not-configured';
      else {
        rec.postAttempts = (rec.postAttempts ?? 0) + 1;
        const r = await d.run('social', ['post', rec.topic, rec.storyId]);
        const p = loadSocial(rec.topic, rec.storyId, root)?.outputs.youtube?.posts.at(-1) ?? null;
        const detail = p?.error ?? (r.stderr || r.stdout).trim().split('\n').at(-1) ?? 'no record';
        if (p?.status === 'posted') rec.posted = true;
        else if (p?.status !== 'failed' && rec.postAttempts < POST_ATTEMPTS) {
          actions.push(`${tag}: post pending (attempt ${rec.postAttempts}), again next tick: ${detail}`);
          writeLaunch(root, rec);
          continue;
        } else {
          rec.posted = false;
          haltLaunch(root, rec, {
            kind: 'step-failed',
            stage: 'launch',
            why:
              p?.status === 'failed'
                ? `the X post of ${tag} failed: ${detail}`
                : `the X post of ${tag} did not go through in ${rec.postAttempts} attempts: ${detail}`,
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
      }
      writeLaunch(root, rec);
    }
    if (d.mail && !rec.emailed) {
      await d.mail.sendTracked(renderLaunched(rec, a, root), 'launch', {
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
