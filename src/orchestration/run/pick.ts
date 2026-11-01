// The production pick (spec §5.4): among ready stories in claimed topics with no production, no decision but
// `queued`, not a follow-up and no open halt, the best by score (ties: evidence, then the topic and the institution
// with the fewest live videos), started when the week's cadence says so. How many to start is configuration: the
// pick, the locks and the work plane need no change to scale. A fixture topic is never picked.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { commissionKey, commissionOf, isFixtureTopic } from '../../config/site';
import type { Automation } from '../../shared/automation';
import { ROOT, scriptDir } from '../../shared/io';
import type { Story } from '../../shared/types';
import { storyOutputs } from '../../modules/publishing';
import { type Decision, board, loadDecisions } from '../production';
import { RUN_DIR } from './journal';
import { statusOf } from './status';
import { type RunResult, runStory } from './runner';
import { type PickRecord, isoWeek, lastSlot, readSchedule, updateSchedule } from './schedule';
import type { Job } from './work';

export interface Candidate {
  topic: string;
  storyId: string;
  institution: string;
  overall: number;
  evidence: number;
  liveInTopic: number;
  liveInInstitution: number;
  queued: boolean;
}

/** What the pick needs to know about one story row, read from the board and the ledgers. */
export interface RowInput {
  topic: string;
  story: Pick<Story, 'id' | 'readiness' | 'partOf' | 'scores'>;
  institution: string | null; // null: no institution claims the topic
  fixture?: boolean;
  hasProduction: boolean;
  decision: Decision['decision'] | null;
  haltOpen: boolean;
  live: boolean; // the story's video is live
}

/** The pure filter: one row per exclusion of spec §5.4. */
export function candidatesOf(rows: RowInput[]): Candidate[] {
  const liveInTopic = new Map<string, number>();
  const liveInInstitution = new Map<string, number>();
  for (const r of rows) {
    if (!r.live) continue;
    liveInTopic.set(r.topic, (liveInTopic.get(r.topic) ?? 0) + 1);
    if (r.institution) liveInInstitution.set(r.institution, (liveInInstitution.get(r.institution) ?? 0) + 1);
  }
  return rows
    .filter(
      (r) =>
        r.story.readiness === 'ready' &&
        !r.story.partOf &&
        r.institution !== null &&
        !r.fixture &&
        !r.hasProduction &&
        r.decision !== 'parked' &&
        !r.haltOpen,
    )
    .map((r) => ({
      topic: r.topic,
      storyId: r.story.id,
      institution: r.institution!,
      overall: r.story.scores.overall,
      evidence: r.story.scores.evidence,
      liveInTopic: liveInTopic.get(r.topic) ?? 0,
      liveInInstitution: liveInInstitution.get(r.institution!) ?? 0,
      queued: r.decision === 'queued',
    }));
}

export function rowInputs(root = ROOT, decisions = loadDecisions(root)): RowInput[] {
  return board(root).flatMap((tb) => {
    const topic = tb.topic.name;
    const c = commissionOf(topic);
    return tb.stories.map((s) => ({
      topic,
      story: s.story,
      institution: c ? commissionKey(c) : null,
      fixture: isFixtureTopic(topic),
      hasProduction: s.production !== null,
      decision: decisions[`${topic}/${s.story.id}`]?.decision ?? null,
      haltOpen: existsSync(join(scriptDir(topic, s.story.id, root), RUN_DIR, 'halt.json')),
      live: !!storyOutputs(topic, s.story.id, root).video,
    }));
  });
}

export const candidates = (root = ROOT, decisions = loadDecisions(root)): Candidate[] =>
  candidatesOf(rowInputs(root, decisions));

/** Queued first; then score, evidence, the topic and the institution with the fewest live videos, the topic name. */
export function rank(c: Candidate[]): Candidate[] {
  return [...c].sort(
    (x, y) =>
      Number(y.queued) - Number(x.queued) ||
      y.overall - x.overall ||
      y.evidence - x.evidence ||
      x.liveInTopic - y.liveInTopic ||
      x.liveInInstitution - y.liveInInstitution ||
      x.topic.localeCompare(y.topic) ||
      x.storyId.localeCompare(y.storyId),
  );
}

