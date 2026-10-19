// `npm run video -- init`: draft video/render.json from the storyboard, so no stage input is written by hand. Every
// scene in order, the draft voice, generic kinds where the category alone picks the wrong one, a typing cue on the
// first spoken word of a question card (otherwise it waits for its own words, spoken late), and chapters from the
// script's sections. Diagrams and animations are listed, not guessed: they become the run's graphics step.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, toJson, ROOT } from '../lib/io';
import { FILES, type Script, scriptDir, sentences } from '../lib/script';
import type { Storyboard } from '../lib/storyboard';
import { VIDEO_DIR, VIDEO_FILES } from './files';
import { type SceneKind, kindOf } from './kinds';
import type { RenderConfig } from './types';

const firstWord = (text: string) =>
  (text.split(/\s+/).find(Boolean) ?? '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

export function draftRenderConfig(
  storyboard: Storyboard,
  script: Script,
): { config: RenderConfig; needsGraphics: string[] } {
  const text = new Map(sentences(script).map((s) => [s.id, s.text]));
  const kinds: Record<string, SceneKind> = {};
  const cues: RenderConfig['cues'] = {};
  const needsGraphics: string[] = [];
  for (const s of storyboard.scenes) {
    const v = s.visual;
    const c = v.chart;
    // stat tiles draw any unit; a rank table and a bar would drop dollars
    if (
      v.category === 'data-chart' &&
      c &&
      (c.type === 'table' || (c.type === 'bar' && c.points.some((p) => p.unit !== 'percent' && p.unit !== 'count')))
    )
      kinds[s.id] = 'stat-tiles';
    if (v.category === 'diagram' || v.category === 'animation' || !kindOf(s, kinds[s.id])) needsGraphics.push(s.id);
    const lines = v.onScreenText ?? [];
    if (v.category === 'typography' && lines.length === 1 && /\?\s*$/.test(lines[0])) {
      const sentence = s.sentences[0];
      cues[s.id] = { type: { sentence, word: firstWord(text.get(sentence) ?? '') } };
    }
  }
  const sceneOf = (sentence: string) => storyboard.scenes.find((s) => s.sentences.includes(sentence))?.id;
  const chapters: Record<string, string> = {};
  for (const sec of script.sections) {
    const at = sec.sentences[0] && sceneOf(sec.sentences[0].id);
    if (at && !chapters[at]) chapters[at] = sec.name[0].toUpperCase() + sec.name.slice(1);
  }
  return {
    config: {
      scenes: storyboard.scenes.map((s) => s.id),
      voice: { provider: 'edge', voice: 'en-US-AndrewMultilingualNeural', rate: '-10%' },
      leadSeconds: 0.6,
      gapSeconds: 0.3,
      cues,
      kinds,
      options: {},
      chapters,
    },
    needsGraphics,
  };
}

/** Writes video/render.json from the draft only when there is none, or with `force`: a tuned config is kept. */
export function initVideo(
  topic: string,
  storyId: string,
  opts: { force?: boolean; root?: string } = {},
): { written: boolean; needsGraphics: string[] } {
  const dir = scriptDir(topic, storyId, opts.root ?? ROOT);
  const sb = readJson<Storyboard>(join(dir, FILES.storyboard));
  const script = readJson<Script>(join(dir, FILES.script));
  if (!sb?.scenes || !script) throw new Error(`no storyboard.json or script.json in ${dir}`);
  const { config, needsGraphics } = draftRenderConfig(sb, script);
  const file = join(dir, VIDEO_DIR, VIDEO_FILES.config);
  if (existsSync(file) && !opts.force) return { written: false, needsGraphics };
  mkdirSync(join(dir, VIDEO_DIR), { recursive: true });
  writeFileSync(file, toJson(config));
  return { written: true, needsGraphics };
}
