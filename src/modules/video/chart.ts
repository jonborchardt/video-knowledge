// Chart timing shared by the renderer and the tests. Browser-safe.
import type { TimelineScene } from './types';

/** The frame each chart point starts filling on: its `point:<label>` cue when render.json gives one, otherwise one
 *  second after the previous point (the storyboard's "let the 47% sit for a second"), never past the next cued point. */
export function pointFrames(scene: TimelineScene, holdFrames = 30): number[] {
  const pts = scene.chart?.points ?? [];
  const cued = pts.map((p) => scene.cues[`point:${p.label}`]);
  const out: number[] = [];
  const first = scene.sentences[0]?.start ?? scene.start;
  for (let i = 0; i < pts.length; i++) {
    const c = cued[i];
    if (c !== undefined) {
      out.push(c);
      continue;
    }
    const prev = i ? out[i - 1] : first;
    const next = cued.slice(i + 1).find((x) => x !== undefined);
    const want = prev + holdFrames;
    out.push(next !== undefined && want > next - 6 ? Math.max(prev + 1, Math.round((prev + next) / 2)) : want);
  }
  return out;
}
