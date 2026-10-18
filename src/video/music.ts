// The soundtrack contract: compositions (reusable rendered music assets, in music/<composition>/) and cues
// (<topic>/scripts/<slug>/video/music.json: which asset plays from which scene to which scene, how loud, how it fades
// and ducks). Cues are anchored to scene ids, never to seconds, so a re-narrated or re-timed scene moves the music
// with it. The composition is produced elsewhere (strudel-bench); this file only validates, places and fingerprints,
// and src/video/assemble.ts does the mixing.
//
//   video section -> music cue -> composition/variation -> rendered audio asset (music/<composition>/<variation>.wav)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, sha } from '../lib/io';
import type { Duck, Span } from './mix';
import type { Timeline } from './types';

export const MUSIC_DIR = 'music'; // repo root: compositions shared by every video
export const MUSIC_CONFIG = 'music.json'; // in the video dir: the cues of one video
export const MIX_FILE = 'mix.json'; // in the video dir: what the last mix did (derived; the report and QA read it)
export const COMPOSITION_FILE = 'composition.json';

/** One rendered variation of a composition: a WAV plus how it was made. */
export interface Variation {
  file: string; // relative to the composition dir
  sha: string; // of the WAV bytes, so a cue never plays a file other than the one the manifest describes
  seconds: number; // measured
  cycles: number; // whole Strudel cycles rendered, so the file loops on a bar boundary
  loop: boolean; // may be repeated: it is whole cycles, so the seam falls on a bar
  crossfade: number; // seconds of head to blend over the cut tail at each seam (strudel-bench renders start dry and stop mid-reverb)
  intensity?: string; // the composition's own word for it: 'low', 'pulse', 'full', ...
  command: string; // how to regenerate it in the generator repo
  renderedAt: string;
}
/** music/<composition>/composition.json, written by the generator's export (or by hand from its output). */
export interface Composition {
  id: string; // directory name
  title: string;
  generator: { name: string; repo: string; version: string }; // repo URL and the commit the render came from
  source: { file: string; sha: string; cps: number; bpm: number; key: string }; // the Strudel source
  licence: {
    cleared: boolean; // every sound source is licensed for a published, monetised video
    samples: { pack: string; licence: string; source: string; attribution?: string }[];
    attribution: string[]; // lines the video description must carry, if any
    notes?: string;
  };
  variations: Record<string, Variation>;
}

export interface MusicCue {
  id: string;
  asset: string; // "<composition>/<variation>"
  /** Scene anchors: "sc12" (the scene's start for `from`, its end for `to`), "sc12:start", "sc12:end", with an
   *  optional offset in seconds: "sc12+1.5", "sc20:end-2". */
  from: string;
  to: string;
  gain: number; // dB applied to the asset (music beds sit well under narration: -18 to -30)
  fadeIn?: number; // seconds, default 1
  fadeOut?: number; // seconds, default 2
  loop?: boolean; // repeat the asset to fill the span (default: the variation's own loop flag)
  offset?: number; // seconds into the asset to start from (default 0)
  duck?: Duck | null; // null: no ducking for this cue even when the file sets a default
}
export interface MusicConfig {
  duck?: Duck; // default ducking under speech for every cue that does not say otherwise
  cues: MusicCue[];
}

export interface ResolvedCue {
  id: string;
  asset: string;
  composition: Composition;
  variation: Variation;
  file: string; // absolute path to the WAV
  start: number; // seconds on the timeline
  end: number;
  offset: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  crossfade: number;
  duck: Duck | null;
}

const ANCHOR = /^(\w+?)(?::(start|end))?([+-]\d+(?:\.\d+)?)?$/;
export function parseAnchor(
  a: string,
  edge: 'start' | 'end',
): { scene: string; edge: 'start' | 'end'; offset: number } {
  const m = ANCHOR.exec(a.trim());
  if (!m) throw new Error(`bad anchor "${a}": expected <scene id>[:start|:end][+/-seconds]`);
  return { scene: m[1], edge: (m[2] as 'start' | 'end' | undefined) ?? edge, offset: Number(m[3] ?? 0) };
}
export function anchorSeconds(a: string, edge: 'start' | 'end', tl: Timeline): number {
  const p = parseAnchor(a, edge);
  const s = tl.scenes.find((x) => x.id === p.scene);
  if (!s) throw new Error(`anchor "${a}": scene ${p.scene} is not in the timeline`);
  const at = p.edge === 'start' ? s.start : s.start + s.duration;
  return Math.max(0, Math.min(tl.durationInFrames / tl.fps, at / tl.fps + p.offset));
}

export function loadComposition(id: string, root = process.cwd()): Composition {
  const dir = join(root, MUSIC_DIR, id);
  const c = readJson<Composition>(join(dir, COMPOSITION_FILE));
  if (!c) throw new Error(`no ${MUSIC_DIR}/${id}/${COMPOSITION_FILE}`);
  if (c.id !== id) throw new Error(`${MUSIC_DIR}/${id}: composition.json says id "${c.id}"`);
  return c;
}

