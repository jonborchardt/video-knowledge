// Audio mixing: the music bed under the narration, done on PCM in this process. Remotion's ffmpeg build has no afade,
// aloop, sidechain or limiter filters, so the placement, looping, fades, gain, ducking and peak management are a few
// loops over Float32Arrays here; ffmpeg only decodes the inputs and encodes the result. Everything but decode and
// encode is pure and deterministic, so the tests run on synthetic buffers without media.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../shared/ffmpeg';

export const RATE = 48000;
export const CHANNELS = 2;
export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => Math.round(20 * Math.log10(g + 1e-12) * 10) / 10;

/** Interleaved stereo float samples at RATE. */
export type Pcm = Float32Array;

/** Decode any audio file to interleaved stereo f32 at RATE (through a 16-bit WAV: Remotion's ffmpeg has no float muxer,
 *  and the narration and every rendered asset are 16-bit sources anyway). */
export function decodePcm(file: string): Pcm {
  const { stdout } = run('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    file,
    '-vn',
    '-ac',
    String(CHANNELS),
    '-ar',
    String(RATE),
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    '-',
  ]);
  const data = stdout.indexOf('data', 12, 'latin1');
  if (data < 0) throw new Error(`no PCM data decoded from ${file}`);
  const bytes = stdout.subarray(data + 8);
  const n = Math.floor(bytes.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = bytes.readInt16LE(i * 2) / 32768;
  return out;
}

/** Encode interleaved stereo f32 as AAC in an mp4 container (the narration track's own format); raw f32 in, which
 *  the ffmpeg build does demux. */
