// The work plane (spec §4.4): one process picks one due long job, runs it in the foreground to its end or halt, and
// exits. The scheduled task runs one instance at a time (one job; "Do not start a new instance") and launches only
// (`--job launch`: no agent-written code runs unattended); the subject's locks are the second line of defence, and
// the bound when a person starts jobs by hand. The pick order is fixed: a launch (phase 3), a due resume, a release
// loop (phase 2), the production pick when due, a topic run (phase 5), a discovery (phase 4), a scan (phase 6).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { commissionOf, isFixtureTopic } from '../../config/site';
import type { Automation } from '../../shared/automation';
import type { Mailer } from './mailer';
import { ROOT, scriptDir, topicsDir } from '../../shared/io';
import { loadDecisions, topicBoard } from '../production';
import { RUN_DIR } from './journal';
import { readLock } from './lock';
import { alive } from './proc';
import { releasePending } from './release';
import { publishedAt } from './resume';
import { statusOf } from './status';
import { pickJob } from './pick';
import { type RunResult, runStory, runValidate } from './runner';
import { type LaunchDeps, launch, launchJobs } from './launch';
import { runCli } from '../../shared/cli';
import { envFor } from './steps';
import { execFileSync } from 'node:child_process';
import { type DueResume, readSchedule, updateSchedule } from './schedule';
import { discover, discoveryDeps, discoveryDir, discoveryDue } from './discovery';
import { runTopic, topicRunFolder } from './topic-runner';
import { maintain, maintainDeps, scanJobs } from './maintain';
import { loadProposals, researched } from '../../modules/topic-discovery';

export type JobKind = 'launch' | 'resume' | 'release' | 'pick' | 'topic' | 'discovery' | 'scan';
export interface Job {
  kind: JobKind;
  topic?: string;
  storyId?: string;
  why: string;
}

export interface WorkDeps {
  now?: () => number;
  alive?: (pid: number) => boolean;
  /** The production pick (Task 5): the job to start when the cadence says so, else null. */
  pick?: () => Job | null;
  /** The release jobs (phase 2): packaged stories with an automation step pending; the default reads the board. */
  releases?: () => Job[];
  /** The launch jobs (phase 3): live, verified groups without a finished launch; the default reads the ledgers. */
  launches?: () => Job[];
  /** Runs a launch job; the default runs the real sequence in the clone. */
  runLaunch?: (topic: string, storyId: string, a: Automation) => Promise<RunResult>;
  runStory?: (topic: string, storyId: string, a: Automation, approver: string) => Promise<RunResult>;
  /** Runs the production pick (records the pick before the start, signs with the pick's approver); default pickJob. */
  runPick?: () => Promise<{ started?: string; why?: string; result?: RunResult }>;
  approver?: string;
  /** Runs the discovery job (phase 4); the default runs the agents and mails the batch. */
  runDiscovery?: (a: Automation) => Promise<RunResult>;
  /** Runs a topic run (phase 5); the default is the topic runner with real agents and CLIs. */
  runTopic?: (topic: string, a: Automation) => Promise<RunResult>;
  /** The topic jobs (phase 5): approved proposals not yet researched; the default reads proposals/. */
  topics?: () => Job[];
  /** The scan jobs (phase 6): the public topic whose maintenance scan is due; the default reads maintenance.json. */
  scans?: () => Job[];
  /** Runs a scan job; the default is the maintenance job with real agents and CLIs. */
  runScan?: (topic: string, a: Automation) => Promise<RunResult>;
  skip?: Job[]; // jobs this instance already found held
  only?: JobKind; // `work --job <kind>`: run a job of this kind or nothing
  mail?: Mailer | null; // the request mails of a release loop
}

export interface WorkReport {
  outcome: 'disabled' | 'idle' | 'done' | 'halted' | 'held';
  job: Job | null;
  result?: RunResult;
}

const sameJob = (x: Job, y: Job) => x.kind === y.kind && x.topic === y.topic && x.storyId === y.storyId;

