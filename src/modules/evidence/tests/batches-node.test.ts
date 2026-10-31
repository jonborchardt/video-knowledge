import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';

// The .mjs scripts load these files through plain node (type stripping): every import must resolve without a loader.
describe('files the .mjs scripts load by .ts path', () => {
  for (const f of ['modules/evidence/batches', 'shared/io', 'modules/evidence/cited']) {
    it(`src/${f}.ts loads in plain node`, () => {
      const r = spawnSync(
        process.execPath,
        ['-e', `import('./src/${f}.ts').then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })`],
        { cwd: ROOT, encoding: 'utf8', timeout: 20_000 },
      );
      // Node 22 may print an ExperimentalWarning for type stripping; only an error fails.
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr, r.stderr).not.toMatch(/Error|ERR_/);
    });
  }
});
