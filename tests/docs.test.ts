// The tracked docs agree with the code (M3 phase 3): every `npm run <script>` they name exists in package.json, every
// relative link resolves, the runbook's readiness table is the code's integration list, and CLAUDE.md keeps its rules.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/shared/io';
import { INTEGRATIONS } from '../src/orchestration/run/readiness';

const DOCS = [
  'CLAUDE.md',
  'README.md',
  'docs/OPERATIONS.md',
  'docs/COMMANDS.md',
  'src/modules/README.md',
  'src/orchestration/README.md',
  '.claude/skills/produce/SKILL.md',
  ...[
    'article',
    'brand',
    'evidence',
    'packaging',
    'publishing',
    'script',
    'shorts',
    'social',
    'stories',
    'storyboard',
    'topic-discovery',
    'video',
    'website',
  ].map((m) => `src/modules/${m}/README.md`),
];
// Scripts of another repo the docs name on purpose, with where they live.
const EXTERNAL_SCRIPTS: Record<string, string> = {
  headless: 'strudel-bench (music/README.md, briefs/strudel-bench.md)',
};
const scripts = Object.keys(
  (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts,
);
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('the tracked docs', () => {
  it('exist', () => {
    for (const d of DOCS) expect(existsSync(join(ROOT, d)), d).toBe(true);
  });
  it('name only npm run scripts that exist (or the one external script, by name)', () => {
    for (const d of DOCS) {
      const names = new Set([...read(d).matchAll(/npm run ([a-z][a-z:-]*)/g)].map((m) => m[1]));
      for (const n of names) {
        if (n in EXTERNAL_SCRIPTS) continue;
        expect(scripts, `${d}: npm run ${n}`).toContain(n);
      }
    }
  });
  it('every relative link resolves to a file or folder', () => {
    for (const d of DOCS) {
      const text = read(d);
      for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = target.split('#')[0];
        if (!path) continue;
        const abs = resolve(join(ROOT, dirname(d)), path);
        expect(existsSync(abs), `${d}: link ${target}`).toBe(true);
      }
    }
  });
  it('no table row of the tracked docs breaks on a pipe inside a code span (review finding 14)', () => {
    for (const d of DOCS)
      for (const line of read(d).split('\n'))
        if (line.startsWith('|'))
          for (const code of line.matchAll(/`([^`]*)`/g))
            expect(/[^\\]\|/.test(code[1]), `${d}: ${line.slice(0, 80)}`).toBe(false);
  });
  it("the runbook's readiness table lists exactly the code's integrations, with each one's enabled-by key", () => {
    const ops = read('docs/OPERATIONS.md');
    const rows = [...ops.matchAll(/^\| `([a-z-]+)` +\| (yes|no[^|]*) +\| ([^|]+)\|/gm)].map((m) => ({
      key: m[1],
      implemented: m[2].trim().startsWith('yes'),
      enabledBy: m[3].trim(),
    }));
    expect(rows.map((r) => r.key).sort()).toEqual(INTEGRATIONS.map((i) => i.key).sort());
    for (const i of INTEGRATIONS) {
      const r = rows.find((x) => x.key === i.key)!;
      expect(r.implemented, i.key).toBe(i.implemented);
      if (i.enabledBy) expect(r.enabledBy, i.key).toContain(i.enabledBy);
    }
  });
  it('CLAUDE.md keeps its Rules section and names the three readiness states; README says Milestone 2 is done', () => {
    const claude = read('CLAUDE.md');
    expect(claude).toMatch(/^## Rules$/m);
    for (const w of ['Implemented', 'Verified', 'Enabled']) expect(claude).toContain(w);
    expect(claude).toContain('docs/OPERATIONS.md');
    const readme = read('README.md');
    expect(readme).not.toMatch(/Autonomous operations\*\* \(next\)/);
    expect(readme).toContain('docs/OPERATIONS.md');
  });
});
