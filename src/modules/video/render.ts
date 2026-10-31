// Rendering: the Remotion composition in src/modules/video/remotion, bundled once, rendered scene by scene into cached
// video-only chunks (assembled with the narration and soundtrack by src/modules/video/assemble.ts). A chunk's cache key is the scene with its absolute frames removed plus
// the version of the code that draws it, so a change to one scene or one component re-renders only what it touches.
// The studio preview (npm run video -- preview) uses the same entry point and timeline.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import ts from 'typescript';
import { ROOT, sha } from '../../shared/io';
import { stageBrand } from './brand';
import { brandKey } from '../../shared/look';
import { ALL_KINDS } from './kinds';
import { COMPOSITION, CONTACT } from './remotion/Root';
import type { Timeline, TimelineScene } from './types';

export const ENTRY = fileURLToPath(new URL('./remotion/index.ts', import.meta.url));
const REMOTION_DIR = fileURLToPath(new URL('./remotion/', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('./', import.meta.url));
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
const SHARED_LIB = ['types.ts', 'words.ts'];

const resolve = (f: string) => [f + '.ts', f + '.tsx'].find((x) => existsSync(x)) ?? null;
const parse = (file: string, text: string) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
/** An import or export-from statement that names only types (`import type ...`, `import { type A, type B }`,
 *  `export type { ... } from`, `export { type A } from`): erased at compile time, so it never changes pixels. */
function typeOnly(node: ts.Node): boolean {
  const allTypes = (els: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[]) =>
    els.length > 0 && els.every((e) => e.isTypeOnly);
  if (ts.isImportDeclaration(node)) {
    const c = node.importClause;
    if (!c) return false; // a side-effect import runs
    if (c.phaseModifier === ts.SyntaxKind.TypeKeyword) return true; // `import type ...`
    return !c.name && !!c.namedBindings && ts.isNamedImports(c.namedBindings) && allTypes(c.namedBindings.elements);
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    if (node.isTypeOnly) return true;
    return !!node.exportClause && ts.isNamedExports(node.exportClause) && allTypes(node.exportClause.elements);
  }
  return false;
}
/** The specifiers a module depends on at run time, in source order: static and side-effect imports, re-exports
 *  (`export * from` included), `import x = require()`, and `import()` / `require()` of a string; type-only
 *  statements are skipped (types never change pixels). */
function runtimeSpecifiers(file: string, text: string): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier) && !typeOnly(node)) out.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      out.push(node.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return out;
}
/** A module's relative runtime dependencies, resolved to files. */
const importsOf = (file: string): string[] =>
  runtimeSpecifiers(file, readFileSync(file, 'utf8'))
    .filter((s) => s.startsWith('./') || s.startsWith('../'))
    .map((s) => resolve(join(dirname(file), s)))
    .filter((f): f is string => f !== null);
/** Every module reachable from `entries` by value imports, the entries included. */
export function deepImports(entries: string[]): Set<string> {
  const seen = new Set<string>();
  for (const stack = [...entries]; stack.length;) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...importsOf(f));
  }
  return seen;
}

/** The code that draws a kind: the files every scene goes through, the kind's component file, every module it
 *  imports, and the modules those import in turn (value imports, followed to the end), so editing a chart helper
 *  re-renders the chart scenes and nothing else, however deep the helper sits. */
export function rendererVersion(kind: TimelineScene['kind']): string {
  return componentVersion(ALL_KINDS[kind].component);
}
/** A source as it draws: CRLF -> LF and every type-only import or export-from statement (the ones the scanner
 *  skips) removed with the rest of its line, so moving the tree or a type's home never moves a key. */
export function normalise(text: string, file = 'x.tsx'): string {
  const lf = text.replace(/\r\n?/g, '\n');
  let out = '';
  let at = 0;
  for (const n of parse(file, lf).statements.filter(typeOnly)) {
    out += lf.slice(at, n.getStart());
    at = n.end + /^[ \t]*\n?/.exec(lf.slice(n.end))![0].length;
  }
  return out + lf.slice(at);
}

/** The code that draws one component: the shared Remotion files, its file and its value-import closure, each
 *  normalised (a file reached only through `import type` contributes nothing). Pure over the two directories. */
export function componentVersionIn(remotionDir: string, srcDir: string, name: string): string {
  const component = join(remotionDir, 'scenes', `${name}.tsx`);
  const direct = importsOf(component);
  const deep = deepImports(direct);
  const files = [
    ...SHARED.map((f) => join(remotionDir, f)),
    ...SHARED_LIB.map((f) => join(srcDir, f)),
    component,
    ...direct,
    ...[...deep].sort(), // after the direct imports, so a key only moves when a deeper file is new or edited
  ];
  return sha([...new Set(files)].map((f) => normalise(readFileSync(f, 'utf8'), f)).join('\n---\n'));
}
/** The code that draws one component, from this tree. */
export const componentVersion = (name: string): string => componentVersionIn(REMOTION_DIR, SRC_DIR, name);

