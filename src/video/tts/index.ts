// Text-to-speech providers. One sentence in, one audio file and its word boundaries out. The provider is chosen by
// VK_TTS_PROVIDER (default edge); the voice and rate come from render.json so the choice is persisted with the story.
import type { WordTiming } from '../types';
import { edge } from './edge';

export interface TtsResult {
  words: WordTiming[]; // empty when the provider reports no boundaries
  format: 'mp3' | 'wav';
  model?: string;
}
export interface TtsProvider {
  id: string;
  /** Writes `outFile` (no extension; the provider appends its format) and returns the boundaries. */
  synthesize(text: string, voice: string, rate: string, outFile: string): TtsResult;
}

const PROVIDERS: Record<string, TtsProvider> = { edge };
// ponytail: one provider; add openai (gpt-4o-mini-tts + whisper word timestamps) here when a key is configured.

export function provider(id = process.env.VK_TTS_PROVIDER ?? 'edge'): TtsProvider {
  const p = PROVIDERS[id];
  if (!p)
    throw new Error(`unknown TTS provider "${id}" (VK_TTS_PROVIDER); known: ${Object.keys(PROVIDERS).join(', ')}`);
  return p;
}
