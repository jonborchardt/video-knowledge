// Microsoft Edge neural voices through the edge-tts Python package (pip install edge-tts). Free, no key, and it reports
// word boundaries, which is what drives the animation cues. Unofficial API: fine for a spike, confirm licensing before
// publishing. VK_PYTHON names the interpreter (default python).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TtsProvider, TtsResult } from './index';

const script = fileURLToPath(new URL('./edge_tts.py', import.meta.url));

export const edge: TtsProvider = {
  id: 'edge',
  synthesize(text, voice, rate, outFile): TtsResult {
    const r = spawnSync(process.env.VK_PYTHON ?? 'python', ['-I', script], {
      input: JSON.stringify({ text, voice, rate, out: outFile + '.mp3' }),
      encoding: 'utf8',
      maxBuffer: 1 << 24,
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`edge-tts failed: ${r.stderr.slice(-800)}`);
    const words = JSON.parse(r.stdout) as TtsResult['words'];
    if (!words.length) throw new Error(`edge-tts returned no word boundaries for "${text.slice(0, 40)}..."`);
    return { words, format: 'mp3' };
  },
};
