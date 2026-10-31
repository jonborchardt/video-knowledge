// Captions for the upload, rendered from the measured timeline: one SRT cue per sentence, starting where its audio
// starts and ending with its audio or where the next sentence starts, whichever comes first (YouTube rejects
// overlapping cues). The package writes it next to the mp4 (captions.en.srt) and the uploader sends it as is.
import type { Timeline } from '../video';

export const MAX_CUE_LINE = 42; // characters on one line; longer sentences become two balanced lines

const stamp = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
};

/** One line when it fits, else two lines split at the space nearest the middle (a sentence is one cue). */
function wrapCue(text: string): string[] {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= MAX_CUE_LINE) return [t];
  const mid = t.length / 2;
  let best = -1;
  for (let i = t.indexOf(' '); i >= 0; i = t.indexOf(' ', i + 1))
    if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
}

export function renderSrt(tl: Timeline): string {
  const all = tl.scenes.flatMap((sc) => sc.sentences);
  return all
    .map((s, i) => {
      const start = s.start / tl.fps;
      const next = all[i + 1] ? all[i + 1].start / tl.fps : Infinity;
      const end = Math.min(start + s.audioSeconds, next);
      return [String(i + 1), `${stamp(start)} --> ${stamp(end)}`, ...wrapCue(s.text), ''].join('\n');
    })
    .join('\n');
}
