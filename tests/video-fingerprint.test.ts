// The bespoke-graphic fingerprint (componentVersion): it hashes the normalised sources of what draws a component, so
// a type's home or the tree's location never moves a key, and every render-affecting edit does.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT, scriptDir, sha, toJson } from '../src/shared/io';
import { KEY_MIGRATION, type VisualReview, graphicKey, planKeyMigration, writeKeyMigration } from '../src/video/check';
import { bespokeFor } from '../src/video/kinds';
import { componentVersionIn, componentVersionLegacy, normalise } from '../src/video/render';
import { checkSegment, loadInputs } from '../src/video/select';

const SHARED = [
  'Root.tsx',
  'Video.tsx',
  'Citation.tsx',
  'Portrait.tsx',
  'fonts.ts',
  'theme.ts',
  'glyphs.tsx',
  'index.ts',
];
const base = mkdtempSync(join(tmpdir(), 'vk-fingerprint-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const put = (file: string, text: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
/** A minimal video tree at `root` (src dir), whose component X imports a value helper and a type from `typeFrom`. */
function tree(
  root: string,
  o: {
    typeFrom?: string;
    typeText?: string;
    helper?: string;
    theme?: string;
    video?: string;
    typesFrom?: string; // types.ts's type-only import: the line the real move changes
    typesValue?: string; // a value import in types.ts
  } = {},
) {
  const remotion = join(root, 'remotion');
  for (const f of SHARED) put(join(remotion, f), `export const ${f.replace(/\W/g, '_')} = 1;\n`);
  if (o.theme) put(join(remotion, 'theme.ts'), o.theme);
  if (o.video) put(join(remotion, 'Video.tsx'), o.video);
  const typesFrom = o.typesFrom ?? '../lib/storyboard';
  put(join(root, typesFrom + '.ts'), 'export type ChartSpec = { n: number };\n');
  if (o.typesValue) put(join(root, o.typesValue + '.ts'), `export const v = '${o.typesValue}';\n`);
  const value = o.typesValue ? `import { v } from '${o.typesValue}';\n` : '';
  put(join(root, 'types.ts'), `import type { ChartSpec } from '${typesFrom}';\n${value}export const FPS = 30;\n`);
  put(join(root, 'words.ts'), 'export const words = (s: string) => s.split(" ");\n');
  const typeFrom = o.typeFrom ?? '../../../lib/storyboard';
  put(join(remotion, 'scenes', typeFrom + '.ts'), o.typeText ?? 'export type T = number;\n');
  put(join(remotion, 'scenes', 'helper.ts'), o.helper ?? 'export const h = 1;\n');
  put(
    join(remotion, 'scenes', 'X.tsx'),
    `import type {\n  T,\n} from '${typeFrom}';\nimport { h } from './helper';\nexport const X = (t: T) => h + t;\n`,
  );
  return componentVersionIn(remotion, root, 'X');
}
let n = 0;
const fresh = (...parts: string[]) => join(base, String(n++), ...parts);

describe('componentVersion', () => {
  it('normalise drops type-only import and export statements and keeps value imports', () => {
    const src =
      "import type {\n  A,\n  B,\n} from './a';\r\nexport type { C } from './c';\nimport { type D, e } from './d';\n";
    expect(normalise(src)).toBe("import { type D, e } from './d';\n");
  });

  it('ignores a type file and its import path, and follows the value helper to the byte', () => {
    const k = tree(fresh());
    expect(tree(fresh(), { typeText: 'export type T = string;\n' })).toBe(k);
    expect(tree(fresh(), { typeFrom: '../../shared/types' })).toBe(k);
    expect(tree(fresh(), { helper: 'export const h = 2;\n' })).not.toBe(k);
  });

  it('is independent of where the tree sits and where its types live, types.ts included', () => {
    const a = tree(fresh('src', 'video'), { typeFrom: '../../lib/storyboard', typesFrom: '../lib/storyboard' });
    const b = tree(fresh('src', 'modules', 'video', 'deep'), {
      typeFrom: '../../../../shared/types',
      typesFrom: '../../shared/types',
    });
    expect(a).toBe(b);
    // control: a value import in types.ts is still hashed, specifier and all
    const c = tree(fresh('src', 'video'), { typesValue: './v1' });
    expect(tree(fresh('src', 'video'), { typesValue: './v2' })).not.toBe(c);
    expect(c).not.toBe(a);
  });

  it('moves when a render-affecting shared file changes', () => {
    const k = tree(fresh());
    expect(tree(fresh(), { theme: 'export const theme = 2;\n' })).not.toBe(k);
    expect(tree(fresh(), { video: 'export const Video = 2;\n' })).not.toBe(k);
  });
});

describe('the one-time key migration', () => {
  it('classifies the repo records: the five 2026-10-20 approvals, all stale', () => {
    const rows = planKeyMigration().flatMap((x) => x.rows);
    expect(rows.map((r) => `${r.topic} ${r.scene} ${r.class}`).sort()).toEqual([
      'inflation-2026 sc12 stale',
      'sovereign-citizens sc04 stale',
      'sovereign-citizens sc09 stale',
      'sovereign-citizens sc19 stale',
      'sovereign-citizens sc30 stale',
    ]);
  }, 30000);

  it('moves only a current record, keeps every other field and the stale ones, and writes once', () => {
    // a copy of a bespoke story's inputs (the registry is keyed by topic and slug) under a temp root
    const [topic, story] = ['sovereign-citizens', 'decision:courts-and-jurisdiction'];
    const root = fresh('repo');
    const [from, to] = [scriptDir(topic, story, ROOT), scriptDir(topic, story, root)];
    for (const f of [
      'script.json',
      'storyboard.json',
      'validation.json',
      'release.json',
      'evidence-package.json',
      'video/render.json',
    ]) {
      mkdirSync(dirname(join(to, f)), { recursive: true });
      copyFileSync(join(from, f), join(to, f));
    }
    const bespoke = bespokeFor('sovereign-citizens/decision-courts-and-jurisdiction');
    const seg = checkSegment({ ...loadInputs(topic, story, root), release: null }, bespoke);
    const at = (id: string) => seg.scenes.find((x) => x.scene.id === id)!;
    const legacy = (id: string) =>
      sha(toJson({ scene: at(id).scene, code: componentVersionLegacy(bespoke[at(id).kind].component) }));
    const now = (id: string) => graphicKey(at(id).scene, at(id).kind, bespoke);
    const rec = (key: string, verdict: 'approved' | 'revise', notes: string) => ({
      key,
      verdict,
      notes,
      reviewer: 'r',
      date: '2026-10-20',
    });
    const review: VisualReview = {
      scenes: {
        sc04: rec(legacy('sc04'), 'approved', 'current'),
        sc09: rec('0000000000', 'revise', ''),
        sc19: rec('1111111111', 'approved', 'approved, then the code moved'),
      },
    };
    const file = join(to, 'video', 'visual-review.json');
    writeFileSync(file, JSON.stringify(review, null, 2) + '\n');

    const plan = planKeyMigration(root);
    const row = (scene: string, cls: string) => ({
      topic,
      story,
      scene,
      kind: at(scene).kind,
      oldKey: legacy(scene),
      newKey: now(scene),
      class: cls,
    });
    expect(plan.map((x) => x.rows)).toEqual([[row('sc04', 'migrated'), row('sc09', 'stale'), row('sc19', 'stale')]]);
    expect(now('sc04')).not.toBe(legacy('sc04'));

    const trail = join(to, 'video', 'key-migration.json');
    expect(writeKeyMigration(plan, '2026-10-30')).toEqual([trail]);
    const after = JSON.parse(readFileSync(file, 'utf8')) as VisualReview;
    const { key, migratedFrom, migration, ...rest } = after.scenes.sc04;
    expect([key, migratedFrom, migration]).toEqual([now('sc04'), legacy('sc04'), KEY_MIGRATION]);
    expect(JSON.stringify(rest)).toBe(JSON.stringify({ ...review.scenes.sc04, key: undefined }));
    expect(JSON.stringify(after.scenes.sc09)).toBe(JSON.stringify(review.scenes.sc09));
    expect(JSON.stringify(after.scenes.sc19)).toBe(JSON.stringify(review.scenes.sc19));
    expect(JSON.parse(readFileSync(trail, 'utf8'))).toEqual({
      migration: KEY_MIGRATION,
      date: '2026-10-30',
      rows: plan[0].rows,
    });

    const files = [readFileSync(file, 'utf8'), readFileSync(trail, 'utf8')];
    expect(writeKeyMigration(planKeyMigration(root), '2026-10-31')).toEqual([]);
    expect([readFileSync(file, 'utf8'), readFileSync(trail, 'utf8')]).toEqual(files);
  }, 30000);
});
