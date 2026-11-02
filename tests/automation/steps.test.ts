import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { alive } from '../../src/orchestration/run/proc';
import { envFor, execStep, parseRun, roleOf, timeoutFor, validatorFor } from '../../src/orchestration/run/steps';
import { type AttemptRecord, readAttempts } from '../../src/orchestration/run/journal';

const tmp = mkdtempSync(join(tmpdir(), 'vk-steps-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const a = loadAutomation(tmp);
const FAKE_STEP = join(process.cwd(), 'tests', 'automation', 'fake-step.mjs');
const FAKE_CLAUDE = join(process.cwd(), 'tests', 'automation', 'fake-claude.mjs');
const fakeStep =
  (...args: string[]) =>
  (): [string, string[]] => [process.execPath, [FAKE_STEP, ...args]];
const ctx = (over: Record<string, unknown> = {}) => ({
  topic: 'heat-pumps',
  storyId: 'decision:when-does-it-pay',
  root: tmp,
  approver: 'automated: run 1',
  role: 'writer' as const,
  logPath: join(tmp, `step-${Math.random().toString(36).slice(2, 7)}.log`),
  env: {
    PATH: process.env.PATH,
    AZURE_SPEECH_KEY: 'k',
    YOUTUBE_OAUTH_CREDENTIALS_PATH: 'p',
    MAIL_USER: 'm',
    X_A_API_KEY: 'x',
  },
  ...over,
});

describe('parseRun', () => {
  it('splits an npm run line and fills the approver placeholder', () => {
    const r = parseRun('npm run script -- lock t s --approved-by "<approver>"', 'automated: run 1');
    expect(r).toEqual({ cli: 'script', args: ['lock', 't', 's', '--approved-by', 'automated: run 1'] });
  });
  it('anything else is null', () => expect(parseRun('watch the draft', 'x')).toBeNull());
  it('timeoutFor reads the verb, then the cli, then the default', () => {
    expect(timeoutFor(a, 'video', ['render', 't', 's'])).toBe(240 * 60_000);
    expect(timeoutFor(a, 'script', ['validate'])).toBe(30 * 60_000);
  });
});

describe('roleOf and validatorFor', () => {
  const prompt = (brief: string) => ({
    kind: 'prompt' as const,
    text: `Read src/modules/x/briefs/${brief} and follow it.\nTopic: t\nStory: s`,
  });
  it('maps briefs to roles', () => {
    expect(roleOf(prompt('script-review.md'))).toBe('reviewer');
    expect(roleOf(prompt('graphics.md'))).toBe('graphics');
    expect(roleOf(prompt('extract.md'))).toBe('extraction');
    expect(roleOf(prompt('collect.md'))).toBe('collect');
    expect(roleOf(prompt('draft-review.md'))).toBe('draftReview');
    expect(roleOf(prompt('script.md'))).toBe('writer');
  });
  it('names the validator the brief used to run itself', () => {
    expect(validatorFor(prompt('script.md'), 't', 's')).toEqual({ cli: 'script', args: ['validate', 't', 's'] });
    expect(validatorFor(prompt('graphics.md'), 't', 's')).toEqual({ cli: 'video', args: ['check', 't', 's'] });
    expect(validatorFor(prompt('stories.md'), 't', 's')).toEqual({ cli: 'stories', args: ['discover', 't'] });
    expect(validatorFor({ kind: 'do', text: 'x' }, 't', 's')).toBeNull();
  });
});

describe('envFor (one key family per verb, nothing for the rest)', () => {
  const env = {
    PATH: '/bin',
    AZURE_SPEECH_KEY: 'k',
    YOUTUBE_OAUTH_CREDENTIALS_PATH: 'p',
    MAIL_USER: 'm',
    X_A_API_KEY: 'x',
    APPROVAL_SECRET: 's',
  };
  it('a renderer-loading verb gets no secret', () => {
    const e = envFor('video', ['check', 't', 's'], env);
    for (const k of [
      'AZURE_SPEECH_KEY',
      'YOUTUBE_OAUTH_CREDENTIALS_PATH',
      'MAIL_USER',
      'X_A_API_KEY',
      'APPROVAL_SECRET',
    ])
      expect(e[k]).toBeUndefined();
    expect(e.PATH).toBe('/bin');
    expect(e.VK_AGENT).toBeUndefined();
  });
  it('a child never gets the OpenAI or Anthropic keys', () => {
    const e = envFor('video', ['spike', 't', 's'], { ...env, OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'k' });
    expect(e.OPENAI_API_KEY).toBeUndefined();
    expect(e.ANTHROPIC_API_KEY).toBeUndefined();
    expect(envFor('publish', ['upload'], { ...env, OPENAI_API_KEY: 'o' }).OPENAI_API_KEY).toBeUndefined();
  });
  it("a child never inherits the runner's own node and tsx settings (a tsconfig path relative to another cwd broke a spawned CLI)", () => {
    const e = envFor('validate', [], { ...env, NODE_OPTIONS: '--import x', TSX_TSCONFIG_PATH: 'tsconfig.json' });
    expect(e.NODE_OPTIONS).toBeUndefined();
    expect(e.TSX_TSCONFIG_PATH).toBeUndefined();
    expect(e.PATH).toBe('/bin');
  });
  it('no video verb gets the Azure key: final narrates through the worker, which loads .env itself', () => {
    const e = envFor('video', ['final', 't', 's'], env);
    expect(e.AZURE_SPEECH_KEY).toBeUndefined();
    expect(e.VK_NO_DOTENV).toBe('1');
  });
  it('publish gets YouTube only, social X only', () => {
    expect(envFor('publish', ['upload'], env).YOUTUBE_OAUTH_CREDENTIALS_PATH).toBe('p');
    expect(envFor('publish', ['upload'], env).MAIL_USER).toBeUndefined();
    expect(envFor('social', ['post'], env).X_A_API_KEY).toBe('x');
    expect(envFor('social', ['post'], env).YOUTUBE_OAUTH_CREDENTIALS_PATH).toBeUndefined();
    expect(envFor('video', ['final', 't', 's'], env).YOUTUBE_OAUTH_CREDENTIALS_PATH).toBeUndefined();
  });
});

describe('execStep: run', () => {
  it('RESULT: FAILED with exit 0 is not ok', async () => {
    const o = await execStep(
      a,
      { kind: 'run', text: 'npm run video -- qa t s' },
      ctx({ argvOf: fakeStep('--print', 'RESULT: FAILED (x)') }),
    );
    expect(o.ok).toBe(false);
    expect(o.exit).toBe(0);
  });
  it('a timed-out child is killed and leaves no orphan', async () => {
    const o = await execStep(
      a,
      { kind: 'run', text: 'npm run video -- qa t s' },
      ctx({ argvOf: fakeStep('--sleep', '5000'), timeoutMs: 1000 }),
    );
    expect(o.error).toBe('timeout');
    expect(o.pid).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 300));
    expect(alive(o.pid!)).toBe(false);
  });
  it('the child of a renderer-loading verb sees no secret family', async () => {
    const dump = join(tmp, 'child-env.json');
    const o = await execStep(
      a,
      { kind: 'run', text: 'npm run video -- check t s' },
      ctx({ argvOf: fakeStep('--dump-env', dump) }),
    );
    expect(o.ok).toBe(true);
    const env = JSON.parse(readFileSync(dump, 'utf8')) as Record<string, string>;
    for (const k of ['AZURE_SPEECH_KEY', 'YOUTUBE_OAUTH_CREDENTIALS_PATH', 'MAIL_USER', 'X_A_API_KEY'])
      expect(env[k]).toBeUndefined();
  });
  it('stale render bundles are deleted before a render, not before a validate', async () => {
    const t = join(tmp, 'temp');
    const mk = () => {
      mkdirSync(join(t, 'remotion-webpack-bundle-x'), { recursive: true });
      mkdirSync(join(t, 'react-motion-render-y'), { recursive: true });
      mkdirSync(join(t, 'unrelated'), { recursive: true });
    };
    mk();
    await execStep(a, { kind: 'run', text: 'npm run script -- validate t s' }, ctx({ argvOf: fakeStep(), tmpDir: t }));
    expect(existsSync(join(t, 'remotion-webpack-bundle-x'))).toBe(true);
    await execStep(a, { kind: 'run', text: 'npm run video -- render t s' }, ctx({ argvOf: fakeStep(), tmpDir: t }));
    expect(existsSync(join(t, 'remotion-webpack-bundle-x'))).toBe(false);
    expect(existsSync(join(t, 'react-motion-render-y'))).toBe(false);
    expect(existsSync(join(t, 'unrelated'))).toBe(true);
  });
  it('reports the child pid as it spawns, so a takeover can kill it', async () => {
    const pids: number[] = [];
    const o = await execStep(
      a,
      { kind: 'run', text: 'npm run video -- qa t s' },
      ctx({ argvOf: fakeStep(), onSpawn: (pid: number) => pids.push(pid) }),
    );
    expect(pids).toEqual([o.pid]);
  });
  it('a do step is a person’s', async () => {
    const o = await execStep(a, { kind: 'do', text: 'watch it' }, ctx());
    expect(o.ok).toBe(false);
    expect(o.error).toMatch(/person/);
  });
});

