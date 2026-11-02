// The live view model (M3 2.1): derived at read time from the locks, journals, attempt records, halts, ledgers and
// the board; one row per story, Short and research, scan or discovery run; the owner's action list; the activity
// feed; the readiness table. Nothing here writes. Fixtures: run folders built with the real writers, a fake pid set.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { ROOT, readJson, toJson, writeJsonAtomic } from '../../src/shared/io';
import type { Proposal } from '../../src/shared/types';
import { appendEvent, emptyLedger, publishPath, saveLedger } from '../../src/modules/publishing/publish';
import { proposalPath } from '../../src/modules/topic-discovery/proposals';
import { writeDiscoveryHalt } from '../../src/orchestration/run/discovery-state';
import {
  type AttemptRecord,
  type Halt,
  type JournalEntry,
  appendJournal,
  runDir,
  topicRunDir,
  writeAttempt,
  writeHalt,
} from '../../src/orchestration/run/journal';
import { type LiveDeps, liveView } from '../../src/orchestration/run/live';
import { jobsHtml } from '../../src/admin/live-render';
import { addSpend, isoWeek } from '../../src/orchestration/run/runner';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const roots: string[] = [];
const fixtures: Fixture[] = [];
afterAll(() => {
  roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
  fixtures.forEach((f) => f.cleanup());
}, 60_000);
const T = 'heat-pumps';
const S = 'decision:x';
const NOW = Date.parse('2026-11-10T10:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const ALIVE = new Set([101, 102, 201, 202, 203, 301]);
const deps = (over: Partial<LiveDeps> = {}): LiveDeps => ({
  now: () => NOW,
  alive: (pid) => ALIVE.has(pid),
  a: DEFAULTS,
  boardRow: () => ({ column: 'producing', stage: 'script', next: 'agent: script.md', institution: 'spending' }),
  ...over,
});
const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  at: ago(10),
  runId: 'r1',
  stage: 'script',
  next: 'agent: script.md',
  step: 'Read src/modules/script/briefs/script.md and follow it.',
  kind: 'prompt',
  attempt: 1,
  exit: 0,
  ms: 1000,
  costUsd: 0.5,
  ...over,
});
const model = (m: string, usd: number) => ({
  model: m,
  canonical: m,
  tokens: { input: 1, output: 1, cacheRead: 0, cacheCreate: 0 },
  costUsd: usd,
});
const record = (line: number, over: Partial<AttemptRecord>): AttemptRecord => ({
  line,
  round: 1,
  at: ago(10),
  finishedAt: ago(9),
  step: 'Read src/modules/script/briefs/script.md and follow it.',
  role: 'writer',
  modelRequested: 'opus',
  models: [model('claude-opus-4-1-20250805', 0.5)],
  effort: 'high',
  turns: 2,
  costUsd: 0.5,
  budgetUsd: 8,
  overCap: false,
  ms: 60_000,
  apiMs: 50_000,
  exit: 0,
  isError: false,
  subtype: 'success',
  stopReason: 'end_turn',
  errors: [],
  denials: [],
  sessionId: 's1',
  resumedFrom: null,
  ...over,
});
const lock = (dir: string, pid: number, over: Record<string, unknown> = {}) =>
  writeJsonAtomic(join(dir, 'lock.json'), {
    runId: 'r1',
    pid,
    host: 'h',
    startedAt: ago(30),
    heartbeatAt: ago(0.5),
    command: `story ${T} ${S}`,
    ...over,
  });
function fresh() {
  const root = mkdtempSync(join(tmpdir(), 'vk-live-'));
  roots.push(root);
  cliRoot(root);
  const story = (id: string) => {
    const slug = id.replace(/[^A-Za-z0-9]+/g, '-');
    mkdirSync(join(root, 'topics', T, 'scripts', slug), { recursive: true });
    writeFileSync(join(root, 'topics', T, 'scripts', slug, 'script.json'), JSON.stringify({ story: id }));
    return runDir(T, id, root);
  };
  return { root, story };
}

