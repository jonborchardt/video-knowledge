// Azure AI Speech: the official API behind the same neural voices edge-tts drafts with, under commercial terms, with
// word boundaries reported by the synthesis itself (the same clock the audio was made on). The same voice name and
// rate as the edge draft give the same reading, so the final render moves cues by a frame or two, not seconds.
// Cost is Azure's list price for neural voices (2026): $15 per million characters; the report labels it an estimate.
//
// The credential boundary: this file never reads AZURE_SPEECH_KEY and imports no SDK. Each sentence is synthesized
// by azure-worker.ts in a process of its own, which loads .env itself; the parent, which imports the renderer tree
// (and so agent-written components), runs without the key.
import { spawn } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { cliArgv } from '../../../shared/cli';
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

/** Drops the Azure key and region from this process. The video CLI calls it right after loading .env, so no stage
 *  (and no agent-written component a stage loads) ever sees them; the worker reloads .env for itself. */
export function forgetAzureKeys(): void {
  delete process.env.AZURE_SPEECH_KEY;
  delete process.env.AZURE_SPEECH_REGION;
}

/** The worker's environment: the parent's, minus the markers that would stop it loading .env or mark it an agent. */
export function workerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) if (!/^VK_(NO_DOTENV|AGENT|WRITABLE|SHELL)$/.test(k)) out[k] = v;
  return out;
}

/** Synthesizes one sentence in the worker process: writes the SSML beside the wav, runs `npm run tts-azure`, parses
 *  the boundaries it prints. A non-zero exit is an error carrying the worker's message (so the retry rules below
 *  still see Azure's transient failures). */
export const workerSpeak: (
  ssml: string,
  outFile: string,
  onBoundary: (b: Boundary) => void,
  deps?: {
    argv?: (ssmlFile: string, outFile: string) => [string, string[]];
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
) => Promise<void> = (ssml, outFile, onBoundary, deps = {}) => {
  const ssmlFile = `${outFile}.ssml`;
  writeFileSync(ssmlFile, ssml);
  const [exe, argv] = (deps.argv ?? ((s, o) => cliArgv('tts-azure', [s, o])))(ssmlFile, outFile);
  return new Promise<void>((resolve, reject) => {
    const child = spawn(exe, argv, {
      env: workerEnv(deps.env ?? process.env),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), deps.timeoutMs ?? SENTENCE_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        unlinkSync(ssmlFile);
      } catch {
        /* already gone */
      }
      if (code !== 0) return reject(new Error(stderr.trim() || `azure worker exited ${code}`));
      try {
        const { boundaries } = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}') as { boundaries: Boundary[] };
        for (const b of boundaries ?? []) onBoundary(b);
        resolve();
      } catch (e) {
        reject(new Error(`azure worker printed no boundaries: ${(e as Error).message}`));
      }
    });
  });
};

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The edge-tts rate ("-10%") is already a valid SSML prosody rate. */
export const ssmlOf = (text: string, voice: string, rate: string) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody rate="${rate}">${escape(text)}</prosody></voice></speak>`;

/** Spoken words only (punctuation gets its own boundary), in seconds. */
export const wordsOf = (bs: Boundary[]): WordTiming[] =>
  bs
    .filter((b) => b.type === 'WordBoundary')
    .map((b) => ({ text: b.text, start: b.offset / 1e7, end: (b.offset + b.duration) / 1e7 }));

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
  speak: Speak = workerSpeak,
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
