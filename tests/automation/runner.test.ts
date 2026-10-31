// The loop (spec §4.1) over a scripted board and a recording executor: order, halts, no-progress, retries, budget,
// caps, the guard's halt kind and the execution order around a graphics agent.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import type { BoardNext, Step } from '../../src/orchestration/production';
import { readHalt, readJournal, runDir } from '../../src/orchestration/run/journal';
import { readLock } from '../../src/orchestration/run/lock';
import { alive } from '../../src/orchestration/run/proc';
import { runStory, type RunOptions } from '../../src/orchestration/run/runner';
import type { StepOutcome } from '../../src/orchestration/run/steps';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));
const newRoot = () => {
  const r = mkdtempSync(join(tmpdir(), 'vk-runner-'));
  writeFileSync(join(r, 'package.json'), '{"name":"video-knowledge"}');
  roots.push(r);
  return r;
};
const T = 'heat-pumps';
const S = 'decision:x';
const a = loadAutomation(join(tmpdir(), 'none'));
const answer = (
  stage: string,
  next: string,
  steps: Step[],
  halt: { kind: string; why: string } | null = null,
  done = false,
): BoardNext => ({ topic: T, story: S, stage, next, steps, halt, done }) as unknown as BoardNext;
const ok = (over: Partial<StepOutcome> = {}): StepOutcome =>
  ({
    kind: 'run',
    ok: true,
    exit: 0,
    ms: 1,
    costUsd: 0,
    sessionId: null,
    error: null,
    log: '',
    ...over,
  }) as StepOutcome;
/** A board that answers from a script, repeating the last answer. */
const scripted = (answers: BoardNext[]) => {
  let i = 0;
  return () => answers[Math.min(i++, answers.length - 1)];
};
// The loop tests run in a temp folder that is not a repository: the real guard is wired by default, so these pass
// no-op hooks unless the test is about the guard.
const noGuard = {
  snapshot: () => {},
  guard: () => ({ ok: true, why: '', kept: [] as string[] }),
  componentCheck: () => ({ ok: true, output: '' }),
};
const run = (root: string, o: Partial<RunOptions>) =>
  runStory(T, S, a, {
    approver: 'automated: test',
    root,
    git: 'none',
    validate: () => ({ ok: true, output: '' }),
    hooks: noGuard,
    ...o,
  });
const FAKE_CLAUDE = join(process.cwd(), 'tests', 'automation', 'fake-claude.mjs');
const FAKE_STEP = join(process.cwd(), 'tests', 'automation', 'fake-step.mjs');

