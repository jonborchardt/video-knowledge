// runValidate skips the suite when the working tree is byte for byte the one that passed last.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runValidate, treeFingerprint } from '../../src/orchestration/run/runner';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const git = (root: string, args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

describe('validate cache', () => {
  it('runs once per tree content: a changed file runs again, the same content does not', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-validate-'));
    roots.push(root);
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 't@example.test']);
    git(root, ['config', 'user.name', 't']);
    writeFileSync(join(root, 'a.txt'), 'one');
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'one']);
    const a = treeFingerprint(root);
    writeFileSync(join(root, 'b.txt'), 'two'); // untracked counts
    const b = treeFingerprint(root);
    expect(a).not.toBeNull();
    expect(b).not.toBe(a);
    let runs = 0;
    const run = () => (runs++, { ok: true, output: 'ran' });
    expect(runValidate(root, process.env, run).output).toBe('ran');
    expect(runValidate(root, process.env, run).output).toMatch(/skipped/);
    writeFileSync(join(root, 'b.txt'), 'three');
    expect(runValidate(root, process.env, run).output).toBe('ran');
    expect(runs).toBe(2);
    expect(runValidate(root, process.env, () => (runs++, { ok: false, output: 'no' })).ok).toBe(true); // same tree: still the last pass
  });
});
