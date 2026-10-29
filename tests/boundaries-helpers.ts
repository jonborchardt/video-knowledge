import { readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { posix } from 'node:path';
import ts from 'typescript';

const EXTS = ['.ts', '.tsx', '.mjs', '.js', '.astro'];

// The code the TypeScript scanner should see: an .astro file is its frontmatter only.
function codeOf(repoPath: string, source: string): string {
  if (!repoPath.endsWith('.astro')) return source;
  const start = source.indexOf('---\n');
  if (start < 0) return '';
  const rest = source.slice(start + 4);
  const end = rest.indexOf('\n---');
  return end < 0 ? rest : rest.slice(0, end);
}

export function importsOf(repoPath: string, source: string): string[] {
  return ts.preProcessFile(codeOf(repoPath, source), true, true).importedFiles.map((f) => f.fileName);
}

// Named bindings imported (or re-exported) from one specifier; '*' for a default or namespace import.
export function importedNames(source: string, specifier: string): string[] | '*' {
  const sf = ts.createSourceFile(
    'x.ts',
    source.startsWith('---\n') ? codeOf('x.astro', source) : source,
    ts.ScriptTarget.Latest,
    true,
  );
  const names: string[] = [];
  let all = false;
  ts.forEachChild(sf, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === specifier
    ) {
      const c = node.importClause;
      if (!c) return;
      if (c.name) all = true;
      const nb = c.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) all = true;
      else if (nb) for (const el of nb.elements) names.push((el.propertyName ?? el.name).text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === specifier
    ) {
      const ec = node.exportClause;
      if (ec && ts.isNamedExports(ec)) for (const el of ec.elements) names.push((el.propertyName ?? el.name).text);
      else all = true;
    }
  });
  return all ? '*' : names;
}

// Every simple cycle once: each is found from its smallest node, through larger ones only.
export function cycles(edges: { from: string; to: string }[]): string[][] {
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const out: string[][] = [];
  for (const start of [...next.keys()].sort()) {
    const dfs = (node: string, path: string[]) => {
      for (const to of next.get(node) ?? []) {
        if (to === start) out.push([...path, start]);
        else if (to > start && !path.includes(to)) dfs(to, [...path, to]);
      }
    };
    dfs(start, [start]);
  }
  return out;
}

export function resolveSpecifier(
  fromRepoPath: string,
  specifier: string,
  exists: (p: string) => boolean,
): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = posix.join(posix.dirname(fromRepoPath), specifier.replace(/\?.*$/, ''));
  const candidates = [base, ...EXTS.map((e) => base + e), `${base}/index.ts`];
  return candidates.find(exists) ?? null;
}

export function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith('node:') || builtinModules.includes(specifier);
}

export function capabilityOf(repoPath: string, map: Record<string, string>): string | undefined {
  const prefix = Object.keys(map)
    .filter((p) => repoPath.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix === undefined) return undefined;
  const cap = map[prefix];
  return cap === '@folder' ? repoPath.slice(prefix.length).split('/')[0] : cap;
}

export function walk(dirs: string[], root: string): string[] {
  const out: string[] = [];
  const visit = (rel: string) => {
    for (const e of readdirSync(posix.join(root, rel), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'tests') continue;
      const p = posix.join(rel, e.name);
      if (e.isDirectory()) visit(p);
      else if (EXTS.some((x) => e.name.endsWith(x))) out.push(p);
    }
  };
  for (const d of dirs) visit(d);
  return out;
}

export type Edge = { from: string; to: string };
export type Violation = Edge & { rule: string };
export type BoundariesConfig = {
  capabilities: Record<string, string>;
  browserSafe: string[];
  layoutOwner: string;
  readApi: Record<string, string[]>;
  edges: Edge[];
};
type FileRecord = { path: string; imports: string[]; source?: string };
type Ctx = { f: FileRecord; to: string; cfg: BoundariesConfig; fromCap?: string; toCap?: string };

// ponytail: a resolved import is a repo file when it has a source extension; a package like 'x.js' would be misread.
const isRepoFile = (to: string) => EXTS.some((e) => to.endsWith(e)) && !to.startsWith('@');
const moduleIndex = (to: string) => /^src\/modules\/[^/]+\/index\.ts$/.test(to);

// The names this file imports from the module `to` (the statement whose specifier resolves to it).
function namesImported(f: FileRecord, to: string): string[] | '*' | undefined {
  const spec = importsOf(f.path, f.source ?? '').find((s) => resolveSpecifier(f.path, s, (p) => p === to) === to);
  return spec === undefined ? undefined : importedNames(f.source ?? '', spec);
}

