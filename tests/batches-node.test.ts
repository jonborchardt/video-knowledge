import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/shared/io';

// The .mjs scripts load these files through plain node (type stripping): every import must resolve without a loader.
describe('files the .mjs scripts load by .ts path', () => {
  for (const f of ['lib/batches', 'shared/io', 'lib/cited']) {
    it(`src/${f}.ts loads in plain node`, () => {
      const r = spawnSync(
        process.execPath,
        ['-e', `import('./src/${f}.ts').then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })`],
        { cwd: ROOT, encoding: 'utf8' },
      );
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
    });
  }
});
