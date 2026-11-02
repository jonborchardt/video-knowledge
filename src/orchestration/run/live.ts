// The live view (M3 2.1): what the system is doing now, derived at read time from the locks, journals, attempt
// records, halts, ledgers, the outbox, the discovery records and the board; served by /admin/live.json on the dev
// server and polled by the admin page. One row per story, Short and research, scan or discovery run; the owner's
// action list (what only a person decides, where, and the command); the activity feed; the readiness table.
// Nothing here writes, kills, or decides a stage: the board stays the source of story-stage truth, the runner of
// execution; execution information is joined in here, never stored as a second truth.
import { basename, join } from 'node:path';
import { type Automation, loadAutomation } from '../../shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, scriptDir, scriptDirs } from '../../shared/io';
import type { ReleaseManifest } from '../../shared/types';
import { commissions } from '../../config/site';
import { loadArticleRequest } from '../../modules/article';
import { currentBuild, loadLedger, openOutput, openRequest } from '../../modules/publishing';
import { loadProposals } from '../../modules/topic-discovery';
import { columnOf, shortColumnOf, stoppedOf, topicBoard } from '../production';
import { discoveryDir, discoveryHalts, discoveryRecords } from './discovery-state';
import {
  type AttemptRecord,
  type Halt,
  type JournalEntry,
  RUN_DIR,
  readAttempts,
  readHalt,
  readJournal,
} from './journal';
import { launches } from './launch';
import { readLock } from './lock';
import { readOutbox } from './notify';
import { alive as pidAlive } from './proc';
import { type ReadinessRow, readinessView } from './readiness';
import { resumesSince, retryable } from './resume';
import { readSchedule } from './schedule';
import { runFolders } from './status';
import { roleOf } from './steps';
import { type Attempt, type Estimate, type WeekRollup, attempts, estimate, rollups } from './usage';
import { type Job, nextJob } from './work';
import { isoWeek } from './runner';
import { storiesWithLedgers } from './publish-due';

export type RowKind = 'video' | 'short' | 'research' | 'scan' | 'discovery';
export type RowState = 'running' | 'between-steps' | 'halted' | 'idle' | 'done';
export type StepKind = 'agent' | 'cli' | 'person' | 'service';

export interface LiveAgent {
  role: string;
  model: string | null;
  step: string;
  pid: number | null;
  startedAt: string;
}
export interface LiveHalt {
  kind: string;
  why: string;
  unblock: string;
  retryable: boolean;
  retries: number;
  nextRetryAt: string | null;
  at: string;
}
export interface LiveRow {
  key: string;
  institution: string | null;
  topic: string;
  storyId: string;
  kind: RowKind;
  column: string | null;
  stage: string | null;
  state: RowState;
  step: string | null;
  stepKind: StepKind | null;
  role: string | null;
  model: string | null;
  startedAt: string | null;
  stepStartedAt: string | null;
  elapsedMs: number | null;
  costUsd: { run: number; total: number };
  estimate: Estimate | null;
  agents: LiveAgent[];
  halt: LiveHalt | null;
  next: string;
  /** The board's own verdict that /produce stopped and a person must act (`stoppedOf`): red in the strip. */
  stopped: boolean;
  /** The runner's heartbeat is older than lockStaleMinutes while its pid lives: frozen, or a stale clock. */
  staleHeartbeat: boolean;
}
export interface OwnerItem {
  kind:
    | 'proposal-batch'
    | 'draft-review'
    | 'release-request'
    | 'paid-link'
    | 'correction-request'
    | 'awaiting-person'
    | 'needs-person';
  key: string;
  topic: string;
  storyId: string | null;
  what: string;
  /** The review page, when one shows it. */
  url: string | null;
  /** The reply line that decides it by mail, when one does. */
  reply: string | null;
  command: string;
  since: string;
}
export interface Activity {
  at: string;
  actor: 'agent' | 'code' | 'person' | 'service';
  topic: string;
  storyId: string | null;
  what: string;
}
export interface LiveJobs {
  running: {
    key: string;
    kind: RowKind;
    topic: string;
    storyId: string;
    step: string | null;
    since: string;
    pid: number;
  }[];
  /** What the work plane would start next (a dry nextJob), or null. */
  queued: Job | null;
  due: { topic: string; storyId: string; why: string; at: string }[];
  scheduled: { key: string; topic: string; storyId: string; output: string; publishAt: string }[];
  stuck: { key: string; since: string; why: string }[];
}
export interface LiveView {
  generatedAt: string;
  rows: LiveRow[];
  jobs: LiveJobs;
  owner: OwnerItem[];
  activity: Activity[];
  readiness: ReadinessRow[];
  /** The caps as configured (limits, not measurements) and the week as rolled up beside budget.json. */
  budget: Automation['agents']['budgetUsd'];
  week: WeekRollup & { week: string };
}

