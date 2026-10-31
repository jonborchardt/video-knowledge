// A small git repository that looks like this one where the guard looks: package.json, .env, .claude/settings.json,
// a shared renderer file, a component, a story folder. Tests plant edits in it and watch the guard revert them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface FixtureRepo {
  root: string;
  topic: string;
  storyId: string;
  story: string; // the story folder, relative
  write: (rel: string, text: string) => void;
  read: (rel: string) => string;
  git: (...args: string[]) => string;
  cleanup: () => void;
}

export function fixtureRepo(): FixtureRepo {
  const root = mkdtempSync(join(tmpdir(), 'vk-repo-'));
  const topic = 'heat-pumps';
  const storyId = 'decision:when-does-it-pay';
  const story = `topics/${topic}/scripts/decision-when-does-it-pay`;
  const write = (rel: string, text: string) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  };
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  write('package.json', JSON.stringify({ name: 'fixture', scripts: { script: 'tsx x.ts' } }, null, 1));
  write('.gitignore', '.env\nnode_modules/\n.automation/\ntopics/*/scripts/*/run/\n');
  write('.claude/settings.json', '{ "hooks": {} }');
  write('src/modules/video/remotion/theme.ts', 'export const theme = {};\n');
  write('src/modules/video/remotion/scenes/Bar.tsx', 'export const Bar = () => null;\n');
  write(
    'src/modules/video/remotion/scenes/index.ts',
    "import { Bar } from './Bar';\nexport const COMPONENTS = { Bar };\n",
  );
  write('src/modules/video/bespoke/index.ts', 'export const BESPOKE = {};\n');
  write(`${story}/script.json`, '{"revision":1}\n');
  write(`${story}/storyboard.json`, '{}\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  write('.env', 'YOUTUBE_OAUTH_CREDENTIALS_PATH=./secret.json\nAZURE_SPEECH_KEY=k\n');
  return {
    root,
    topic,
    storyId,
    story,
    write,
    read: (rel) =>
      execFileSync(
        process.execPath,
        ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', join(root, rel)],
        { encoding: 'utf8' },
      ),
    git,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
