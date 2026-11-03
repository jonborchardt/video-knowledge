import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANARIES, componentCheck, guard, matchesAny, snapshot, guardWhy } from '../../src/orchestration/run/guard';
import { grantFor } from '../../src/orchestration/run/roles';
import { fixtureRepo, type FixtureRepo } from './helpers';

let r: FixtureRepo;
let homeDir: string;
beforeAll(() => {
  r = fixtureRepo();
  homeDir = mkdtempSync(join(tmpdir(), 'vk-home-')); // outside the repo, as the person's home is
});
afterAll(() => {
  r.cleanup();
  rmSync(homeDir, { recursive: true, force: true });
});
const home = () => {
  mkdirSync(join(homeDir, '.claude'), { recursive: true });
  writeFileSync(join(homeDir, '.claude', 'settings.json'), '{}');
  return homeDir;
};

describe('matchesAny (gitignore-style)', () => {
  it('matches exact paths, * within a segment and ** across segments', () => {
    expect(matchesAny('a/b.json', ['a/b.json'])).toBe(true);
    expect(matchesAny('a/x.tsx', ['a/*.tsx'])).toBe(true);
    expect(matchesAny('a/b/x.tsx', ['a/*.tsx'])).toBe(false);
    expect(matchesAny('a/b/x.tsx', ['a/**'])).toBe(true);
    expect(matchesAny('topics/t/work/h3.json', ['topics/t/work/h*.json'])).toBe(true);
    expect(matchesAny('package.json', ['topics/**'])).toBe(false);
  });
});

describe('guard', () => {
  const writer = () => grantFor('writer', { topic: r.topic, storyId: r.storyId });
  it('a change to a writable file passes and is kept', () => {
    const before = snapshot(r.root, { home: home() });
    r.write(`${r.story}/script.json`, '{"revision":2}\n');
    const g = guard(before, r.root, writer().writable);
    expect(g.ok).toBe(true);
    expect(r.read(`${r.story}/script.json`)).toBe('{"revision":2}\n');
    r.git('checkout', '--', '.');
  });
  it('an edit to package.json is reverted and listed', () => {
    const before = snapshot(r.root, { home: home() });
    r.write('package.json', '{"scripts":{"script":"node evil.js"}}');
    const g = guard(before, r.root, writer().writable);
    expect(g.ok).toBe(false);
    expect(g.reverted).toEqual(['package.json']);
    expect(r.read('package.json')).toContain('tsx x.ts');
  });
  it('a package.json planted inside a writable folder is deleted by name', () => {
    const before = snapshot(r.root, { home: home() });
    r.write(`${r.story}/package.json`, '{}');
    const g = guard(before, r.root, [`${r.story}/**`]);
    expect(g.ok).toBe(false);
    expect(g.reverted).toEqual([`${r.story}/package.json`]);
    expect(existsSync(join(r.root, r.story, 'package.json'))).toBe(false);
  });
  it('a new component passes while a modified existing one is reverted (newFilesOnly)', () => {
    const g0 = grantFor('graphics', { topic: r.topic, storyId: r.storyId });
    const before = snapshot(r.root, { home: home() });
    r.write('src/modules/video/remotion/scenes/New.tsx', 'export const New = () => null;\n');
    r.write('src/modules/video/remotion/scenes/Bar.tsx', 'export const Bar = () => 1;\n');
    const g = guard(before, r.root, g0.writable, { newFilesOnly: g0.newFilesOnly, additiveOnly: g0.additiveOnly });
    expect(g.ok).toBe(false);
    expect(g.reverted).toEqual(['src/modules/video/remotion/scenes/Bar.tsx']);
    expect(existsSync(join(r.root, 'src/modules/video/remotion/scenes/New.tsx'))).toBe(true);
    expect(r.read('src/modules/video/remotion/scenes/Bar.tsx')).toBe('export const Bar = () => null;\n');
    r.git('clean', '-fdq', 'src');
  });
  it('an index change that only adds lines passes; one that deletes a line is reverted (additiveOnly)', () => {
    const g0 = grantFor('graphics', { topic: r.topic, storyId: r.storyId });
    const idx = 'src/modules/video/remotion/scenes/index.ts';
    const original = r.read(idx);
    let before = snapshot(r.root, { home: home() });
    r.write(idx, original + 'export const MORE = 1;\n');
    expect(guard(before, r.root, g0.writable, { additiveOnly: g0.additiveOnly }).ok).toBe(true);
    r.git('checkout', '--', '.');
    before = snapshot(r.root, { home: home() });
    r.write(idx, 'export const COMPONENTS = {};\n');
    const g = guard(before, r.root, g0.writable, { additiveOnly: g0.additiveOnly });
    expect(g.ok).toBe(false);
    expect(g.reverted).toEqual([idx]);
    expect(r.read(idx)).toBe(original);
  });
  it("a discovery agent's new review file is reverted: the grant's deny beats its writable", () => {
    const before = snapshot(r.root, { home: home() });
    mkdirSync(join(r.root, 'proposals'), { recursive: true });
    r.write('proposals/ev-range.json', '{}');
    r.write('proposals/ev-range.review.json', '{}');
    const d = grantFor('discovery', { topic: 'proposals' });
    const g = guard(before, r.root, [...d.writable, ...d.derived], { newFilesOnly: d.newFilesOnly, deny: d.deny });
    expect(g.kept).toEqual(['proposals/ev-range.json']);
    expect(g.reverted).toEqual(['proposals/ev-range.review.json']);
    expect(existsSync(join(r.root, 'proposals', 'ev-range.review.json'))).toBe(false);
  });
  it('a changed .env canary is restored byte for byte', () => {
    const before = snapshot(r.root, { home: home() });
    const original = r.read('.env');
    r.write('.env', 'YOUTUBE_OAUTH_CREDENTIALS_PATH=./attacker.json\n');
    const g = guard(before, r.root, writer().writable);
    expect(g.ok).toBe(false);
    expect(g.restored).toEqual(['.env']);
    expect(r.read('.env')).toBe(original);
  });
  it(".git/config: the IDE's merge-base bookkeeping passes, a hooksPath or url change is restored", () => {
    const cfg = '.git/config';
    const original = r.read(cfg);
    const before = snapshot(r.root, { home: home() });
    r.write(cfg, `${original}[branch "feat/x"]\n\tvscode-merge-base = origin/main\n`);
    const ide = guard(before, r.root, writer().writable);
    expect(ide.ok).toBe(true);
    expect(ide.restored).toEqual([]);
    expect(r.read(cfg)).toContain('vscode-merge-base'); // left as the IDE wrote it
    const after = snapshot(r.root, { home: home() });
    r.write(cfg, `${r.read(cfg)}[core]\n\thooksPath = /tmp/evil\n`);
    const tampered = guard(after, r.root, writer().writable);
    expect(tampered.ok).toBe(false);
    expect(tampered.restored).toEqual([cfg]);
    expect(r.read(cfg)).not.toContain('hooksPath');
    // a key on the section's own line is a section with a key, whatever the line filter thought (review finding 1)
    const again = snapshot(r.root, { home: home() });
    r.write(cfg, `${r.read(cfg)}[core] hooksPath = /tmp/evil\n`);
    const oneLine = guard(again, r.root, writer().writable);
    expect(oneLine.ok).toBe(false);
    expect(oneLine.restored).toEqual([cfg]);
    expect(r.read(cfg)).not.toContain('/tmp/evil');
  });
  it('a changed user-level settings file is reported, not touched', () => {
    const h = home();
    const before = snapshot(r.root, { home: h });
    writeFileSync(join(h, '.claude', 'settings.json'), '{"permissions":{"allow":["Edit(**)"]}}');
    const g = guard(before, r.root, writer().writable);
    expect(g.ok).toBe(false);
    expect(g.reported).toEqual([join(h, '.claude', 'settings.json')]);
    expect(readFileSync(join(h, '.claude', 'settings.json'), 'utf8')).toContain('Edit(**)');
  });
  it('an edit to .claude/settings.json in the repo is reverted', () => {
    const before = snapshot(r.root, { home: home() });
    r.write('.claude/settings.json', '{ "permissions": { "allow": ["Bash(*)"] } }');
    const g = guard(before, r.root, writer().writable);
    expect(g.ok).toBe(false);
    expect(g.reverted).toEqual(['.claude/settings.json']);
    expect(r.read('.claude/settings.json')).toBe('{ "hooks": {} }');
  });
});

