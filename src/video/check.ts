// `npm run video -- check`: before the lock, can every scene be drawn, does every diagram and animation have a graphic,
// and has an agent that did not build each bespoke graphic approved its frames? Writes video/render-check.json (the
// library's RenderCheckSummary), which the lock and the board's graphics stage read. A graphic is approved at a key
// (the scene plus the code that draws it), so editing either asks for a new visual review.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, sha, toJson, ROOT } from '../shared/io';
import { RENDER_CHECK, type RenderCheckSummary, renderConfigSha } from '../lib/render-check';
import { scriptDir, storySlug } from '../shared/io';
import type { Scene } from '../lib/storyboard';
import { VIDEO_FILES, videoDir } from './files';
import { type KindRegistry, type SceneKind, bespokeFor } from './kinds';
import { componentVersion } from './render';
import { type Segment, checkSegment, loadInputs } from './select';

/** video/visual-review.json: written by the visual reviewer (scripts/briefs/visual-review.md). */
export interface VisualReview {
  scenes: Record<
    string,
    { key: string; verdict: 'approved' | 'revise'; notes: string; reviewer: string; date: string }
  >;
}

export const graphicKey = (scene: Scene, kind: SceneKind, bespoke: KindRegistry) =>
  sha(toJson({ scene, code: componentVersion(bespoke[kind].component) }));

export function renderCheck(
  seg: Segment,
  review: VisualReview | null,
  configSha: string,
  bespoke: KindRegistry,
): RenderCheckSummary {
  const kindOfScene = new Map(seg.scenes.map((s) => [s.scene.id, s.kind]));
  const selected = seg.storyboard.scenes.filter((s) => seg.config.scenes?.includes(s.id));
  // a diagram drawn by a generic kind came from a registered asset that draws it; anything else needs a graphic
  const needsGraphics = selected
    .filter((s) => ['diagram', 'animation'].includes(s.visual.category) && !kindOfScene.has(s.id))
    .map((s) => s.id);
  const graphics = seg.scenes
    .filter((s) => Object.hasOwn(bespoke, s.kind))
    .map(({ scene, kind }) => {
      const key = graphicKey(scene, kind, bespoke);
      const r = review?.scenes[scene.id];
      return { scene: scene.id, kind, key, approved: r?.verdict === 'approved' && r.key === key };
    });
  const problems = seg.problems.filter((p) => !needsGraphics.some((id) => p.startsWith(`${id}: no renderer`)));
  return {
    generatedAt: new Date().toISOString(),
    fingerprints: { ...seg.fingerprints, config: configSha },
    ok: !problems.length && !needsGraphics.length,
    problems,
    graphics,
    needsGraphics,
  };
}

/** Checks the story's render.json as it stands, writes video/render-check.json and returns it. The lock is what this
 *  check gates, so an earlier release (a send-back pass) is not held against it. */
export function writeRenderCheck(topic: string, storyId: string, root = ROOT): RenderCheckSummary {
  const dir = videoDir(topic, storyId, root);
  const bespoke = bespokeFor(`${topic}/${storySlug(storyId)}`);
  const seg = checkSegment({ ...loadInputs(topic, storyId, root), release: null }, bespoke);
  const sdir = scriptDir(topic, storyId, root);
  const rc = renderCheck(
    seg,
    readJson<VisualReview>(join(dir, VIDEO_FILES.visualReview)),
    renderConfigSha(sdir),
    bespoke,
  );
  writeFileSync(join(sdir, RENDER_CHECK), toJson(rc));
  return rc;
}
