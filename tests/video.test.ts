// The video stage: segment selection against the validated script, narration caching, the timeline from measured
// audio, cue resolution, chart timing, and the ffmpeg wrapper. The synthetic fixture needs no TTS; the one test on the
// real MLM storyboard reads the committed artifacts.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type Release, scriptFingerprint, storyboardFingerprint, validationFingerprint } from '../src/lib/script';
import { type Storyboard, type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import { pointFrames } from '../src/video/chart';
import { audioStats, probe } from '../src/video/ffmpeg';
import { kindOf, unsupportedWhy } from '../src/video/kinds';
import { narrate } from '../src/video/narration';
import { type SegmentInputs, checkSegment, citationDetail, loadSegment } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import type { TtsProvider } from '../src/video/tts';
import type { NarrationManifest, RenderConfig, TimelineScene } from '../src/video/types';
import { alignLine, findWord, tokens } from '../src/video/words';
import { DOC_D, approveAll, good, pkg, plan, read, run, scene } from './script-helpers';

// ---- fixture: a three-scene storyboard over the helpers' passing script ------------------------------------------

const POINTS = [
  { label: 'lost money', value: 47, unit: 'percent' as const, display: '47%', cite: DOC_D },
  { label: 'broke even', value: 27, unit: 'percent' as const, display: '27%', cite: DOC_D },
  { label: 'made a profit', value: 25, unit: 'percent' as const, display: '25%', cite: DOC_D },
];
const scenes = (): StoryboardPlan['scenes'] => [
  scene('sc01', ['s01'], {
    visual: { category: 'animation', description: 'phone', assetIds: ['phone-ui'] },
    pauseSeconds: 0.5,
  }),
  scene('sc02', ['s02'], {
    visual: {
      category: 'data-chart',
      description: 'bar',
      onScreenText: ['601 people surveyed'],
      chart: { type: 'stacked-bar', title: 'Outcome', points: POINTS, note: 'Self-reported.' },
    },
    citations: [{ label: 'Survey D', cite: DOC_D }],
    pauseSeconds: 1,
  }),
  scene('sc03', ['s03'], {
    visual: { category: 'typography', description: 'question', onScreenText: ['So what does that leave?'] },
  }),
];
const config = (over: Partial<RenderConfig> = {}): RenderConfig => ({
  scenes: ['sc01', 'sc02', 'sc03'],
  voice: { provider: 'fake', voice: 'v', rate: '+0%' },
  leadSeconds: 0.5,
  gapSeconds: 0.3,
  cues: { sc02: { count: { sentence: 's02', word: '601' }, 'point:lost money': { sentence: 's02', word: '47' } } },
  ...over,
});
function inputs(
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
function manifest(inp: SegmentInputs, over: Partial<Record<string, string>> = {}): NarrationManifest {
  const seg = checkSegment(inp);
  return {
    provider: 'fake',
    voice: 'v',
    rate: '+0%',
    format: 'wav',
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

describe('segment selection', () => {
  it('accepts the fixture: kinds, sentences, citations', () => {
    const seg = checkSegment(inputs({ release: true }));
    expect(seg.problems).toEqual([]);
    expect(seg.scenes.map((s) => s.kind)).toEqual(['phone', 'stacked-bar', 'quote']);
    expect(seg.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
    expect(seg.scenes[1].citations[0]).toMatchObject({ label: 'Survey D' });
    expect(seg.scenes[1].citations[0].detail).toMatch(/survey-d\.txt, lines 1-2/);
  });
  it('loads the real MLM segment', () => {
    const seg = loadSegment('get-rich-quick', 'decision:mlm-and-seminars');
    expect(seg.scenes.map((s) => s.scene.id)).toEqual(['sc01', 'sc02', 'sc03', 'sc04']);
    expect(seg.scenes.map((s) => s.kind)).toEqual(['phone', 'tree', 'quote', 'stacked-bar']);
    expect(seg.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03', 's04', 's05']);
    expect(seg.scenes[3].scene.visual.chart?.points.map((p) => p.value)).toEqual([47, 27, 25]);
    expect(seg.scenes[3].citations[0].detail).toContain('lines 135-139');
  });
  it('rejects unknown, non-contiguous and reordered scenes', () => {
    expect(checkSegment(inputs({ config: { scenes: ['sc01', 'sc03'] } })).problems.join()).toMatch(/contiguous/);
    expect(checkSegment(inputs({ config: { scenes: ['sc02', 'sc01'] } })).problems.join()).toMatch(/contiguous/);
    expect(checkSegment(inputs({ config: { scenes: ['sc09'] } })).problems.join()).toMatch(
      /sc09 is not in the storyboard/,
    );
  });
  it('reports unsupported visuals and assets instead of substituting', () => {
    const p = scenes();
    p[0] = scene('sc01', ['s01'], { visual: { category: 'footage', description: 'b-roll' } });
    expect(checkSegment(inputs({ plan: p })).problems).toContain(unsupportedWhy(p[0] as Storyboard['scenes'][0]));
    expect(kindOf({ visual: { category: 'animation', description: 'x', assetIds: ['phone-ui'] } })).toBe('phone');
    expect(kindOf({ visual: { category: 'animation', description: 'x', assetIds: ['person-grid'] } })).toBeNull();
  });
  it('rejects a chart the stacked bar cannot draw', () => {
    const p = scenes();
    const chart = p[1].visual.chart!;
    p[1].visual.chart = { ...chart, points: [{ ...chart.points[0], unit: 'usd' }, ...chart.points.slice(1)] };
    expect(checkSegment(inputs({ plan: p })).problems.join()).toMatch(/draws percentages/);
    const seg = checkSegment(inputs());
    seg.scenes[1].scene.visual.chart!.points[0].value = Number.NaN;
    expect(checkSegment({ ...seg }).problems.join()).toMatch(/no numeric value/);
  });
  it('rejects cues outside their scene and a missing required cue', () => {
    const bad = checkSegment(inputs({ config: { cues: { sc02: { count: { sentence: 's03', word: 'what' } } } } }));
    expect(bad.problems.join()).toMatch(/not in the scene/);
    const p = scenes();
    p[0] = scene('sc01', ['s01'], { visual: { category: 'diagram', description: 'tree', assetIds: ['node-tree'] } });
    const noCue = checkSegment(inputs({ plan: p, config: { cues: {} } }));
    expect(noCue.problems.join()).toMatch(/needs cue "tier2"/);
  });
  it('refuses a script the validation did not approve or the release did not lock', () => {
    const inp = inputs({ release: true });
    inp.validation.sentences[1].approved = false;
    expect(checkSegment(inp).problems.join()).toMatch(/s02 is not verified and approved/);
    const drift = inputs({ release: true });
    drift.release!.fingerprints.storyboard = 'other';
    expect(checkSegment(drift).problems.join()).toMatch(/release approved storyboard/);
  });
  it('resolves citations through the package', () => {
    expect(citationDetail({ label: 'x', cite: 'nope.txt#L1-L2' }, pkg())).toBeNull();
    expect(citationDetail({ label: 'x', source: 'no-such-source' }, pkg())).toBeNull();
  });
});

describe('timeline', () => {
  it('tiles scenes by the measured audio and resolves cues to spoken words', () => {
    const inp = inputs();
    const seg = checkSegment(inp);
    const m = manifest(inp);
    const tl = buildTimeline(seg, m);
    expect(tl.scenes.map((s) => s.id)).toEqual(['sc01', 'sc02', 'sc03']);
    expect(tl.scenes[0].start).toBe(0); // the first scene is on screen through the lead
    expect(tl.scenes[0].sentences[0].start).toBe(15); // 0.5 s lead
    expect(tl.scenes[0].sentences[0].duration).toBe(Math.ceil(m.sentences[0].duration * 30));
    expect(tl.scenes[0].duration).toBe(15 + tl.scenes[0].sentences[0].duration + 15); // lead, audio, 0.5 s pause
    for (let i = 1; i < tl.scenes.length; i++)
      expect(tl.scenes[i].start).toBe(tl.scenes[i - 1].start + tl.scenes[i - 1].duration);
    const last = tl.scenes.at(-1)!;
    expect(tl.durationInFrames).toBe(last.start + last.duration);
    const s2 = tl.scenes[1].sentences[0];
    const cue = tl.scenes[1].cues['point:lost money'];
    expect(cue).toBeGreaterThanOrEqual(s2.start);
    expect(cue).toBeLessThan(s2.start + s2.duration);
    expect(s2.words.find((w) => w.text === '47')?.frame).toBe(cue);
    expect(tl.fingerprints.script).toBe(scriptFingerprint(inp.script));
    expect(buildTimeline(seg, m)).toEqual(tl); // deterministic
  });
  it('refuses altered narration, missing audio and cues on unspoken words', () => {
    const inp = inputs();
    const seg = checkSegment(inp);
    expect(() => buildTimeline(seg, manifest(inp, { s02: 'Of 601 people surveyed, 74 percent lost money.' }))).toThrow(
      /differs from the script/,
    );
    const m = manifest(inp);
    expect(() => buildTimeline(seg, { ...m, sentences: m.sentences.slice(1) })).toThrow(
      /no narration audio for sentence s01/,
    );
    const seg2 = checkSegment(inputs({ config: { cues: { sc02: { count: { sentence: 's02', word: 'bananas' } } } } }));
    expect(() => buildTimeline(seg2, manifest(inp))).toThrow(/"bananas" is not spoken/);
  });
  it('fills uncued chart points a second after the previous one, never past the next cue', () => {
    const base: Omit<TimelineScene, 'sentences' | 'chart' | 'cues'> = {
      id: 'sc',
      order: 1,
      category: 'data-chart',
      kind: 'stacked-bar',
      start: 100,
      duration: 300,
      onScreenText: [],
      citations: [],
      assets: [],
    };
    const sc: TimelineScene = {
      ...base,
      sentences: [{ id: 's', text: '', start: 100, duration: 300, audio: '', audioSeconds: 10, words: [] }],
      chart: { type: 'stacked-bar', points: POINTS },
      cues: { 'point:lost money': 150, 'point:made a profit': 260 },
    };
    expect(pointFrames(sc)).toEqual([150, 180, 260]);
    expect(pointFrames({ ...sc, cues: { 'point:lost money': 150, 'point:made a profit': 165 } })).toEqual([
      150, 158, 165,
    ]);
    expect(pointFrames({ ...sc, cues: {} })).toEqual([130, 160, 190]);
  });
});

describe('words', () => {
  const words = [
    { text: 'In', start: 0, end: 0.1 },
    { text: 'a', start: 0.1, end: 0.2 },
    { text: 'study', start: 0.2, end: 0.5 },
    { text: 'asked 601', start: 0.5, end: 1.2 },
    { text: '47 percent', start: 1.2, end: 1.9 },
  ];
  it('splits grouped boundaries and finds the nth word', () => {
    expect(tokens(words).map((w) => w.text)).toEqual(['In', 'a', 'study', 'asked', '601', '47', 'percent']);
    expect(findWord(words, '601')?.start).toBe(0.5);
    expect(findWord(words, 'A')?.start).toBe(0.1);
    expect(findWord(words, 'a', 2)).toBeNull();
  });
  it('aligns a line to a run of the spoken words', () => {
    expect(alignLine('"asked 601, 47"', words)?.map((w) => w.text)).toEqual(['asked', '601', '47']);
    expect(alignLine('study percent', words)).toBeNull();
  });
});

describe('narration and ffmpeg', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vk-video-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  /** A one-second 8 kHz silent WAV with a single full-scale click, so peak and silence are both measurable. */
  const wav = (seconds = 1, rate = 8000) => {
    const n = seconds * rate;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(n * 2, 40);
    b.writeInt16LE(16000, 44 + 100 * 2);
    return b;
  };
  let calls = 0;
  const fake: TtsProvider = {
    id: 'fake',
    synthesize(text, _voice, _rate, out) {
      calls++;
      writeFileSync(out + '.wav', wav(2));
      return { format: 'wav', words: [{ text: text.split(' ')[0], start: 0.1, end: 0.4 }] };
    },
  };
  it('measures the audio and reuses it when nothing changed', () => {
    const seg = checkSegment(inputs());
    const m = narrate(seg, dir, { tts: fake });
    expect(m.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
    expect(m.sentences[0].duration).toBeCloseTo(2, 2);
    expect(existsSync(join(dir, m.sentences[0].file))).toBe(true);
    expect(calls).toBe(3);
    const again = narrate(seg, dir, { tts: fake });
    expect(calls).toBe(3);
    expect(again.sentences.map((s) => s.sha)).toEqual(m.sentences.map((s) => s.sha));
    expect(JSON.parse(readFileSync(join(dir, 'narration.json'), 'utf8')).sentences).toHaveLength(3);
    narrate(seg, dir, { tts: fake, force: true });
    expect(calls).toBe(6);
  });
  it('probes media and fails loudly on a missing or broken file', () => {
    const f = join(dir, 'probe.wav');
    writeFileSync(f, wav(1));
    const p = probe(f);
    expect(p.duration).toBeCloseTo(1, 2);
    expect(p.audio?.codec).toBe('pcm_s16le');
    expect(p.video).toBeNull();
    expect(() => probe(join(dir, 'missing.mp4'))).toThrow(/no such file/);
    writeFileSync(join(dir, 'broken.mp4'), 'not media');
    expect(() => probe(join(dir, 'broken.mp4'))).toThrow(/ffprobe/);
  });
  it('finds the peak and the silence in decoded audio', () => {
    const f = join(dir, 'stats.wav');
    writeFileSync(f, wav(3));
    const a = audioStats(f, -40, 2);
    expect(a.maxVolumeDb).toBeCloseTo(20 * Math.log10(16000 / 32768), 0);
    expect(a.silences.length).toBe(1);
    expect(a.silences[0].end - a.silences[0].start).toBeGreaterThan(2);
  });
});
