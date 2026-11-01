// The tree guard (spec §4.6, layer 2): after every agent and every child step the runner diffs the tree against a
// snapshot and reverts anything outside the role's writable set, restores canaries it holds the content of, and
// reports the rest. Protection, not isolation: it detects and reverts unauthorised writes after the fact; it does
// not prevent code from running. `componentCheck` (layer 4) keeps a component that fails the browser-safe rule or
// the typecheck from being loaded by a later child.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import ts from 'typescript';
import { readJson, ROOT, sha } from '../../shared/io';

/** Repo files whose change is never the agent's to make, restored from the snapshot when the content is held. */
export const CANARIES = [
  '.env',
  '.env.*',
  '.secrets/**',
  '.claude/**',
  '.git/config',
  '.git/hooks/*',
  'package.json',
  'package-lock.json',
  'automation.json',
  'node_modules/.package-lock.json',
  // what the runner executes for every child: a rewrite of either would run agent code with the runner's keys
  'node_modules/tsx/dist/cli.mjs',
  'node_modules/typescript/lib/tsc.js',
];
/** Outside the repo: the person's own Claude settings. Reported on change, never touched. */
export const HOME_CANARIES = ['.claude/settings.json', '.claude.json'];
/** Names that are never writable, wherever they appear: an `npm run --prefix` into one would run agent code. */
const NEVER_BY_NAME = new Set(['package.json', 'package-lock.json', '.npmrc', '.gitignore', 'node_modules']);
const HOLD_BYTES = 64 * 1024;

const toPosix = (p: string) => p.replaceAll('\\', '/');

/** gitignore-style match: `**` crosses segments, `*` does not, everything else is literal; a pattern naming a
 *  folder (no glob, no extension) also matches what is under it. */
export function matchesAny(path: string, patterns: string[]): boolean {
  const p = toPosix(path);
  return patterns.some((pat) => {
    const re = new RegExp(
      '^' +
        toPosix(pat)
          .split('**')
          .map((part) =>
            part
              .split('*')
              .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
              .join('[^/]*'),
          )
          .join('.*') +
        '$',
    );
    return (
      re.test(p) || (!/[*]/.test(pat) && !/\.[a-z]+$/i.test(pat) && p.startsWith(toPosix(pat).replace(/\/$/, '') + '/'))
    );
  });
}

export interface TreeSnapshot {
  /** porcelain status by path (`M`, `A`, `??`, …) for every path that was already dirty before the agent ran. */
  status: Map<string, string>;
  /** The content hash of every path that was already dirty: a further change to it is the agent's. */
  dirtySha: Map<string, string>;
  canaries: Map<string, { sha: string; content: Buffer | null }>;
}

type Git = (args: string[], cwd: string) => string;
const runGit: Git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function porcelain(root: string, git: Git): Map<string, string> {
  const out = new Map<string, string>();
  const raw = git(['status', '--porcelain', '--untracked-files=all', '-z'], root);
  for (const entry of raw.split('\0')) {
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2).trim() || 'M';
    out.set(toPosix(entry.slice(3)), code);
  }
  return out;
}

