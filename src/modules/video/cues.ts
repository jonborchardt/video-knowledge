// When things happen in a scene, from its cues and words. Browser-safe; every component reads timing through here.
import type { TimelineScene } from './types';
import { alignLine } from './words';

/** The cue's frame, or the fallback. */
export const cue = (scene: TimelineScene, name: string, fallback: number) => scene.cues[name] ?? fallback;

/** The first frame of the spoken run that matches `line`, searching every sentence of the scene; null when the line
 *  is not spoken as written. */
export function spokenAt(scene: TimelineScene, line: string): { frame: number; end: number } | null {
  for (const s of scene.sentences) {
    const run = alignLine(line, s.words);
    if (run?.length) return { frame: run[0].frame, end: run.at(-1)!.end };
  }
  return null;
}

/** The frame each on-screen line appears on: its `line:<n>` cue (1-based), else when it is spoken, else the start of
 *  the nth sentence, else a second after the previous line. */
export function lineFrames(scene: TimelineScene, holdFrames = 30): number[] {
  const out: number[] = [];
  scene.onScreenText.forEach((line, i) => {
    const c = scene.cues[`line:${i + 1}`];
    if (c !== undefined) return out.push(c);
    const spoken = spokenAt(scene, line);
    if (spoken) return out.push(spoken.frame);
    const s = scene.sentences[i];
    if (s && (i === 0 || s.start > out[i - 1])) return out.push(s.start);
    out.push((out[i - 1] ?? scene.start) + holdFrames);
  });
  return out;
}

/** The last spoken frame of the scene (the pause follows), or its end. */
export const lastWord = (scene: TimelineScene) =>
  scene.sentences.at(-1)?.words.at(-1)?.frame ?? scene.start + scene.duration - 1;
