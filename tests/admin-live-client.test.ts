// The admin page's live patch (M3 2.2): applyLive(prev, next) is pure and yields the smallest set of operations that
// bring the markup from one view to the next: a Now cell's html, a row's column attribute and label, a stage strip's
// current cell, and keyed list reconciliations (insert, remove, replace by key) that never replace a table. The DOM
// side (applyOps) is exercised by the browser test against the dev server.
import { describe, expect, it } from 'vitest';
import type { LiveRow, LiveView } from '../src/orchestration';
import { applyLive, pollDelay } from '../src/admin/live-client';
import { nowCellHtml, ownerItemHtml } from '../src/admin/live-render';

const row = (over: Partial<LiveRow> = {}): LiveRow => ({
  key: 'heat-pumps/decision:x',
  institution: 'spending',
  topic: 'heat-pumps',
  storyId: 'decision:x',
  kind: 'video',
  column: 'producing',
  stage: 'script',
  state: 'running',
  step: 'Read src/modules/script/briefs/script.md and follow it.',
  stepKind: 'agent',
  role: 'writer',
  model: 'opus',
  startedAt: '2026-11-10T09:00:00.000Z',
  stepStartedAt: '2026-11-10T09:50:00.000Z',
  elapsedMs: 600_000,
  costUsd: { run: 1.25, total: 3.5 },
  estimate: null,
  agents: [{ role: 'writer', model: 'opus', step: 'Read script.md', pid: 7, startedAt: '2026-11-10T09:50:00.000Z' }],
  halt: null,
  next: 'agent: script.md',
  stopped: false,
  staleHeartbeat: false,
  ...over,
});
const view = (rows: LiveRow[], over: Partial<LiveView> = {}): LiveView => ({
  generatedAt: '2026-11-10T10:00:00.000Z',
  rows,
  jobs: {
    running: [],
    queued: { workEnabled: false, next: null, pickEnabled: false, pick: null },
    due: [],
    scheduled: [],
    stuck: [],
  },
  owner: [],
  activity: [],
  readiness: [],
  budget: { perAgent: 8, perRun: 80, perTopic: 150, perWeek: 200 },
  week: {
    week: '2026-W46',
    rolledUpUsd: 0,
    budgetUsd: 0,
    gapUsd: 0,
    attempts: 0,
    unknownModel: 0,
    mixedModel: 0,
    unparsed: 0,
    overCap: 0,
  },
  ...over,
});
const STAGES = ['package', 'script', 'validate', 'review'];
const LABELS = { producing: 'In production', 'draft-review': 'Draft review' };
const opts = { stages: STAGES, labels: LABELS };