function canaryFiles(root: string, home: string): string[] {
  const files: string[] = [];
  const addMatching = (base: string, pat: string) => {
    const dir = join(base, pat.replace(/\/?[^/]*[*].*$/, ''));
    if (!pat.includes('*')) {
      if (existsSync(join(base, pat))) files.push(join(base, pat));
      return;
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
    const walk = (d: string) => {
      for (const name of readdirSafe(d)) {
        const full = join(d, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (matchesAny(relative(base, full), [pat])) files.push(full);
      }
    };
    walk(dir);
  };
  for (const c of CANARIES) addMatching(root, c);
  for (const c of HOME_CANARIES) addMatching(home, c);
  return files;
}
const readdirSafe = (d: string): string[] => {
  try {
    return readdirSync(d);
  } catch {
    return [];
  }
};

/** JSON with every object's keys sorted, so a rewrite that reorders keys hashes the same. */
const canonical = (x: unknown): string =>
  JSON.stringify(x, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
const empty = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && Object.keys(v as object).length === 0);

/** What a canary's hash covers: the whole file, except `~/.claude.json`, which Claude Code itself rewrites on every
 *  start (counters, authored paths, a new project entry per cwd, keys in another order); of it only the
 *  permission-bearing parts count, canonically ordered, and a project entry that carries none counts for nothing. */
function canaryContent(file: string): Buffer {
  if (basename(file) !== '.claude.json') return readFileSync(file);
  try {
    const j = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const projects = (j.projects ?? {}) as Record<string, Record<string, unknown>>;
    const projection = {
      mcpServers: empty(j.mcpServers) ? null : j.mcpServers,
      permissions: empty(j.permissions) ? null : j.permissions,
      projects: Object.fromEntries(
        Object.entries(projects)
          .map(([k, p]) => [
            k,
            {
              allowedTools: empty(p.allowedTools) ? null : p.allowedTools,
              mcpServers: empty(p.mcpServers) ? null : p.mcpServers,
              hooks: empty(p.hooks) ? null : p.hooks,
            },
          ])
          .filter(([, v]) => Object.values(v as Record<string, unknown>).some((x) => x !== null)),
      ),
    };
    return Buffer.from(canonical(projection));
  } catch {
    return readFileSync(file);
  }
}

export function snapshot(root: string, opts: { git?: Git; home?: string } = {}): TreeSnapshot {
  const git = opts.git ?? runGit;
  const canaries = new Map<string, { sha: string; content: Buffer | null }>();
  for (const f of canaryFiles(root, opts.home ?? homedir())) {
    const buf = canaryContent(f);
    canaries.set(f, { sha: sha(buf), content: buf.length <= HOLD_BYTES ? buf : null });
  }
  const status = porcelain(root, git);
  const dirtySha = new Map<string, string>();
  for (const p of status.keys()) {
    const full = join(root, p);
    if (existsSync(full) && statSync(full).isFile()) dirtySha.set(p, sha(readFileSync(full)));
  }
  return { status, dirtySha, canaries };
}

export interface GuardResult {
  ok: boolean;
  reverted: string[];
  restored: string[];
  reported: string[];
  /** Changed paths inside the writable set, left in place (a graphics agent's new components go to componentCheck). */
  kept: string[];
}

/** Every path whose status changed since `before` and is outside `writable` is reverted; a changed canary is
 *  restored (or reported when its content is not held, or it lives outside the repo). */
export function guard(
  before: TreeSnapshot,
  root: string,
  writable: string[],
  opts: { newFilesOnly?: string[]; additiveOnly?: string[]; deny?: string[]; git?: Git; home?: string } = {},
): GuardResult {
  const git = opts.git ?? runGit;
  const result: GuardResult = { ok: true, reverted: [], restored: [], reported: [], kept: [] };
  const now = porcelain(root, git);
  // A file that was already dirty before the step and keeps its status code is the person's and is left alone: a
  // second modification of an `M` file cannot be told apart by status, and a stash would move their work.
  const changed = [...now.entries()].filter(([p, code]) => {
    if (before.status.get(p) !== code) return true;
    const was = before.dirtySha.get(p);
    if (was === undefined) return false;
    const full = join(root, p);
    return existsSync(full) && statSync(full).isFile() ? sha(readFileSync(full)) !== was : true;
  });
  for (const [path, code] of changed) {
    const name = basename(path);
    const byName = NEVER_BY_NAME.has(name) || path.split('/').includes('node_modules');
    const denied = matchesAny(path, opts.deny ?? []);
    const allowed = !byName && !denied && matchesAny(path, writable);
    const wasNew = code === '??' || code === 'A';
    const newOnly = matchesAny(path, opts.newFilesOnly ?? []) && !wasNew;
    const additive = matchesAny(path, opts.additiveOnly ?? []) && !wasNew && deletesLines(git, root, path);
    if (allowed && !newOnly && !additive) {
      result.kept.push(path);
      continue;
    }
    revert(git, root, path, wasNew);
    result.reverted.push(path);
  }
  for (const [file, was] of before.canaries) {
    const inRepo = !relative(root, file).startsWith('..') && !isAbsolute(relative(root, file));
    const nowSha = existsSync(file) ? sha(canaryContent(file)) : 'missing';
    if (nowSha === was.sha) continue;
    if (inRepo && was.content) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, was.content);
      result.restored.push(toPosix(relative(root, file)));
    } else result.reported.push(inRepo ? toPosix(relative(root, file)) : file);
  }
  result.ok = result.reverted.length + result.restored.length + result.reported.length === 0;
  return result;
}