export interface PickState {
  week: string;
  picks: PickRecord[];
}
export const pickState = (root = ROOT, now = Date.now()): PickState => {
  const s = readSchedule(root);
  const week = isoWeek(now);
  return { week, picks: s.week === week ? (s.picks ?? []) : [] };
};

/** The cadence: production on, the week's slot passed, fewer picks this week than the cap, room for a run, fewer
 *  open approval requests than the cap. */
export function pickDue(
  a: Automation,
  now: Date,
  state: PickState,
  open: { awaitingApproval: number; aliveStoryLocks: number },
): boolean {
  if (!a.enabled.production) return false;
  const slot = lastSlot(now.getTime(), a.production.weekday, a.production.hour, a.schedule.timezone);
  if (isoWeek(Date.parse(`${slot}T12:00:00Z`)) !== isoWeek(now.getTime())) return false; // this week's slot not yet
  if (state.picks.length >= a.production.storiesPerWeek) return false;
  if (open.aliveStoryLocks >= a.runs.maxConcurrentStoryRuns) return false;
  if (open.awaitingApproval >= a.production.maxAwaitingApproval) return false;
  return true;
}

/** The first candidate whose institution still has room this week. */
export function choose(ranked: Candidate[], a: Automation, state: PickState): Candidate | null {
  const per = new Map<string, number>();
  for (const p of state.picks) per.set(p.institution, (per.get(p.institution) ?? 0) + 1);
  return ranked.find((c) => (per.get(c.institution) ?? 0) < a.production.perInstitutionPerWeek) ?? null;
}

export interface PickDeps {
  now?: () => number;
  candidates?: () => Candidate[];
  awaitingApproval?: () => number; // open approval requests (phase 2); 0 until then
  alive?: (pid: number) => boolean;
  run?: (topic: string, storyId: string, approver: string) => Promise<RunResult>;
}

/** The job the work plane runs when the pick is due, or null. */
export function pickJobIfDue(a: Automation, root = ROOT, deps: PickDeps = {}): Job | null {
  const now = deps.now ?? Date.now;
  const state = pickState(root, now());
  const due = pickDue(a, new Date(now()), state, {
    awaitingApproval: deps.awaitingApproval?.() ?? 0,
    aliveStoryLocks: statusOf(root, deps.alive).filter((r) => r.state === 'running').length,
  });
  if (!due) return null;
  const c = choose(rank((deps.candidates ?? (() => candidates(root)))()), a, state);
  return c
    ? { kind: 'pick', topic: c.topic, storyId: c.storyId, why: `production pick (${c.overall.toFixed(2)})` }
    : null;
}

/** Record the pick before starting it (a crash never starts two), then run the story. */
export async function pickJob(
  a: Automation,
  root = ROOT,
  deps: PickDeps = {},
): Promise<{ started?: string; why?: string; result?: RunResult }> {
  const now = deps.now ?? Date.now;
  const job = pickJobIfDue(a, root, deps);
  if (!job) return { why: 'nothing due' };
  const week = isoWeek(now());
  const record: PickRecord = {
    topic: job.topic!,
    storyId: job.storyId!,
    institution: commissionOf(job.topic!) ? commissionKey(commissionOf(job.topic!)!) : '',
    at: new Date(now()).toISOString(),
  };
  updateSchedule(root, (s) => ({ ...s, week, picks: [...(s.week === week ? (s.picks ?? []) : []), record] }));
  const date = new Date(now()).toISOString().slice(0, 10);
  const approver = `automated: production pick ${date}, enabled by ${a.approvals.approverName || 'automation.json'}`;
  const run = deps.run ?? ((t, s, ap) => runStory(t, s, a, { approver: ap, root }));
  const result = await run(job.topic!, job.storyId!, approver);
  return { started: `${job.topic}/${job.storyId}`, result };
}