describe('applyLive', () => {
  it('the first view renders every row cell and list; an identical view yields no operation', () => {
    const v = view([row()]);
    const ops = applyLive(null, v, opts);
    expect(ops.find((o) => o.op === 'html' && o.sel === 'heat-pumps/decision:x.now')).toBeTruthy();
    expect(ops.find((o) => o.op === 'strip' && o.row === 'heat-pumps/decision:x')).toMatchObject({ stage: 'script' });
    expect(
      ops
        .filter((o) => o.op === 'list')
        .map((o) => (o as { list: string }).list)
        .sort(),
    ).toEqual(['activity', 'blocked', 'owner', 'readiness', 'running'].sort());
    expect(applyLive(v, v, opts)).toEqual([]);
  });
  it('a step change rewrites the Now cell only; a column change rewrites the attribute, the label and the strip', () => {
    const a = view([row()]);
    const b = view([row({ step: 'Read src/modules/script/briefs/script-review.md and follow it.', role: 'reviewer' })]);
    const ops = applyLive(a, b, opts);
    // the Now cell and the running list's row carry the step; nothing else moves
    expect(ops.map((o) => o.op).sort()).toEqual(['html', 'list']);
    const now = ops.find((o) => o.op === 'html') as { html: string };
    expect(now.html).toContain('script-review.md');
    expect(now.html).toContain('reviewer');
    const c = view([
      row({
        column: 'draft-review',
        stage: 'review',
        state: 'idle',
        step: null,
        stepKind: null,
        role: null,
        model: null,
        agents: [],
      }),
    ]);
    const ops2 = applyLive(b, c, opts);
    expect(ops2).toEqual(
      expect.arrayContaining([
        { op: 'attr', row: 'heat-pumps/decision:x', attr: 'data-state', value: 'draft-review' },
        { op: 'html', sel: 'heat-pumps/decision:x.column', html: 'Draft review' },
        { op: 'strip', row: 'heat-pumps/decision:x', stage: 'review', stopped: false, done: false },
      ]),
    );
  });
  it('a row that halts moves from the running list to the blocked list by key, with the lists reconciled, never replaced', () => {
    const a = view([row()], {
      jobs: {
        running: [
          {
            key: 'heat-pumps/decision:x',
            kind: 'video',
            topic: 'heat-pumps',
            storyId: 'decision:x',
            step: 'x',
            since: 's',
            pid: 1,
          },
        ],
        queued: { workEnabled: false, next: null, pickEnabled: false, pick: null },
        due: [],
        scheduled: [],
        stuck: [],
      },
    });
    const halted = row({
      state: 'halted',
      step: null,
      stepKind: null,
      role: null,
      model: null,
      agents: [],
      halt: {
        kind: 'timeout',
        why: 'render hung',
        unblock: 'npm run run -- story heat-pumps decision:x',
        retryable: true,
        retries: 1,
        nextRetryAt: '2026-11-10T11:00:00.000Z',
        at: '2026-11-10T10:00:00.000Z',
      },
    });
    const b = view([halted]);
    const ops = applyLive(a, b, opts);
    const running = ops.find((o) => o.op === 'list' && o.list === 'running') as {
      keys: string[];
      html: Record<string, string>;
    };
    const blocked = ops.find((o) => o.op === 'list' && o.list === 'blocked') as {
      keys: string[];
      html: Record<string, string>;
    };
    expect(running.keys).toEqual([]);
    expect(blocked.keys).toEqual(['heat-pumps/decision:x']);
    expect(blocked.html['heat-pumps/decision:x']).toContain('render hung');
    expect(blocked.html['heat-pumps/decision:x']).toContain('retry');
    expect(ops.every((o) => o.op !== 'html' || !/^table/.test(o.sel))).toBe(true); // lists reconcile, tables stay
  });
  it('the owner list is keyed and only changed items carry html; the Now cell says between steps and shows the elapsed time', () => {
    const o1 = {
      kind: 'release-request' as const,
      key: 'release:rr-1',
      topic: 't',
      storyId: 's',
      what: 'release request rr-1',
      url: '/t/review/s',
      reply: 'OK rr-1',
      command: 'npm run publish -- decide',
      since: '2026-11-10T09:00:00.000Z',
    };
    const o2 = { ...o1, key: 'batch:pb-1', kind: 'proposal-batch' as const, what: 'proposal batch pb-1' };
    const a = view([], { owner: [o1] });
    const b = view([], { owner: [o1, o2] });
    const ops = applyLive(a, b, opts);
    const owner = ops.find((o) => o.op === 'list' && o.list === 'owner') as {
      keys: string[];
      html: Record<string, string>;
    };
    expect(owner.keys).toEqual(['release:rr-1', 'batch:pb-1']);
    expect(Object.keys(owner.html)).toEqual(['batch:pb-1']);
    expect(ownerItemHtml(o1)).toContain('OK rr-1');
    expect(ownerItemHtml(o1)).toContain('/t/review/s');
    const between = nowCellHtml(
      row({
        state: 'between-steps',
        step: null,
        stepKind: null,
        role: null,
        model: null,
        agents: [],
        elapsedMs: 125_000,
      }),
    );
    expect(between).toContain('between steps');
    expect(between).toContain('2 min 5 s');
    const estimated = nowCellHtml(row({ estimate: { n: 6, medianUsd: 2.5, p75Usd: 3, medianMs: 60_000 } }));
    expect(estimated).toContain('1.25 USD');
    expect(estimated).toMatch(/2\.50 USD.*n=6/);
    expect(nowCellHtml(row())).toContain('no estimate');
    expect(nowCellHtml(row({ step: '<script>', role: null }))).not.toContain('<script>');
  });
  it('polls every 5 s while something runs or sits between steps, else every 30 s', () => {
    expect(pollDelay(view([row()]))).toBe(5000);
    expect(pollDelay(view([row({ state: 'between-steps' })]))).toBe(5000);
    expect(pollDelay(view([row({ state: 'halted' })]))).toBe(30_000);
    expect(pollDelay(view([]))).toBe(30_000);
  });
});