describe('liveView rows', () => {
  it('a running story in an agent step: the agent, its role, model, elapsed, the run cost and an estimate when five like it exist', () => {
    const { root, story } = fresh();
    const dir = story(S);
    // five finished writer attempts on one model version give the estimate; then the open one
    for (let i = 0; i < 5; i++) {
      const l = appendJournal(dir, entry({ at: ago(100 - i), costUsd: 1 + i }));
      writeAttempt(
        dir,
        record(l, {
          costUsd: 1 + i,
          models: [model('claude-opus-4-1-20250805', 1 + i)],
          at: ago(100 - i),
          ms: 1000 * (i + 1),
        }),
      );
      addSpend(root, isoWeek(new Date(NOW)), 1 + i);
    }
    appendJournal(dir, entry({ kind: 'finish', step: 'finish', costUsd: 0, at: ago(50) }));
    const l = appendJournal(dir, entry({ kind: 'run', step: 'npm run script -- package t s', costUsd: 0, at: ago(5) }));
    writeAttempt(dir, record(l + 1, { finishedAt: null, costUsd: 0, models: [], turns: null, pid: 102, at: ago(4) }));
    lock(dir, 101, {
      childPid: 102,
      childStep: 'Read src/modules/script/briefs/script.md and follow it.',
      childAt: ago(4),
    });
    const v = liveView(root, deps());
    const row = v.rows.find((r) => r.key === `${T}/${S}`)!;
    expect(row).toMatchObject({
      kind: 'video',
      institution: 'spending',
      column: 'producing',
      stage: 'script',
      state: 'running',
      stepKind: 'agent',
      role: 'writer',
      model: 'opus',
      next: 'agent: script.md',
    });
    expect(row.step).toMatch(/script\.md/);
    expect(row.startedAt).toBe(ago(30));
    expect(row.stepStartedAt).toBe(ago(4));
    expect(row.elapsedMs).toBe(4 * 60_000);
    expect(row.costUsd).toEqual({ run: 0, total: 15 });
    expect(row.estimate).toEqual({ n: 5, medianUsd: 3, p75Usd: 4, medianMs: 3000 });
    expect(row.agents).toHaveLength(1);
    expect(row.agents[0]).toMatchObject({ role: 'writer', pid: 102 });
    expect(row.halt).toBeNull();
    expect(row.stopped).toBe(false);
    expect(v.generatedAt).toBe(new Date(NOW).toISOString());
  });
  it('a running story between steps shows between-steps with the time since the last journal line; a CLI step is a cli step', () => {
    const { root, story } = fresh();
    const dir = story(S);
    appendJournal(dir, entry({ kind: 'run', step: 'npm run script -- package t s', costUsd: 0, at: ago(2) }));
    lock(dir, 101);
    const between = liveView(root, deps()).rows.find((r) => r.key === `${T}/${S}`)!;
    expect(between.state).toBe('between-steps');
    expect(between.elapsedMs).toBe(2 * 60_000);
    expect(between.stepKind).toBeNull();
    expect(between.estimate).toBeNull();
    // an agent brief whose attempt record has already closed (the lock still names the step): still an agent step
    lock(dir, 101, {
      childPid: 102,
      childStep: 'Read src/modules/script/briefs/script-review.md and follow it.',
      childAt: ago(1),
    });
    const closing = liveView(root, deps()).rows.find((r) => r.key === `${T}/${S}`)!;
    expect(closing.stepKind).toBe('agent');
    expect(closing.role).toBe('reviewer');
    lock(dir, 101, { childPid: 102, childStep: 'npm run video -- render t s', childAt: ago(1) });
    const cli = liveView(root, deps()).rows.find((r) => r.key === `${T}/${S}`)!;
    expect(cli).toMatchObject({
      state: 'running',
      stepKind: 'cli',
      step: 'npm run video -- render t s',
      role: null,
      model: null,
    });
    expect(cli.elapsedMs).toBe(60_000);
  });
  it('a research run lists one line per parallel agent from the open attempt records whose pid is alive, never from the shared lock', () => {
    const { root } = fresh();
    const dir = topicRunDir(T, root);
    appendJournal(
      dir,
      entry({ stage: 'lists', kind: 'run', step: 'npm run evidence -- groups t', costUsd: 0, at: ago(3) }),
    );
    const base = 2;
    for (let k = 0; k < 3; k++)
      writeAttempt(
        dir,
        record(base + k, {
          finishedAt: null,
          costUsd: 0,
          models: [],
          role: 'extraction',
          modelRequested: 'sonnet',
          step: `Read src/modules/evidence/briefs/extract.md and follow it.\nGroup: ${k + 1}`.split('\n')[0],
          pid: 201 + k,
          at: ago(2),
        }),
      );
    writeAttempt(
      dir,
      record(9, { finishedAt: null, costUsd: 0, models: [], role: 'extraction', pid: 999, at: ago(500) }),
    ); // a crashed run's
    lock(dir, 301, {
      command: `topic ${T}`,
      childPid: 203,
      childStep: 'Read src/modules/evidence/briefs/extract.md and follow it.',
      childAt: ago(2),
    });
    const row = liveView(root, deps({ boardRow: () => null })).rows.find((r) => r.key === `${T}/research`)!;
    expect(row.kind).toBe('research');
    expect(row.state).toBe('running');
    expect(row.stepKind).toBe('agent');
    expect(row.agents.map((x) => x.pid)).toEqual([201, 202, 203]);
    expect(row.agents.every((x) => x.role === 'extraction' && x.model === 'sonnet')).toBe(true);
    expect(row.stage).toBe('lists');
    expect(row.column).toBeNull();
  });
  it('a halted story: kind, why, unblock, retryable, the retries so far and the next retry time; a scan row; a discovery halt row', () => {
    const { root, story } = fresh();
    const dir = story(S);
    appendJournal(dir, entry({ kind: 'resume', step: 'resume', costUsd: 0, at: ago(40) }));
    appendJournal(dir, entry({ kind: 'halt', step: 'timeout', error: 'render hung', costUsd: 0, at: ago(20) }));
    const h: Halt = {
      kind: 'timeout',
      stage: 'video',
      why: 'render hung',
      unblock: { kind: 'run', text: `npm run run -- story ${T} ${S}` },
      at: ago(20),
      runId: 'r1',
      board: { stage: 'video', next: 'npm run video -- render' },
    };
    writeHalt(dir, h);
    // a scan in the topic's work folder (no lock: idle after its finish)
    const tdir = topicRunDir(T, root);
    appendJournal(
      tdir,
      entry({
        stage: 'scan',
        kind: 'prompt',
        step: 'Read src/modules/evidence/briefs/new-sources.md and follow it.',
        at: ago(60),
      }),
    );
    appendJournal(tdir, entry({ stage: 'scan', kind: 'finish', step: 'finish', costUsd: 0, at: ago(55) }));
    writeDiscoveryHalt(root, 'cheap-flights', {
      kind: 'no-progress',
      stage: 'discovery',
      why: 'the review never completed',
      unblock: { kind: 'fix', text: 'read the log' },
      at: ago(90),
      runId: 'discovery',
      board: { stage: 'discovery', next: '2026-11-06' },
    });
    const v = liveView(
      root,
      deps({
        boardRow: (t, s) =>
          s === S
            ? { column: 'producing', stage: 'video', next: 'npm run video -- render', institution: 'spending' }
            : null,
      }),
    );
    const row = v.rows.find((r) => r.key === `${T}/${S}`)!;
    expect(row.state).toBe('halted');
    expect(row.halt).toEqual({
      kind: 'timeout',
      why: 'render hung',
      unblock: `npm run run -- story ${T} ${S}`,
      retryable: true,
      retries: 1,
      nextRetryAt: new Date(Date.parse(ago(20)) + DEFAULTS.runs.retryBackoffMinutes[1] * 60_000).toISOString(),
      at: ago(20),
    });
    const scan = v.rows.find((r) => r.key === `${T}/research`)!;
    expect(scan.kind).toBe('scan');
    expect(scan.state).toBe('idle');
    expect(scan.stage).toBe('scan');
    const disc = v.rows.find((r) => r.key === 'proposals/cheap-flights')!;
    expect(disc).toMatchObject({ kind: 'discovery', state: 'halted' });
    expect(disc.halt?.kind).toBe('no-progress');
    expect(v.jobs.stuck).toEqual([]); // 20 minutes is under stuckAfterMinutes
  });
  it('the default board row comes from the real board of the story (a synthetic packaged production)', () => {
    const f = syntheticProduction('packaged');
    fixtures.push(f);
    const dir = runDir(f.topic, f.story, f.root);
    appendJournal(dir, entry({ kind: 'finish', step: 'finish', costUsd: 0 }));
    const row = liveView(f.root, { now: () => NOW, alive: () => false, a: DEFAULTS }).rows.find(
      (r) => r.storyId === f.story,
    )!;
    expect(row.institution).toBe('spending');
    expect(typeof row.stopped).toBe('boolean'); // the board's stoppedOf, joined in
    expect(typeof row.column).toBe('string');
    expect(typeof row.stage).toBe('string');
    expect(row.state).toBe('idle');
    expect(row.next.length).toBeGreaterThan(0);
  }, 60_000);
});