export function encodeAac(pcm: Pcm, out: string) {
  const dir = mkdtempSync(join(tmpdir(), 'vk-mix-'));
  const raw = join(dir, 'mix.f32');
  try {
    writeFileSync(raw, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    run('ffmpeg', [
      '-hide_banner',
      '-v',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ar',
      String(RATE),
      '-ac',
      String(CHANNELS),
      '-i',
      raw,
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-f',
      'mp4',
      out,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface Duck {
  db: number; // gain change while a sentence is spoken (negative)
  attack: number; // seconds to reach it before speech starts
  release: number; // seconds to recover after speech ends
}
/** A cue resolved to seconds on the track. */
export interface Placement {
  id: string;
  pcm: Pcm; // the asset, decoded
  start: number; // seconds on the track
  end: number; // seconds on the track; the music stops here (or earlier, when the asset is shorter and does not loop)
  offset: number; // seconds into the asset to start from
  gain: number; // dB
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  loop: boolean;
  crossfade: number; // seconds of the asset's head blended over its cut tail at every loop seam (0: butt join)
  duck: Duck | null;
}
export type Span = [number, number]; // seconds

const DECLICK = 0.01; // the shortest fade: no cue starts or stops on a non-zero sample
const BLOCK = RATE / 100; // the ducking envelope is computed every 10 ms and interpolated between

/** Ducking gain (linear) at `t` seconds: `duck.db` inside a span, ramping in over `attack` before it and out over
 *  `release` after it; the deepest of overlapping ramps wins. */
export function duckAt(t: number, spans: Span[], duck: Duck): number {
  let depth = 0; // 0 = no duck, 1 = full
  for (const [a, b] of spans) {
    let d: number;
    if (t >= a && t <= b) d = 1;
    else if (t < a) d = duck.attack > 0 ? 1 - (a - t) / duck.attack : 0;
    else d = duck.release > 0 ? 1 - (t - b) / duck.release : 0;
    if (d > depth) depth = d;
    if (depth >= 1) break;
  }
  return depth <= 0 ? 1 : dbToGain(duck.db * depth);
}

/** Half-sine fade shape: 0 at the edge, 1 after `seconds`. */
const fade = (t: number, seconds: number) => (t >= seconds ? 1 : Math.sin((Math.PI / 2) * Math.max(0, t / seconds)));

/** Add one cue into `bus` (interleaved stereo at RATE). Returns the seconds of the track the cue actually sounded on.
 *  A looped asset repeats with period (length - crossfade): at each seam the asset's head fades in over its cut tail,
 *  equal-power, so a render that starts dry and ends mid-reverb still loops without a click. */
export function placeCue(bus: Pcm, p: Placement, speech: Span[]): Span {
  const frames = bus.length / CHANNELS;
  const srcFrames = Math.floor(p.pcm.length / CHANNELS);
  if (!srcFrames) throw new Error(`${p.id}: the asset has no audio`);
  const xf = p.loop ? Math.min(Math.round(p.crossfade * RATE), Math.floor(srcFrames / 2)) : 0;
  const period = srcFrames - xf;
  const from = Math.max(0, p.start);
  const offsetFrames = Math.min(Math.round(p.offset * RATE), srcFrames - 1);
  const available = p.loop ? Infinity : (srcFrames - offsetFrames) / RATE;
  const to = Math.min(p.end, frames / RATE, from + available);
  if (to <= from) return [from, from];
  const fadeIn = Math.max(DECLICK, p.fadeIn);
  const fadeOut = Math.max(DECLICK, p.fadeOut);
  const g = dbToGain(p.gain);
  const env = p.duck ? new Float32Array(Math.ceil(((to - from) * RATE) / BLOCK) + 2) : null;
  if (env && p.duck) for (let b = 0; b < env.length; b++) env[b] = duckAt(from + (b * BLOCK) / RATE, speech, p.duck);
  const first = Math.round(from * RATE);
  const last = Math.round(to * RATE);
  for (let i = first; i < last; i++) {
    const t = i / RATE;
    let a = g * fade(t - from, fadeIn) * fade(to - t, fadeOut);
    if (env) {
      const x = ((i - first) % BLOCK) / BLOCK;
      const b = Math.floor((i - first) / BLOCK);
      a *= env[b] * (1 - x) + env[b + 1] * x;
    }
    const pos = i - first + offsetFrames;
    let l: number;
    let r: number;
    if (pos < srcFrames && (!p.loop || pos < period)) {
      l = p.pcm[pos * CHANNELS];
      r = p.pcm[pos * CHANNELS + 1];
    } else if (!p.loop) break;
    else {
      const u = pos % period; // position in the current repeat
      const head = p.pcm[u * CHANNELS];
      const headR = p.pcm[u * CHANNELS + 1];
      if (u < xf) {
        // the seam: the previous repeat's tail (frames period..period+u) under the fresh head
        const w = Math.sin((Math.PI / 2) * (u / xf));
        const wt = Math.cos((Math.PI / 2) * (u / xf));
        l = head * w + p.pcm[(period + u) * CHANNELS] * wt;
        r = headR * w + p.pcm[(period + u) * CHANNELS + 1] * wt;
      } else {
        l = head;
        r = headR;
      }
    }
    bus[i * CHANNELS] += l * a;
    bus[i * CHANNELS + 1] += r * a;
  }
  return [from, to];
}

export function peak(pcm: Pcm): number {
  let m = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i]);
    if (v > m) m = v;
  }
  return m;
}
export function rmsDb(pcm: Pcm, fromSeconds: number, toSeconds: number): number {
  const a = Math.max(0, Math.floor(fromSeconds * RATE) * CHANNELS);
  const b = Math.min(pcm.length, Math.floor(toSeconds * RATE) * CHANNELS);
  if (b <= a) return -Infinity;
  let sq = 0;
  for (let i = a; i < b; i++) sq += pcm[i] * pcm[i];
  return gainToDb(Math.sqrt(sq / (b - a)));
}

export interface MixDown {
  pcm: Pcm;
  narrationPeakDb: number;
  musicPeakDb: number;
  peakDb: number;
  musicScale: number; // 1 unless the sum would have exceeded the ceiling; the music alone is turned down, never the voice
}
/** narration + music, with the music turned down (never the narration) until the sum stays under `ceilingDb`. */
export function mixDown(narration: Pcm, music: Pcm, ceilingDb = -1): MixDown {
  if (music.length !== narration.length) throw new Error('narration and music buses differ in length');
  const ceiling = dbToGain(ceilingDb);
  // the largest music scale that keeps every summed sample under the ceiling; a voice sample already over it is
  // the narration's own peak (loudnorm caps it at -1.5 dBTP) and says nothing about the music
  let scale = 1;
  for (let i = 0; i < narration.length; i++)
    if (Math.abs(narration[i]) < ceiling && Math.abs(narration[i] + music[i] * scale) > ceiling)
      scale = Math.max(0, (ceiling - Math.abs(narration[i])) / Math.abs(music[i]));
  const out = narration.map((v, i) => (Math.abs(v) < ceiling ? v + music[i] * scale : v));
  return {
    pcm: out,
    narrationPeakDb: gainToDb(peak(narration)),
    musicPeakDb: gainToDb(peak(music) * scale),
    peakDb: gainToDb(peak(out)),
    musicScale: Math.round(scale * 1e4) / 1e4,
  };
}
