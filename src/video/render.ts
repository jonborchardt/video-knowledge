// Rendering: the Remotion composition in src/video/remotion, bundled once, rendered scene by scene into cached
// video-only chunks, then assembled: chunks concatenated without re-encoding, the narration laid on one continuous
// track from the sentence files, the two muxed. A chunk's cache key is the scene with its absolute frames removed plus
// the version of the code that draws it, so a change to one scene or one component re-renders only what it touches.
// The studio preview (npm run video -- preview) uses the same entry point and timeline.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { sha } from '../lib/script';
import { narrationTrack, concatVideo, mux } from './ffmpeg';
import { COMPONENT_FILE } from './kinds';
import { type MixReport, type MusicConfig, type ResolvedCue, mixSoundtrack } from './music';
import { COMPOSITION, CONTACT } from './remotion/Root';
import type { NarrationManifest, Timeline, TimelineScene } from './types';

export const ENTRY = fileURLToPath(new URL('./remotion/index.ts', import.meta.url));
const REMOTION_DIR = fileURLToPath(new URL('./remotion/', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('./', import.meta.url));
const SHARED = ['Root.tsx', 'Video.tsx', 'Citation.tsx', 'theme.ts', 'glyphs.tsx', 'index.ts'];
const SHARED_LIB = ['types.ts', 'words.ts'];

/** The code that draws a kind: the files every scene goes through, the kind's component file, and the modules that
 *  file imports from src/video (one level: chart.ts, cues.ts, excerpt.ts and the like), so editing a chart helper
 *  re-renders the chart scenes and nothing else. */
export function rendererVersion(kind: TimelineScene['kind']): string {
  const component = join(REMOTION_DIR, 'scenes', COMPONENT_FILE[kind]);
  const source = readFileSync(component, 'utf8');
  const imports = [...source.matchAll(/from '(\.\.?\/[^']+)'/g)]
    .map((m) => join(REMOTION_DIR, 'scenes', m[1]))
    .map((f) => (existsSync(f + '.ts') ? f + '.ts' : existsSync(f + '.tsx') ? f + '.tsx' : f))
    .filter((f) => existsSync(f));
  const files = [
    ...SHARED.map((f) => join(REMOTION_DIR, f)),
    ...SHARED_LIB.map((f) => join(SRC_DIR, f)),
    component,
    ...imports,
  ];
  return sha([...new Set(files)].map((f) => readFileSync(f, 'utf8').replace(/\r\n?/g, '\n')).join('\n---\n'));
}

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
export const sceneKey = (s: TimelineScene, tl: Timeline) =>
  sha(
    JSON.stringify({ scene: relativeScene(s), fps: tl.fps, w: tl.width, h: tl.height, code: rendererVersion(s.kind) }),
  );

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
        if (f.startsWith(p.scene.id + '-') && f.endsWith('.mp4')) unlinkSync(join(chunksDir, f));
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

/** The soundtrack to mix under the narration: the cue sheet and its cues resolved against the timeline. */
export interface Soundtrack {
  config: MusicConfig;
  cues: ResolvedCue[];
}

/** Concatenate the chunks of a contiguous run of scenes and lay the narration under them, with the soundtrack mixed
 *  in when one is given (the caller passes it for a full render only); writes `out` and, with music, video/mix.json.
 *  Returns the mix report (null without music). */
export function assemble(
  tl: Timeline,
  manifest: NarrationManifest,
  chunks: Chunk[],
  publicDir: string,
  out: string,
  loudnorm = true,
  music: Soundtrack | null = null,
): MixReport | null {
  if (!chunks.length) throw new Error('nothing to assemble');
  for (let i = 1; i < chunks.length; i++)
    if (chunks[i].scene.start !== chunks[i - 1].scene.start + chunks[i - 1].scene.duration)
      throw new Error(`chunks are not contiguous: ${chunks[i - 1].scene.id} then ${chunks[i].scene.id}`);
  const first = chunks[0].scene.start;
  const end = chunks.at(-1)!.scene.start + chunks.at(-1)!.scene.duration;
  const sentences = chunks.flatMap((c) => c.scene.sentences);
  const file = (id: string) => {
    const a = manifest.sentences.find((s) => s.id === id);
    if (!a) throw new Error(`no narration for ${id}`);
    return join(publicDir, a.file);
  };
  const slots = sentences.map((s, i) => {
    const slotStart = i === 0 ? first : s.start;
    const slotEnd = i < sentences.length - 1 ? sentences[i + 1].start : end;
    return { file: file(s.id), delay: (s.start - slotStart) / tl.fps, seconds: (slotEnd - slotStart) / tl.fps };
  });
  const video = out + '.video.mp4';
  const audio = out + '.audio.m4a';
  const mixed = out + '.mix.m4a';
  let report: MixReport | null = null;
  try {
    concatVideo(
      chunks.map((c) => c.file),
      video,
    );
    narrationTrack(slots, audio, loudnorm);
    if (music) {
      report = mixSoundtrack(audio, music.config, music.cues, tl, [first / tl.fps, end / tl.fps], mixed, publicDir);
      mux(video, mixed, out);
    } else mux(video, audio, out);
  } finally {
    for (const f of [video, audio, mixed]) if (existsSync(f)) unlinkSync(f);
  }
  return report;
}

/** A contact sheet of inspection frames (paths relative to publicDir), one PNG. */
export async function renderContactSheet(frames: { file: string; label: string }[], publicDir: string, out: string) {
  const inputProps = { frames };
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir });
  const composition = await selectComposition({ serveUrl, id: CONTACT, inputProps, logLevel: 'error' });
  await renderStill({ composition, serveUrl, inputProps, output: out, imageFormat: 'png', logLevel: 'error' });
}
