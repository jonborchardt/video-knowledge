// The CLIs as child processes (src/shared/cli.ts): every npm run script names a file that exists, and the argv a
// caller gets is that file under the repo's tsx (node alone for an .mjs), never a hand-written path.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cliArgv, cliScript, runCli } from '../src/shared/cli';
import { ROOT } from '../src/shared/io';

describe('the CLIs as child processes', () => {
  it('every package.json script that runs a file names one that exists', () => {
    const scripts = (
      JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    ).scripts;
    const files = Object.entries(scripts).flatMap(([n, cmd]) =>
      /^(tsx|node) \S+$/.test(cmd) ? [[n, cliScript(n)] as const] : [],
    );
    expect(files.length).toBeGreaterThan(10);
    for (const [, f] of files) expect(existsSync(join(ROOT, f)), f).toBe(true);
  });
  it('resolves a CLI by its npm run name: tsx with the repo tsconfig for .ts, node alone for .mjs', () => {
    expect(cliScript('video')).toBe('src/modules/video/cli.ts');
    const [exe, argv] = cliArgv('publish', ['show', 't', 's']);
    expect(exe).toBe(process.execPath);
    expect(argv).toEqual([
      join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      '--tsconfig',
      join(ROOT, 'tsconfig.json'),
      join(ROOT, 'src', 'modules', 'publishing', 'cli.ts'),
      'show',
      't',
      's',
    ]);
    expect(cliArgv('watcher', [])[1]).toEqual([join(ROOT, 'src', 'modules', 'evidence', 'watcher.mjs')]);
    expect(() => cliScript('no-such-cli')).toThrow(/no CLI script no-such-cli/);
    expect(() => cliScript('validate')).toThrow(/no CLI script/);
  });
  it('runs one and captures its output', () => {
    const r = runCli('board', ['next']);
    expect(typeof r.stdout).toBe('string');
    expect(r.status).not.toBeNull();
  }, 60_000);
});