export interface BoardRow {
  column: string | null;
  stage: string | null;
  next: string;
  institution: string | null;
  stopped?: boolean;
}
export interface LiveDeps {
  now?: () => number;
  alive?: (pid: number) => boolean;
  a?: Automation;
  /** The board's answer for one story or Short (column, stage, next, institution); the default asks topicBoard. */
  boardRow?: (topic: string, storyId: string) => BoardRow | null;
}

const institutionOf = (topic: string): string | null =>
  Object.entries(commissions).find(([, c]) => c.topics.includes(topic) || c.fixtureTopics?.includes(topic))?.[0] ??
  null;

/** The default board access: one topicBoard per topic, cached for this view; null when the board cannot answer. */
function boardRows(root: string): (topic: string, storyId: string) => BoardRow | null {
  const cache = new Map<string, ReturnType<typeof topicBoard> | null>();
  return (topic, storyId) => {
    if (!cache.has(topic)) {
      try {
        cache.set(topic, topicBoard(topic, root));
      } catch {
        cache.set(topic, null);
      }
    }
    const b = cache.get(topic);
    if (!b) return null;
    const institution = institutionOf(topic);
    const m = /^(.*)\/shorts\/[^/]+$/.exec(storyId);
    if (m) {
      const parent = b.stories.find((r) => r.story.id === m[1]);
      const sh = parent?.shorts.find((s) => s.id === storyId);
      return sh
        ? { column: shortColumnOf(sh), stage: sh.production?.stage ?? null, next: sh.next, institution, stopped: false }
        : null;
    }
    const r = b.stories.find((x) => x.story.id === storyId);
    return r
      ? { column: columnOf(r), stage: r.production?.stage ?? null, next: r.next, institution, stopped: stoppedOf(r) }
      : null;
  };
}