// An import of a read-API module index that names only exported read-API names.
function readApiOk({ f, to, cfg }: Ctx): boolean {
  if (!moduleIndex(to)) return false;
  const allowed = cfg.readApi[to.split('/')[2]];
  const names = allowed && namesImported(f, to);
  return Array.isArray(names) && names.length > 0 && names.every((n) => allowed.includes(n));
}

function crossCapability(c: Ctx): Violation | null {
  const { f, to, fromCap, toCap } = c;
  if (!isRepoFile(to) || !fromCap || !toCap || fromCap === toCap) return null;
  if (fromCap === 'shared' || toCap === 'shared' || fromCap === 'orchestration') return null;
  if (fromCap === 'website' && moduleIndex(to)) return null;
  if (readApiOk(c)) return null;
  return { from: f.path, to, rule: 'cross-capability' };
}

function sharedImportsModule({ f, to, fromCap, toCap }: Ctx): Violation | null {
  return fromCap === 'shared' && isRepoFile(to) && toCap && toCap !== 'shared'
    ? { from: f.path, to, rule: 'shared-imports-module' }
    : null;
}

function orchestrationImportsInternal({ f, to, fromCap, toCap }: Ctx): Violation | null {
  if (fromCap !== 'orchestration') return null;
  const internal = to.startsWith('src/modules/')
    ? !moduleIndex(to)
    : /^src\/(lib|video)\//.test(to) && toCap !== 'shared' && toCap !== 'orchestration';
  return internal ? { from: f.path, to, rule: 'orchestration-imports-internal' } : null;
}

function browserSafe({ f, to, cfg }: Ctx): Violation | null {
  const safe = (p: string) => cfg.browserSafe.some((b) => p.startsWith(b));
  if (!safe(f.path)) return null;
  const bad = isNodeBuiltin(to) || (isRepoFile(to) && !safe(to));
  return bad ? { from: f.path, to, rule: 'browser-safe' } : null;
}

function unmappedTarget({ f, to, toCap }: Ctx): Violation | null {
  return isRepoFile(to) && !toCap ? { from: f.path, to, rule: 'unmapped' } : null;
}

// Once per file: TOPICS imported from the layout owner, or a join(..., 'topics', ...).
function layout(f: FileRecord, cfg: BoundariesConfig): Violation | null {
  if (f.path === cfg.layoutOwner) return null;
  const source = f.source ?? '';
  const names = f.imports.includes(cfg.layoutOwner) ? namesImported(f, cfg.layoutOwner) : undefined;
  const uses = (Array.isArray(names) && names.includes('TOPICS')) || /\bjoin\([^)]*'topics'/.test(source);
  return uses ? { from: f.path, to: cfg.layoutOwner, rule: 'layout' } : null;
}

export function violations(files: FileRecord[], cfg: BoundariesConfig): Violation[] {
  const out: Violation[] = [];
  const readApiEdges: Edge[] = [];
  for (const f of files) {
    const fromCap = capabilityOf(f.path, cfg.capabilities);
    if (!fromCap) {
      out.push({ from: f.path, to: f.path, rule: 'unmapped' });
      continue;
    }
    for (const to of f.imports) {
      const c: Ctx = { f, to, cfg, fromCap, toCap: capabilityOf(to, cfg.capabilities) };
      const hits = [unmappedTarget, crossCapability, sharedImportsModule, orchestrationImportsInternal, browserSafe]
        .map((rule) => rule(c))
        .filter((v): v is Violation => v !== null);
      out.push(...hits);
      if (c.toCap && c.toCap !== fromCap && fromCap !== 'orchestration' && readApiOk(c)) {
        readApiEdges.push({ from: fromCap, to: c.toCap });
      }
    }
    const l = layout(f, cfg);
    if (l) out.push(l);
  }
  for (const [from, to] of cycles([...new Map(readApiEdges.map((e) => [`${e.from}->${e.to}`, e])).values()]))
    out.push({ from, to, rule: 'read-api-cycle' });
  return out;
}

const NEVER_ALLOWED = ['unmapped', 'read-api-cycle'];

export function check(found: Violation[], allow: Edge[]): { unexpected: Violation[]; stale: Edge[] } {
  const listed = (v: Violation) => allow.some((a) => a.from === v.from && a.to === v.to);
  return {
    unexpected: found.filter((v) => NEVER_ALLOWED.includes(v.rule) || !listed(v)),
    stale: allow.filter((a) => !found.some((v) => v.from === a.from && v.to === a.to)),
  };
}
