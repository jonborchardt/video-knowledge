import { join } from 'node:path';
import { expect, it } from 'vitest';
import { FILES, readJson, scriptDirs } from '../src/shared/io';
import type { Release, ScriptValidation } from '../src/shared/types';
import { validationFingerprint } from '../src/shared/sentence-validation';

// The fingerprint every locked release.json holds must not change when the function moves.
it('validationFingerprint matches the one a locked release stored', () => {
  const hits = scriptDirs().filter((d) => {
    const r = readJson<Release>(join(d.dir, FILES.release));
    const v = readJson<ScriptValidation>(join(d.dir, FILES.validation));
    return r && v && validationFingerprint(v) === r.fingerprints.validation;
  });
  expect(hits.length).toBeGreaterThan(0);
});