describe('execStep: prompt with the validator loop', () => {
  const fake = { ...a, agents: { ...a.agents, command: `node ${FAKE_CLAUDE}` } };
  const prompt = {
    kind: 'prompt' as const,
    text: 'Read src/modules/script/briefs/script.md and follow it.\nTopic: t\nStory: s',
  };
  const scenario = (name: string) => {
    const p = join(tmp, `${name}.json`);
    writeFileSync(p, JSON.stringify([{ match: '.', actions: [], cost: 0.5 }]));
    return p;
  };
  it('a validator that fails once resumes the same session exactly once', async () => {
    const once = join(tmp, 'once-a');
    const log = join(tmp, 'claude-log-a.jsonl');
    const o = await execStep(
      fake,
      prompt,
      ctx({
        argvOf: fakeStep('--once-file', once),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario('s1'), FAKE_CLAUDE_LOG: log },
      }),
    );
    expect(o.ok).toBe(true);
    expect(o.costUsd).toBe(1);
    const calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as string[]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toContain('--resume');
    expect(calls[1][calls[1].indexOf('--resume') + 1]).toBe(o.sessionId);
    expect(calls[1][calls[1].indexOf('-p') + 1]).toMatch(/findings: one sentence/);
  });
  it('a validator that never passes ends the step not ok after the rounds, with the last findings', async () => {
    const log = join(tmp, 'claude-log-b.jsonl');
    const o = await execStep(
      fake,
      prompt,
      ctx({
        argvOf: fakeStep('--print', 'findings: still wrong', '--exit', '2'),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario('s2'), FAKE_CLAUDE_LOG: log },
      }),
    );
    expect(o.ok).toBe(false);
    expect(o.error).toMatch(/still wrong/);
    expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(1 + a.runs.validationRounds);
  });
  it('two validator rounds record two attempts under the journal line and one outcome whose cost and tokens are the sums', async () => {
    const once = join(tmp, 'once-c');
    const run = join(tmp, 'run-c');
    const sc = join(tmp, 's-sum.json');
    writeFileSync(
      sc,
      JSON.stringify([{ match: '.', actions: [], cost: 0.5, tokens: { input: 100, output: 20 }, turns: 3 }]),
    );
    const o = await execStep(
      fake,
      prompt,
      ctx({
        argvOf: fakeStep('--once-file', once),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: sc },
        attempts: { dir: run, line: 7 },
      }),
    );
    expect(o.ok).toBe(true);
    expect(o.rounds).toBe(2);
    expect(o.costUsd).toBe(1);
    expect(o.modelRequested).toBe('opus');
    expect(o.models).toEqual([
      {
        model: 'fake-sonnet',
        canonical: 'fake-sonnet',
        tokens: { input: 200, output: 40, cacheRead: 0, cacheCreate: 0 },
        costUsd: 1,
      },
    ]);
    expect(o.turns).toBe(6);
    expect(o.apiMs).toBe(1600);
    expect(o.overCap).toBe(false);
    expect(existsSync(join(run, 'agents', '7-1.json'))).toBe(true);
    expect(existsSync(join(run, 'agents', '7-2.json'))).toBe(true);
    const recs = readAttempts(run);
    expect(recs.map((r) => [r.line, r.round])).toEqual([
      [7, 1],
      [7, 2],
    ]);
    const r1 = recs[0];
    expect(r1).toMatchObject({
      step: 'Read src/modules/script/briefs/script.md and follow it.',
      role: 'writer',
      modelRequested: 'opus',
      effort: a.agents.effort,
      turns: 3,
      costUsd: 0.5,
      budgetUsd: 8,
      overCap: false,
      exit: 0,
      isError: false,
      subtype: 'success',
      stopReason: 'end_turn',
      errors: [],
      denials: [],
      resumedFrom: null,
    });
    expect(r1.models[0].model).toBe('fake-sonnet');
    expect(r1.sessionId).toBe(o.sessionId);
    expect(r1.finishedAt).toBeTruthy();
    expect(recs[1].resumedFrom).toBe(o.sessionId);
    // usage, outcome and error metadata only: never the prompt, the reply or stdout
    const raw = JSON.parse(readFileSync(join(run, 'agents', '7-1.json'), 'utf8')) as Record<string, unknown>;
    for (const k of ['prompt', 'text', 'result', 'stdout', 'reply']) expect(raw).not.toHaveProperty(k);
    expect(JSON.stringify(raw)).not.toContain('fake agent:');
  });
  it('a failed attempt (is_error) is recorded with its cost; the outcome carries the same', async () => {
    const run = join(tmp, 'run-d');
    const sc = join(tmp, 's-err.json');
    writeFileSync(sc, JSON.stringify([{ match: '.', actions: [], cost: 0.7, error: true }]));
    const o = await execStep(
      fake,
      prompt,
      ctx({ argvOf: fakeStep(), env: { ...process.env, FAKE_CLAUDE_SCENARIO: sc }, attempts: { dir: run, line: 2 } }),
    );
    expect(o.ok).toBe(false);
    expect(o.costUsd).toBe(0.7);
    const [r] = readAttempts(run);
    expect(r).toMatchObject({
      line: 2,
      round: 1,
      costUsd: 0.7,
      isError: true,
      exit: 1,
      subtype: 'error_during_execution',
    });
    expect(r.models[0].costUsd).toBe(0.7);
  });
  it('two runs that reach the same journal line (a crash, then a resume) keep both attempt records (review finding 8)', async () => {
    const run = join(tmp, 'run-f');
    const sc = join(tmp, 's-two.json');
    writeFileSync(sc, JSON.stringify([{ match: '.', actions: [], cost: 0.3 }]));
    const env = { ...process.env, FAKE_CLAUDE_SCENARIO: sc };
    await execStep(fake, prompt, ctx({ argvOf: fakeStep(), env, attempts: { dir: run, line: 4, runId: 'r1' } }));
    await execStep(fake, prompt, ctx({ argvOf: fakeStep(), env, attempts: { dir: run, line: 4, runId: 'r2' } }));
    expect(existsSync(join(run, 'agents', '4-1-r1.json'))).toBe(true);
    expect(existsSync(join(run, 'agents', '4-1-r2.json'))).toBe(true);
    const recs = readAttempts(run);
    expect(recs.map((r) => [r.line, r.round, r.runId])).toEqual([
      [4, 1, 'r1'],
      [4, 1, 'r2'],
    ]);
    expect(recs.reduce((n, r) => n + r.costUsd, 0)).toBeCloseTo(0.6, 5);
  });
  it('a spawn error is recorded too: exit null, no cost, no model used, the model requested', async () => {
    const run = join(tmp, 'run-e');
    const broken = { ...fake, agents: { ...fake.agents, command: join(tmp, 'no-such-claude') } };
    const o = await execStep(broken, prompt, ctx({ argvOf: fakeStep(), attempts: { dir: run, line: 1 } }));
    expect(o.ok).toBe(false);
    const [r] = readAttempts(run);
    expect(r).toMatchObject({ exit: null, costUsd: 0, models: [], modelRequested: 'opus' });
    expect(r.finishedAt).toBeTruthy();
    const open: AttemptRecord | undefined = readAttempts(join(tmp, 'nowhere'))[0];
    expect(open).toBeUndefined();
  });
  it('the injected guard runs after every agent turn and a failing guard ends the step', async () => {
    const calls: string[] = [];
    const o = await execStep(
      fake,
      prompt,
      ctx({
        argvOf: fakeStep(),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario('s3') },
        guard: () => {
          calls.push('guard');
          return { ok: false, why: 'package.json changed' };
        },
      }),
    );
    expect(calls).toEqual(['guard']);
    expect(o.ok).toBe(false);
    expect(o.error).toMatch(/package.json changed/);
    expect(o.guardFailed).toBe(true);
  });
});
