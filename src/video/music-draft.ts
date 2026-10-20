// `npm run music -- cues`: draft video/music.json from the script's sections and a cleared composition, so the cue
// sheet is never written by hand. Four cues cover every scene with no gap (silent stretches read as mistakes), at
// the levels the MLM and heat-pumps mixes settled on: a pulse under the hook, more motion under the setup, the
// quietest texture under the evidence, the pulse again to close.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/io';
import type { Script, SectionName } from '../lib/script';
import type { Storyboard } from '../lib/storyboard';
import {
  COMPOSITION_FILE,
  type Composition,
  MUSIC_DIR,
  type MusicConfig,
  type MusicCue,
  loadComposition,
} from './music';

const GROUPS: {
  id: string;
  sections: SectionName[];
  variation: string;
  gain: number;
  fadeIn: number;
  fadeOut: number;
}[] = [
  { id: 'opening', sections: ['hook'], variation: 'pulse', gain: -11, fadeIn: 3, fadeOut: 3 },
  { id: 'setup', sections: ['setup'], variation: 'active', gain: -13, fadeIn: 2, fadeOut: 3 },
  {
    id: 'evidence',
    sections: ['investigation', 'question-1', 'question-2', 'question-3'],
    variation: 'texture',
    gain: -13,
    fadeIn: 4,
    fadeOut: 4,
  },
  {
    id: 'ending',
    sections: ['answer', 'takeaway', 'close'],
    variation: 'pulse',
    gain: -11,
    fadeIn: 2,
    fadeOut: 6,
  },
];

/** The named composition when it exists and is cleared (null when it is not); unnamed, the first cleared one by id. */
export function pickComposition(all: Composition[], want?: string): Composition | null {
  const cleared = [...all].sort((a, b) => a.id.localeCompare(b.id)).filter((c) => c.licence.cleared);
  return (want ? cleared.find((c) => c.id === want) : cleared[0]) ?? null;
}

/** Every composition in music/. */
export function compositions(root = ROOT): Composition[] {
  const dir = join(root, MUSIC_DIR);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, COMPOSITION_FILE)))
    .map((d) => loadComposition(d.name, root));
}

export function draftCueSheet(script: Script, storyboard: Storyboard, c: Composition): MusicConfig {
  const ids = storyboard.scenes.map((s) => s.id);
  const sceneOf = (sentence: string) => storyboard.scenes.findIndex((s) => s.sentences.includes(sentence));
  const starts = GROUPS.map((g) => {
    const first = script.sections.find((s) => g.sections.includes(s.name) && s.sentences.length)?.sentences[0].id;
    return { g, at: first ? sceneOf(first) : -1 };
  }).filter((x) => x.at >= 0);
  // a group that starts inside an earlier group's scene adds nothing; the first group starts at the first scene
  const kept = starts.filter((x, i) => starts.slice(0, i).every((y) => x.at > y.at));
  if (kept.length) kept[0].at = 0;
  const fallback = Object.entries(c.variations).find(([, v]) => v.loop)?.[0] ?? Object.keys(c.variations)[0];
  const cues: MusicCue[] = kept.map(({ g, at }, i) => {
    const has = Object.hasOwn(c.variations, g.variation);
    return {
      id: g.id,
      asset: `${c.id}/${has ? g.variation : fallback}`,
      from: ids[at],
      to: ids[i + 1 < kept.length ? kept[i + 1].at - 1 : ids.length - 1],
      gain: g.gain,
      fadeIn: g.fadeIn,
      fadeOut: g.fadeOut,
      ...(has ? {} : { loop: true }),
    };
  });
  return { duck: { db: -2.5, attack: 0.4, release: 1.2 }, cues };
}
