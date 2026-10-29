import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/lib/io';
import { capabilityOf, check, importsOf, resolveSpecifier, violations, walk } from './boundaries-helpers';

const config = JSON.parse(readFileSync(join(ROOT, 'tests/boundaries.json'), 'utf8'));
const exists = (p: string) => existsSync(join(ROOT, p));

describe('module boundaries (docs/superpowers/specs/2026-10-29-module-architecture.md)', () => {
  const files = walk(['src', 'scripts'], ROOT).map((path) => {
    const source = readFileSync(join(ROOT, path), 'utf8');
    const specs = importsOf(path, source);
    const imports = specs.map((s) => resolveSpecifier(path, s, exists) ?? s);
    return { path, specs, imports, source };
  });
  const { unexpected, stale } = check(violations(files, config), config.edges);

  it('has no import edge outside the allowlist', () => {
    const lines = unexpected.map((v) => `  { "from": "${v.from}", "to": "${v.to}", "until": "<cap>" }  // ${v.rule}`);
    expect(unexpected, `unlisted edges:\n${lines.join('\n')}`).toEqual([]);
  });
  it('has no stale allowlist entry', () => {
    expect(stale, `remove from tests/boundaries.json:\n${JSON.stringify(stale, null, 1)}`).toEqual([]);
  });
  it('names a capability for every file', () => {
    const unmapped = files.filter((f) => capabilityOf(f.path, config.capabilities) === undefined).map((f) => f.path);
    expect(unmapped).toEqual([]);
  });
  it('gives every allowlisted edge an until', () => {
    expect(config.edges.filter((e: { until?: string }) => !e.until)).toEqual([]);
  });
  it('resolves every relative import, so no edge is dropped', () => {
    const misses = files.flatMap((f) =>
      f.specs
        .filter((s) => s.startsWith('./') || s.startsWith('../'))
        .filter((s) => resolveSpecifier(f.path, s, exists) === null)
        .map((s) => `${f.path}: ${s}`),
    );
    expect(misses).toEqual([]);
  });
});