describe('guard: child scope denies, pre-dirty files, home projection', () => {
  const writer = () => grantFor('writer', { topic: r.topic, storyId: r.storyId });
  it('a child-scope deny list reverts a store write even inside the writable folder', () => {
    r.write(`topics/${r.topic}/store/topics.json`, '{}');
    r.git('add', '-A');
    r.git('commit', '-q', '-m', 'store');
    const before = snapshot(r.root, { home: home() });
    r.write(`topics/${r.topic}/store/topics.json`, '{"planted":true}');
    r.write(`topics/${r.topic}/stories.json`, '{}');
    const g = guard(before, r.root, [`topics/${r.topic}/**`], {
      deny: [`topics/*/store/**`, 'topics/*/public-record.json'],
    });
    expect(g.reverted).toEqual([`topics/${r.topic}/store/topics.json`]);
    expect(g.kept).toEqual([`topics/${r.topic}/stories.json`]);
    r.git('clean', '-fdq', 'topics');
  });
  it('a tracked file already dirty before the step is still reverted when its content moves again', () => {
    r.write('package.json', '{"name":"fixture","scripts":{"script":"tsx x.ts"},"dirty":1}');
    const before = snapshot(r.root, { home: home() });
    r.write('package.json', '{"name":"fixture","scripts":{"script":"node evil.js"}}');
    const g = guard(before, r.root, writer().writable);
    expect(g.reverted).toEqual(['package.json']);
    expect(r.read('package.json')).toContain('tsx x.ts'); // back to the committed content
    r.git('checkout', '--', '.');
  });
  it('the tsx and tsc the runner executes are canaries', () => {
    expect(CANARIES).toContain('node_modules/tsx/dist/cli.mjs');
    expect(CANARIES).toContain('node_modules/typescript/lib/tsc.js');
  });
  it('~/.claude.json: Claude Code’s own churn passes, a permission change is reported', () => {
    const h = home();
    const cj = join(h, '.claude.json');
    const base = { numStartups: 1, projects: { [r.root]: { allowedTools: [], loggedAuthoredArtifactPaths: [] } } };
    writeFileSync(cj, JSON.stringify(base));
    const before = snapshot(r.root, { home: h });
    writeFileSync(
      cj,
      JSON.stringify({
        ...base,
        numStartups: 2,
        projects: { [r.root]: { ...base.projects[r.root], loggedAuthoredArtifactPaths: ['x'] } },
      }),
    );
    expect(guard(before, r.root, writer().writable).ok).toBe(true);
    // a rewrite that reorders the keys and adds a project entry carrying no permission (what a claude -p session in a
    // new cwd leaves behind) is Claude Code's churn too: the first real fixture run halted on exactly this
    writeFileSync(
      cj,
      JSON.stringify({
        projects: {
          'F:/elsewhere': { allowedTools: [], mcpServers: {}, hasTrustDialogAccepted: true },
          [r.root]: { loggedAuthoredArtifactPaths: ['y'], allowedTools: [] },
        },
        numStartups: 3,
      }),
    );
    expect(guard(before, r.root, writer().writable).ok).toBe(true);
    writeFileSync(
      cj,
      JSON.stringify({ ...base, projects: { [r.root]: { ...base.projects[r.root], allowedTools: ['Bash(*)'] } } }),
    );
    const g = guard(before, r.root, writer().writable);
    expect(g.reported).toEqual([cj]);
    rmSync(cj);
  });
});

