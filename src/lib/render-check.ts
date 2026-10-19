// The contract of video/render-check.json as the library layer sees it. `npm run video -- check` writes it (the video
// layer's renderCheck, src/video/check.ts, returns this type), so the lock and the board can require a renderable
// storyboard with approved graphics without importing from src/video/.

export const RENDER_CHECK = 'video/render-check.json';
export interface RenderCheckSummary {
  generatedAt: string;
  fingerprints: { script: string; storyboard: string; config: string }; // config: sha of video/render.json
  ok: boolean; // every scene renders and no diagram or animation lacks a graphic
  problems: string[];
  graphics: { scene: string; kind: string; key: string; approved: boolean }[]; // bespoke scenes and their visual review
  needsGraphics: string[];
}

/** Why the render check does not clear the lock: missing, made for other files, a scene that will not render, a
 *  diagram without a graphic, or a graphic the visual review has not approved at its current key. */
export function renderCheckProblems(
  rc: RenderCheckSummary | null,
  now: { script: string; storyboard: string; config: string },
): string[] {
  const again = 'run npm run video -- check';
  if (!rc) return [`no ${RENDER_CHECK}: ${again}`];
  const f = rc.fingerprints;
  if (f.script !== now.script || f.storyboard !== now.storyboard || f.config !== now.config)
    return [
      `render check is for script ${f.script} / storyboard ${f.storyboard} / config ${f.config}; now ${now.script} / ${now.storyboard} / ${now.config}: ${again}`,
    ];
  return [
    ...rc.problems,
    ...rc.needsGraphics.map((s) => `${s} needs a graphic`),
    ...rc.graphics.filter((g) => !g.approved).map((g) => `graphic ${g.scene} is not approved by the visual review`),
  ];
}
