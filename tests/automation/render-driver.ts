// The process the crash-render test spawns and kills: runs one locked story past the render to the article stage with the fake render.
//   tsx tests/automation/render-driver.ts <root> <topic> <story-id> <story dir> <sleep ms> <report template>
import { join } from 'node:path';
import { loadAutomation } from '../../src/shared/automation';
import { cliArgv } from '../../src/shared/cli';
import { runStory } from '../../src/orchestration/run/runner';

const [root, topic, storyId, dir, sleepMs, template] = process.argv.slice(2);
const a = loadAutomation(join(root, 'no-automation-file'));
const FAKE_RENDER = join(process.cwd(), 'tests', 'automation', 'fake-render.mjs');
const r = await runStory(topic, storyId, a, {
  approver: 'automated: crash test',
  root,
  until: 'article',
  git: 'none',
  validate: () => ({ ok: true, output: '' }),
  hooks: {
    snapshot: () => {},
    guard: () => ({ ok: true, why: '', kept: [] }),
    componentCheck: () => ({ ok: true, output: '' }),
  },
  argvOf: (cli, args) =>
    cli === 'video' && args[0] === 'spike'
      ? [process.execPath, [FAKE_RENDER, dir, sleepMs, template]]
      : cliArgv(cli, args),
});
process.stdout.write(`${r.outcome} ${r.stage}\n`);
process.exit(r.outcome === 'done' ? 0 : 1);
