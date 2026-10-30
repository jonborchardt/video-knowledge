// `npm run video -- check`: before the lock, can every scene be drawn, does every diagram and animation have a graphic,
// and has an agent that did not build each bespoke graphic approved its frames? Writes video/render-check.json (the
// library's RenderCheckSummary), which the lock and the board's graphics stage read. A graphic is approved at a key
// (the scene plus the code that draws it), so editing either asks for a new visual review.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readJson, sha, toJson, ROOT, topicDir, topicsDir } from '../../shared/io';
import { RENDER_CHECK, type RenderCheckSummary, renderConfigSha } from './render-check';
import { scriptDir, storySlug } from '../../shared/io';
import type { Scene } from '../../shared/types';
import { VIDEO_FILES, videoDir } from './files';
import { type KindRegistry, type SceneKind, bespokeFor } from './kinds';
import { componentVersion, componentVersionLegacy } from './render';
import { type Segment, checkSegment, loadInputs } from './select';

/** video/visual-review.json: written by the visual reviewer (src/modules/video/briefs/visual-review.md). */
export interface VisualReview {
  scenes: Record<
    string,
    {
      key: string;
      verdict: 'approved' | 'revise';
      notes: string;
      reviewer: string;
      date: string;
      /** set by `npm run video -- migrate-keys`: the key the approval was given at, and the commit that moved it */
      migratedFrom?: string;
      migration?: string;
    }
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

// ---- the one-time approval key migration (`npm run video -- migrate-keys`) ----
// Kept with componentVersionLegacy until the video section's proof is done; the video section deletes both.

/** The commit that normalised componentVersion: the migration every moved record names. */
export const KEY_MIGRATION = '94d98ab';
export const KEY_MIGRATION_FILE = 'key-migration.json';

export interface KeyMigrationRow {
  topic: string;
  story: string;
  scene: string;
  kind: string | null; // null: no bespoke kind draws the scene today
  oldKey: string | null;
  newKey: string | null;
  class: 'migrated' | 'stale';
}
export interface KeyMigration {
  file: string; // the visual review
  review: VisualReview;
  rows: KeyMigrationRow[];
}

const findReviews = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? findReviews(join(dir, d.name))
      : d.name === VIDEO_FILES.visualReview && dir.endsWith('video')
        ? [join(dir, d.name)]
        : [],
  );

/** Every visual review under every topic's scripts folder (Shorts included), each record classified: `migrated` when its key
 *  is today's key under the old algorithm (the approval is current), else `stale` (already not approved; untouched). */
export function planKeyMigration(root = ROOT): KeyMigration[] {
  const topics = readdirSync(topicsDir(root), { withFileTypes: true }).filter((d) => d.isDirectory());
  return topics
    .flatMap(({ name: topic }) => {
      const base = join(topicDir(topic, root), 'scripts');
      return existsSync(base) ? findReviews(base) : [];
    })
    .map((file) => {
      const sdir = dirname(dirname(file));
      const story = readJson<{ topic: string; story: string }>(join(sdir, 'script.json'))!;
      const review = readJson<VisualReview>(file)!;
      const bespoke = bespokeFor(`${story.topic}/${storySlug(story.story)}`);
      const seg = checkSegment({ ...loadInputs(story.topic, story.story, root), release: null }, bespoke);
      const rows = Object.entries(review.scenes).map(([id, r]): KeyMigrationRow => {
        const s = seg.scenes.find((x) => x.scene.id === id && Object.hasOwn(bespoke, x.kind));
        const keyWith = (code: string) => sha(toJson({ scene: s!.scene, code }));
        const oldKey = s ? keyWith(componentVersionLegacy(bespoke[s.kind].component)) : null;
        const newKey = s ? graphicKey(s.scene, s.kind, bespoke) : null;
        const cls = oldKey !== null && r.key === oldKey ? 'migrated' : 'stale';
        return { topic: story.topic, story: story.story, scene: id, kind: s?.kind ?? null, oldKey, newKey, class: cls };
      });
      return { file, review, rows };
    });
}

/** Moves every `migrated` record to its new key (every other field kept) and writes video/key-migration.json beside
 *  each visual review; a story that already has one is kept as it is (the audit trail is written once). */
export function writeKeyMigration(plan: KeyMigration[], date: string): string[] {
  return plan.flatMap(({ file, review, rows }) => {
    const out = join(dirname(file), KEY_MIGRATION_FILE);
    if (existsSync(out)) return [];
    const scenes = { ...review.scenes };
    for (const row of rows.filter((x) => x.class === 'migrated'))
      scenes[row.scene] = {
        ...scenes[row.scene],
        key: row.newKey!,
        migratedFrom: row.oldKey!,
        migration: KEY_MIGRATION,
      };
    if (rows.some((x) => x.class === 'migrated'))
      writeFileSync(file, JSON.stringify({ ...review, scenes }, null, 2) + '\n');
    writeFileSync(out, toJson({ migration: KEY_MIGRATION, date, rows }));
    return [out];
  });
}
