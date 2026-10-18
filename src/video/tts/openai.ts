// OpenAI text-to-speech (commercial terms: generated audio may be published) with word timestamps from OpenAI's own
// transcription of the result, so cues align to the audio actually produced. Needs OPENAI_API_KEY (OPEN_API_KEY is
// read as a fallback). Nothing here is cached; narration.ts caches per sentence.
//   VK_OPENAI_TTS_MODEL   default gpt-4o-mini-tts
//   VK_OPENAI_STT_MODEL   default whisper-1 (the model that returns word-level timestamps)
//   VK_OPENAI_BASE        default https://api.openai.com/v1
// Cost is estimated from OpenAI's published guidance (2026): about $0.015 per minute of gpt-4o-mini-tts audio and
// $0.006 per minute of whisper-1; the report labels it an estimate.
import { readFileSync, writeFileSync } from 'node:fs';
import type { TtsProvider, TtsResult } from './index';

export const INSTRUCTIONS =
  'Calm, clear documentary narration for an educational video. Conversational, unhurried, no announcer energy. ' +
  'Read numbers and percentages carefully and distinctly, with a short pause before an important figure.';

/** edge-tts rates ("-20%") map to OpenAI's speed multiplier (0.8); OpenAI accepts 0.25 to 4. */
export const speedOf = (rate: string) => {
  const pct = Number(rate.replace('%', ''));
  const s = Number.isFinite(pct) ? 1 + pct / 100 : 1;
  return Math.min(4, Math.max(0.25, s));
};

type Fetch = typeof fetch;

export function openaiProvider(doFetch: Fetch = fetch): TtsProvider {
  return {
    id: 'openai',
    licence: 'commercial: OpenAI terms assign output rights to the customer',
    limitations: [
      'word timestamps come from a transcription of the synthesized audio, not from the synthesis, so a cue can land on a misheard word',
    ],
    async synthesize(text, voice, rate, outFile): Promise<TtsResult> {
      const key = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY;
      if (!key) throw new Error('openai TTS needs OPENAI_API_KEY');
      const base = process.env.VK_OPENAI_BASE ?? 'https://api.openai.com/v1';
      const model = process.env.VK_OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';
      const stt = process.env.VK_OPENAI_STT_MODEL ?? 'whisper-1';
      const auth = { Authorization: `Bearer ${key}` };
      const speech = await doFetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: 'wav',
          speed: speedOf(rate),
          instructions: INSTRUCTIONS,
        }),
      });
      if (!speech.ok) throw new Error(`openai speech ${speech.status}: ${(await speech.text()).slice(0, 300)}`);
      const file = outFile + '.wav';
      writeFileSync(file, Buffer.from(await speech.arrayBuffer()));

      const form = new FormData();
      form.append('file', new Blob([readFileSync(file)], { type: 'audio/wav' }), 'speech.wav');
      form.append('model', stt);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      const tr = await doFetch(`${base}/audio/transcriptions`, { method: 'POST', headers: auth, body: form });
      if (!tr.ok) throw new Error(`openai transcription ${tr.status}: ${(await tr.text()).slice(0, 300)}`);
      const j = (await tr.json()) as { duration?: number; words?: { word: string; start: number; end: number }[] };
      const words = (j.words ?? []).map((w) => ({ text: w.word, start: w.start, end: w.end }));
      if (!words.length)
        throw new Error(`openai transcription returned no word timestamps for "${text.slice(0, 40)}..."`);
      const minutes = (j.duration ?? words.at(-1)!.end) / 60;
      return {
        words,
        format: 'wav',
        model: `${model}+${stt}`,
        cost: Math.round(minutes * (0.015 + 0.006) * 1e4) / 1e4,
      };
    },
  };
}

export const openai = openaiProvider();