export function nextJob(a: Automation, root = ROOT, deps: WorkDeps = {}): Job | null {
  const skip = deps.skip ?? [];
  const running = statusOf(root, deps.alive ?? alive).filter((r) => r.state === 'running').length;
  const storyRoom = running < a.runs.maxConcurrentStoryRuns;
  // launches first (spec §4.4): a live, verified release group whose site update is pending
  for (const job of (deps.launches ?? (() => launchJobs(a, root)))())
    if (!skip.some((s) => sameJob(s, job))) return job;
  const due: DueResume[] = readSchedule(root).due ?? [];
  if (storyRoom)
    for (const d of due) {
      if (publishedAt(d.topic, d.storyId, root)) continue; // live: nothing left to resume
      const job: Job = { kind: 'resume', topic: d.topic, storyId: d.storyId, why: `due resume (${d.why})` };
      if (!skip.some((s) => sameJob(s, job))) return job;
    }
  // release loops (spec §4.4): a packaged story with an automation step pending, not halted, not running
  if (storyRoom)
    for (const job of (deps.releases ?? (() => releaseJobs(a, root, deps.alive ?? alive)))())
      if (!skip.some((s) => sameJob(s, job))) return job;
  if (storyRoom && deps.pick) {
    const p = deps.pick();
    if (p && !skip.some((s) => sameJob(s, p))) return p;
  }
  // discovery (phase 4): the weekly slot, once, unless another instance holds it
  if (discoveryDue(a, root, (deps.now ?? Date.now)())) {
    const held = readLock(discoveryDir(root));
    const job: Job = { kind: 'discovery', why: 'discovery: the weekly slot' };
    if (!(held && (deps.alive ?? alive)(held.pid)) && !skip.some((s) => sameJob(s, job))) return job;
  }
  // topic runs (phase 5): an approved proposal not yet researched, under the topic-run concurrency cap, only with
  // enabled.research (approval authorises the topic; the flag authorises the spend)
  const topicRuns = statusOf(root, deps.alive ?? alive).filter(
    (r) => r.state === 'running' && r.storyId === 'research',
  ).length;
  if (a.enabled.research && topicRuns < a.runs.maxConcurrentTopicRuns)
    for (const job of (deps.topics ?? (() => topicJobs(root, deps.alive ?? alive)))())
      if (!skip.some((s) => sameJob(s, job))) return job;
  // scans (phase 6): the public topic whose scan is oldest and due, one at a time, never while its topic runs
  if (topicRuns < a.runs.maxConcurrentTopicRuns)
    for (const job of (deps.scans ?? (() => scanJobs(a, root, (deps.now ?? Date.now)())))())
      if (!skip.some((s) => sameJob(s, job))) {
        const lock = readLock(topicRunFolder(job.topic!, root));
        if (!(lock && (deps.alive ?? alive)(lock.pid))) return job;
      }
  return null;
}

/** Every packaged story (never a fixture topic's, never a follow-up) whose release loop has work and that no halt or
 *  live run holds. */
export function releaseJobs(a: Automation, root = ROOT, isAlive: (pid: number) => boolean = alive): Job[] {
  const out: Job[] = [];
  const decisions = loadDecisions(root);
  const topics = existsSync(topicsDir(root))
    ? readdirSync(topicsDir(root)).filter((t) => existsSync(join(topicsDir(root), t, 'stories.json')))
    : [];
  for (const topic of topics) {
    if (isFixtureTopic(topic)) continue; // the fixture is never selected by automation (spec §5.8)
    if (!commissionOf(topic)?.handle) continue; // no channel yet: nothing to upload to
    const tb = topicBoard(topic, root, decisions);
    for (const r of tb.stories) {
      if (r.story.partOf || r.production?.stage !== 'packaged' || r.decision?.decision === 'parked') continue;
      const dir = join(scriptDir(topic, r.story.id, root), RUN_DIR);
      if (existsSync(join(dir, 'halt.json'))) continue;
      const lock = readLock(dir);
      if (lock && isAlive(lock.pid)) continue;
      const why = releasePending(topic, r.story.id, a, root);
      if (why) out.push({ kind: 'release', topic, storyId: r.story.id, why: `release: ${why}` });
    }
  }
  return out;
}

/** Every approved proposal that is not researched yet (no ready story), never a fixture topic's, with no live run
 *  and no halt in its topic run folder. */
export function topicJobs(root = ROOT, isAlive: (pid: number) => boolean = alive): Job[] {
  const out: Job[] = [];
  for (const { proposal } of loadProposals(root)) {
    if (proposal.status !== 'approved' || isFixtureTopic(proposal.slug) || researched(proposal.slug, root)) continue;
    const dir = topicRunFolder(proposal.slug, root);
    if (existsSync(join(dir, 'halt.json'))) continue;
    const lock = readLock(dir);
    if (lock && isAlive(lock.pid)) continue;
    out.push({ kind: 'topic', topic: proposal.slug, why: `research: the approved proposal ${proposal.slug}` });
  }
  return out;
}

