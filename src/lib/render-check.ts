// The contract of video/render-check.json as the library layer sees it. `npm run video -- check` writes it (the video
// layer's renderCheck, src/video/check.ts, returns this type), so the lock and the board can require a renderable
// storyboard with approved graphics without importing from src/video/.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileSha } from '../shared/io';

export const RENDER_CHECK = 'video/render-check.json';
export interface RenderCheckSummary {
  generatedAt: string;
  fingerprints: { script: string; storyboard: string; config: string }; // config: sha of video/render.json
  ok: boolean; // every scene renders and no diagram or animation lacks a graphic
  problems: string[];
  graphics: { scene: string; kind: string; key: string; approved: boolean }[]; // bespoke scenes and their visual review
  needsGraphics: string[];
}

type Now = RenderCheckSummary['fingerprints'];
/** The sha of the story's video/render.json ('' when there is none): what a render check is bound to. */
export function renderConfigSha(scriptDir: string): string {
  const f = join(scriptDir, 'video', 'render.json');
  return existsSync(f) ? fileSha(f) : '';
}
/** The check was made for another script, storyboard or render.json (or never made). */
export const renderCheckStale = (rc: RenderCheckSummary | null, now: Now) =>
  !rc || (Object.keys(now) as (keyof Now)[]).some((k) => rc.fingerprints[k] !== now[k]);

/** Why the render check does not clear the lock: missing, made for other files, a scene that will not render, a
 *  diagram without a graphic, or a graphic the visual review has not approved at its current key. */
export function renderCheckProblems(rc: RenderCheckSummary | null, now: Now): string[] {
  const again = 'run npm run video -- check';
  if (!rc) return [`no ${RENDER_CHECK}: ${again}`];
  const f = rc.fingerprints;
  if (renderCheckStale(rc, now))
    return [
      `render check is for script ${f.script} / storyboard ${f.storyboard} / config ${f.config}; now ${now.script} / ${now.storyboard} / ${now.config}: ${again}`,
    ];
  return [
    ...rc.problems,
    ...rc.needsGraphics.map((s) => `${s} needs a graphic`),
    ...rc.graphics.filter((g) => !g.approved).map((g) => `graphic ${g.scene} is not approved by the visual review`),
  ];
}
