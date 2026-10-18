// Text-to-speech providers. One sentence in, one audio file and its word boundaries out. The provider is chosen by
// render.json (voice.provider) or VK_TTS_PROVIDER; the voice and rate come from render.json so the choice is persisted
// with the story. `edge` is free and draft-only; `openai` is paid under commercial terms.
import type { WordTiming } from '../types';
import { edge } from './edge';
import { openai } from './openai';

export interface TtsResult {
  words: WordTiming[]; // empty when the provider reports no boundaries
  format: 'mp3' | 'wav';
  model?: string;
  cost?: number; // USD for this call, when paid
}
export interface TtsProvider {
  id: string;
  licence: string; // what the terms allow for the rendered video
  /** Writes `outFile` (no extension; the provider appends its format) and returns the boundaries. */
  synthesize(text: string, voice: string, rate: string, outFile: string): Promise<TtsResult>;
}

const PROVIDERS: Record<string, TtsProvider> = { edge, openai };

export function provider(id = process.env.VK_TTS_PROVIDER ?? 'edge'): TtsProvider {
  const p = PROVIDERS[id];
  if (!p)
    throw new Error(`unknown TTS provider "${id}" (VK_TTS_PROVIDER); known: ${Object.keys(PROVIDERS).join(', ')}`);
  return p;
}
