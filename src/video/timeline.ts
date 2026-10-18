// Timeline: the measured narration durations tile the scenes; the storyboard's word-count estimates are not used.
// Deterministic given the segment, the manifest, render.json and the cited passages. Every cue resolves to the frame
// its word is spoken on, and every excerpt to its passage, or the build fails.
import type { PassageReader } from '../lib/evidence';
import { sha } from '../lib/script';
import { narrationFingerprint } from './narration';
import type { Segment } from './select';
import {
  FPS,
  HEIGHT,
  type NarrationManifest,
  type Timeline,
  type TimelineScene,
  type TimelineSentence,
  WIDTH,
} from './types';
import { findWord, tokens } from './words';

export type SegmentCore = Pick<
  Segment,
  'scenes' | 'sentences' | 'config' | 'fingerprints' | 'script' | 'storyboard' | 'pkg'
>;

export function buildTimeline(
  seg: SegmentCore,
  manifest: NarrationManifest,
  fps = FPS,
  read?: PassageReader,
): Timeline {
  const f = (seconds: number) => Math.round(seconds * fps);
  const audio = new Map(manifest.sentences.map((s) => [s.id, s]));
  const docName = new Map(seg.pkg.documents.map((d) => [d.file, d.name]));
  let cursor = 0;
  const scenes: TimelineScene[] = seg.scenes.map(({ scene, kind, citations }, order) => {
    const start = cursor;
    if (order === 0) cursor += f(seg.config.leadSeconds ?? 0); // the first scene is on screen before it is spoken over
    const ids = scene.sentences;
    const sentences: TimelineSentence[] = ids.map((id, i) => {
      const want = seg.sentences.find((s) => s.id === id);
      const a = audio.get(id);
      if (!want || !a) throw new Error(`${scene.id}: no narration audio for sentence ${id}; run narrate`);
      if (a.text !== want.text) throw new Error(`${scene.id}: the narration for ${id} differs from the script`);
      if (a.fingerprint !== want.fingerprint)
        throw new Error(`${scene.id}: narration for ${id} is from another script`);
      if (!(a.duration > 0)) throw new Error(`${scene.id}: ${id} has no measured duration`);
      const s: TimelineSentence = {
        id,
        text: a.text,
        start: cursor,
        duration: Math.ceil(a.duration * fps),
        audio: a.file,
        audioSeconds: a.duration,
        words: tokens(a.words).map((w) => ({ text: w.text, frame: cursor + f(w.start), end: cursor + f(w.end) })),
      };
      cursor += s.duration;
      if (i < ids.length - 1) cursor += f(seg.config.gapSeconds ?? 0);
      return s;
    });
    cursor += f(scene.pauseSeconds ?? 0);
    const cues: Record<string, number> = {};
    for (const [name, c] of Object.entries(seg.config.cues?.[scene.id] ?? {})) {
      const s = sentences.find((x) => x.id === c.sentence);
      if (!s) throw new Error(`${scene.id}: cue "${name}" names sentence ${c.sentence}, not in the scene`);
      const w = findWord(s.words, c.word, c.nth ?? 1);
      if (!w) throw new Error(`${scene.id}: cue "${name}": "${c.word}" is not spoken in ${c.sentence}`);
      cues[name] = w.frame;
    }
    let excerpt: TimelineScene['excerpt'] = null;
    if (scene.visual.excerpt) {
      const { cite, highlight } = scene.visual.excerpt;
      const text = read?.(cite) ?? null;
      if (text === null) throw new Error(`${scene.id}: excerpt ${cite} cannot be read from the corpus`);
      const [file, anchor] = cite.split('#');
      excerpt = {
        cite,
        doc: docName.get(file) ?? file,
        lines: (anchor ?? '').replace(/L/g, ''),
        text,
        highlight: highlight ?? null,
      };
    }
    return {
      id: scene.id,
      order: order + 1,
      category: scene.visual.category,
      kind,
      start,
      duration: cursor - start,
      sentences,
      cues,
      onScreenText: scene.visual.onScreenText ?? [],
      chart: scene.visual.chart ?? null,
      excerpt,
      citations,
      assets: scene.visual.assetIds ?? [],
      options: seg.config.options?.[scene.id] ?? {},
    };
  });
  return {
    topic: seg.script.topic,
    story: seg.script.story,
    title: seg.script.title,
    fps,
    width: WIDTH,
    height: HEIGHT,
    durationInFrames: cursor,
    fingerprints: {
      ...seg.fingerprints,
      narration: narrationFingerprint(manifest),
      config: sha(JSON.stringify(seg.config)),
    },
    narration: { provider: manifest.provider, voice: manifest.voice, rate: manifest.rate, licence: manifest.licence },
    scenes,
  };
}
