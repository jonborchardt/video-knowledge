// Narration: one audio file per sentence, cached by provider, voice, rate and text, with the measured duration and the
// provider's word boundaries in video/narration.json. Changing the visuals never regenerates speech; changing a
// sentence, the voice or the rate regenerates only that sentence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, sha, toJson } from '../lib/script';
import { probe } from './ffmpeg';
import type { Segment } from './select';
import { VIDEO_FILES } from './select';
import { type TtsProvider, provider as defaultProvider } from './tts';
import type { NarrationManifest, SentenceAudio } from './types';

export const NARRATION_DIR = 'narration';
export const narrationKey = (voice: Segment['config']['voice'], text: string) =>
  sha(`${voice.provider}|${voice.voice}|${voice.rate}|${text}`);
export const narrationFingerprint = (m: NarrationManifest) =>
  sha(m.sentences.map((s) => `${s.id}:${s.sha}`).join('\n'));

export interface NarrateOptions {
  force?: boolean; // regenerate even when cached
  tts?: TtsProvider;
  log?: (line: string) => void;
}

/** Resolve or generate the audio for every sentence of the segment; writes <videoDir>/narration.json and returns it. */
export function narrate(seg: Segment, videoDir: string, opts: NarrateOptions = {}): NarrationManifest {
  const voice = seg.config.voice;
  const tts = opts.tts ?? defaultProvider(voice.provider);
  const log = opts.log ?? (() => {});
  const old = readJson<NarrationManifest>(join(videoDir, VIDEO_FILES.narration));
  const cached = new Map((old?.sentences ?? []).map((s) => [s.file, s]));
  mkdirSync(join(videoDir, NARRATION_DIR), { recursive: true });
  let model: string | undefined = old?.model;
  let format = old?.format ?? '';
  const out: SentenceAudio[] = seg.sentences.map((s) => {
    const key = narrationKey(voice, s.text);
    const base = `${NARRATION_DIR}/${s.id}-${key}`;
    const hit = [...cached.values()].find((c) => c.file.startsWith(base + '.') && c.text === s.text);
    if (hit && !opts.force && existsSync(join(videoDir, hit.file))) {
      const bytes = readFileSync(join(videoDir, hit.file));
      if (sha(bytes) === hit.sha) {
        log(`${s.id}: cached ${hit.file} (${hit.duration}s)`);
        return { ...hit, fingerprint: s.fingerprint };
      }
    }
    const r = tts.synthesize(s.text, voice.voice, voice.rate, join(videoDir, base));
    const file = `${base}.${r.format}`;
    const bytes = readFileSync(join(videoDir, file));
    const duration = probe(join(videoDir, file)).duration;
    if (!(duration > 0)) throw new Error(`${s.id}: ${file} has no measurable duration`);
    const last = r.words.at(-1);
    if (last && last.end > duration + 0.05)
      throw new Error(`${s.id}: last word ends at ${last.end}s but the audio is ${duration}s: truncated`);
    model = r.model ?? model;
    format = r.format;
    log(`${s.id}: synthesised ${file} (${duration.toFixed(2)}s, ${r.words.length} boundaries)`);
    return { id: s.id, text: s.text, fingerprint: s.fingerprint, file, sha: sha(bytes), duration, words: r.words };
  });
  const manifest: NarrationManifest = {
    provider: tts.id,
    voice: voice.voice,
    rate: voice.rate,
    ...(model ? { model } : {}),
    format,
    generatedAt: new Date().toISOString(),
    sentences: out,
  };
  writeFileSync(join(videoDir, VIDEO_FILES.narration), toJson(manifest));
  return manifest;
}
