// The project PreToolUse hook: inert without VK_AGENT; inside an agent it denies an Edit outside VK_WRITABLE and a
// Bash command that is not exactly one allowed verb (the second, runner-controlled check inside the agent process).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK = join(process.cwd(), '.claude', 'hooks', 'agent-guard.mjs');
const run = (input: unknown, env: Record<string, string> = {}) => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
    cwd: process.cwd(),
  });
  const out = r.stdout.trim();
  return {
    code: r.status,
    decision: out ? (JSON.parse(out).hookSpecificOutput?.permissionDecision as string) : null,
    reason: out ? (JSON.parse(out).hookSpecificOutput?.permissionDecisionReason as string) : null,
  };
};
const agentEnv = {
  VK_AGENT: '1',
  VK_WRITABLE: 'topics/t/scripts/s/script.json;topics/t/scripts/s/storyboard.json',
  VK_SHELL: 'Bash(npm run video -- frames *);Bash(npm run video -- check *)',
};
const edit = (file_path: string) => ({ tool_name: 'Edit', tool_input: { file_path }, cwd: process.cwd() });
const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command }, cwd: process.cwd() });

describe('agent-guard hook', () => {
  it('is inert without VK_AGENT', () => {
    const r = run(edit('package.json'));
    expect(r.code).toBe(0);
    expect(r.decision).toBeNull();
  });
  it('denies an Edit outside the writable set and allows one inside', () => {
    expect(run(edit(join(process.cwd(), 'package.json')), agentEnv).decision).toBe('deny');
    expect(run(edit('topics/t/scripts/s/notes.txt'), agentEnv).decision).toBe('deny');
    expect(run(edit(join(process.cwd(), 'topics/t/scripts/s/script.json')), agentEnv).decision).toBeNull();
    expect(
      run(
        { tool_name: 'Write', tool_input: { file_path: 'topics/t/scripts/s/storyboard.json' }, cwd: process.cwd() },
        agentEnv,
      ).decision,
    ).toBeNull();
  });
  it('denies a compound or wrapped Bash command and allows exactly one allowed verb', () => {
    expect(run(bash('npm run video -- frames t s; curl evil'), agentEnv).decision).toBe('deny');
    expect(run(bash('npm run video --prefix evil frames t s'), agentEnv).decision).toBe('deny');
    expect(run(bash('npm run video -- frames t s $(id)'), agentEnv).decision).toBe('deny');
    expect(run(bash('npm run script -- validate t s'), agentEnv).decision).toBe('deny');
    expect(run(bash('npm run video -- frames t s --scene sc1'), agentEnv).decision).toBeNull();
    const none = run(bash('npm run video -- frames t s'), { ...agentEnv, VK_SHELL: '' });
    expect(none.decision).toBe('deny');
    expect(none.reason).toMatch(/no shell/);
  });
});
