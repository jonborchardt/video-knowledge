// The work plane (spec §4.4): one process picks one due long job, runs it in the foreground to its end or halt, and
// exits. The scheduler starts instances in parallel; the subject's lock is the bound on how many run at once, not
// the scheduler. The pick order is fixed: a launch (phase 3), a due resume, a release loop (phase 2), the production
// pick when due, a topic run (phase 5), a discovery (phase 4), a scan (phase 6).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isFixtureTopic } from '../../config/site';
import type { Automation } from '../../shared/automation';
import { ROOT, scriptDir, topicsDir } from '../../shared/io';
import { loadDecisions, topicBoard } from '../production';
import { RUN_DIR } from './journal';
import { readLock } from './lock';
import { alive } from './proc';
import { releasePending } from './release';
import { statusOf } from './status';
import { pickJob } from './pick';
import { type RunResult, runStory } from './runner';
import { type DueResume, readSchedule, updateSchedule } from './schedule';

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
  runStory?: (topic: string, storyId: string, a: Automation, approver: string) => Promise<RunResult>;
  /** Runs the production pick (records the pick before the start, signs with the pick's approver); default pickJob. */
  runPick?: () => Promise<{ started?: string; why?: string; result?: RunResult }>;
  approver?: string;
  skip?: Job[]; // jobs this instance already found held
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
  // launches: phase 3
  const due: DueResume[] = readSchedule(root).due ?? [];
  if (storyRoom)
    for (const d of due) {
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
  // topic runs, discovery, scans: phases 4 to 6
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
    const tb = topicBoard(topic, root, decisions);
    for (const r of tb.stories) {
      if (r.story.partOf || r.production?.stage !== 'packaged') continue;
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

export async function work(a: Automation, root = ROOT, deps: WorkDeps = {}): Promise<WorkReport> {
  const now = deps.now ?? Date.now;
  if (!a.enabled.work) return { outcome: 'disabled', job: null };
  const run = deps.runStory ?? ((t, s, auto, approver) => runStory(t, s, auto, { approver, root }));
  const approver = deps.approver ?? `automated: work ${new Date(now()).toISOString().slice(0, 10)}`;
  const skip: Job[] = [...(deps.skip ?? [])];
  for (let attempt = 0; attempt < 2; attempt++) {
    const job = nextJob(a, root, { ...deps, skip });
    if (!job) return { outcome: 'idle', job: null };
    if (job.kind === 'resume')
      updateSchedule(root, (s) => ({
        ...s,
        due: (s.due ?? []).filter((d) => !(d.topic === job.topic && d.storyId === job.storyId)),
      }));
    // a pick is recorded in schedule.json before it starts (a crash never starts two; the cadence binds)
    const picked = job.kind === 'pick' ? await (deps.runPick ?? (() => pickJob(a, root)))() : null;
    if (job.kind === 'pick' && !picked?.result) return { outcome: 'idle', job: null };
    const result = picked?.result ?? (await run(job.topic!, job.storyId!, a, approver));
    if (result.outcome === 'held') {
      skip.push(job); // another instance owns it: try the next job once
      continue;
    }
    updateSchedule(root, (s) => ({
      ...s,
      lastWork: { kind: job.kind, outcome: result.outcome, at: new Date(now()).toISOString() },
    }));
    return { outcome: result.outcome === 'done' ? 'done' : 'halted', job, result };
  }
  return { outcome: 'idle', job: null };
}

/** The two scheduler commands and the settings a person applies, for the platform; never run here (register D1, D2). */
export function scheduleText(a: Automation, root: string, platform = process.platform): string {
  const clone = a.clone ?? root;
  if (platform === 'win32') {
    const task = (name: string, verb: string) =>
      `schtasks /Create /SC MINUTE /MO ${a.schedule.tickMinutes} /TN "video-knowledge ${name}" /TR "cmd /c cd /d ${clone} && npm run -s run -- ${verb} >> .automation\\${verb}.log 2>&1" /F`;
    return [
      'Two Task Scheduler tasks, created by you (the repo never creates one):',
      '',
      task('tick', 'tick'),
      task('work', 'work'),
      '',
      "Then, in the Task Scheduler window, for each task: Run only when user is logged on (so ~/.claude's login, the GPU",
      'and %TEMP% are yours); Stop the task if it runs longer than: off (or 3 days) for work.',
      'Settings tab: tick = "Do not start a new instance"; work = "Run a new instance in parallel" (the locks bound how',
      'many jobs run at once, not the scheduler).',
      '',
      'Power: renders must not sleep (register D2). You run these yourself:',
      'powercfg /change standby-timeout-ac 0',
      'powercfg /change hibernate-timeout-ac 0',
      '',
      `Nothing runs until automation.json says enabled.tick, enabled.work (and enabled.production) are true.`,
    ].join('\n');
  }
  return [
    'Two cron lines (crontab -e), created by you:',
    `*/${a.schedule.tickMinutes} * * * * cd ${clone} && npm run -s run -- tick >> .automation/tick.log 2>&1`,
    `*/${a.schedule.tickMinutes} * * * * cd ${clone} && npm run -s run -- work >> .automation/work.log 2>&1`,
  ].join('\n');
}
