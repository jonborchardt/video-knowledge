// automation.json (the automation policy) and its reader: every feature off by default, a closed key set, agent
// permissions never in configuration (they are code: src/orchestration/run/roles.ts).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { automationProblems, loadAutomation } from '../src/shared/automation';

const tmp = mkdtempSync(join(tmpdir(), 'vk-automation-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('automation.json', () => {
  it('loads defaults when the file is absent', () => {
    const a = loadAutomation(tmp);
    expect(a.runs.loopCap).toBe(60);
    expect(a.review.draft).toBe('person');
    expect(a.production.storiesPerWeek).toBe(1);
    expect(Object.values(a.enabled).every((v) => v === false)).toBe(true);
  });
  it('agent tool lists are not configuration', () =>
    expect(automationProblems({ agents: { allowedTools: ['Bash(npm run publish *)'] } })).toContain(
      'agents.allowedTools: unknown key (agent tools are code: src/orchestration/run/roles.ts)',
    ));
  it('refuses an unknown key and a wrong type', () =>
    expect(automationProblems({ runs: { loopCap: 'sixty' }, nope: 1 })).toEqual(
      expect.arrayContaining(['runs.loopCap: expected a number', 'nope: unknown key']),
    ));
  it('refuses a draft policy outside person, shadow, agent', () =>
    expect(automationProblems({ review: { draft: 'auto' } })).toContain(
      'review.draft: expected person, shadow or agent',
    ));
  it('refuses a cadence under one', () =>
    expect(automationProblems({ production: { storiesPerWeek: 0 } })).toContain(
      'production.storiesPerWeek: expected at least 1',
    ));
  it('refuses a commitOn outside main and produce-branch', () =>
    expect(automationProblems({ git: { commitOn: 'develop' } })).toContain(
      'git.commitOn: expected main or produce-branch',
    ));
  it('a partial file merges under the defaults', () => {
    const a = loadAutomation(tmp, { runs: { loopCap: 10 } });
    expect(a.runs.loopCap).toBe(10);
    expect(a.runs.noProgressAttempts).toBe(3);
  });
  it('the committed file is valid and every feature is off', () => {
    const a = loadAutomation();
    expect(Object.values(a.enabled).every((v) => v === false)).toBe(true);
  });
});
