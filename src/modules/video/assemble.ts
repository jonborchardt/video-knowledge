// Audio assembly: the rendered scene chunks concatenated without re-encoding, the narration laid on one continuous
// track from the sentence files, the soundtrack mixed under it (PCM, src/video/mix.ts), and the two muxed. Rendering
// pictures is src/video/render.ts; the soundtrack contract (cue sheet, anchors, fingerprint, mix.json) is
// src/video/music.ts. Only a full render passes a soundtrack, so a scene or range render is narration only.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toJson } from '../../shared/io';
import { concatVideo, mux, narrationTrack } from './ffmpeg';
import { CHANNELS, RATE, type Span, decodePcm, encodeAac, mixDown, placeCue, rmsDb } from './mix';
import { MIX_FILE, type MixReport, type MusicConfig, type ResolvedCue, musicFingerprint, speechSpans } from './music';
import type { Chunk } from './render';
import type { NarrationManifest, Timeline } from './types';

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

/** Mix the resolved cues under the narration track (`narrationFile`, already loudness-normalised, covering
 *  `window` seconds of the timeline) into `out` (AAC in mp4) and write the mix report next to the cue sheet. */
export function mixSoundtrack(
  narrationFile: string,
  cfg: MusicConfig,
  cues: ResolvedCue[],
  tl: Timeline,
  window: [number, number],
  out: string,
  videoDir: string,
  ceilingDb = -1,
): MixReport {
  const narration = decodePcm(narrationFile);
  const bus = new Float32Array(narration.length);
  const speech = speechSpans(tl).map((s): Span => [s[0] - window[0], s[1] - window[0]]);
  const pcm = new Map<string, Float32Array>();
  const placed: MixReport['cues'] = [];
  const frames = bus.length / CHANNELS;
  for (const c of cues) {
    if (!pcm.has(c.file)) pcm.set(c.file, decodePcm(c.file));
    // the cue on a buffer as long as its span (not the whole track), then added into the bus at its start
    const a = Math.max(0, c.start - window[0]);
    const b = Math.min(frames / RATE, c.end - window[0]);
    const solo = new Float32Array(Math.max(0, Math.round((b - a) * RATE)) * CHANNELS);
    const p = { ...c, pcm: pcm.get(c.file)!, start: 0, end: b - a };
    const sounded = solo.length
      ? placeCue(
          solo,
          p,
          speech.map((s): Span => [s[0] - a, s[1] - a]),
        )
      : [0, 0];
    const at = Math.round(a * RATE) * CHANNELS;
    for (let i = 0; i < solo.length && at + i < bus.length; i++) bus[at + i] += solo[i];
    placed.push({
      id: c.id,
      asset: c.asset,
      start: c.start,
      end: c.end,
      sounded: [sounded[0] + a + window[0], sounded[1] + a + window[0]],
      rmsDb: rmsDb(solo, sounded[0], sounded[1]),
      gain: c.gain,
      loop: c.loop,
      duck: c.duck,
    });
  }
  const m = mixDown(narration, bus, ceilingDb);
  const scaleDb = 20 * Math.log10(m.musicScale || 1e-12); // levels are reported as mixed, after the ceiling's scaling
  for (const c of placed) c.rmsDb = Math.round((c.rmsDb + scaleDb) * 10) / 10;
  encodeAac(m.pcm, out);
  const over = (x: Float32Array, spans: Span[]) => {
    // rms over a set of spans: power-weighted by length
    let sq = 0;
    let n = 0;
    for (const [a, b] of spans) {
      const d = Math.max(0, b - a);
      if (!d) continue;
      const r = rmsDb(x, a, b);
      if (r === -Infinity) continue;
      sq += Math.pow(10, r / 10) * d;
      n += d;
    }
    return n ? Math.round(10 * Math.log10(sq / n) * 10) / 10 : -Infinity;
  };
  const speechRmsDb = over(narration, speech);
  const musicDuring = over(bus, speech);
  const report: MixReport = {
    generatedAt: new Date().toISOString(),
    fingerprint: musicFingerprint(cfg, cues),
    window,
    ceilingDb,
    narrationPeakDb: m.narrationPeakDb,
    musicPeakDb: m.musicPeakDb,
    peakDb: m.peakDb,
    musicScale: m.musicScale,
    speechRmsDb,
    musicUnderSpeechDb: Math.round((musicDuring + scaleDb - speechRmsDb) * 10) / 10,
    cues: placed,
    compositions: [...new Map(cues.map((c) => [c.composition.id, c.composition])).values()].map((c) => ({
      id: c.id,
      title: c.title,
      generator: c.generator,
      source: c.source,
      licence: c.licence,
    })),
  };
  writeFileSync(join(videoDir, MIX_FILE), toJson(report));
  return report;
}
