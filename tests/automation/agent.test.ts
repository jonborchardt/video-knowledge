import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { agentArgs, agentEnv, parseResult, runAgent, UNATTENDED, usageOf } from '../../src/orchestration/run/agent';
import { CONTENT_ROLES, grantFor } from '../../src/orchestration/run/roles';

const tmp = mkdtempSync(join(tmpdir(), 'vk-agent-'));
const REAL = join(process.cwd(), 'tests', 'fixtures', 'automation', 'claude-result.json');
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const a = loadAutomation(tmp);
const subject = { topic: 'heat-pumps', storyId: 'decision:when-does-it-pay' };
const req = (over: Partial<Parameters<typeof agentArgs>[1]> = {}) => ({
  role: 'writer' as const,
  subject,
  prompt: 'write the script',
  cwd: tmp,
  budgetUsd: 8,
  timeoutMs: 60_000,
  appendSystem: UNATTENDED,
  ...over,
});
const fake = {
  ...a,
  agents: { ...a.agents, command: `node ${join(process.cwd(), 'tests', 'automation', 'fake-claude.mjs')}` },
};
const scenario = (name: string, entries: unknown[]) => {
  const p = join(tmp, `${name}.json`);
  writeFileSync(p, JSON.stringify(entries));
  return p;
};

describe('agentArgs', () => {
  it('is print mode under dontAsk with project settings only, a budget, and never the dangerous flags', () => {
    const args = agentArgs(a, req());
    expect(args.slice(0, 2)).toEqual(['-p', 'write the script']);
    expect(args).toContain('--output-format');
    expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('8');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('project');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('acceptEdits');
    expect(args.some((x) => x.startsWith('Write('))).toBe(false);
    expect(args[args.indexOf('--model') + 1]).toBe('opus');
  });
  it('a content role has no Bash rule; the Edit rules are the grant, nothing under src/', () => {
    for (const role of CONTENT_ROLES) {
      const args = agentArgs(a, req({ role }));
      expect(args.some((x) => x.startsWith('Bash('))).toBe(false);
    }
    const args = agentArgs(a, req());
    const edits = args.filter((x) => x.startsWith('Edit(') && args.indexOf(x) < args.indexOf('--disallowedTools'));
    expect(edits).toEqual(grantFor('writer', subject).writable.map((p) => `Edit(${p})`));
    expect(edits.some((x) => x.includes('src/'))).toBe(false);
  });
  it('graphics is denied theme.ts and Video.tsx and allowed its two verbs', () => {
    const args = agentArgs(a, req({ role: 'graphics' }));
    const denied = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--append-system-prompt'));
    expect(denied).toContain('Edit(src/modules/video/remotion/theme.ts)');
    expect(denied).toContain('Edit(src/modules/video/remotion/Video.tsx)');
    expect(args).toContain('Bash(npm run video -- frames *)');
  });
  it('a resume passes the session id instead of a fresh session', () => {
    const args = agentArgs(a, req({ resume: 'sess-1' }));
    expect(args[args.indexOf('--resume') + 1]).toBe('sess-1');
  });
});

describe('agentEnv', () => {
  it('drops every secret family, keeps PATH, and names the grant for the hook', () => {
    const env = agentEnv(
      {
        PATH: '/bin',
        AZURE_SPEECH_KEY: 'k',
        YOUTUBE_OAUTH_CREDENTIALS_PATH: 'p',
        MAIL_USER: 'm',
        X_CORSPENDING_API_KEY: 'x',
        APPROVAL_SECRET: 's',
      },
      grantFor('writer', subject),
    );
    expect(env.PATH).toBe('/bin');
    for (const k of [
      'AZURE_SPEECH_KEY',
      'YOUTUBE_OAUTH_CREDENTIALS_PATH',
      'MAIL_USER',
      'X_CORSPENDING_API_KEY',
      'APPROVAL_SECRET',
    ])
      expect(env[k]).toBeUndefined();
    expect(env.VK_AGENT).toBe('1');
    expect(env.CI).toBe('1');
    expect(env.VK_NO_DOTENV).toBe('1'); // a verb the agent runs itself must not reload .env either
    expect(agentEnv({ OPENAI_API_KEY: 'o' }, grantFor('writer', subject)).OPENAI_API_KEY).toBeUndefined();
    expect(env.VK_WRITABLE).toContain('script.json');
    expect(env.VK_SHELL).toBe('');
  });
});

