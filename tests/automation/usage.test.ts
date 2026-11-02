// The read side of agent spend (M3 1.2): the attempt is the unit; attempts() lists every attempt exactly once across
// attempt records, journal lines without records (older runs) and discovery records; rollups are sums over it and
// nothing else; estimates are medians over completed, ok, single-model attempts of one role and one model version,
// null under five observations. budget.json stays the gate and is shown beside the week with the gap named.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { writeDiscovery } from '../../src/orchestration/run/discovery-state';
import {
  type AttemptRecord,
  type JournalEntry,
  appendJournal,
  runDir,
  topicRunDir,
  writeAttempt,
} from '../../src/orchestration/run/journal';
import { addSpend, isoWeek } from '../../src/orchestration/run/runner';
import { attempts, estimate, rollups } from '../../src/orchestration/run/usage';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const T = 'heat-pumps';
const S = 'decision:x';
const AT = '2026-11-03T10:00:00.000Z'; // ISO week 2026-W45
const W = isoWeek(new Date(AT));
const model = (m: string, usd: number) => ({
  model: m,
  canonical: m.replace(/-\d{8}$/, ''),
  tokens: { input: 100, output: 10, cacheRead: 0, cacheCreate: 0 },
  costUsd: usd,
});
const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  at: AT,
  runId: 'r1',
  stage: 'script',
  next: 'agent: script.md',
  step: 'Read src/modules/script/briefs/script.md and follow it.',
  kind: 'prompt',
  attempt: 1,
  exit: 0,
  ms: 1000,
  costUsd: 0,
  ...over,
});
const record = (line: number, round: number, over: Partial<AttemptRecord>): AttemptRecord => ({
  line,
  round,
  at: AT,
  finishedAt: AT,
  step: 'Read src/modules/script/briefs/script.md and follow it.',
  role: 'writer',
  modelRequested: 'opus',
  models: [model('claude-opus-4-1-20250805', 1)],
  effort: 'high',
  turns: 3,
  costUsd: 1,
  budgetUsd: 8,
  overCap: false,
  ms: 1000,
  apiMs: 800,
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
function fresh() {
  const root = mkdtempSync(join(tmpdir(), 'vk-usage-'));
  roots.push(root);
  mkdirSync(join(root, 'topics', T, 'scripts', 'decision-x'), { recursive: true });
  writeFileSync(join(root, 'topics', T, 'scripts', 'decision-x', 'script.json'), JSON.stringify({ story: S }));
  return root;
}
/** A prompt step of two rounds (one journal line summing two records) and a run step, then a finish. */
function storyRun(root: string, usd = [0.4, 0.6]) {
  const dir = runDir(T, S, root);
  const l1 = appendJournal(dir, entry({ kind: 'run', step: 'npm run script -- package t s', costUsd: 0 }));
  const l2 = appendJournal(
    dir,
    entry({
      costUsd: usd[0] + usd[1],
      models: [model('claude-opus-4-1-20250805', usd[0] + usd[1])],
      modelRequested: 'opus',
      rounds: 2,
    }),
  );
  writeAttempt(dir, record(l2, 1, { costUsd: usd[0], models: [model('claude-opus-4-1-20250805', usd[0])] }));
  writeAttempt(
    dir,
    record(l2, 2, { costUsd: usd[1], models: [model('claude-opus-4-1-20250805', usd[1])], resumedFrom: 's1' }),
  );
  addSpend(root, W, usd[0]);
  addSpend(root, W, usd[1]);
  return { dir, l1, l2 };
}

describe('attempts: every attempt exactly once', () => {
  it('a line with records counts its records, not itself; a line without records (an older run) counts once with unknown model; discovery counts from its record', () => {
    const root = fresh();
    const { l2 } = storyRun(root);
    // an older line: cost but no records and no usage fields
    const dir = runDir(T, S, root);
    const l3 = appendJournal(
      dir,
      entry({ costUsd: 0.3, step: 'Read src/modules/script/briefs/script-review.md and follow it.' }),
    );
    addSpend(root, W, 0.3);
    // discovery: one institution agent and one review
    writeDiscovery(root, {
      slot: '2026-11-06',
      startedAt: AT,
      finishedAt: AT,
      institutions: {
        spending: {
          session: 'd1',
          costUsd: 0.6,
          ok: true,
          proposals: ['a'],
          reviews: {
            a: {
              session: 'd2',
              costUsd: 0.2,
              ok: true,
              models: [model('claude-opus-4-1-20250805', 0.2)],
              modelRequested: 'opus',
              turns: 2,
              ms: 500,
            },
          },
          done: true,
          models: [model('claude-opus-4-1-20250805', 0.6)],
          modelRequested: 'opus',
          turns: 5,
          ms: 2000,
        },
      },
      batch: null,
      emailed: true,
      costUsd: 0.8,
    });
    addSpend(root, W, 0.8);
    const all = attempts(root);
    expect(all.map((a) => a.costUsd).sort()).toEqual([0.2, 0.3, 0.4, 0.6, 0.6]);
    expect(new Set(all.map((a) => a.key)).size).toBe(all.length);
    const byLine = all.filter((a) => a.source === 'record');
    expect(byLine.map((a) => [a.line, a.round])).toEqual([
      [l2, 1],
      [l2, 2],
    ]);
    const older = all.find((a) => a.source === 'journal')!;
    expect(older.line).toBe(l3);
    expect(older.models).toEqual([]);
    expect(older.modelRequested).toBeNull();
    expect(older.role).toBe('reviewer'); // the brief names the role even on an old line
    const disc = all.filter((a) => a.source === 'discovery');
    expect(disc.map((a) => a.role).sort()).toEqual(['discovery', 'proposalReview']);
    expect(disc[0].topic).toBe('proposals');
    // the week rollup equals budget.json: nothing was lost
    const r = rollups(root);
    expect(r.weeks[W].rolledUpUsd).toBeCloseTo(2.1, 5);
    expect(r.weeks[W].budgetUsd).toBeCloseTo(2.1, 5);
    expect(r.weeks[W].gapUsd).toBeCloseTo(0, 5);
    expect(r.weeks[W].unknownModel).toBe(1);
  });
  it('two attempts of two runs at one journal line (a crash, then a resume) are both listed once and both summed; an old-format record still reads', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    const l = appendJournal(dir, entry({ costUsd: 0.5 })); // the resumed run's line sums its own attempt only
    writeAttempt(
      dir,
      record(l, 1, { runId: 'crashed', costUsd: 0.4, models: [model('claude-opus-4-1-20250805', 0.4)] }),
    );
    writeAttempt(
      dir,
      record(l, 1, { runId: 'resumed', costUsd: 0.5, models: [model('claude-opus-4-1-20250805', 0.5)] }),
    );
    writeAttempt(dir, record(l + 1, 1, { costUsd: 0.2, models: [model('claude-opus-4-1-20250805', 0.2)] })); // no runId: the old name
    const all = attempts(root);
    expect(all.map((a) => a.costUsd).sort()).toEqual([0.2, 0.4, 0.5]);
    expect(new Set(all.map((a) => a.key)).size).toBe(3);
    expect(rollups(root, all).byStory[`${T}/${S}`].totalUsd).toBeCloseTo(1.1, 5);
  });
  it('an open record (the agent still running) is listed as unfinished with no cost; an orphan record (no journal line yet) still counts', () => {
    const root = fresh();
    const dir = runDir(T, S, root);
    writeAttempt(dir, record(1, 1, { finishedAt: null, costUsd: 0, models: [], turns: null, pid: 4242 }));
    writeAttempt(dir, record(2, 1, { costUsd: 0.5, models: [model('claude-opus-4-1-20250805', 0.5)] }));
    const all = attempts(root);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ finished: false, costUsd: 0, line: 1 });
    expect(all[1]).toMatchObject({ finished: true, costUsd: 0.5, line: 2 });
    expect(rollups(root).byStory[`${T}/${S}`].totalUsd).toBeCloseTo(0.5, 5);
  });
});