/** Resolve every cue of `cfg` against the timeline and the composition manifests on disk; throws listing every
 *  problem (a missing asset, an unknown scene, an end before a start, a WAV whose bytes are not the manifest's). */
export function resolveCues(cfg: MusicConfig, tl: Timeline, root = process.cwd()): ResolvedCue[] {
  const problems: string[] = [];
  const out: ResolvedCue[] = [];
  const seen = new Set<string>();
  const comps = new Map<string, Composition>();
  for (const cue of cfg.cues ?? []) {
    const bad = (why: string) => problems.push(`cue ${cue.id ?? '?'}: ${why}`);
    if (!cue.id) bad('no id');
    else if (seen.has(cue.id)) bad('duplicate id');
    seen.add(cue.id);
    const [compId, varId, extra] = (cue.asset ?? '').split('/');
    if (!compId || !varId || extra) {
      bad(`asset "${cue.asset}" is not <composition>/<variation>`);
      continue;
    }
    let comp = comps.get(compId);
    if (!comp) {
      try {
        comp = loadComposition(compId, root);
        comps.set(compId, comp);
      } catch (e) {
        bad(e instanceof Error ? e.message : String(e));
        continue;
      }
    }
    const v = comp.variations[varId];
    if (!v) {
      bad(`${compId} has no variation "${varId}" (${Object.keys(comp.variations).join(', ')})`);
      continue;
    }
    const file = join(root, MUSIC_DIR, compId, v.file);
    if (!existsSync(file)) bad(`${MUSIC_DIR}/${compId}/${v.file} is missing; regenerate it: ${v.command}`);
    else if (sha(readFileSync(file)) !== v.sha)
      bad(`${MUSIC_DIR}/${compId}/${v.file} is not the file the manifest describes (sha)`);
    let span: [number, number];
    try {
      span = [anchorSeconds(cue.from, 'start', tl), anchorSeconds(cue.to, 'end', tl)];
    } catch (e) {
      bad(e instanceof Error ? e.message : String(e));
      continue;
    }
    const [start, end] = span;
    if (end <= start) bad(`ends (${end.toFixed(2)}s) before it starts (${start.toFixed(2)}s)`);
    if (typeof cue.gain !== 'number' || cue.gain > 0) bad(`gain must be a number of dB at or below 0, not ${cue.gain}`);
    const duck = cue.duck === null ? null : (cue.duck ?? cfg.duck ?? null);
    if (duck && !(duck.db <= 0 && duck.attack >= 0 && duck.release >= 0))
      bad('duck needs db <= 0, attack >= 0, release >= 0');
    out.push({
      id: cue.id,
      asset: cue.asset,
      composition: comp,
      variation: v,
      file,
      start,
      end,
      offset: cue.offset ?? 0,
      gain: cue.gain,
      fadeIn: cue.fadeIn ?? 1,
      fadeOut: cue.fadeOut ?? 2,
      loop: cue.loop ?? v.loop,
      crossfade: v.crossfade ?? 0,
      duck,
    });
  }
  if (problems.length) throw new Error(`music.json:\n  ${problems.join('\n  ')}`);
  return out;
}

/** The spans of the timeline in which a sentence is spoken, in seconds (what ducking follows). */
export const speechSpans = (tl: Timeline): Span[] =>
  tl.scenes.flatMap((s) => s.sentences.map((x): Span => [x.start / tl.fps, x.start / tl.fps + x.audioSeconds]));

/** What the mixed track depends on: the cue file, the asset bytes and the scene timing. Changing any of these means
 *  the audio must be mixed again; changing none of the visuals is involved, so the chunk cache is untouched. */
export const musicFingerprint = (cfg: MusicConfig, cues: ResolvedCue[]) =>
  sha(JSON.stringify({ cfg, assets: cues.map((c) => [c.asset, c.variation.sha, c.start, c.end]) }));

export function loadMusicConfig(videoDir: string): MusicConfig | null {
  return readJson<MusicConfig>(join(videoDir, MUSIC_CONFIG));
}

/** What the last mix did: video/mix.json, read by the build report, the QA and the production board. */
export interface MixReport {
  generatedAt: string;
  fingerprint: string; // musicFingerprint: the cue sheet and the asset bytes it placed
  window: [number, number]; // seconds of the timeline the track covers
  ceilingDb: number;
  narrationPeakDb: number;
  musicPeakDb: number;
  peakDb: number;
  musicScale: number;
  speechRmsDb: number; // the narration while sentences are spoken
  musicUnderSpeechDb: number; // music bus level during speech, relative to the narration: how far under the voice it sits
  cues: {
    id: string;
    asset: string;
    start: number;
    end: number;
    sounded: [number, number]; // where it actually played (an unlooped asset may stop early)
    rmsDb: number; // of this cue alone, over where it sounded
    gain: number;
    loop: boolean;
    duck: Duck | null;
  }[];
  compositions: Pick<Composition, 'id' | 'title' | 'generator' | 'source' | 'licence'>[];
}
