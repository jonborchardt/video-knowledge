// Shorts inside the run (phase 2 Task 5, spec §5.3): what a packaged parent owes its Shorts, and the pass that
// discovers, hands the reviewer brief to a fresh agent when candidates are unreviewed, and runs each ready candidate
// as a nested story run, serially; a halted Short never stops the others.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REVIEW_DIR, scriptDir, shortId, toJson } from '../../src/shared/io';
import { shortsReviewPath } from '../../src/modules/shorts';
import { runDir, writeHalt, type Halt } from '../../src/orchestration/run/journal';
import type { RunResult } from '../../src/orchestration/run/runner';
import { shortsForParent, shortsOwed, shortsPending } from '../../src/orchestration/run/shorts';
import type { StepOutcome } from '../../src/orchestration/run/steps';
import { type ShortFixture, syntheticShort } from '../production-helpers';

const fixtures: ShortFixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const ok = (): StepOutcome => ({
  kind: 'run',
  ok: true,
  exit: 0,
  ms: 1,
  costUsd: 0,
  sessionId: null,
  error: null,
  log: '',
});
const done = (): RunResult => ({ outcome: 'done', stage: 'packaged', halt: null, iterations: 1, costUsd: 0 });
const packaged = (f: ShortFixture, id: string) => {
  const dir = join(scriptDir(f.topic, id, f.root), 'video', REVIEW_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'review.json'), toJson({ mp4Sha: 'x', status: 'release build' }));
};

describe('shortsOwed', () => {
  it('owes discovery without shorts.json, the production of each ready candidate, nothing once packaged', () => {
    const f = syntheticShort('reviewed');
    fixtures.push(f);
    const id = shortId(f.parent, 'fixture-short');
    let o = shortsOwed(f.topic, f.parent, f.root);
    expect(o).toMatchObject({ discover: false, review: false, produce: [id], halted: [] });
    expect(shortsPending(o)).toBe(true);
    const h: Halt = {
      kind: 'timeout',
      stage: 'render',
      why: 'hung',
      unblock: { kind: 'run', text: 'x' },
      at: 'a',
      runId: 'r',
      board: { stage: 'render', next: '' },
    };
    writeHalt(runDir(f.topic, id, f.root), h);
    expect(shortsOwed(f.topic, f.parent, f.root).halted).toEqual([{ id, halt: h }]);
    packaged(f, id);
    o = shortsOwed(f.topic, f.parent, f.root);
    expect(o.produce).toEqual([]);
    expect(shortsPending(o)).toBe(false);
  });
});

describe('a nested run that is held or ends without a package', () => {
  it('is reported as a halt the parent can act on, never a crash (review finding 2)', async () => {
    const f = syntheticShort('reviewed');
    fixtures.push(f);
    const id = shortId(f.parent, 'fixture-short');
    const held = await shortsForParent(f.topic, f.parent, {
      root: f.root,
      run: async () => ok(),
      runShort: async () => ({ outcome: 'held', stage: '', halt: null, iterations: 0, costUsd: 0 }),
    });
    expect(held.halted).toHaveLength(1);
    expect(held.halted[0]).toMatchObject({ id, halt: { kind: 'timeout' } });
    const empty = await shortsForParent(f.topic, f.parent, {
      root: f.root,
      run: async () => ok(),
      runShort: async () => done(), // done, but no package on disk
    });
    expect(empty.halted[0]).toMatchObject({ id, halt: { kind: 'step-failed' } });
  });
});

describe('shortsForParent', () => {
  it('discovers, runs each ready candidate once as a nested run, and reports a halted one without stopping', async () => {
    const f = syntheticShort('reviewed');
    fixtures.push(f);
    const id = shortId(f.parent, 'fixture-short');
    const steps: string[] = [];
    const ran: string[] = [];
    const r = await shortsForParent(f.topic, f.parent, {
      root: f.root,
      run: async (s) => (steps.push(s.text), ok()),
      runShort: async (sid) => {
        ran.push(sid);
        packaged(f, sid);
        return done();
      },
    });
    expect(steps).toEqual([`npm run shorts -- discover ${f.topic} ${f.parent}`]);
    expect(ran).toEqual([id]);
    expect(r).toEqual({ produced: [id], halted: [], problem: null });
    // a second pass owes nothing and runs nothing
    const again = await shortsForParent(f.topic, f.parent, {
      root: f.root,
      run: async () => ok(),
      runShort: async () => done(),
    });
    expect(again.produced).toEqual([]);
  });

  it('hands the reviewer brief to an agent when candidates are unreviewed, and a halted Short is reported', async () => {
    const f = syntheticShort('reviewed');
    fixtures.push(f);
    const id = shortId(f.parent, 'fixture-short');
    // the review is gone: the candidate needs the reviewer's pass
    const review = shortsReviewPath(f.topic, f.parent, f.root);
    const { renameSync } = await import('node:fs');
    renameSync(review, `${review}.bak`);
    const { discoverShorts, loadShortParent, shortsPath } = await import('../../src/modules/shorts');
    writeFileSync(
      shortsPath(f.topic, f.parent, f.root),
      toJson(discoverShorts(loadShortParent(f.topic, f.parent, f.root), null)),
    );
    const steps: string[] = [];
    const halt: Halt = {
      kind: 'step-failed',
      stage: 'render',
      why: 'boom',
      unblock: { kind: 'fix', text: 'read it' },
      at: 'a',
      runId: 'r',
      board: { stage: 'render', next: '' },
    };
    const r = await shortsForParent(f.topic, f.parent, {
      root: f.root,
      run: async (s) => {
        steps.push(s.text);
        if (/shorts\.md/.test(s.text)) renameSync(`${review}.bak`, review); // the "agent" restores the review
        if (/discover/.test(s.text) || /shorts\.md/.test(s.text))
          writeFileSync(
            shortsPath(f.topic, f.parent, f.root),
            toJson(
              discoverShorts(
                loadShortParent(f.topic, f.parent, f.root),
                existsSync(review) ? JSON.parse(readFileSync(review, 'utf8')) : null,
              ),
            ),
          );
        return ok();
      },
      runShort: async () => ({ outcome: 'halted', stage: 'render', halt, iterations: 1, costUsd: 0 }),
    });
    expect(steps[0]).toMatch(/shorts -- discover/);
    expect(steps[1]).toMatch(/Read src\/modules\/shorts\/briefs\/shorts\.md and follow it/);
    expect(r.produced).toEqual([]);
    expect(r.halted).toEqual([{ id, halt }]);
  });
});
