// A tiny process the crash test spawns and kills: runs one story with the fake agent until a stage.
//   tsx tests/automation/run-driver.ts <root> <topic> <story-id> <scenario.json> <until>
import { join } from 'node:path';
import { loadAutomation } from '../../src/shared/automation';
import { runStory } from '../../src/orchestration/run/runner';

const [root, topic, storyId, scenario, until] = process.argv.slice(2);
const a = loadAutomation(join(root, 'no-automation-file'));
const fake = {
  ...a,
  agents: { ...a.agents, command: `node ${join(process.cwd(), 'tests', 'automation', 'fake-claude.mjs')}` },
};
const r = await runStory(topic, storyId, fake, {
  approver: 'automated: crash test',
  root,
  until: until as never,
  git: 'none',
  validate: () => ({ ok: true, output: '' }),
  env: { ...process.env, FAKE_CLAUDE_SCENARIO: scenario },
});
process.stdout.write(`${r.outcome} ${r.stage}\n`);
process.exit(r.outcome === 'done' ? 0 : 1);
