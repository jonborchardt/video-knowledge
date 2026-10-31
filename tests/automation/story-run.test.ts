// The runner on the real topic copy with the real CLIs and the fake agent: to `locked`, and across a crash.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadAutomation } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { FILES, ROOT } from '../../src/shared/io';
import { readJournal, runDir } from '../../src/orchestration/run/journal';
import { runStory } from '../../src/orchestration/run/runner';
import { cliRoot, copyTopic, syntheticProduction } from '../production-helpers';

const TOPIC = 'heat-pumps';
const FAKE_CLAUDE = join(ROOT, 'tests', 'automation', 'fake-claude.mjs');
const cleanups: (() => void)[] = [];
afterAll(() => cleanups.forEach((c) => c()));

/** The artifacts a writer, reviewer and storyboard agent would produce, taken from the synthetic locked fixture, and
 *  a fresh topic copy whose story has no production yet. */
function stage() {
  const src = syntheticProduction('locked');
  cleanups.push(src.cleanup);
  const c = copyTopic(TOPIC);
  cleanups.push(c.cleanup);
  cliRoot(c.root);
  // the real guard needs a repository: the copy becomes one, with the runner's folders ignored as in the repo
  writeFileSync(join(c.root, '.gitignore'), '.automation/\ntopics/*/scripts/*/run/\ntopics/*/work/\n');
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: c.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const dir = c.dir(src.story);
  rmSync(dir, { recursive: true, force: true });
  const from = (f: string) => join(src.dir, f).replaceAll('\\', '/');
  const to = (f: string) => join(dir, f).replaceAll('\\', '/');
  const scenario = join(c.root, 'scenario.json');
  const entries = (storyboardSleep: number) => [
    { match: 'briefs/script\\.md', actions: [{ copy: from(FILES.script), to: to(FILES.script) }], cost: 0.3 },
    { match: 'briefs/script-review\\.md', actions: [{ copy: from(FILES.review), to: to(FILES.review) }], cost: 0.2 },
    {
      match: 'briefs/storyboard\\.md',
      actions: [{ copy: from(FILES.storyboard), to: to(FILES.storyboard) }],
      cost: 0.2,
      sleepMs: storyboardSleep,
    },
  ];
  writeFileSync(scenario, JSON.stringify(entries(0)));
  const a = loadAutomation(join(c.root, 'no-automation-file'));
  const fake = { ...a, agents: { ...a.agents, command: `node ${FAKE_CLAUDE}` } };
  return { src, root: c.root, story: src.story, dir, scenario, fake, entries };
}

describe('story run (integration)', () => {
  it('drives a ready story to locked with real CLIs and the fake agent', { timeout: 300_000 }, async () => {
    const s = stage();
    const r = await runStory(TOPIC, s.story, s.fake, {
      approver: 'automated: test',
      root: s.root,
      until: 'locked',
      git: 'none',
      validate: () => ({ ok: true, output: '' }),
      env: { ...process.env, FAKE_CLAUDE_SCENARIO: s.scenario },
    });
    expect(r.halt).toBeNull();
    expect(r.outcome).toBe('done');
    expect(existsSync(join(s.dir, FILES.release))).toBe(true);
    const j = readJournal(runDir(TOPIC, s.story, s.root));
    const prompts = j.filter((e) => e.kind === 'prompt');
    const writer = prompts.find((e) => /script\.md/.test(e.step) && !/review/.test(e.step));
    const reviewer = prompts.find((e) => /script-review\.md/.test(e.step));
    expect(writer?.sessionId).toBeTruthy();
    expect(reviewer?.sessionId).toBeTruthy();
    expect(writer?.sessionId).not.toBe(reviewer?.sessionId);
    expect(existsSync(join(runDir(TOPIC, s.story, s.root), 'lock.json'))).toBe(false);
    expect(r.costUsd).toBeCloseTo(0.7);
  });
  it(
    'a run killed mid-step resumes at the same stage, journals the resume and takes the lock over',
    { timeout: 300_000 },
    async () => {
      const s = stage();
      writeFileSync(s.scenario, JSON.stringify(s.entries(20_000)));
      const [exe, argv] = cliArgv('board', []); // the repo's tsx, for the driver
      const tsx = argv.slice(0, 3); // [tsx cli, --tsconfig, path]
      const driver = join(ROOT, 'tests', 'automation', 'run-driver.ts');
      const child = spawn(exe, [...tsx, driver, s.root, TOPIC, s.story, s.scenario, 'locked'], {
        cwd: ROOT,
        stdio: 'ignore',
        windowsHide: true,
      });
      const dir = runDir(TOPIC, s.story, s.root);
      // wait until the storyboard agent is running (its prompt is journaled before it starts), then kill the run
      const started = Date.now();
      while (
        !readJournal(dir).some((e) => e.kind === 'prompt' && /storyboard\.md/.test(e.step)) &&
        Date.now() - started < 240_000
      )
        await new Promise((r) => setTimeout(r, 500));
      expect(readJournal(dir).some((e) => /storyboard\.md/.test(e.step))).toBe(true);
      child.kill();
      await new Promise((r) => child.on('exit', r));
      expect(existsSync(join(dir, 'lock.json'))).toBe(true); // a kill leaves the lock
      const stageBefore = readJournal(dir).at(-1)?.stage;
      writeFileSync(s.scenario, JSON.stringify(s.entries(0)));
      const r = await runStory(TOPIC, s.story, s.fake, {
        approver: 'automated: test',
        root: s.root,
        until: 'locked',
        git: 'none',
        validate: () => ({ ok: true, output: '' }),
        env: { ...process.env, FAKE_CLAUDE_SCENARIO: s.scenario },
      });
      expect(r.outcome).toBe('done');
      const j = readJournal(dir);
      const resume = j.find((e) => e.kind === 'resume');
      expect(resume).toBeTruthy();
      expect(resume?.error).toMatch(/took over/);
      expect(stageBefore).toBe('storyboard');
      expect(j.filter((e) => e.kind === 'run' && /script -- package/.test(e.step))).toHaveLength(1); // nothing redone
      expect(existsSync(join(s.dir, FILES.release))).toBe(true);
    },
  );
});