describe('rollups', () => {
  it('per run resets at finish, per story and per topic accumulate; research and scans roll into the topic', () => {
    const root = fresh();
    const { dir } = storyRun(root);
    appendJournal(dir, entry({ kind: 'finish', step: 'finish', costUsd: 0 }));
    const l = appendJournal(
      dir,
      entry({ costUsd: 0.2, modelRequested: 'opus', models: [model('claude-opus-4-1-20250805', 0.2)] }),
    );
    writeAttempt(dir, record(l, 1, { costUsd: 0.2, models: [model('claude-opus-4-1-20250805', 0.2)] }));
    addSpend(root, W, 0.2);
    const tdir = topicRunDir(T, root);
    const lt = appendJournal(tdir, entry({ stage: 'extract', costUsd: 1.5, role: undefined } as Partial<JournalEntry>));
    writeAttempt(
      tdir,
      record(lt, 1, { role: 'extraction', costUsd: 1.5, models: [model('claude-opus-4-1-20250805', 1.5)] }),
    );
    addSpend(root, W, 1.5);
    const r = rollups(root);
    expect(r.byRun[`${T}/${S}`]).toMatchObject({ runUsd: 0.2, totalUsd: 1.2 });
    expect(r.byStory[`${T}/${S}`].totalUsd).toBeCloseTo(1.2, 5);
    expect(r.byStory[`${T}/research`].totalUsd).toBeCloseTo(1.5, 5);
    expect(r.byTopic[T].totalUsd).toBeCloseTo(2.7, 5);
    expect(r.weeks[W].rolledUpUsd).toBeCloseTo(2.7, 5);
    expect(r.weeks[W].gapUsd).toBeCloseTo(0, 5);
  });
  it('a lost attempt shows as a gap between budget.json and the rollup; an attempt with no parseable result is counted as unparsed', () => {
    const root = fresh();
    const { dir } = storyRun(root);
    addSpend(root, W, 0.7); // spent and gated, but its journal line and record were lost in a crash
    const l = appendJournal(dir, entry({ costUsd: 0, exit: null, error: 'no result (exit null): ENOENT' }));
    writeAttempt(
      dir,
      record(l, 1, { costUsd: 0, models: [], exit: null, errors: ['no result (exit null): ENOENT'], turns: null }),
    );
    const w = rollups(root).weeks[W];
    expect(w.budgetUsd).toBeCloseTo(1.7, 5);
    expect(w.rolledUpUsd).toBeCloseTo(1.0, 5);
    expect(w.gapUsd).toBeCloseTo(0.7, 5);
    expect(w.unparsed).toBe(1);
  });
});