describe('liveView owner list, jobs, activity, readiness', () => {
  it('queued work is labelled by the flags: off, a dry-run candidate only; on, the job the work plane will start, the production pick included when its flag is on', () => {
    const { root, story } = fresh();
    story(S);
    const pick = () => ({ kind: 'pick' as const, topic: T, storyId: S, why: 'production pick (0.80)' });
    const off = liveView(root, deps({ pick })).jobs.queued;
    expect(off.workEnabled).toBe(false);
    expect(off.pickEnabled).toBe(false);
    expect(off.pick).toBeNull(); // enabled.production is off: no pick is queued or even proposed as due
    expect(jobsHtml({ running: [], queued: off, due: [], scheduled: [], stuck: [] })).toMatch(/work plane is off/);
    const onA = { ...DEFAULTS, enabled: { ...DEFAULTS.enabled, work: true, production: true } };
    const on = liveView(root, deps({ a: onA, pick })).jobs.queued;
    expect(on.workEnabled).toBe(true);
    expect(on.pickEnabled).toBe(true);
    expect(on.pick).toEqual(pick());
    expect(on.next).toEqual(pick()); // nothing else is due in this root, so the pick is the next job
    const html = jobsHtml({ running: [], queued: on, due: [], scheduled: [], stuck: [] });
    expect(html).toMatch(/Next job the work plane will start: pick heat-pumps \/ decision:x/);
    expect(html).toMatch(/Production pick: on, due: pick heat-pumps \/ decision:x/);
    expect(html).not.toMatch(/work plane is off/);
    const workOnly = liveView(root, deps({ a: { ...DEFAULTS, enabled: { ...DEFAULTS.enabled, work: true } }, pick }))
      .jobs.queued;
    expect(workOnly.pickEnabled).toBe(false);
    expect(workOnly.pick).toBeNull();
    expect(workOnly.next).toBeNull();
    expect(jobsHtml({ running: [], queued: workOnly, due: [], scheduled: [], stuck: [] })).toMatch(
      /Production pick: off/,
    );
  });

  it('the owner list has one item per kind: a proposal batch, a draft, a release request, a paid link, a correction, an awaiting-person and a needs-person halt', () => {
    const { root, story } = fresh();
    const good = readJson<Proposal>(join(ROOT, 'tests', 'fixtures', 'proposals', 'good.json'))!;
    mkdirSync(join(root, 'proposals'), { recursive: true });
    writeFileSync(
      proposalPath('ev-running-costs', root),
      toJson({
        ...good,
        slug: 'ev-running-costs',
        status: 'proposed',
        batch: { id: 'pb-000000000001', sentAt: ago(100), messageId: '<b1@test>' },
      }),
    );
    // a release request and a paid link on one story
    const S2 = 'decision:released';
    story(S2);
    const sdir = join(root, 'topics', T, 'scripts', 'decision-released');
    mkdirSync(join(sdir, 'video', 'review'), { recursive: true });
    writeFileSync(
      join(sdir, 'video', 'review', 'release-manifest.json'),
      toJson({
        releaseSha: 'rs1',
        outputs: { youtube: {} },
        ctas: {
          primary: {},
          secondary: [],
          commercial: [{ n: 1, id: 'cta-1', text: 'A pump', url: 'https://x', disclosure: 'paid', approvedBy: null }],
        },
      }),
    );
    saveLedger(
      publishPath(T, S2, root),
      appendEvent(emptyLedger(`${T}/${S2}`), 'youtube', {
        at: ago(100),
        type: 'approval-requested',
        by: 'automation',
        request: 'rr-000000000001',
        release: 'rs1',
        outputs: ['youtube'],
        expiresAt: new Date(NOW + 86_400_000).toISOString(),
        channel: 'email',
      }).ledger,
    );
    // a correction request on another
    const S3 = 'decision:corrected';
    story(S3);
    writeFileSync(
      join(root, 'topics', T, 'scripts', 'decision-corrected', 'article-request.json'),
      toJson({
        request: 'ar-000000000001',
        fingerprint: 'fp',
        at: ago(100),
        expiresAt: new Date(NOW + 86_400_000).toISOString(),
        by: 'automated: maintenance m1',
      }),
    );
    // halts a person resolves
    const S4 = 'decision:waiting';
    const d4 = story(S4);
    writeHalt(d4, {
      kind: 'awaiting-person',
      stage: 'review',
      why: 'watch the draft',
      unblock: { kind: 'decide', text: 'reply OK to the draft mail' },
      at: ago(10),
      runId: 'r',
      board: { stage: 'review', next: 'x' },
    });
    const S5 = 'decision:needs';
    const d5 = story(S5);
    writeHalt(d5, {
      kind: 'needs-person',
      stage: 'publish',
      why: 'a live video cites a revised finding',
      unblock: { kind: 'decide', text: `npm run run -- clear ${T} ${S5} --by "<name>"` },
      at: ago(10),
      runId: 'r',
      board: { stage: 'publish', next: 'x' },
    });
    // a draft awaiting review: the board says so
    const S6 = 'decision:draft';
    story(S6);
    const v = liveView(
      root,
      deps({
        boardRow: (t, s) => ({
          column: s === S6 ? 'draft-review' : 'producing',
          stage: 'publish',
          next: 'watch the draft',
          institution: 'spending',
        }),
      }),
    );
    const kinds = v.owner.map((o) => o.kind);
    expect(kinds.sort()).toEqual(
      [
        'awaiting-person',
        'correction-request',
        'draft-review',
        'needs-person',
        'paid-link',
        'proposal-batch',
        'release-request',
      ].sort(),
    );
    const batch = v.owner.find((o) => o.kind === 'proposal-batch')!;
    expect(batch.what).toContain('pb-000000000001');
    expect(batch.command).toMatch(/npm run topics -- approve ev-running-costs --by/);
    expect(batch.reply).toMatch(/APPROVE ev-running-costs/);
    const release = v.owner.find((o) => o.kind === 'release-request')!;
    expect(release.command).toMatch(/npm run publish -- decide heat-pumps decision:released --request rr-000000000001/);
    expect(release.url).toBe(`/${T}/review/decision-released`);
    expect(v.owner.find((o) => o.kind === 'paid-link')!.command).toMatch(
      /npm run links -- cta approve heat-pumps decision:released cta-1 --by/,
    );
    expect(v.owner.find((o) => o.kind === 'correction-request')!.command).toMatch(
      /npm run article -- decide heat-pumps decision:corrected --request ar-000000000001/,
    );
    expect(v.owner.find((o) => o.kind === 'awaiting-person')!.command).toBe('reply OK to the draft mail');
    expect(v.owner.find((o) => o.kind === 'draft-review')!.url).toBe(`/${T}/review/decision-draft`);
  });
  it('activity lists the last entries across journals, ledgers, the outbox and discovery, newest first, each with an actor kind', () => {
    const { root, story } = fresh();
    const dir = story(S);
    appendJournal(dir, entry({ kind: 'run', step: 'npm run script -- package t s', costUsd: 0, at: ago(30) }));
    appendJournal(dir, entry({ at: ago(20) }));
    appendJournal(dir, entry({ kind: 'halt', step: 'awaiting-person', error: 'watch it', costUsd: 0, at: ago(10) }));
    saveLedger(
      publishPath(T, S, root),
      appendEvent(emptyLedger(`${T}/${S}`), 'youtube', {
        at: ago(5),
        type: 'uploaded',
        by: 'automation',
        id: 'vid00000000',
        visibility: 'private',
        build: 'b1',
        metadata: 'm1',
      }).ledger,
    );
    mkdirSync(join(root, '.automation'), { recursive: true });
    writeFileSync(
      join(root, '.automation', 'outbox.json'),
      toJson([
        {
          messageId: '<m1@test>',
          kind: 'draft-request',
          subject: '[CoR draft] x',
          to: 'j',
          topic: T,
          storyId: S,
          createdAt: ago(4),
          sentAt: ago(4),
          attempts: 1,
        },
      ]),
    );
    const v = liveView(root, deps());
    expect(v.activity.map((e) => e.at)).toEqual([ago(4), ago(5), ago(10), ago(20), ago(30)]);
    expect(v.activity.map((e) => e.actor)).toEqual(['code', 'service', 'code', 'agent', 'code']);
    expect(v.activity[1].what).toMatch(/uploaded/);
    expect(v.activity[0].what).toMatch(/draft-request/);
    expect(v.activity.every((e) => e.topic === T)).toBe(true);
  });
  it('jobs: the running locks, the queued job the work plane would start next (dry), the due resumes, scheduled publications and stuck rows; readiness is the integration table', () => {
    const { root, story } = fresh();
    const dir = story(S);
    lock(dir, 101, { childPid: 102, childStep: 'npm run video -- render t s', childAt: ago(1) });
    const S2 = 'decision:old';
    const d2 = story(S2);
    writeHalt(d2, {
      kind: 'step-failed',
      stage: 'video',
      why: 'broken',
      unblock: { kind: 'fix', text: 'read the log' },
      at: ago(DEFAULTS.runs.stuckAfterMinutes + 5),
      runId: 'r',
      board: { stage: 'video', next: 'x' },
    });
    const S3 = 'decision:scheduled';
    story(S3);
    saveLedger(
      publishPath(T, S3, root),
      appendEvent(
        appendEvent(emptyLedger(`${T}/${S3}`), 'youtube', {
          at: ago(100),
          type: 'uploaded',
          by: 'automation',
          id: 'vid00000003',
          visibility: 'private',
          build: 'b3',
          metadata: 'm3',
        }).ledger,
        'youtube',
        {
          at: ago(50),
          type: 'scheduled',
          by: 'Jon',
          id: 'vid00000003',
          publishAt: new Date(NOW + 3_600_000).toISOString(),
        },
      ).ledger,
    );
    const v = liveView(root, deps());
    expect(v.jobs.running.map((j) => j.key)).toEqual([`${T}/${S}`]);
    expect(v.jobs.running[0]).toMatchObject({ kind: 'video', step: 'npm run video -- render t s', pid: 101 });
    expect(v.jobs.stuck.map((j) => j.key)).toEqual([`${T}/${S2}`]);
    expect(v.jobs.scheduled).toEqual([
      {
        key: `${T}/${S3}`,
        topic: T,
        storyId: S3,
        output: 'youtube',
        publishAt: new Date(NOW + 3_600_000).toISOString(),
      },
    ]);
    expect(v.jobs.due).toEqual([]);
    expect(v.jobs.queued.workEnabled).toBe(false); // DEFAULTS: every flag off
    expect(v.jobs.queued.pickEnabled).toBe(false);
    expect(v.jobs.queued.pick).toBeNull();
    expect(v.readiness.map((r) => r.key)).toContain('youtube-upload');
    expect(v.readiness.every((r) => r.verified === null)).toBe(true);
    expect(v.budget).toMatchObject({ perAgent: 8, perRun: 80, perTopic: 150, perWeek: 200 });
    expect(v.week.budgetUsd).toBe(0);
  });
});
