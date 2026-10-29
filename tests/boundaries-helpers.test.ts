import { describe, expect, it } from 'vitest';
import { capabilityOf, cycles, importedNames, importsOf, isNodeBuiltin, resolveSpecifier } from './boundaries-helpers';

describe('importsOf', () => {
  it('lists static, type-only, export-from, dynamic and require specifiers', () => {
    const src =
      `import { a } from './a';\nimport type { B } from './b';\nexport { c } from './c';\n` +
      `const d = await import('./d');\nconst e = require('./e');\nimport fs from 'node:fs';`;
    expect(importsOf('src/lib/x.ts', src).sort()).toEqual(['./a', './b', './c', './d', './e', 'node:fs']);
  });
  it('reads only the frontmatter of an .astro file', () => {
    const src = `---\nimport { x } from '../lib/publish';\n---\n<script>import('./client')</script>`;
    expect(importsOf('src/pages/p.astro', src)).toEqual(['../lib/publish']);
  });
});

describe('importedNames', () => {
  it('lists named bindings for one specifier', () => {
    const src = `import { loadTopic, type Topic } from '../evidence/index';\nimport { x as y } from './z';\nexport { urlOf } from '../website/index';`;
    expect(importedNames(src, '../evidence/index')).toEqual(['loadTopic', 'Topic']);
    expect(importedNames(src, './z')).toEqual(['x']);
    expect(importedNames(src, '../website/index')).toEqual(['urlOf']);
  });
  it('reports a namespace or default import as *', () => {
    expect(importedNames(`import * as ev from './ev';`, './ev')).toBe('*');
    expect(importedNames(`import ev from './ev';`, './ev')).toBe('*');
  });
});

describe('cycles', () => {
  it('finds a cycle and none in a DAG', () => {
    expect(
      cycles([
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ]),
    ).toEqual([['a', 'b', 'a']]);
    expect(
      cycles([
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ]),
    ).toEqual([]);
  });
});

describe('resolveSpecifier', () => {
  const exists = (p: string) => ['src/lib/io.ts', 'src/video/remotion/index.ts', 'src/config/site.ts'].includes(p);
  it('adds .ts', () => expect(resolveSpecifier('src/lib/script.ts', './io', exists)).toBe('src/lib/io.ts'));
  it('resolves a folder to index.ts', () =>
    expect(resolveSpecifier('src/video/render.ts', './remotion', exists)).toBe('src/video/remotion/index.ts'));
  it('walks up', () =>
    expect(resolveSpecifier('src/pages/a/b.astro', '../../config/site', exists)).toBe('src/config/site.ts'));
  it('returns null for a package', () => expect(resolveSpecifier('src/lib/io.ts', 'vitest', exists)).toBeNull());
});

describe('isNodeBuiltin', () => {
  it('knows node: and bare builtins', () => {
    expect(isNodeBuiltin('node:fs')).toBe(true);
    expect(isNodeBuiltin('path')).toBe(true);
    expect(isNodeBuiltin('remotion')).toBe(false);
  });
});

describe('capabilityOf', () => {
  const map = { 'src/lib/': 'lib', 'src/lib/io.ts': 'shared', 'src/modules/': '@folder' };
  it('prefers the longest prefix', () => expect(capabilityOf('src/lib/io.ts', map)).toBe('shared'));
  it('reads the module folder', () => expect(capabilityOf('src/modules/article/index.ts', map)).toBe('article'));
  it('is undefined for an unmapped file', () => expect(capabilityOf('src/other.ts', map)).toBeUndefined());
});
