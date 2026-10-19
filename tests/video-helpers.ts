// The video stage's synthetic fixture: a three-scene storyboard over the script helpers' passing script, a render
// config and a narration manifest with 0.3 s per word, so the timeline, cache, mixing and report tests need no TTS.
import { storyboardFingerprint, validationFingerprint } from '../src/lib/release';
import { type Release, scriptFingerprint } from '../src/lib/script';
import { type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import { checkSegment, type SegmentInputs } from '../src/video/select';
import type { NarrationManifest, RenderConfig } from '../src/video/types';
import { DOC_D, approveAll, good, pkg, plan, read, run, scene } from './script-helpers';

export const POINTS = [
  { label: 'lost money', value: 47, unit: 'percent' as const, display: '47%', cite: DOC_D },
  { label: 'broke even', value: 27, unit: 'percent' as const, display: '27%', cite: DOC_D },
  { label: 'made a profit', value: 25, unit: 'percent' as const, display: '25%', cite: DOC_D },
];
export const scenes = (): StoryboardPlan['scenes'] => [
  scene('sc01', ['s01'], {
    visual: { category: 'animation', description: 'phone', assetIds: ['phone-ui'] },
    pauseSeconds: 0.5,
  }),
  scene('sc02', ['s02'], {
    visual: {
      category: 'data-chart',
      description: 'bar',
      onScreenText: ['601 people surveyed'],
      chart: { type: 'stacked-bar', title: 'Outcome', points: POINTS.map((p) => ({ ...p })), note: 'Self-reported.' },
    },
    citations: [{ label: 'Survey D', cite: DOC_D }],
    pauseSeconds: 1,
  }),
  scene('sc03', ['s03'], {
    visual: { category: 'typography', description: 'question', onScreenText: ['So what does that leave?'] },
  }),
];
export const config = (over: Partial<RenderConfig> = {}): RenderConfig => ({
  scenes: ['sc01', 'sc02', 'sc03'],
  voice: { provider: 'fake', voice: 'v', rate: '+0%' },
  leadSeconds: 0.5,
  gapSeconds: 0.3,
  cues: { sc02: { count: { sentence: 's02', word: '601' }, 'point:lost money': { sentence: 's02', word: '47' } } },
  ...over,
});
export function inputs(
  over: { plan?: StoryboardPlan['scenes']; config?: Partial<RenderConfig>; release?: boolean } = {},
): SegmentInputs {
  const script = good();
  const validation = run(script, approveAll(script));
  const sb = buildStoryboard(
    { ...plan(over.plan ?? scenes(), script), assets: { 'phone-ui': { kind: 'animation', description: 'phone' } } },
    script,
    validation,
    pkg(),
    read,
  );
  const release: Release | null = over.release
    ? {
        topic: script.topic,
        story: script.story,
        approvedBy: 'test',
        date: 'd',
        revision: 1,
        fingerprints: {
          script: scriptFingerprint(script),
          package: pkg().fingerprint,
          validation: validationFingerprint(validation),
          storyboard: storyboardFingerprint(sb),
        },
      }
    : null;
  return { script, storyboard: sb, validation, release, config: config(over.config), pkg: pkg() };
}
/** A manifest with 0.3 s per word, as a provider would report it, without any TTS. */
export function manifest(inp: SegmentInputs, over: Partial<Record<string, string>> = {}): NarrationManifest {
  const seg = checkSegment(inp);
  return {
    provider: 'fake',
    voice: 'v',
    rate: '+0%',
    format: 'wav',
    licence: 'test',
    cost: 0,
    generatedAt: 'd',
    sentences: seg.sentences.map((s) => {
      const text = over[s.id] ?? s.text;
      const words = text.split(/\s+/).map((w, i) => ({ text: w, start: 0.1 + i * 0.3, end: 0.35 + i * 0.3 }));
      return {
        id: s.id,
        text,
        fingerprint: s.fingerprint,
        file: `narration/${s.id}.wav`,
        sha: s.id,
        duration: words.length * 0.3 + 0.4,
        words,
      };
    }),
  };
}
