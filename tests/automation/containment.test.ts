// Acceptance criterion 14 (spec §13, §4.6): an agent cannot change the machinery. What this suite proves: writes
// outside a role's files are detected and reverted, canaries are restored, a component that fails the browser-safe
// check is caught before a child would load it, a child of a renderer-loading verb holds no secret, and content roles
// have no shell rule. What it cannot prove: code running inside the agent's own process, or inside the first child
// that loads it before the guard, with the user's privileges. The spec and CLAUDE.md say so in those words.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { ROOT } from '../../src/shared/io';
import { agentArgs } from '../../src/orchestration/run/agent';
import { componentCheck, guard, snapshot } from '../../src/orchestration/run/guard';
import { CONTENT_ROLES, grantFor } from '../../src/orchestration/run/roles';
import { execStep, type StepContext } from '../../src/orchestration/run/steps';
import { fixtureRepo, type FixtureRepo } from './helpers';

let r: FixtureRepo;
beforeAll(() => {
  r = fixtureRepo();
});
afterAll(() => r.cleanup());
const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const FAKE_STEP = join(ROOT, 'tests', 'automation', 'fake-step.mjs');
const a = loadAutomation(join(ROOT, 'no-such-root')); // the defaults: every flag off
const fake = { ...a, agents: { ...a.agents, command: `node ${FAKE_CLAUDE}` } };
const prompt = {
  kind: 'prompt' as const,
  text: 'Read src/modules/script/briefs/script.md and follow it.\nTopic: t\nStory: s',
};

/** Step logs live where the runner puts them, under the story's gitignored run/ folder: never a change the guard sees. */
const logIn = (name: string) => {
  const d = join(r.root, r.story, 'run');
  mkdirSync(d, { recursive: true });
  return join(d, `${name}.log`);
};

/** Runs one agent step with the real guard wired in (as the runner does), after a scenario that plants `actions`. */
async function agentWrites(name: string, actions: unknown[], role: 'writer' | 'graphics' = 'writer') {
  const scenario = join(r.root, `${name}.json`);
  writeFileSync(scenario, JSON.stringify([{ match: '.', actions, cost: 0.1 }]));
  const g0 = grantFor(role, { topic: r.topic, storyId: r.storyId });
  const home = join(r.root, 'home');
  let before = snapshot(r.root, { home });
  const result = { reverted: [] as string[], restored: [] as string[] };
  const ctx: StepContext = {
    topic: r.topic,
    storyId: r.storyId,
    root: r.root,
    approver: 'automated: test',
    role,
    logPath: logIn(name),
    env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario },
    argvOf: () => [process.execPath, [FAKE_STEP]],
    guard: () => {
      const g = guard(before, r.root, [...g0.writable, ...g0.derived], {
        newFilesOnly: g0.newFilesOnly,
        additiveOnly: g0.additiveOnly,
        home,
      });
      result.reverted.push(...g.reverted);
      result.restored.push(...g.restored);
      before = snapshot(r.root, { home });
      return { ok: g.ok, why: [...g.reverted, ...g.restored, ...g.reported].join(', ') };
    },
  };
  const o = await execStep(fake, prompt, ctx);
  return { o, ...result };
}