/** The scene with its absolute frames made relative to its start: moving a scene does not change its pixels. */
export function relativeScene(s: TimelineScene): TimelineScene {
  const r = (n: number) => n - s.start;
  return {
    ...s,
    start: 0,
    sentences: s.sentences.map((x) => ({
      ...x,
      start: r(x.start),
      words: x.words.map((w) => ({ ...w, frame: r(w.frame), end: r(w.end) })),
    })),
    cues: Object.fromEntries(Object.entries(s.cues).map(([k, v]) => [k, r(v)])),
  };
}
/** The kit files a scene draws from the staged brand/ folder: the end scene's cards, a Short's seal (the portrait
 *  badge on every scene when an institution publishes it), and in landscape the lockup over an opening typography
 *  scene (Text.tsx) and the seal at a transition's seam (Transition.tsx). */
export const kitSlots = (s: TimelineScene, tl: Timeline): string[] => [
  ...(s.kind === 'close-card' ? ['close-card', 'endscreen-subscribe'] : []),
  ...(tl.short?.commissionKey || (!tl.short && s.kind === 'transition') ? ['seal'] : []),
  ...(!tl.short && s.order === 1 && ['title', 'question', 'list'].includes(s.kind) ? ['lockup-horizontal-ground'] : []),
];
const kitSvg = (topic: string, slot: string) =>
  readFileSync(join(ROOT, 'brand', brandKey(topic), `${slot}.svg`), 'utf8');
export const sceneKey = (s: TimelineScene, tl: Timeline, readKit: (topic: string, slot: string) => string = kitSvg) => {
  const slots = kitSlots(s, tl);
  return sha(
    JSON.stringify({
      scene: relativeScene(s),
      fps: tl.fps,
      w: tl.width,
      h: tl.height,
      palette: tl.palette, // the theme is filled from the kit's colours
      short: tl.short ?? null, // the frame and the end card draw the institution and the question
      code: rendererVersion(s.kind),
      // a scene that draws the kit re-renders when the kit is redrawn (the committed SVGs, not the rasters);
      // absent elsewhere, so no other scene's key moves
      ...(slots.length ? { kit: slots.map((f) => sha(readKit(tl.topic, f))) } : {}),
    }),
  );
};

export interface Chunk {
  scene: TimelineScene;
  file: string;
  cached: boolean;
}
export interface RenderOptions {
  only?: string[]; // scene ids; default every scene of the timeline
  force?: boolean;
  log?: (line: string) => void;
  onProgress?: (sceneId: string, fraction: number) => void;
}

/** Render the scenes that have no current chunk into `chunksDir`; stale chunks of a scene are removed. */
export async function renderScenes(
  tl: Timeline,
  publicDir: string,
  chunksDir: string,
  opts: RenderOptions = {},
): Promise<Chunk[]> {
  mkdirSync(chunksDir, { recursive: true });
  const scenes = tl.scenes.filter((s) => !opts.only || opts.only.includes(s.id));
  const plan = scenes.map((scene) => ({ scene, file: join(chunksDir, `${scene.id}-${sceneKey(scene, tl)}.mp4`) }));
  const todo = plan.filter((p) => opts.force || !existsSync(p.file));
  const out: Chunk[] = plan.map((p) => ({ ...p, cached: !todo.includes(p) }));
  if (!todo.length) return out;
  const inputProps = tl as unknown as Record<string, unknown>;
  stageBrand(tl.topic, publicDir);
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir });
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION,
      inputProps,
      logLevel: 'error',
      puppeteerInstance: browser,
    });
    for (const p of todo) {
      for (const f of readdirSync(chunksDir))
        if (f.startsWith(`${p.scene.id}-`) && f.endsWith('.mp4')) unlinkSync(join(chunksDir, f));
      await renderMedia({
        composition,
        serveUrl,
        inputProps,
        codec: 'h264',
        muted: true,
        frameRange: [p.scene.start, p.scene.start + p.scene.duration - 1],
        outputLocation: p.file,
        logLevel: 'error',
        puppeteerInstance: browser,
        onProgress: ({ progress }) => opts.onProgress?.(p.scene.id, progress),
      });
      opts.log?.(`${p.scene.id}: rendered ${p.scene.duration} frames (${p.scene.kind})`);
    }
  } finally {
    await browser.close({ silent: true });
  }
  return out;
}

/** A contact sheet of inspection frames (paths relative to publicDir), one PNG. */
export async function renderContactSheet(frames: { file: string; label: string }[], publicDir: string, out: string) {
  const inputProps = { frames };
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir });
  const composition = await selectComposition({ serveUrl, id: CONTACT, inputProps, logLevel: 'error' });
  await renderStill({ composition, serveUrl, inputProps, output: out, imageFormat: 'png', logLevel: 'error' });
}
