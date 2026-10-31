// Azure AI Speech: the official API behind the same neural voices edge-tts drafts with, under commercial terms, with
// word boundaries reported by the synthesis itself (the same clock the audio was made on). Needs AZURE_SPEECH_KEY and
// AZURE_SPEECH_REGION, from the environment or the repo's .env (loaded by src/modules/video/cli.ts). The same voice name and
// rate as the edge draft give the same reading, so the final render moves cues by a frame or two, not seconds.
// Cost is Azure's list price for neural voices (2026): $15 per million characters; the report labels it an estimate.
import { writeFileSync } from 'node:fs';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import type { WordTiming } from '../types';
import type { TtsProvider, TtsResult } from './index';

/** One boundary event: offset and duration in ticks of 100 ns, type 'WordBoundary' | 'PunctuationBoundary' | 'SentenceBoundary'. */
export interface Boundary {
  text: string;
  offset: number;
  duration: number;
  type: string;
}
/** Synthesize `ssml` into `outFile` (a RIFF wav), reporting each boundary as it comes. */
export type Speak = (ssml: string, outFile: string, onBoundary: (b: Boundary) => void) => Promise<void>;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The edge-tts rate ("-10%") is already a valid SSML prosody rate. */
export const ssmlOf = (text: string, voice: string, rate: string) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody rate="${rate}">${escape(text)}</prosody></voice></speak>`;

/** Spoken words only (punctuation gets its own boundary), in seconds. */
export const wordsOf = (bs: Boundary[]): WordTiming[] =>
  bs
    .filter((b) => b.type === 'WordBoundary')
    .map((b) => ({ text: b.text, start: b.offset / 1e7, end: (b.offset + b.duration) / 1e7 }));

const sdkSpeak: Speak = (ssml, outFile, onBoundary) => {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region)
    throw new Error('azure TTS needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (.env or the environment)');
  const cfg = sdk.SpeechConfig.fromSubscription(key, region);
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
  cfg.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, 'true');
  const synth = new sdk.SpeechSynthesizer(cfg, null as unknown as undefined); // null: no speaker, the bytes come back in the result
  synth.wordBoundary = (_, e) =>
    onBoundary({ text: e.text, offset: e.audioOffset, duration: e.duration, type: String(e.boundaryType) });
  return new Promise<void>((resolve, reject) => {
    synth.speakSsmlAsync(
      ssml,
      (r) => {
        synth.close();
        if (r.reason !== sdk.ResultReason.SynthesizingAudioCompleted)
          return reject(new Error(`azure speech failed: ${r.errorDetails ?? sdk.ResultReason[r.reason]}`));
        writeFileSync(outFile, Buffer.from(r.audioData));
        resolve();
      },
      (e) => {
        synth.close();
        reject(new Error(`azure speech failed: ${e}`));
      },
    );
  });
};

/** Azure sheds load with "No free synthesizer" (websocket 1013) and 429s, and a dropped connection is "Unable to
 *  contact server" (1006); all are retried. A sentence that neither finishes nor fails within SENTENCE_TIMEOUT_MS
 *  (the SDK can sit on a dead socket for hours) counts as the same. */
const transient = (e: unknown) =>
  /ResourceExhausted|No free synthesizer|1013|1006|Unable to contact server|429|Too Many Requests|timed out|timeout/i.test(
    String(e),
  );
const BACKOFF_MS = [2000, 5000, 10000, 20000, 60000, 120000];
export const SENTENCE_TIMEOUT_MS = 120_000;

const withTimeout = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`azure speech timed out after ${ms / 1000}s: ${what}`)), ms);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });

export function azureProvider(
  speak: Speak = sdkSpeak,
  backoff = BACKOFF_MS,
  timeoutMs = SENTENCE_TIMEOUT_MS,
): TtsProvider {
  return {
    id: 'azure',
    licence: 'commercial: Azure AI Speech terms allow the generated audio in published media',
    async synthesize(text, voice, rate, outFile): Promise<TtsResult> {
      const bs: Boundary[] = [];
      for (let attempt = 0; ; attempt++) {
        bs.length = 0;
        try {
          await withTimeout(
            speak(ssmlOf(text, voice, rate), outFile + '.wav', (b) => bs.push(b)),
            timeoutMs,
            text.slice(0, 40),
          );
          break;
        } catch (e) {
          if (attempt >= backoff.length || !transient(e)) throw e;
          await new Promise((r) => setTimeout(r, backoff[attempt]));
        }
      }
      const words = wordsOf(bs);
      if (!words.length) throw new Error(`azure returned no word boundaries for "${text.slice(0, 40)}..."`);
      return { words, format: 'wav', model: 'neural', cost: Math.round(text.length * 15e-6 * 1e4) / 1e4 };
    },
  };
}

export const azure = azureProvider();