describe('containment (criterion 14)', () => {
  it('(1) an agent that edits package.json is reverted and the step fails naming the path', async () => {
    const { o, reverted } = await agentWrites('c1', [
      { write: 'package.json', text: '{"scripts":{"script":"node evil.js"}}' },
    ]);
    expect(o.ok).toBe(false);
    expect(o.guardFailed).toBe(true);
    expect(o.error).toContain('package.json');
    expect(reverted).toEqual(['package.json']);
    expect(r.read('package.json')).toContain('tsx x.ts');
  });
  it('(2) a package.json planted in the story folder is deleted', async () => {
    const { o, reverted } = await agentWrites('c2', [{ write: `${r.story}/package.json`, text: '{}' }]);
    expect(o.guardFailed).toBe(true);
    expect(reverted).toEqual([`${r.story}/package.json`]);
    expect(existsSync(join(r.root, r.story, 'package.json'))).toBe(false);
  });
  it('(3) a rewritten .env is restored', async () => {
    const original = r.read('.env');
    const { o, restored } = await agentWrites('c3', [
      { write: '.env', text: 'YOUTUBE_OAUTH_CREDENTIALS_PATH=./attacker.json\n' },
    ]);
    expect(o.guardFailed).toBe(true);
    expect(restored).toEqual(['.env']);
    expect(r.read('.env')).toBe(original);
  });
  it('(4) an edit to .claude/settings.json is reverted', async () => {
    const { o, reverted } = await agentWrites('c4', [
      { write: '.claude/settings.json', text: '{"permissions":{"allow":["Bash(*)"]}}' },
    ]);
    expect(o.guardFailed).toBe(true);
    expect(reverted).toEqual(['.claude/settings.json']);
  });
  it('(5) a graphics agent that modifies an existing shared component is reverted', async () => {
    const { o, reverted } = await agentWrites(
      'c5',
      [{ write: 'src/modules/video/remotion/scenes/Bar.tsx', text: 'export const Bar = () => 1;\n' }],
      'graphics',
    );
    expect(o.guardFailed).toBe(true);
    expect(reverted).toEqual(['src/modules/video/remotion/scenes/Bar.tsx']);
  });
  it('(6) a planted component with a node import fails the check; a renderer-loading child holds no secret', async () => {
    const evil = 'src/modules/video/remotion/scenes/Evil.tsx';
    const { o } = await agentWrites(
      'c6',
      [{ write: evil, text: "export const Evil = async () => (await import('node:' + 'fs')).writeFileSync;\n" }],
      'graphics',
    );
    expect(o.guardFailed).toBeUndefined(); // a new component is within the graphics grant: the guard passes it
    expect(componentCheck(r.root, [evil], () => ({ ok: true, output: '' })).ok).toBe(false);
    const dump = join(r.root, 'child-env.json');
    const c = await execStep(
      a,
      { kind: 'run', text: 'npm run video -- check t s' },
      {
        topic: r.topic,
        storyId: r.storyId,
        root: r.root,
        approver: 'x',
        role: 'writer',
        logPath: logIn('c6-child'),
        env: {
          PATH: process.env.PATH,
          YOUTUBE_OAUTH_CREDENTIALS_PATH: 'p',
          AZURE_SPEECH_KEY: 'k',
          MAIL_USER: 'm',
          X_A_API_KEY: 'x',
        },
        argvOf: () => [process.execPath, [FAKE_STEP, '--dump-env', dump]],
      },
    );
    expect(c.ok).toBe(true);
    const env = JSON.parse(readFileSync(dump, 'utf8')) as Record<string, string>;
    for (const k of ['YOUTUBE_OAUTH_CREDENTIALS_PATH', 'AZURE_SPEECH_KEY', 'MAIL_USER', 'X_A_API_KEY'])
      expect(env[k]).toBeUndefined();
    expect(env.VK_NO_DOTENV).toBe('1');
    r.git('clean', '-fdq', 'src');
  });
  it("(7) a graphics agent's own check verb writes render-check.json: kept, never reverted", async () => {
    const { o, reverted } = await agentWrites(
      'c7',
      [{ write: `${r.story}/video/render-check.json`, text: '{"problems":[]}\n' }],
      'graphics',
    );
    expect(o.guardFailed).toBeFalsy();
    expect(reverted).toEqual([]);
  });
  it('(8) a content role has no Bash rule, whatever the configuration says', () => {
    for (const role of CONTENT_ROLES) {
      const args = agentArgs(a, {
        role,
        subject: { topic: 't', storyId: 's', slug: 'x' },
        prompt: 'p',
        cwd: r.root,
        budgetUsd: 1,
        timeoutMs: 1000,
        appendSystem: '',
      });
      expect(args.some((x) => x.startsWith('Bash('))).toBe(false);
    }
  });
  it('(10) documents the limits: protection, not isolation', () => {
    expect(readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8')).toContain('protection, not isolation');
  });
});