describe('componentCheck', () => {
  it('fails a component that imports a repo file outside the browser-safe set', () => {
    r.write(
      'src/modules/video/remotion/scenes/Io.tsx',
      "import { sha } from '../../../../shared/io';\nexport const Io = sha;\n",
    );
    r.write(
      'src/modules/video/remotion/scenes/Render.tsx',
      "import { x } from '../../render';\nexport const Render = x;\n",
    );
    r.write(
      'src/modules/video/remotion/scenes/Theme.tsx',
      "import { theme } from '../theme';\nexport const Theme = () => theme;\n",
    );
    const tsc = () => ({ ok: true, output: '' });
    expect(componentCheck(r.root, ['src/modules/video/remotion/scenes/Io.tsx'], tsc).output).toMatch(/shared\/io/);
    expect(componentCheck(r.root, ['src/modules/video/remotion/scenes/Render.tsx'], tsc).ok).toBe(false);
    expect(componentCheck(r.root, ['src/modules/video/remotion/scenes/Theme.tsx'], tsc).ok).toBe(true);
    r.git('clean', '-fdq', 'src');
  });
  it('fails a component with a dynamic node import and passes a plain one', () => {
    r.write(
      'src/modules/video/remotion/scenes/Evil.tsx',
      "export const Evil = async () => (await import('node:' + 'fs')).readFileSync;\n",
    );
    r.write(
      'src/modules/video/remotion/scenes/Good.tsx',
      "import { theme } from '../theme';\nexport const Good = () => theme;\n",
    );
    const tsc = () => ({ ok: true, output: '' });
    const bad = componentCheck(r.root, ['src/modules/video/remotion/scenes/Evil.tsx'], tsc);
    expect(bad.ok).toBe(false);
    expect(bad.output).toMatch(/node:/);
    const fs2 = componentCheck(r.root, ['src/modules/video/remotion/scenes/Fs.tsx'], tsc);
    expect(fs2.ok).toBe(false); // a missing file is a failure, never a pass
    r.write(
      'src/modules/video/remotion/scenes/Fs.tsx',
      "import { readFileSync } from 'fs';\nexport const Fs = readFileSync;\n",
    );
    expect(componentCheck(r.root, ['src/modules/video/remotion/scenes/Fs.tsx'], tsc).ok).toBe(false);
    expect(componentCheck(r.root, ['src/modules/video/remotion/scenes/Good.tsx'], tsc).ok).toBe(true);
    expect(
      componentCheck(r.root, ['src/modules/video/remotion/scenes/Good.tsx'], () => ({ ok: false, output: 'TS2322' }))
        .ok,
    ).toBe(false);
    r.git('clean', '-fdq', 'src');
  });
});

describe('guardWhy', () => {
  it('names every reverted, restored and reported path, so a canary outside the repo never leaves an empty reason', () => {
    expect(guardWhy({ ok: true, reverted: [], restored: [], reported: [], kept: ['a'] })).toBe('');
    expect(
      guardWhy({
        ok: false,
        reverted: ['src/x.ts'],
        restored: ['.env'],
        reported: ['C:/Users/j/.claude/settings.json'],
        kept: [],
      }),
    ).toBe('reverted src/x.ts; restored .env; changed outside the repo: C:/Users/j/.claude/settings.json');
  });
});