export async function work(a: Automation, root = ROOT, deps: WorkDeps = {}): Promise<WorkReport> {
  const now = deps.now ?? Date.now;
  if (!a.enabled.work) return { outcome: 'disabled', job: null };
  const run =
    deps.runStory ?? ((t, s, auto, approver) => runStory(t, s, auto, { approver, root, mail: deps.mail ?? null }));
  const approver = deps.approver ?? `automated: work ${new Date(now()).toISOString().slice(0, 10)}`;
  const skip: Job[] = [...(deps.skip ?? [])];
  for (let attempt = 0; attempt < 2; attempt++) {
    const job = nextJob(a, root, { ...deps, skip });
    if (!job || (deps.only && job.kind !== deps.only)) return { outcome: 'idle', job: null };
    // a pick is recorded in schedule.json before it starts (a crash never starts two; the cadence binds)
    const picked = job.kind === 'pick' ? await (deps.runPick ?? (() => pickJob(a, root)))() : null;
    if (job.kind === 'pick' && !picked?.result) return { outcome: 'idle', job: null };
    const result =
      picked?.result ??
      (job.kind === 'discovery'
        ? await (deps.runDiscovery ?? ((auto) => discover(auto, discoveryDeps(deps.mail ?? null), root)))(a)
        : job.kind === 'topic'
          ? await (deps.runTopic ?? ((t, auto) => runTopic(t, auto, { root })))(job.topic!, a)
          : job.kind === 'scan'
            ? await (deps.runScan ?? ((t, auto) => maintain(t, auto, maintainDeps(deps.mail ?? null), root)))(
                job.topic!,
                a,
              )
            : job.kind === 'launch'
              ? await (deps.runLaunch ?? ((t, s, auto) => launch(t, s, auto, launchDeps(root), root)))(
                  job.topic!,
                  job.storyId!,
                  a,
                )
              : await run(job.topic!, job.storyId!, a, approver));
    if (result.outcome === 'held') {
      skip.push(job); // another instance owns it: try the next job once (a held resume keeps its due entry)
      continue;
    }
    updateSchedule(root, (s) => ({
      ...s,
      due: (s.due ?? []).filter((d) => !(d.topic === job.topic && d.storyId === job.storyId)), // a resume's, once run
      lastWork: { kind: job.kind, outcome: result.outcome, at: new Date(now()).toISOString() },
    }));
    return { outcome: result.outcome === 'done' ? 'done' : 'halted', job, result };
  }
  return { outcome: 'idle', job: null };
}

/** The launch job's real dependencies: git in the clone, each CLI as a child with its verb's environment, validate. */
export const launchDeps = (root: string): LaunchDeps => ({
  git: (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  run: (cli, args) => runCli(cli, args, { cwd: root, env: envFor(cli, args, process.env) }),
  validate: () => runValidate(root, envFor('validate', [], process.env)),
});

/** The two scheduler commands and the settings a person applies, for the platform; never run here (register D1, D2). */
export function scheduleText(a: Automation, root: string, platform = process.platform): string {
  const clone = a.clone ?? root;
  if (platform === 'win32') {
    const task = (name: string, verb: string) =>
      `schtasks /Create /SC MINUTE /MO ${a.schedule.tickMinutes} /TN "video-knowledge ${name}" /TR "cmd /c cd /d ${clone} && npm run -s run -- ${verb} >> .automation\\${name}.log 2>&1" /F`;
    return [
      'Two Task Scheduler tasks, created by you (the repo never creates one):',
      '',
      task('tick', 'tick'),
      task('work', 'work --job launch'),
      '',
      "Then, in the Task Scheduler window, for each task: Run only when user is logged on (so ~/.claude's login, the GPU",
      'and %TEMP% are yours); Stop the task if it runs longer than: off (or 3 days) for work.',
      'Settings tab: tick and work = "Do not start a new instance" (one instance of each task at a time, so one job at a',
      "time: a trigger that fires while the task runs is skipped, not queued; the tick's lock and its file claims are",
      'the second line of defence). Check it: schtasks /Query /TN "video-knowledge work" /XML must show',
      '<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>. The setting is per task: it serialises neither the',
      'tick against work nor anything you start by hand (docs/OPERATIONS.md, section 4).',
      'The work task runs launches only (--job launch): no agent-written code runs unattended; story, topic, scan and',
      'discovery runs are started by a person in a session.',
      '',
      'Power: renders must not sleep (register D2). You run these yourself:',
      'powercfg /change standby-timeout-ac 0',
      'powercfg /change hibernate-timeout-ac 0',
      '',
      `Nothing runs until automation.json says enabled.tick, enabled.work (and enabled.production) are true.`,
    ].join('\n');
  }
  return [
    'Two cron lines (crontab -e), created by you (cron has no instance policy: the locks are the only bound):',
    `*/${a.schedule.tickMinutes} * * * * cd ${clone} && npm run -s run -- tick >> .automation/tick.log 2>&1`,
    `*/${a.schedule.tickMinutes} * * * * cd ${clone} && npm run -s run -- work --job launch >> .automation/work.log 2>&1`,
  ].join('\n');
}
