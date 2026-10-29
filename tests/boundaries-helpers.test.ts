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

import { check, violations } from './boundaries-helpers';
const cfg = {
  capabilities: {
    'src/lib/io.ts': 'shared',
    'src/lib/article.ts': 'article',
    'src/lib/publish.ts': 'publishing',
    'src/lib/production.ts': 'orchestration',
    'src/modules/': '@folder',
    'src/video/': 'video',
    'src/shared/': 'shared',
  },
  browserSafe: ['src/video/remotion/', 'src/video/types.ts'],
  layoutOwner: 'src/lib/io.ts',
  readApi: {} as Record<string, string[]>,
  edges: [],
};
// imports are given resolved; the helper derives the specifier from `source` when it needs names (relative paths in these fixtures)
const file = (path: string, imports: string[], source = '') => ({ path, imports, source });

describe('violations', () => {
  it('flags a cross-capability import and allows shared', () => {
    const v = violations([file('src/lib/article.ts', ['src/lib/publish.ts', 'src/lib/io.ts'])], cfg);
    expect(v).toEqual([{ from: 'src/lib/article.ts', to: 'src/lib/publish.ts', rule: 'cross-capability' }]);
  });
  it('lets orchestration import a module index only', () => {
    const v = violations(
      [file('src/lib/production.ts', ['src/modules/article/index.ts', 'src/modules/article/state.ts'])],
      cfg,
    );
    expect(v.map((x) => x.rule)).toEqual(['orchestration-imports-internal']);
  });
  it('allows a read-API index only for listed names', () => {
    const src = `import { urlOf } from '../website/index';`;
    const f = [file('src/modules/packaging/package.ts', ['src/modules/website/index.ts'], src)];
    expect(violations(f, { ...cfg, readApi: {} })).toHaveLength(1);
    expect(violations(f, { ...cfg, readApi: { website: ['urlOf'] } })).toEqual([]);
    expect(violations(f, { ...cfg, readApi: { website: ['contentGraph'] } })).toHaveLength(1); // urlOf not listed
    const star = [
      file(
        'src/modules/packaging/package.ts',
        ['src/modules/website/index.ts'],
        `import * as w from '../website/index';`,
      ),
    ];
    expect(violations(star, { ...cfg, readApi: { website: ['urlOf'] } })).toHaveLength(1);
    const internal = [
      file(
        'src/modules/packaging/package.ts',
        ['src/modules/website/graph.ts'],
        `import { urlOf } from '../website/graph';`,
      ),
    ];
    expect(violations(internal, { ...cfg, readApi: { website: ['urlOf'] } })).toHaveLength(1);
  });
  it('flags a cycle between read APIs', () => {
    const a = file('src/modules/a/x.ts', ['src/modules/b/index.ts'], `import { fb } from '../b/index';`);
    const b = file('src/modules/b/y.ts', ['src/modules/a/index.ts'], `import { fa } from '../a/index';`);
    const v = violations([a, b], { ...cfg, readApi: { a: ['fa'], b: ['fb'] } });
    expect(v.map((x) => x.rule)).toEqual(['read-api-cycle']);
  });
  it('flags shared importing a module', () => {
    expect(violations([file('src/shared/types.ts', ['src/lib/article.ts'])], cfg)[0].rule).toBe(
      'shared-imports-module',
    );
  });
  it('flags a node import in a browser-safe file', () => {
    const v = violations(
      [file('src/video/remotion/Video.tsx', ['node:fs', 'src/video/types.ts', 'src/video/render.ts'])],
      cfg,
    );
    expect(v.map((x) => `${x.to}:${x.rule}`)).toEqual(['node:fs:browser-safe', 'src/video/render.ts:browser-safe']);
  });
  it('flags TOPICS and a topics join outside the layout owner', () => {
    const src = `import { TOPICS } from './io';\nconst p = join(root, 'topics', t);`;
    const v = violations([file('src/lib/article.ts', ['src/lib/io.ts'], src)], cfg);
    expect(v.filter((x) => x.rule === 'layout')).toHaveLength(1);
  });
  it('flags an unmapped file', () => {
    const v = violations([file('src/lib/new-thing.ts', [])], cfg);
    expect(v[0]).toMatchObject({ from: 'src/lib/new-thing.ts', rule: 'unmapped' });
  });
});

describe('check', () => {
  const v = [{ from: 'a', to: 'b', rule: 'cross-capability' }];
  it('separates unexpected and stale', () => {
    expect(check(v, [{ from: 'a', to: 'b' }])).toEqual({ unexpected: [], stale: [] });
    expect(check(v, [])).toEqual({ unexpected: v, stale: [] });
    expect(check([], [{ from: 'a', to: 'b' }])).toEqual({ unexpected: [], stale: [{ from: 'a', to: 'b' }] });
  });
  it('never allowlists unmapped', () => {
    const u = [{ from: 'x', to: 'x', rule: 'unmapped' }];
    expect(check(u, [{ from: 'x', to: 'x' }]).unexpected).toEqual(u);
  });
});