describe('runStory', () => {
  it('runs the steps of each pass in order and asks the board again after each pass', async () => {
    const root = newRoot();
    const calls: string[] = [];
    const r = await run(root, {
      ask: scripted([
        answer('package', 'npm run script -- package t s', [{ kind: 'run', text: 'npm run script -- package t s' }]),
        answer('script', 'agent: script.md', [
          { kind: 'prompt', text: 'Read src/modules/script/briefs/script.md and follow it.' },
        ]),
        answer('packaged', 'done', [], null, true),
      ]),
      exec: async (_a, s) => {
        calls.push(s.text.slice(0, 20));
        return ok({ kind: s.kind });
      },
    });
    expect(calls).toEqual(['npm run script -- pa', 'Read src/modules/scr']);
    expect(r.outcome).toBe('done');
    expect(readLock(runDir(T, S, root))).toBeNull();
    expect(readJournal(runDir(T, S, root)).some((e) => e.kind === 'finish')).toBe(true);
  });
  it('halts awaiting-person on a stop: next and on a board halt a person resolves', async () => {
    for (const [next, halt] of [
      ['stop: revision limit reached', { kind: 'revision-limit', why: 'three revisions' }],
      ['stop: no candidate', { kind: 'story-left', why: 'gone' }],
    ] as const) {
      const root = newRoot();
      const r = await run(root, {
        ask: scripted([answer('validate', next, [{ kind: 'do', text: next }], halt)]),
        exec: async () => ok(),
      });
      expect(r.outcome).toBe('halted');
      expect(r.halt?.kind).toBe('awaiting-person');
      expect(r.halt?.unblock.kind).toBe('decide');
      expect(readHalt(runDir(T, S, root))?.board.next).toBe(next);
    }
  });
  it('a do step halts awaiting-person with the step text as the unblock', async () => {
    const root = newRoot();
    const r = await run(root, {
      ask: scripted([answer('review', 'watch it', [{ kind: 'do', text: 'watch it on the review page' }])]),
      exec: async () => ok(),
    });
    expect(r.halt?.kind).toBe('awaiting-person');
    expect(r.halt?.unblock.text).toBe('watch it on the review page');
  });
  it('counts no progress when the board does not move and halts after the configured attempts', async () => {
    const root = newRoot();
    let n = 0;
    const r = await run(root, {
      ask: scripted([
        answer('script', 'agent: script.md', [{ kind: 'prompt', text: 'Read src/modules/script/briefs/script.md' }]),
      ]),
      exec: async () => {
        n++;
        return ok({ kind: 'prompt', ok: true, costUsd: 0.1, sessionId: `s${n}` });
      },
    });
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('no-progress');
    expect(n).toBe(a.runs.noProgressAttempts); // three attempts at the same next, then the halt
  });
  it('a refusal (exit 2) ends the pass without a retry and asks again', async () => {
    const root = newRoot();
    const calls: string[] = [];
    const r = await run(root, {
      ask: scripted([
        answer('validate', 'npm run script -- validate t s, then npm run script -- storyboard t s', [
          { kind: 'run', text: 'npm run script -- validate t s' },
          { kind: 'run', text: 'npm run script -- storyboard t s' },
        ]),
        answer('packaged', 'done', [], null, true),
      ]),
      exec: async (_a, s) => {
        calls.push(s.text);
        return ok({ ok: false, exit: 2, error: 'refused' });
      },
    });
    expect(calls).toEqual(['npm run script -- validate t s']);
    expect(r.outcome).toBe('done');
  });
  it('retries a crashed render up to the cap in one pass, then halts step-failed', async () => {
    const root = newRoot();
    let n = 0;
    const r = await run(root, {
      ask: scripted([
        answer('video', 'npm run video -- render t s', [{ kind: 'run', text: 'npm run video -- render t s' }]),
      ]),
      exec: async () => {
        n++;
        return ok({ ok: false, exit: 1, error: 'crash' });
      },
    });
    expect(n).toBe(a.runs.timeoutsPerStep);
    expect(r.halt?.kind).toBe('step-failed');
  });
  it('halts budget before the agent that would exceed the run or the week, spending nothing on it', async () => {
    const root = newRoot();
    // perAgent is the estimate of the next agent: 0 + 0.5 fits a run of 1, 0.9 + 0.5 does not
    const small = { ...a, agents: { ...a.agents, budgetUsd: { ...a.agents.budgetUsd, perAgent: 0.5, perRun: 1 } } };
    let n = 0;
    const r = await runStory(T, S, small, {
      approver: 'automated: test',
      root,
      git: 'none',
      hooks: noGuard,
      validate: () => ({ ok: true, output: '' }),
      ask: scripted([
        answer('script', 'agent: a', [{ kind: 'prompt', text: 'Read src/modules/script/briefs/script.md' }]),
        answer('review', 'agent: b', [{ kind: 'prompt', text: 'Read src/modules/script/briefs/script-review.md' }]),
      ]),
      exec: async () => {
        n++;
        return ok({ kind: 'prompt', costUsd: 0.9, sessionId: `s${n}` });
      },
    });
    expect(n).toBe(1);
    expect(r.halt?.kind).toBe('budget');
    expect(r.costUsd).toBeCloseTo(0.9);
  });
  it('look-stale at packaged is done', async () => {
    const root = newRoot();
    const r = await run(root, {
      ask: scripted([
        answer('packaged', 'npm run video -- final t s', [], { kind: 'look-stale', why: 'older kit' }, true),
      ]),
      exec: async () => ok(),
    });
    expect(r.outcome).toBe('done');
  });
  it('a held lock returns held and touches nothing', async () => {
    const root = newRoot();
    const dir = runDir(T, S, root);
    writeFileSync(
      join(dir, 'lock.json'),
      JSON.stringify({
        runId: 'other',
        pid: process.pid,
        host: 'h',
        startedAt: 'x',
        heartbeatAt: 'x',
        command: 'story',
      }),
    );
    const r = await run(root, { ask: scripted([answer('packaged', 'done', [], null, true)]), exec: async () => ok() });
    expect(r.outcome).toBe('held');
    expect(readJournal(dir)).toEqual([]);
  });
  it('a guard failure after an agent halts unexpected-edit with the paths and the session id', async () => {
    const root = newRoot();
    const r = await run(root, {
      ask: scripted([
        answer('script', 'agent: a', [{ kind: 'prompt', text: 'Read src/modules/script/briefs/script.md' }]),
      ]),
      exec: async () =>
        ok({ kind: 'prompt', ok: false, guardFailed: true, error: 'package.json, .env', sessionId: 'sess-9' }),
    });
    expect(r.halt?.kind).toBe('unexpected-edit');
    expect(r.halt?.why).toContain('package.json');
    expect(r.halt?.why).toContain('sess-9');
  });
  it('the graphics cap halts cap after the configured revisions of one scene', async () => {
    const root = newRoot();
    const prompt = {
      kind: 'prompt' as const,
      text: 'Read src/modules/video/briefs/graphics.md and follow it.\nScenes: sc4',
    };
    let n = 0;
    const r = await run(root, {
      ask: () => answer('graphics', `agent: graphics.md (sc4) ${n}`, [prompt]),
      exec: async () => {
        n++;
        return ok({ kind: 'prompt', costUsd: 0.1, sessionId: `g${n}` });
      },
    });
    expect(r.halt?.kind).toBe('cap');
    expect(n).toBe(a.runs.graphicsRevisions);
  });
  it('a forbidden flag in a step log halts forbidden-flag', async () => {
    const root = newRoot();
    const r = await run(root, {
      ask: scripted([
        answer('script', 'agent: a', [{ kind: 'prompt', text: 'Read src/modules/evidence/briefs/evidence.md' }]),
      ]),
      exec: async (_a, _s, ctx) => {
        writeFileSync(ctx.logPath, 'ran npm run record-sources -- t x --replace-cited\n');
        return ok({ kind: 'prompt', sessionId: 'e1' });
      },
    });
    expect(r.halt?.kind).toBe('forbidden-flag');
  });
  it('the finish runs validate in a secret-free environment', async () => {
    const root = newRoot();
    let seen: NodeJS.ProcessEnv | null = null;
    const r = await run(root, {
      ask: scripted([answer('packaged', 'done', [], null, true)]),
      exec: async () => ok(),
      env: { PATH: '/bin', AZURE_SPEECH_KEY: 'k', YOUTUBE_OAUTH_CREDENTIALS_PATH: 'p', OPENAI_API_KEY: 'o' },
      validate: (env) => {
        seen = env;
        return { ok: true, output: '' };
      },
    });
    expect(r.outcome).toBe('done');
    expect(seen).not.toBeNull();
    for (const k of ['AZURE_SPEECH_KEY', 'YOUTUBE_OAUTH_CREDENTIALS_PATH', 'OPENAI_API_KEY'])
      expect(seen![k]).toBeUndefined();
    expect(seen!.VK_NO_DOTENV).toBe('1');
  });
  it('the tree is snapshotted before the first step, so the first child is guarded too', async () => {
    const root = newRoot();
    const order: string[] = [];
    const r = await run(root, {
      ask: scripted([
        answer('package', 'npm run script -- package t s', [{ kind: 'run', text: 'npm run script -- package t s' }]),
        answer('packaged', 'done', [], null, true),
      ]),
      exec: async () => {
        order.push('child');
        return ok();
      },
      hooks: {
        snapshot: () => order.push('snapshot'),
        guard: (scope) => {
          order.push(`guard:${scope}`);
          return { ok: true, why: '', kept: [] };
        },
        componentCheck: () => ({ ok: true, output: '' }),
      },
    });
    expect(r.outcome).toBe('done');
    expect(order.slice(0, 3)).toEqual(['snapshot', 'child', 'guard:child']);
  });
  it('a commit on the wrong branch or a failing git halts git instead of printing done', async () => {
    for (const git of [
      (args: string[]) => (args[0] === 'rev-parse' ? 'feat/other\n' : ''),
      () => {
        throw new Error('fatal: pre-commit hook failed');
      },
    ]) {
      const root = newRoot();
      const r = await run(root, {
        ask: scripted([answer('packaged', 'done', [], null, true)]),
        exec: async () => ok(),
        git,
      });
      expect(r.outcome).toBe('halted');
      expect(r.halt?.kind).toBe('git');
    }
  });
  it('records the running child in the lock and clears it after the step', async () => {
    const root = newRoot();
    const seen: (number | undefined)[] = [];
    const dir = runDir(T, S, root);
    const r = await run(root, {
      ask: scripted([
        answer('package', 'npm run script -- package t s', [{ kind: 'run', text: 'npm run script -- package t s' }]),
        answer('packaged', 'done', [], null, true),
      ]),
      exec: async (_a, _s, ctx) => {
        ctx.onSpawn?.(4242);
        seen.push(readLock(dir)?.childPid);
        return ok();
      },
    });
    expect(r.outcome).toBe('done');
    expect(seen).toEqual([4242]);
  });
  it('a takeover kills the dead run’s child before anything else runs', async () => {
    const root = newRoot();
    const dir = runDir(T, S, root);
    const orphan = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(alive(orphan.pid!)).toBe(true);
    writeFileSync(
      join(dir, 'lock.json'),
      JSON.stringify({
        runId: 'dead',
        pid: 999999,
        host: 'h',
        startedAt: 'x',
        heartbeatAt: 'x',
        command: 'story',
        childPid: orphan.pid,
        childStep: 'agent: storyboard.md',
      }),
    );
    const r = await run(root, { ask: scripted([answer('packaged', 'done', [], null, true)]), exec: async () => ok() });
    expect(r.outcome).toBe('done');
    await new Promise((r) => setTimeout(r, 500));
    expect(alive(orphan.pid!)).toBe(false);
    expect(readJournal(dir).find((e) => e.kind === 'resume')?.error).toMatch(/killed child/);
  });

  // The order of operations (spec §4.6) with the real executor: the fake agent appends 'agent' to a record file, the
  // hooks record themselves, the injected CLI records whether it is the validator (video check) or the next child.
  const orderRun = (root: string, componentOk: boolean) => {
    const record = join(root, 'order.txt');
    writeFileSync(record, '');
    const scenario = join(root, 'scenario.json');
    writeFileSync(
      scenario,
      JSON.stringify([{ match: '.', actions: [{ append: 'order.txt', text: 'agent\n' }], cost: 0.1 }]),
    );
    const push = (s: string) => writeFileSync(record, s + '\n', { flag: 'a' });
    const prompt = {
      kind: 'prompt' as const,
      text: 'Read src/modules/video/briefs/graphics.md and follow it.\nScenes: sc4',
    };
    const fake = { ...a, agents: { ...a.agents, command: `node ${FAKE_CLAUDE}` } };
    return {
      record,
      run: runStory(T, S, fake, {
        approver: 'automated: test',
        root,
        git: 'none',
        validate: () => ({ ok: true, output: '' }),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario },
        ask: scripted([
          answer('graphics', 'agent: graphics.md (sc4), then npm run script -- storyboard t s', [
            prompt,
            { kind: 'run', text: 'npm run script -- storyboard t s' },
          ]),
          answer('packaged', 'done', [], null, true),
        ]),
        argvOf: (cli) => {
          push(cli === 'video' ? 'validator' : 'child');
          return [process.execPath, [FAKE_STEP]];
        },
        hooks: {
          snapshot: () => push('snapshot'),
          guard: (scope) => {
            push(`guard:${scope}`);
            return { ok: true, why: '', kept: ['src/modules/video/remotion/scenes/New.tsx'] };
          },
          componentCheck: () => {
            push('componentCheck');
            return { ok: componentOk, output: componentOk ? '' : 'Evil.tsx: imports node:fs' };
          },
        },
      }),
    };
  };
  it('around a graphics agent the order is snapshot, agent, guard, componentCheck, validator, guard, next child, guard', async () => {
    const root = newRoot();
    const { record, run: r } = orderRun(root, true);
    expect((await r).outcome).toBe('done');
    const order = readFileSync(record, 'utf8').trim().split('\n');
    expect(order).toEqual([
      'snapshot',
      'agent',
      'guard:agent',
      'componentCheck',
      'validator',
      'guard:child',
      'child',
      'guard:child',
      'guard:child', // the finish
    ]);
  });
  it('a component that fails the check halts before the validator or the next child runs', async () => {
    const root = newRoot();
    const { record, run: r } = orderRun(root, false);
    const result = await r;
    const order = readFileSync(record, 'utf8').trim().split('\n');
    expect(order).toEqual(['snapshot', 'agent', 'guard:agent', 'componentCheck']);
    expect(result.halt?.kind).toBe('unexpected-edit');
    expect(result.halt?.why).toContain('node:fs');
  });
});