function deletesLines(git: Git, root: string, path: string): boolean {
  const out = git(['diff', '--numstat', '--', path], root).trim();
  if (!out) return false;
  const deleted = Number(out.split(/\s+/)[1] ?? '0');
  return deleted > 0;
}

function revert(git: Git, root: string, path: string, wasNew: boolean): void {
  if (wasNew) rmSync(join(root, path), { recursive: true, force: true });
  else git(['checkout', '--', path], root);
}

/** The browser-safe rule over agent-written components: no static, dynamic or require import of `node:` or a
 *  builtin (a dynamic specifier built from strings that starts with `node:` counts), plus the typecheck `run`. */
export function componentCheck(
  root: string,
  changed: string[],
  run: (files: string[]) => { ok: boolean; output: string } = tscCheck,
): { ok: boolean; output: string } {
  const problems: string[] = [];
  const builtins = new Set(builtinModules);
  for (const rel of changed) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      problems.push(`${rel}: missing`);
      continue;
    }
    const src = readFileSync(full, 'utf8');
    const sf = ts.createSourceFile(
      full,
      src,
      ts.ScriptTarget.Latest,
      true,
      rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const safePrefixes = (
      readJson<{ browserSafe?: string[] }>(join(ROOT, 'tests', 'boundaries.json'))?.browserSafe ?? []
    ).map((p) => p.replace(/\.tsx?$/, ''));
    // a relative import must land in the browser-safe set (the boundary test's rule); a package import is fine
    const bad = (spec: string): string | null => {
      if (spec.startsWith('node:') || builtins.has(spec)) return `imports ${spec}`;
      if (!spec.startsWith('.')) return null;
      const target = toPosix(relative(root, join(dirname(full), spec))).replace(/\.tsx?$/, '');
      return safePrefixes.some(
        (p) => target === p || target.startsWith(p.endsWith('/') ? p : p + '/') || target.startsWith(p),
      )
        ? null
        : `imports ${spec} (${target}), outside the browser-safe set`;
    };
    const specOf = (e: ts.Expression): string | null => {
      if (ts.isStringLiteralLike(e)) return e.text;
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const l = specOf(e.left);
        const r = specOf(e.right);
        return l !== null && r !== null ? l + r : l;
      }
      if (ts.isTemplateExpression(e)) return e.head.text;
      return null;
    };
    const visit = (n: ts.Node) => {
      if (
        (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
        n.moduleSpecifier &&
        ts.isStringLiteral(n.moduleSpecifier)
      ) {
        const why = bad(n.moduleSpecifier.text);
        if (why) problems.push(`${rel}: ${why}`);
      } else if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
        if ((isImport || isRequire) && n.arguments[0]) {
          const spec = specOf(n.arguments[0]);
          if (spec === null) problems.push(`${rel}: ${isImport ? 'import()' : 'require()'} of a computed specifier`);
          else {
            const why = bad(spec);
            if (why) problems.push(`${rel}: ${why}`);
          }
        }
      }
      if (
        /\bprocess\s*\.\s*(env|binding|dlopen|mainModule)\b/.test(n.getText(sf)) &&
        n.kind === ts.SyntaxKind.PropertyAccessExpression
      )
        problems.push(`${rel}: reads process.${/process\s*\.\s*(\w+)/.exec(n.getText(sf))?.[1]}`);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  if (problems.length) return { ok: false, output: [...new Set(problems)].join('\n') };
  const r = run(changed.map((c) => join(root, c)));
  return r.ok ? { ok: true, output: '' } : { ok: false, output: r.output };
}

function tscCheck(files: string[]): { ok: boolean; output: string } {
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  const cfg = join(ROOT, '.automation', 'component-check.tsconfig.json');
  mkdirSync(dirname(cfg), { recursive: true });
  writeFileSync(
    cfg,
    JSON.stringify({ extends: join(ROOT, 'tsconfig.json').replaceAll('\\', '/'), files, include: [] }),
  );
  try {
    execFileSync(process.execPath, [tsc, '--noEmit', '-p', cfg], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: '' };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: (err.stdout ?? '') + (err.stderr ?? '') || err.message };
  }
}