describe('usageOf (the real print-mode result of one haiku call, saved 2026-11-02)', () => {
  it('keeps every model of modelUsage with its version, canonical name, tokens and cost, plus turns and api time', () => {
    const u = usageOf(parseResult(readFileSync(REAL, 'utf8')));
    expect(u.models).toEqual([
      {
        model: 'claude-haiku-4-5-20251001',
        canonical: 'claude-haiku-4-5',
        tokens: { input: 533, output: 54, cacheRead: 0, cacheCreate: 31208 },
        costUsd: 0.063219,
      },
    ]);
    expect(u.turns).toBe(1);
    expect(u.apiMs).toBe(2537);
    expect(u.stopReason).toBe('end_turn');
  });
  it('a result without modelUsage (an older record) reads as unknown, never zero', () => {
    const u = usageOf({ type: 'result', total_cost_usd: 0.5 });
    expect(u.models).toEqual([]);
    expect(u.turns).toBeNull();
    expect(u.apiMs).toBeNull();
    expect(usageOf(null).models).toEqual([]);
  });
});

describe('runAgent (with the fake claude)', () => {
  it('the dumped environment has no secret and the result carries cost and session', async () => {
    const dump = join(tmp, 'env.json');
    const s = scenario('dump', [{ match: 'write', actions: [], cost: 0.5, dumpEnv: dump }]);
    const r = await runAgent(fake, req(), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s, AZURE_SPEECH_KEY: 'k' } });
    expect(r.ok).toBe(true);
    expect(r.costUsd).toBe(0.5);
    expect(r.sessionId).toMatch(/^fake-/);
    // the usage metadata the CLI reports: the alias asked for, every model used, turns, api time, the cap
    expect(r.modelRequested).toBe('opus');
    expect(r.models).toEqual([
      {
        model: 'fake-sonnet',
        canonical: 'fake-sonnet',
        tokens: { input: 100, output: 20, cacheRead: 0, cacheCreate: 0 },
        costUsd: 0.5,
      },
    ]);
    expect(r.turns).toBe(1);
    expect(r.apiMs).toBe(800);
    expect(r.budgetUsd).toBe(8);
    expect(r.overCap).toBe(false);
    const env = JSON.parse(readFileSync(dump, 'utf8')) as Record<string, string>;
    expect(env.AZURE_SPEECH_KEY).toBeUndefined();
    expect(env.VK_AGENT).toBe('1');
  });
  it('a sleeping agent is killed at the timeout', async () => {
    const s = scenario('sleep', [{ match: 'write', actions: [], cost: 0, sleepMs: 20_000 }]);
    const t0 = Date.now();
    const r = await runAgent(fake, req({ timeoutMs: 500 }), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s } });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
    expect(Date.now() - t0).toBeLessThan(20_000); // the fake sleeps 20 s: anything shorter means it was killed (slack for a loaded machine)
  });
  it('an agent error is ok false with its cost and text', async () => {
    const s = scenario('err', [{ match: 'write', actions: [], cost: 0.2, error: true, result: 'budget exceeded' }]);
    const r = await runAgent(fake, req(), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s } });
    expect(r.ok).toBe(false);
    expect(r.costUsd).toBe(0.2);
    expect(r.text).toBe('budget exceeded');
    expect(r.isError).toBe(true);
    expect(r.subtype).toBe('error_during_execution');
    expect(r.models[0].costUsd).toBe(0.2); // a failed attempt keeps its usage
  });
  it('a cost above the cap passed is overCap: the CLI cap is soft, not a ceiling', async () => {
    const s = scenario('over', [{ match: 'write', actions: [], cost: 0.09 }]);
    const r = await runAgent(fake, req({ budgetUsd: 0.05 }), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s } });
    expect(r.overCap).toBe(true);
    expect(r.budgetUsd).toBe(0.05);
  });
  it('a timeout after the result was printed keeps the parsed cost and models', async () => {
    const s = scenario('late', [
      { match: 'write', actions: [], cost: 0.3, sleepAfterMs: 5000, model: 'fake-opus-20260101' },
    ]);
    const r = await runAgent(fake, req({ timeoutMs: 800 }), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s } });
    expect(r.error).toBe('timeout');
    expect(r.costUsd).toBe(0.3);
    expect(r.models[0]).toMatchObject({ model: 'fake-opus-20260101', canonical: 'fake-opus' });
  });
  it('a spawn error records the exit, no cost, no model used, and the model requested', async () => {
    const broken = { ...fake, agents: { ...fake.agents, command: join(tmp, 'no-such-claude') } };
    const r = await runAgent(broken, req(), { env: { ...process.env } });
    expect(r.ok).toBe(false);
    expect(r.exit).toBeNull();
    expect(r.costUsd).toBe(0);
    expect(r.models).toEqual([]);
    expect(r.modelRequested).toBe('opus');
    expect(r.error).toBeTruthy();
  });
  it('an action writes a file relative to cwd and a resume keeps the id', async () => {
    const s = scenario('write', [{ match: 'write', actions: [{ write: 'out.txt', text: 'hi' }], cost: 0.1 }]);
    const r = await runAgent(fake, req({ resume: 'fake-keep' }), { env: { ...process.env, FAKE_CLAUDE_SCENARIO: s } });
    expect(readFileSync(join(tmp, 'out.txt'), 'utf8')).toBe('hi');
    expect(r.sessionId).toBe('fake-keep');
  });
});
