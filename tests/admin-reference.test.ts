// The admin Objects tab's reference data (M3 2.4): every module folder is in the catalog and in src/modules/README.md,
// every read-API name of tests/boundaries.json is listed under its module, every object box names an existing module
// and every edge joins two boxes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/shared/io';
import { cols, edges, moduleCatalog } from '../src/admin/objects';

const folders = readdirSync(join(ROOT, 'src', 'modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const catalog = moduleCatalog(ROOT);
const boxes = cols.flatMap((c) => c.boxes);

describe('the module catalog', () => {
  it('lists every folder under src/modules/, and the modules README names each one', () => {
    const readme = readFileSync(join(ROOT, 'src', 'modules', 'README.md'), 'utf8');
    for (const f of folders) {
      const m = catalog.find((e) => e.name === f);
      expect(m, f).toBeTruthy();
      expect(m!.kind).toBe('module');
      expect(m!.responsibility.length, `${f}: a one-paragraph README lead`).toBeGreaterThan(20);
      expect(m!.paths.length, `${f}: a row in src/modules/README.md`).toBeGreaterThan(0);
      expect(readme).toMatch(new RegExp(`^\\| ${f} +\\|`, 'm'));
    }
    expect(catalog.filter((e) => e.kind === 'shared')).toHaveLength(1);
    expect(catalog.filter((e) => e.kind === 'orchestration')).toHaveLength(1);
    expect(catalog.find((e) => e.name === 'orchestration')!.responsibility).toMatch(/derived state/i);
  });
  it('lists every read API name under its module', () => {
    const b = JSON.parse(readFileSync(join(ROOT, 'tests', 'boundaries.json'), 'utf8')) as {
      readApi: Record<string, string[]>;
    };
    for (const [m, names] of Object.entries(b.readApi)) {
      const e = catalog.find((x) => x.name === m);
      expect(e, m).toBeTruthy();
      for (const n of names) expect(e!.readApi, `${m}.${n}`).toContain(n);
    }
  });
  it('the modules README has no "future" module: topic-discovery and social exist', () => {
    const readme = readFileSync(join(ROOT, 'src', 'modules', 'README.md'), 'utf8');
    expect(readme).not.toMatch(/\(future\)/);
    expect(existsSync(join(ROOT, 'src', 'modules', 'topic-discovery', 'index.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'src', 'modules', 'social', 'index.ts'))).toBe(true);
  });
});

describe('the object boxes', () => {
  it('each names an existing module (or shared, orchestration), a writer, a validity rule and a file; ids are unique', () => {
    const known = new Set([...folders, 'shared', 'orchestration']);
    const ids = boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of boxes) {
      expect(known.has(b.owner), `${b.id}: owner ${b.owner}`).toBe(true);
      expect(b.writer.length, b.id).toBeGreaterThan(5);
      expect(b.valid.length, b.id).toBeGreaterThan(10);
      expect(b.file.length, b.id).toBeGreaterThan(3);
      expect(b.d).toHaveLength(2);
    }
  });
  it('covers the M2 and M3 objects the plan names, and every edge joins two boxes', () => {
    for (const id of [
      'proposal',
      'preview',
      'batch',
      'markers',
      'scan',
      'areq',
      'notes',
      'manifest',
      'approval',
      'shadow',
      'launch',
      'disc',
      'attempt',
      'readiness',
    ])
      expect(
        boxes.some((b) => b.id === id),
        id,
      ).toBe(true);
    const ids = new Set(boxes.map((b) => b.id));
    for (const e of edges) {
      expect(ids.has(e.from), `${e.from} -> ${e.to}`).toBe(true);
      expect(ids.has(e.to), `${e.from} -> ${e.to}`).toBe(true);
    }
    // every module with objects is linked from them, and lists them back
    for (const m of catalog) for (const b of m.objects) expect(b.owner).toBe(m.name);
  });
});
