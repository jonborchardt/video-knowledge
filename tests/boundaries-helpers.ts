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
  const base = posix.join(posix.dirname(fromRepoPath), specifier);
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
