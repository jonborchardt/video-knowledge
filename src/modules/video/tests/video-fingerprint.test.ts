// The bespoke-graphic fingerprint (componentVersion): it hashes the normalised sources of what draws a component, so
// a type's home or the tree's location never moves a key, and every render-affecting edit does.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { componentVersionIn, normalise } from '../render';

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

/** The fixture tree with component X replaced by `x` and the scene files `files` (name -> source, beside X). */
function custom(x: string, files: Record<string, string>): string {
  const root = fresh();
  tree(root);
  const scenes = join(root, 'remotion', 'scenes');
  put(join(scenes, 'X.tsx'), x);
  for (const [f, text] of Object.entries(files)) put(join(scenes, f), text);
  return componentVersionIn(join(root, 'remotion'), root, 'X');
}
const v1 = 'export const a = 1;\nexport type A = number;\n';
const v2 = 'export const a = 2;\nexport type A = number;\n';
/** The key moves when `dep` (imported by `x`) is edited. */
const follows = (x: string, dep: string) => custom(x, { [dep]: v1 }) !== custom(x, { [dep]: v2 });

describe('componentVersion: the runtime dependency forms (AST)', () => {
  it("follows a side-effect import: import './fx'", () => {
    expect(follows("import './fx';\nexport const X = 1;\n", 'fx.ts')).toBe(true);
  });
  it("follows re-exports: export * from './star' and export { a } from './named'", () => {
    expect(follows("export * from './star';\nexport const X = 1;\n", 'star.ts')).toBe(true);
    expect(follows("export { a } from './named';\nexport const X = 1;\n", 'named.ts')).toBe(true);
  });
  it("follows a dynamic import: import('./lazy')", () => {
    expect(follows("export const X = () => import('./lazy');\n", 'lazy.ts')).toBe(true);
  });
  it("follows a mixed import: import { type A, a } from './mixed'", () => {
    expect(follows("import { type A, a } from './mixed';\nexport const X = (n: A) => a + n;\n", 'mixed.ts')).toBe(true);
  });
  it('follows a double-quoted specifier: import { a } from "./dq"', () => {
    expect(follows('import { a } from "./dq";\nexport const X = a;\n', 'dq.ts')).toBe(true);
  });
  it("ignores import { type A } from './t' and import type A from './t': editing or moving the type's file", () => {
    for (const imp of ["import { type A } from './t';", "import type A from './t';"]) {
      const x = (from: string) => `${imp.replace('./t', from)}\nexport const X = (n: A) => n;\n`;
      const k = custom(x('./t'), { 't.ts': v1 });
      expect(custom(x('./t'), { 't.ts': v2 })).toBe(k);
      expect(custom(x('../moved/t'), { '../moved/t.ts': v1 })).toBe(k);
    }
  });
  it('normalise drops an import whose bindings are all types and a default type import, keeps a side-effect import', () => {
    const src =
      "import { type A, type B } from './a';\nimport type C from './c';\nimport './fx';\nexport { type D } from './d';\n";
    expect(normalise(src)).toBe("import './fx';\n");
  });
});