const slugOf = (topic: string, storyId: string, root: string) => basename(scriptDir(topic, storyId, root));
const reviewUrl = (topic: string, storyId: string, root: string) => `/${topic}/review/${slugOf(topic, storyId, root)}`;
const stepKindOf = (step: string | null, agent: boolean): StepKind | null => {
  if (!step) return null;
  if (agent || /briefs\//.test(step)) return 'agent'; // a brief is an agent's step, open attempt record or not
  if (/^npm run publish -- (upload|push|sync|verify|go-live)/.test(step)) return 'service';
  if (/^npm run /.test(step)) return 'cli';
  return 'person';
};
const alias = (r: AttemptRecord) => r.modelRequested;
/** The model version the last finished attempt of this role under this alias used: what an estimate is keyed by. */
function versionFor(all: Attempt[], role: string, model: string | null): string | null {
  const last = all
    .filter((a) => a.finished && a.role === role && a.modelRequested === model && a.models.length === 1)
    .at(-1);
  return last?.models[0].model ?? null;
}

export function liveView(root = ROOT, deps: LiveDeps = {}): LiveView {
  const now = deps.now ?? Date.now;
  const alive = deps.alive ?? pidAlive;
  const a = deps.a ?? loadAutomation(root);
  const board = deps.boardRow ?? boardRows(root);
  const all = attempts(root);
  const roll = rollups(root, all);
  const at = new Date(now()).toISOString();
  const rows: LiveRow[] = [];
  const activity: Activity[] = [];
  const running: LiveJobs['running'] = [];
  const stuck: LiveJobs['stuck'] = [];

  for (const f of runFolders(root)) {
    const dir = join(f.dir, RUN_DIR);
    const journal = readJournal(dir);
    const lock = readLock(dir);
    const halt = readHalt(dir);
    const live = lock !== null && alive(lock.pid);
    const last = journal.at(-1) ?? null;
    const isTopicRun = f.storyId === 'research';
    const kind: RowKind = isTopicRun
      ? (lock?.command.startsWith('scan') ?? false) || (!lock && last?.stage === 'scan')
        ? 'scan'
        : 'research'
      : /\/shorts\//.test(f.storyId)
        ? 'short'
        : 'video';
    const key = `${f.topic}/${f.storyId}`;
    // the open attempts of a live run: one line per parallel agent, by pid, never from the shared lock
    const open = live
      ? readAttempts(dir).filter((r) => r.finishedAt === null && r.pid !== undefined && alive(r.pid))
      : [];
    const agents: LiveAgent[] = open.map((r) => ({
      role: r.role,
      model: alias(r),
      step: r.step,
      pid: r.pid ?? null,
      startedAt: r.at,
    }));
    const step = live ? (lock!.childStep ?? null) : null;
    const state: RowState = live ? (step ? 'running' : 'between-steps') : halt ? 'halted' : 'idle';
    const stepStartedAt = live ? (open[0]?.at ?? lock!.childAt ?? last?.at ?? lock!.startedAt) : null;
    const model = open[0] ? alias(open[0]) : null;
    const b = isTopicRun ? null : board(f.topic, f.storyId);
    const run = roll.byRun[key] ?? { runUsd: 0, totalUsd: 0 };
    const est = open[0] ? estimate(open[0].role, versionFor(all, open[0].role, model) ?? '', root, all) : null;
    const h: LiveHalt | null =
      !live && halt
        ? {
            kind: halt.kind,
            why: halt.why,
            unblock: halt.unblock.text,
            retryable: retryable(halt),
            retries: resumesSince(dir, halt),
            nextRetryAt: nextRetry(a, dir, halt),
            at: halt.at,
          }
        : null;
    const staleHeartbeat = live && now() - Date.parse(lock!.heartbeatAt) >= a.runs.lockStaleMinutes * 60_000;
    rows.push({
      key,
      institution: b?.institution ?? institutionOf(f.topic),
      topic: f.topic,
      storyId: f.storyId,
      kind,
      column: b?.column ?? null,
      stage: isTopicRun ? (lock ? (last?.stage ?? null) : (last?.stage ?? null)) : (b?.stage ?? null),
      state: !live && !halt && b?.column && ['published', 'live'].includes(b.column) ? 'done' : state,
      step,
      stepKind: live ? stepKindOf(step, open.length > 0) : null,
      role: live
        ? (open[0]?.role ?? (step && /briefs\//.test(step) ? roleOf({ kind: 'prompt', text: step }) : null))
        : null,
      model: live ? model : null,
      startedAt: live ? lock!.startedAt : null,
      stepStartedAt,
      elapsedMs: stepStartedAt ? now() - Date.parse(stepStartedAt) : null,
      costUsd: { run: run.runUsd, total: run.totalUsd },
      estimate: est,
      agents,
      halt: h,
      next: b?.next ?? halt?.board.next ?? last?.next ?? '',
      stopped: b?.stopped ?? false,
      staleHeartbeat,
    });
    if (live)
      running.push({ key, kind, topic: f.topic, storyId: f.storyId, step, since: lock!.startedAt, pid: lock!.pid });
    if (!live && halt && !retryable(halt) && now() - Date.parse(halt.at) >= a.runs.stuckAfterMinutes * 60_000)
      stuck.push({ key, since: halt.at, why: `${halt.kind}: ${halt.why}` });
    for (const e of journal) activity.push(journalActivity(e, f.topic, isTopicRun ? null : f.storyId));
  }
  // discovery: its halts as rows, its lock as a running row
  for (const d of discoveryHalts(root))
    rows.push({
      key: `proposals/${d.slug}`,
      institution: null,
      topic: 'proposals',
      storyId: d.slug,
      kind: 'discovery',
      column: null,
      stage: 'discovery',
      state: 'halted',
      step: null,
      stepKind: null,
      role: null,
      model: null,
      startedAt: null,
      stepStartedAt: null,
      elapsedMs: null,
      costUsd: { run: 0, total: 0 },
      estimate: null,
      agents: [],
      halt: {
        kind: d.halt.kind,
        why: d.halt.why,
        unblock: d.halt.unblock.text,
        retryable: false,
        retries: 0,
        nextRetryAt: null,
        at: d.halt.at,
      },
      next: d.halt.unblock.text,
      stopped: false,
      staleHeartbeat: false,
    });
  const dlock = readLock(discoveryDir(root));
  if (dlock && alive(dlock.pid)) {
    const key = 'proposals/discovery';
    rows.push({
      key,
      institution: null,
      topic: 'proposals',
      storyId: 'discovery',
      kind: 'discovery',
      column: null,
      stage: 'discovery',
      state: dlock.childStep ? 'running' : 'between-steps',
      step: dlock.childStep ?? null,
      stepKind: dlock.childStep ? 'agent' : null,
      role: dlock.childStep ? roleOf({ kind: 'prompt', text: dlock.childStep }) : null,
      model: null,
      startedAt: dlock.startedAt,
      stepStartedAt: dlock.childAt ?? dlock.startedAt,
      elapsedMs: now() - Date.parse(dlock.childAt ?? dlock.startedAt),
      costUsd: { run: 0, total: 0 },
      estimate: null,
      agents: [],
      halt: null,
      next: '',
      stopped: false,
      staleHeartbeat: false,
    });
    running.push({
      key,
      kind: 'discovery',
      topic: 'proposals',
      storyId: 'discovery',
      step: dlock.childStep ?? null,
      since: dlock.startedAt,
      pid: dlock.pid,
    });
  }
  for (const d of discoveryRecords(root))
    for (const [inst, run] of Object.entries(d.institutions)) {
      activity.push({
        at: d.startedAt,
        actor: 'agent',
        topic: 'proposals',
        storyId: d.slot,
        what: `discovery agent for ${inst}${run.ok ? '' : ` failed: ${run.error ?? ''}`} (${run.costUsd.toFixed(2)} USD)`,
      });
      for (const [slug, r] of Object.entries(run.reviews))
        activity.push({
          at: d.startedAt,
          actor: 'agent',
          topic: 'proposals',
          storyId: slug,
          what: `proposal review of ${slug}${r.ok ? '' : ` failed: ${r.error ?? ''}`} (${r.costUsd.toFixed(2)} USD)`,
        });
    }

  // ledgers, the outbox, launches
  const owner: OwnerItem[] = [];
  const scheduled: LiveJobs['scheduled'] = [];
  for (const [topic, storyId] of storiesWithLedgers(root)) {
    const ledger = loadLedger(topic, storyId, root);
    if (!ledger) continue;
    const key = `${topic}/${storyId}`;
    for (const [id, o] of Object.entries(ledger.outputs))
      for (const e of o.events)
        activity.push({
          at: e.at,
          actor: /^automated:|^automation$|^tick/.test(e.by)
            ? SERVICE_EVENTS.has(e.type)
              ? 'service'
              : 'code'
            : SERVICE_EVENTS.has(e.type)
              ? 'service'
              : 'person',
          topic,
          storyId,
          what: `${e.type} ${id}${'id' in e && e.id ? ` (${e.id})` : ''} by ${e.by}`,
        });
    const req = openRequest(ledger, undefined, new Date(now()));
    if (req)
      owner.push({
        kind: 'release-request',
        key: `release:${req.request}`,
        topic,
        storyId,
        what: `release request ${req.request}, sent ${req.at}, expires ${req.expiresAt}`,
        url: reviewUrl(topic, storyId, root),
        reply: `OK ${req.request}  (or: OK at <when>, CHANGES: <what>)`,
        command: `npm run publish -- decide ${topic} ${storyId} --request ${req.request} --verdict ok --by "<name>" --via cli`,
        since: req.at,
      });
    const manifest = readJson<ReleaseManifest>(
      join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, MANIFEST_FILE),
    );
    for (const c of manifest?.ctas?.commercial ?? [])
      if (!c.approvedBy)
        owner.push({
          kind: 'paid-link',
          key: `paid:${key}:${c.id}`,
          topic,
          storyId,
          what: `paid link ${c.n} (${c.id}) awaits your approval: ${c.text}`,
          url: reviewUrl(topic, storyId, root),
          reply: req ? `PAID ${c.n} OK` : null,
          command: `npm run links -- cta approve ${topic} ${storyId} ${c.id} --by "<name>"`,
          since: manifest!.generatedAt ?? at,
        });
    try {
      const main = openOutput(topic, storyId, { root });
      if (main.state.status === 'scheduled') {
        const publishAt = main.out.events.findLast((e) => e.type === 'scheduled')?.publishAt;
        if (publishAt) scheduled.push({ key, topic, storyId, output: main.id, publishAt });
      }
    } catch {
      /* a ledger without a main output: nothing scheduled */
    }
  }
  for (const e of readOutbox(root))
    activity.push({
      at: e.sentAt ?? e.createdAt,
      actor: 'code',
      topic: e.topic ?? 'proposals',
      storyId: e.storyId ?? null,
      what: `mail ${e.kind}: ${e.subject}${e.sentAt ? '' : ' (unsent)'}`,
    });
  for (const l of launches(root))
    activity.push({
      at: l.liveAt ?? l.startedAt,
      actor: l.liveAt ? 'service' : 'code',
      topic: l.topic,
      storyId: l.storyId,
      what: l.liveAt ? `launch live (${l.probes} probes)` : `launch started${l.halt ? `, halted ${l.halt.kind}` : ''}`,
    });

  // the owner's other items: proposal batches, drafts, corrections, halts a person resolves
  const batches = new Map<string, { slugs: string[]; since: string }>();
  for (const p of loadProposals(root))
    if (p.proposal.status === 'proposed' && p.proposal.batch) {
      const b = batches.get(p.proposal.batch.id) ?? { slugs: [], since: p.proposal.batch.sentAt };
      b.slugs.push(p.proposal.slug);
      batches.set(p.proposal.batch.id, b);
    }
  for (const [id, b] of batches)
    owner.push({
      kind: 'proposal-batch',
      key: `batch:${id}`,
      topic: 'proposals',
      storyId: null,
      what: `proposal batch ${id} awaits your reply: ${b.slugs.join(', ')}`,
      url: null,
      reply: b.slugs.map((s) => `APPROVE ${s}`).join(' / ') + ' / REJECT <slug>: <why> / APPROVE ALL',
      command: b.slugs.map((s) => `npm run topics -- approve ${s} --by "<name>"`).join('; '),
      since: b.since,
    });
  for (const s of scriptDirs(root)) {
    const storyId = readJson<{ story?: string }>(join(s.dir, 'script.json'))?.story ?? s.slug;
    const r = loadArticleRequest(s.topic, storyId, root);
    if (r && !r.decided && Date.parse(r.expiresAt) > now())
      owner.push({
        kind: 'correction-request',
        key: `correction:${r.request}`,
        topic: s.topic,
        storyId,
        what: `article correction ${r.request} awaits your reply, requested ${r.at}, expires ${r.expiresAt}`,
        url: null,
        reply: 'OK  (or: CHANGES: <what>)',
        command: `npm run article -- decide ${s.topic} ${storyId} --request ${r.request} --verdict ok --by "<name>"`,
        since: r.at,
      });
  }
  for (const r of rows) {
    if (r.halt && (r.halt.kind === 'awaiting-person' || r.halt.kind === 'needs-person'))
      owner.push({
        kind: r.halt.kind,
        key: `halt:${r.key}`,
        topic: r.topic,
        storyId: r.storyId,
        what: `${r.halt.kind}: ${r.halt.why}`,
        url: r.kind === 'video' || r.kind === 'short' ? reviewUrl(r.topic, r.storyId, root) : null,
        reply: null,
        command: r.halt.unblock,
        since: r.halt.at,
      });
    if (r.column === 'draft-review' && !owner.some((o) => o.kind === 'draft-review' && o.key === `draft:${r.key}`))
      owner.push({
        kind: 'draft-review',
        key: `draft:${r.key}`,
        topic: r.topic,
        storyId: r.storyId,
        what: `a draft awaits your review`,
        url: reviewUrl(r.topic, r.storyId, root),
        reply: 'OK  (or: CHANGES: <what>) to the draft mail',
        command: `npm run publish -- accept-draft ${r.topic} ${r.storyId} --by "<name>" --build <sha>`,
        since: r.stepStartedAt ?? at,
      });
  }
  // drafts of stories without a run folder: an uploaded draft build in the ledger (buildColumn's rule: uploaded or
  // metadata-behind with a draft build is draft-review); a packaged draft not yet uploaded shows on the Board's row,
  // whose column the board computes, and is listed here only once its run folder exists (asking the board for every
  // story would cost the whole board on every poll)
  for (const [topic, storyId] of storiesWithLedgers(root)) {
    const key = `${topic}/${storyId}`;
    if (owner.some((o) => o.key === `draft:${key}`)) continue;
    try {
      const main = openOutput(topic, storyId, { root });
      const build = currentBuild(scriptDir(topic, storyId, root));
      if (build?.status === 'draft' && ['uploaded', 'metadata-behind'].includes(main.state.status))
        owner.push({
          kind: 'draft-review',
          key: `draft:${key}`,
          topic,
          storyId,
          what: 'a draft awaits your review',
          url: reviewUrl(topic, storyId, root),
          reply: 'OK  (or: CHANGES: <what>) to the draft mail',
          command: `npm run publish -- accept-draft ${topic} ${storyId} --by "<name>" --build ${build.sha}`,
          since: main.out.events.findLast((e) => e.type === 'uploaded')?.at ?? at,
        });
    } catch {
      /* a ledger without a main output */
    }
  }
  owner.sort((x, y) => x.since.localeCompare(y.since));

  const queued = queuedJob(a, root, now, alive);
  const week = isoWeek(new Date(now()));
  const wk = roll.weeks[week] ?? {
    rolledUpUsd: 0,
    budgetUsd: 0,
    gapUsd: 0,
    attempts: 0,
    unknownModel: 0,
    mixedModel: 0,
    unparsed: 0,
    overCap: 0,
  };
  return {
    generatedAt: at,
    rows: rows.sort((x, y) => x.key.localeCompare(y.key)),
    jobs: {
      running,
      queued,
      due: (readSchedule(root).due ?? []).map((d) => ({ topic: d.topic, storyId: d.storyId, why: d.why, at: d.at })),
      scheduled,
      stuck,
    },
    owner,
    activity: activity.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 100),
    readiness: readinessView(root, a),
    budget: a.agents.budgetUsd,
    week: { week, ...wk },
  };
}

/** The work plane's next job (a dry nextJob), remembered for a minute per root: it asks the board for every story
 *  with a ledger (seconds), which a five-second poll cannot afford; the answer is the real one, a minute old at most. */
const QUEUED_TTL_MS = 60_000;
const queuedMemo = new Map<string, { at: number; job: Job | null }>();
function queuedJob(a: Automation, root: string, now: () => number, alive: (pid: number) => boolean): Job | null {
  const m = queuedMemo.get(root);
  if (m && now() - m.at < QUEUED_TTL_MS) return m.job;
  let job: Job | null;
  try {
    job = nextJob(a, root, { now, alive });
  } catch {
    job = null;
  }
  queuedMemo.set(root, { at: now(), job });
  return job;
}

const SERVICE_EVENTS = new Set(['uploaded', 'published', 'unpublished', 'verified', 'scheduled', 'updated']);

function journalActivity(e: JournalEntry, topic: string, storyId: string | null): Activity {
  const actor: Activity['actor'] = e.kind === 'prompt' ? 'agent' : e.kind === 'do' ? 'person' : 'code';
  const cost = e.costUsd
    ? ` (${e.costUsd.toFixed(2)} USD${e.models?.length ? `, ${e.models.map((m) => m.model).join('+')}` : ''})`
    : '';
  return { at: e.at, actor, topic, storyId, what: `${e.kind}: ${e.step}${e.error ? `: ${e.error}` : ''}${cost}` };
}

/** The next automatic retry of a retryable halt by the configured backoff, or null (a person's halt). */
function nextRetry(a: Automation, dir: string, h: Halt): string | null {
  if (!retryable(h)) return null;
  const attempt = resumesSince(dir, h);
  const backoff = a.runs.retryBackoffMinutes;
  if (attempt >= backoff.length) return null;
  return new Date(Date.parse(h.at) + backoff[attempt] * 60_000).toISOString();
}