describe('estimate (medians by role and model version)', () => {
  const seed = (root: string, costs: number[], over: Partial<AttemptRecord> = {}) => {
    const dir = runDir(T, S, root);
    costs.forEach((c, i) => {
      const l = appendJournal(dir, entry({ costUsd: c }));
      writeAttempt(
        dir,
        record(l, 1, {
          costUsd: c,
          ms: 1000 * (i + 1),
          models: [model(over.models?.[0]?.model ?? 'claude-opus-4-1-20250805', c)],
          ...over,
          ...(over.models ? {} : {}),
        }),
      );
    });
  };
  it('five completed ok single-model attempts give n, median and p75 cost and median duration; four give null', () => {
    const root = fresh();
    seed(root, [1, 2, 3, 4, 10]);
    expect(estimate('writer', 'claude-opus-4-1-20250805', root)).toEqual({
      n: 5,
      medianUsd: 3,
      p75Usd: 4,
      medianMs: 3000,
    });
    const root4 = fresh();
    seed(root4, [1, 2, 3, 4]);
    expect(estimate('writer', 'claude-opus-4-1-20250805', root4)).toBeNull();
  });
  it('a different model version, another role, a failed attempt and a mixed-model attempt are excluded; the rollup keeps them all', () => {
    const root = fresh();
    seed(root, [1, 2, 3, 4, 5]);
    seed(root, [50], { models: [model('claude-opus-4-1-20260101', 50)] }); // another version
    seed(root, [60], { role: 'reviewer' });
    seed(root, [70], { isError: true, exit: 1 });
    seed(root, [80], { models: [model('claude-opus-4-1-20250805', 40), model('claude-sonnet-4-5-20250929', 40)] });
    expect(estimate('writer', 'claude-opus-4-1-20250805', root)).toEqual({
      n: 5,
      medianUsd: 3,
      p75Usd: 4,
      medianMs: 3000,
    });
    expect(estimate('reviewer', 'claude-opus-4-1-20250805', root)).toBeNull();
    const r = rollups(root);
    expect(r.byStory[`${T}/${S}`].totalUsd).toBeCloseTo(275, 5);
    expect(r.weeks[W].mixedModel).toBe(1);
  });
});
