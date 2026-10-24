// The video stage: segment selection against the validated script, narration caching, the timeline from measured
// audio, cue resolution, chart timing, excerpt extraction, the render cache key, assembly contiguity, the ffmpeg
// wrapper and the providers. Every test runs on the synthetic fixture (tests/video-helpers.ts) and needs no TTS.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { scriptDir, scriptFingerprint } from '../src/lib/script';
import type { Storyboard } from '../src/lib/storyboard';
import { type VisualReview, graphicKey, renderCheck } from '../src/video/check';
import { draftRenderConfig, initVideo } from '../src/video/init';
import type { KindRegistry, SceneKind } from '../src/video/kinds';
import { pointFrames } from '../src/video/chart';
import { cue, lineFrames, spokenAt } from '../src/video/cues';
import { excerptWindow, flowPassage } from '../src/video/excerpt';
import { type Probe, audioStats, probe } from '../src/video/ffmpeg';
import { BESPOKE } from '../src/video/bespoke';
import { ALL_KINDS, GENERIC, SHORT_GENERIC, kindOf, registryFor, unsupportedWhy } from '../src/video/kinds';
import { citationTop } from '../src/video/remotion/Citation';
import { captionCards } from '../src/video/remotion/Portrait';
import { SHORT_MAX_SECONDS, type Script, type ShortBlock, sentences } from '../src/lib/script';
import { buildStoryboard } from '../src/lib/storyboard';
import { approveAll, good, plan, run } from './script-helpers';
import { COMPONENTS } from '../src/video/remotion/scenes';
import { headlineNumber, segmentColors } from '../src/video/remotion/scenes/StackedBar';
import { countUp, theme } from '../src/video/remotion/theme';
import { narrate } from '../src/video/narration';
import { TOLERANCE, blankChecks, contentChecks, shortChecks, soundtrackChecks, syncChecks } from '../src/video/qa';
import { assemble } from '../src/video/assemble';
import { deepImports, relativeScene, sceneKey } from '../src/video/render';
import { checkSegment, citationDetail } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import { type TtsProvider, provider, providerLimitations } from '../src/video/tts';
import { RENDERER_LIMITATIONS } from '../src/video/remotion/limitations';
import { openaiProvider, speedOf } from '../src/video/tts/openai';
import { type Speak, azureProvider } from '../src/video/tts/azure';
import { PORTRAIT, SHORT_LAYOUT, type TimelineScene } from '../src/video/types';
import { alignLine, findWord, tokens } from '../src/video/words';
import { DOC_D, pkg, read, scene } from './script-helpers';
import { POINTS, inputs, manifest, scenes } from './video-helpers';

describe('segment selection', () => {
  it('accepts the fixture: kinds, sentences, citations', () => {
    const seg = checkSegment(inputs({ release: true }));
    expect(seg.problems).toEqual([]);
    expect(seg.scenes.map((s) => s.kind)).toEqual(['phone', 'stacked-bar', 'question']);
    expect(seg.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
    expect(seg.scenes[1].citations[0]).toMatchObject({ label: 'Survey D' });
    expect(seg.scenes[1].citations[0].detail).toMatch(/survey-d\.txt, lines 1-2/);
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
    expect(kindOf({ visual: { category: 'animation', description: 'x' } })).toBeNull();
    expect(kindOf({ visual: { category: 'diagram', description: 'x', assetIds: ['person-grid'] } })).toBe(
      'person-grid',
    );
    expect(kindOf({ visual: { category: 'typography', description: 'x', onScreenText: ['"a quote"'] } })).toBe('quote');
    expect(kindOf({ visual: { category: 'typography', description: 'x', onScreenText: ['a', 'b'] } })).toBe('list');
    expect(kindOf({ visual: { category: 'data-chart', description: 'x' } })).toBeNull(); // no chart type, no kind
    expect(kindOf({ visual: { category: 'animation', description: 'x' } }, 'constructor')).toBeNull(); // own keys only
  });
  it('takes a bespoke kind from render.json only when it draws the category', () => {
    const p = scenes();
    p[0] = scene('sc01', ['s01'], { visual: { category: 'animation', description: 'push in' } });
    const mine: KindRegistry = { 'push-in': { component: 'FinePrint', accepts: ['animation'] } };
    const kind = 'push-in' as SceneKind; // a bespoke name, registered only in `mine`
    const ok = checkSegment(inputs({ plan: p, config: { kinds: { sc01: kind } } }), mine);
    expect(ok.problems).toEqual([]);
    expect(ok.scenes[0].kind).toBe(kind);
    // Another video's bespoke kind is unknown here: the fixture's video registers none.
    const elsewhere = checkSegment(inputs({ plan: p, config: { kinds: { sc01: kind } } }));
    expect(elsewhere.problems.join()).toMatch(/unknown to this video/);
    const wrong = checkSegment(inputs({ plan: p, config: { kinds: { sc01: 'waffle' } } }), mine);
    expect(wrong.problems.join()).toMatch(/does not draw animation/);
    const unknown = checkSegment(inputs({ config: { kinds: { sc01: 'hologram' as never } } }));
    expect(unknown.problems.join()).toMatch(/unknown/);
  });
  it('one record per kind: a known component, a category, and names unique across videos', () => {
    const names = [GENERIC, ...Object.values(BESPOKE as Record<string, object>)].flatMap((r) => Object.keys(r));
    expect(new Set(names).size).toBe(names.length);
    for (const [k, spec] of Object.entries(ALL_KINDS)) {
      expect(spec.accepts.length, k).toBeGreaterThan(0);
      expect(COMPONENTS[spec.component], k).toBeTypeOf('function');
    }
  });
  it('rejects a chart the kind cannot draw', () => {
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
    const c = tl.scenes[1].cues['point:lost money'];
    expect(c).toBeGreaterThanOrEqual(s2.start);
    expect(c).toBeLessThan(s2.start + s2.duration);
    expect(s2.words.find((w) => w.text === '47')?.frame).toBe(c);
    expect(tl.fingerprints.script).toBe(scriptFingerprint(inp.script));
    expect(tl.scenes[1].options).toEqual({});
    expect(buildTimeline(seg, m)).toEqual(tl); // deterministic
  });
  it('carries options and reads excerpts from the corpus, refusing a missing passage', () => {
    const p = scenes();
    p[2] = scene('sc03', ['s03'], {
      visual: { category: 'document-excerpt', description: 'page', excerpt: { cite: DOC_D, highlight: '47%' } },
    });
    const inp = inputs({ plan: p, config: { options: { sc03: { accent: 'slate' } } } });
    const seg = checkSegment(inp);
    expect(seg.scenes[2].kind).toBe('excerpt');
    const tl = buildTimeline(seg, manifest(inp), 30, read);
    expect(tl.scenes[2].excerpt).toMatchObject({ cite: DOC_D, lines: '1-2', highlight: '47%' });
    expect(tl.scenes[2].excerpt?.text).toMatch(/601 participants/);
    expect(tl.scenes[2].options).toEqual({ accent: 'slate' });
    expect(() => buildTimeline(seg, manifest(inp), 30, () => null)).toThrow(/cannot be read/);
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
      excerpt: null,
      options: {},
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
  it('times on-screen lines by cue, by speech, then by sentence', () => {
    const inp = inputs();
    const tl = buildTimeline(checkSegment(inp), manifest(inp));
    const sc = { ...tl.scenes[1], onScreenText: ['601 people', 'lost money', 'third line'] };
    const s = sc.sentences[0];
    expect(spokenAt(sc, '601 people')?.frame).toBe(s.words.find((w) => w.text === '601')!.frame);
    expect(spokenAt(sc, 'nothing here')).toBeNull();
    const [a, b, c] = lineFrames(sc);
    expect(a).toBe(s.words.find((w) => w.text === '601')!.frame);
    expect(b).toBe(s.words.find((w) => w.text === 'lost')!.frame);
    expect(c).toBe(b + 30);
    expect(lineFrames({ ...sc, cues: { 'line:3': 999 } })[2]).toBe(999);
    expect(cue(sc, 'missing', 7)).toBe(7);
  });
});

describe('qa check groups (no ffmpeg)', () => {
  const inp = inputs();
  const seg = checkSegment(inp);
  const m = manifest(inp);
  const tl = buildTimeline(seg, m);
  const seconds = tl.durationInFrames / tl.fps;
  const failed = (checks: { name: string; ok: boolean }[]) => checks.filter((c) => !c.ok).map((c) => c.name);

  it('content and sync pass on the fixture, and a reordered timeline fails', () => {
    expect(failed(contentChecks(tl, seg))).toEqual([]);
    const p = { duration: seconds, video: null, audio: null } as unknown as Probe;
    expect(failed(syncChecks(p, tl, seg, m))).toEqual([]);
    const swapped = { ...tl, scenes: [...tl.scenes].reverse() };
    expect(failed(contentChecks(swapped, seg))).toContain('scene order');
  });

  it('blankChecks names every flat run with its scene', () => {
    const sps = TOLERANCE.samplesPerSecond;
    const n = Math.ceil(seconds * sps);
    const samples = Array.from({ length: n }, () => ({ mean: 100, sd: 20 }));
    const flatten = (from: number, len: number) => {
      for (let i = Math.floor(from * sps); i < Math.min(n, Math.floor((from + len) * sps)); i++)
        samples[i] = { mean: 0, sd: 0 };
    };
    flatten(0, TOLERANCE.blankRunSeconds + 0.2); // start of sc01
    flatten(tl.scenes[2].start / tl.fps, TOLERANCE.blankRunSeconds + 0.2); // start of sc03
    const check = blankChecks(samples, tl).find((c) => c.name === 'no blank sections')!;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('in sc01');
    expect(check.detail).toContain('in sc03');
    expect(check.scene).toBe('sc01'); // the review page seeks to the first place
  });

  it('a failing check names the scene and sentence it is about', () => {
    const sc = tl.scenes[1];
    const s0 = sc.sentences[0];
    const edited = {
      ...tl,
      scenes: tl.scenes.map((x) =>
        x.id === sc.id
          ? { ...x, sentences: x.sentences.map((y) => (y.id === s0.id ? { ...y, text: 'changed' } : y)) }
          : x,
      ),
    };
    const c = contentChecks(edited, seg).find((x) => x.name === 'narration matches script')!;
    expect(c).toMatchObject({ ok: false, scene: sc.id, sentence: s0.id });
    expect(contentChecks(tl, seg).every((x) => x.scene === undefined && x.sentence === undefined)).toBe(true);
  });

  it('blank checks read luma samples: a flat stretch fails, varied content passes', () => {
    const n = Math.ceil(seconds * TOLERANCE.samplesPerSecond);
    const varied = Array.from({ length: n }, () => ({ mean: 100, sd: 20 }));
    expect(failed(blankChecks(varied, tl))).toEqual([]);
    const flat = varied.map(() => ({ mean: 0, sd: 0 }));
    expect(failed(blankChecks(flat, tl))).toEqual(['no blank sections', 'every scene has content']);
  });

  it('no music config is a passing soundtrack check', () => {
    expect(soundtrackChecks(tl, {})).toEqual([{ name: 'soundtrack', ok: true, detail: 'none: no video/music.json' }]);
  });
});

describe('words and excerpts', () => {
  const words = [
    { text: 'In', start: 0, end: 0.1 },
    { text: 'a', start: 0.1, end: 0.2 },
    { text: 'study', start: 0.2, end: 0.5 },
    { text: 'asked 601', start: 0.5, end: 1.3 },
    { text: '47 percent', start: 1.3, end: 1.9 },
  ];
  it('splits grouped boundaries by letters and finds the nth word', () => {
    expect(tokens(words).map((w) => w.text)).toEqual(['In', 'a', 'study', 'asked', '601', '47', 'percent']);
    expect(findWord(words, '601')?.start).toBeCloseTo(0.5 + 0.8 * (5 / 8), 5);
    expect(findWord(words, 'asked')?.end).toBeCloseTo(0.5 + 0.8 * (5 / 8), 5);
    expect(findWord(words, 'A')?.start).toBe(0.1);
    expect(findWord(words, 'a', 2)).toBeNull();
  });
  it('aligns a line to a run of the spoken words', () => {
    expect(alignLine('"asked 601, 47"', words)?.map((w) => w.text)).toEqual(['asked', '601', '47']);
    expect(alignLine('study percent', words)).toBeNull();
  });
  it('keeps the column of a two-column page that holds the highlight and windows around it', () => {
    const page = [
      'Left column text that runs on and                 The motivation of most MLM is the',
      'on about something else entirely                  opportunity to make large amounts of income',
      'for several lines in a row here.                  for a minimal investment of time and money.',
      '12 A footnote that should be dropped from the flow of the page.',
      'FEDERAL TRADE COMMISSION - FTC.GOV             13',
      'And the left column continues to                  with the concept of time freedom or leveraged',
      'the end of the passage.                           income, which allows a person to gain.',
    ].join('\n');
    const flow = flowPassage(page, 'time freedom or leveraged income');
    expect(flow).toMatch(/^The motivation of most MLM/);
    expect(flow).not.toMatch(/Left column|footnote|FTC\.GOV/);
    const w = excerptWindow(page, 'time freedom or leveraged income', 6);
    expect(w.match).toBe('time freedom or leveraged income');
    expect(w.before.split(' ').length).toBeLessThanOrEqual(7);
    expect(w.before).toMatch(/^…/);
    expect(excerptWindow('a plain passage with no highlight', 'absent').match).toBeNull();
    expect(excerptWindow('Of the 601 participants, 47% lost.', null).before).toBe('Of the 601 participants, 47% lost.');
  });
});

describe('render cache and assembly', () => {
  it('keys a chunk by the scene made relative and the code that draws it', () => {
    const inp = inputs();
    const tl = buildTimeline(checkSegment(inp), manifest(inp));
    const s = tl.scenes[1];
    const r = relativeScene(s);
    expect(r.start).toBe(0);
    expect(r.sentences[0].start).toBe(s.sentences[0].start - s.start);
    expect(r.cues['point:lost money']).toBe(s.cues['point:lost money'] - s.start);
    const moved = {
      ...s,
      start: s.start + 90,
      sentences: s.sentences.map((x) => ({
        ...x,
        start: x.start + 90,
        words: x.words.map((w) => ({ ...w, frame: w.frame + 90, end: w.end + 90 })),
      })),
      cues: Object.fromEntries(Object.entries(s.cues).map(([k, v]) => [k, v + 90])),
    };
    expect(sceneKey(moved, tl)).toBe(sceneKey(s, tl));
    expect(sceneKey({ ...s, onScreenText: ['other'] }, tl)).not.toBe(sceneKey(s, tl));
    expect(sceneKey(s, { ...tl, fps: 24 })).not.toBe(sceneKey(s, tl));
  });
  it('refuses to assemble chunks that are not contiguous', () => {
    const inp = inputs();
    const tl = buildTimeline(checkSegment(inp), manifest(inp));
    const chunks = [tl.scenes[0], tl.scenes[2]].map((scene) => ({ scene, file: 'x.mp4', cached: true }));
    expect(() => assemble(tl, manifest(inp), chunks, '.', 'out.mp4')).toThrow(/not contiguous/);
    expect(() => assemble(tl, manifest(inp), [], '.', 'out.mp4')).toThrow(/nothing/);
  });
});

describe('narration and ffmpeg', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vk-video-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  /** A silent 8 kHz WAV with a single full-scale click, so peak and silence are both measurable. */
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
    licence: 'test',
    async synthesize(text, _voice, _rate, out) {
      calls++;
      writeFileSync(out + '.wav', wav(2));
      return { format: 'wav', words: [{ text: text.split(' ')[0], start: 0.1, end: 0.4 }], cost: 0.01 };
    },
  };
  it('measures the audio, reuses it when nothing changed, and sums the cost', async () => {
    const seg = checkSegment(inputs());
    const m = await narrate(seg, dir, { tts: fake });
    expect(m.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
    expect(m.sentences[0].duration).toBeCloseTo(2, 2);
    expect(existsSync(join(dir, m.sentences[0].file))).toBe(true);
    expect(m.licence).toBe('test');
    expect(m.cost).toBeCloseTo(0.03, 5);
    expect(calls).toBe(3);
    const again = await narrate(seg, dir, { tts: fake });
    expect(calls).toBe(3);
    expect(again.sentences.map((s) => s.sha)).toEqual(m.sentences.map((s) => s.sha));
    expect(JSON.parse(readFileSync(join(dir, 'narration.json'), 'utf8')).sentences).toHaveLength(3);
    await narrate(seg, dir, { tts: fake, force: true });
    expect(calls).toBe(6);
    // a different voice never reuses another voice's files
    const other = checkSegment(inputs({ config: { voice: { provider: 'fake', voice: 'w', rate: '+0%' } } }));
    await narrate(other, dir, { tts: fake });
    expect(calls).toBe(9);
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
  it('knows its providers and their licences', () => {
    expect(provider('edge').licence).toMatch(/draft only/);
    expect(provider('openai').licence).toMatch(/^commercial/);
    expect(provider('azure').licence).toMatch(/^commercial/);
    expect(() => provider('nope')).toThrow(/unknown TTS provider/);
    expect(speedOf('-20%')).toBeCloseTo(0.8);
    expect(speedOf('+0%')).toBe(1);
    expect(speedOf('junk')).toBe(1);
  });
  it('drives Azure Speech without a live call: escaped SSML at the edge rate, spoken words only', async () => {
    const speak: Speak = async (ssml, outFile, on) => {
      expect(ssml).toContain(
        '<voice name="en-US-AndrewMultilingualNeural"><prosody rate="-10%">Fish &amp; chips &lt;3.</prosody>',
      );
      writeFileSync(outFile, wav(1));
      on({ text: 'Fish', offset: 1e6, duration: 3e6, type: 'WordBoundary' });
      on({ text: '&', offset: 4e6, duration: 1e6, type: 'WordBoundary' });
      on({ text: '.', offset: 9e6, duration: 1e6, type: 'PunctuationBoundary' });
    };
    const r = await azureProvider(speak).synthesize(
      'Fish & chips <3.',
      'en-US-AndrewMultilingualNeural',
      '-10%',
      join(dir, 'az'),
    );
    expect(r.format).toBe('wav');
    expect(r.words).toEqual([
      { text: 'Fish', start: 0.1, end: 0.4 },
      { text: '&', start: 0.4, end: 0.5 },
    ]);
    expect(r.cost).toBe(0.0002);
    expect(existsSync(join(dir, 'az.wav'))).toBe(true);
    // Azure sheds load with "No free synthesizer": retried after a pause, with the half-reported boundaries dropped
    let calls = 0;
    const flaky: Speak = async (_s, outFile, on) => {
      on({ text: 'Half', offset: 0, duration: 1e6, type: 'WordBoundary' });
      if (calls++ === 0)
        throw new Error(
          'Status(StatusCode="ResourceExhausted", Detail="No free synthesizer") websocket error code: 1013',
        );
      writeFileSync(outFile, wav(1));
      on({ text: 'done', offset: 1e6, duration: 1e6, type: 'WordBoundary' });
    };
    const again = await azureProvider(flaky, [1]).synthesize('Half done.', 'v', '+0%', join(dir, 'az3'));
    expect(calls).toBe(2);
    expect(again.words.map((w) => w.text)).toEqual(['Half', 'done']);
    // a sentence the SDK never answers is retried too
    let hung = 0;
    const hang: Speak = (_s, outFile, on) =>
      hung++ === 0
        ? new Promise(() => {})
        : (async () => {
            writeFileSync(outFile, wav(1));
            on({ text: 'late', offset: 0, duration: 1e6, type: 'WordBoundary' });
          })();
    const late = await azureProvider(hang, [1], 20).synthesize('late', 'v', '+0%', join(dir, 'az5'));
    expect(late.words.map((w) => w.text)).toEqual(['late']);
    const broken: Speak = async () => {
      throw new Error('azure speech failed: Unauthorized');
    };
    await expect(azureProvider(broken, [1]).synthesize('x', 'v', '+0%', join(dir, 'az4'))).rejects.toThrow(
      /Unauthorized/,
    );
    const silent: Speak = async (_s, _o, on) => on({ text: '.', offset: 0, duration: 1, type: 'PunctuationBoundary' });
    await expect(azureProvider(silent).synthesize('x', 'v', '+0%', join(dir, 'az2'))).rejects.toThrow(
      /no word boundaries/,
    );
  });
  it('drives the OpenAI speech and transcription endpoints without a live call', async () => {
    const seen: string[] = [];
    const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push(String(url));
      if (String(url).endsWith('/audio/speech')) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ voice: 'ash', response_format: 'wav', speed: 0.9 });
        return new Response(wav(1), { status: 200 });
      }
      expect(init?.body).toBeInstanceOf(FormData);
      return Response.json({ duration: 60, words: [{ word: 'Hello', start: 0.1, end: 0.4 }] });
    }) as typeof fetch;
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    try {
      const r = await openaiProvider(fetchMock).synthesize('Hello there.', 'ash', '-10%', join(dir, 'oa'));
      expect(r.format).toBe('wav');
      expect(r.words).toEqual([{ text: 'Hello', start: 0.1, end: 0.4 }]);
      expect(r.cost).toBeCloseTo(0.021, 4);
      expect(existsSync(join(dir, 'oa.wav'))).toBe(true);
      expect(seen).toHaveLength(2);
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPEN_API_KEY;
      await expect(openaiProvider(fetchMock).synthesize('x', 'ash', '+0%', join(dir, 'oa2'))).rejects.toThrow(
        /OPENAI_API_KEY/,
      );
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });
});

describe('build report limitations', () => {
  it('come from the provider and the renderer in use', () => {
    expect(providerLimitations('edge').length).toBeGreaterThan(0);
    expect(RENDERER_LIMITATIONS.length).toBeGreaterThan(0);
    expect(providerLimitations('openai').join()).not.toMatch(/edge-tts/);
    expect(providerLimitations('fake')).toEqual([]);
  });
});

describe('render cache key', () => {
  it('follows value imports to the end and skips type-only ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-imports-'));
    try {
      writeFileSync(
        join(dir, 'a.tsx'),
        "import { b } from './b';\nimport type { T } from './t';\nexport const a = b;\n",
      );
      writeFileSync(join(dir, 'b.ts'), "import { c } from './c';\nexport const b = c;\n");
      writeFileSync(join(dir, 'c.ts'), 'export const c = 1;\n');
      writeFileSync(join(dir, 't.ts'), 'export type T = number;\n');
      const names = [...deepImports([join(dir, 'a.tsx')])].map((f) => basename(f)).sort();
      expect(names).toEqual(['a.tsx', 'b.ts', 'c.ts']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('render config draft and render check', () => {
  // The fixture with its question turned into a diagram, which no generic kind can draw (sc01's phone is inferred).
  const withDiagram = () => {
    const p = scenes();
    p[2] = scene('sc03', ['s03'], { visual: { category: 'diagram', description: 'a flow of money' } });
    return inputs({ plan: p });
  };

  it('draftRenderConfig lists every scene, drafts the voice and chapters, and flags diagrams', () => {
    const { storyboard, script } = withDiagram();
    const { config, needsGraphics } = draftRenderConfig(storyboard, script);
    expect(config.scenes).toEqual(storyboard.scenes.map((s) => s.id));
    expect(needsGraphics).toEqual(['sc01', 'sc03']); // every animation and diagram is listed, never guessed
    expect(config.voice.rate).toBe('+0%');
    expect(config.chapters?.sc01).toBe('Hook');
  });

  it('initVideo writes a draft once and keeps it unless forced', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-init-'));
    try {
      const { storyboard, script } = withDiagram();
      const dir = scriptDir(script.topic, script.story, root);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(storyboard));
      writeFileSync(join(dir, 'script.json'), JSON.stringify(script));
      expect(initVideo(script.topic, script.story, { root })).toEqual({
        written: true,
        needsGraphics: ['sc01', 'sc03'],
      });
      const f = join(dir, 'video', 'render.json');
      writeFileSync(f, readFileSync(f, 'utf8').replace('"+0%"', '"+5%"')); // a tuned config
      expect(initVideo(script.topic, script.story, { root })).toEqual({ written: false, needsGraphics: ['sc03'] });
      expect(readFileSync(f, 'utf8')).toContain('"+5%"');
      expect(initVideo(script.topic, script.story, { root, force: true }).written).toBe(true);
      expect(readFileSync(f, 'utf8')).toContain('"+0%"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('renderCheck approves a graphic only at its current key', () => {
    const bespoke: KindRegistry = { 'x-phone': { component: 'Phone', accepts: ['animation'] } };
    const seg = checkSegment(inputs({ config: { kinds: { sc01: 'x-phone' as SceneKind } } }), bespoke);
    const unreviewed = renderCheck(seg, null, 'c', bespoke);
    expect(unreviewed.graphics).toEqual([
      {
        scene: 'sc01',
        kind: 'x-phone',
        key: graphicKey(seg.scenes[0].scene, 'x-phone' as SceneKind, bespoke),
        approved: false,
      },
    ]);
    expect(unreviewed.ok).toBe(true); // ok covers renderability; approval is checked by renderCheckProblems
    const at = (key: string): VisualReview => ({
      scenes: { sc01: { key, verdict: 'approved', notes: '', reviewer: 'r', date: 'd' } },
    });
    expect(renderCheck(seg, at(unreviewed.graphics[0].key), 'c', bespoke).graphics[0].approved).toBe(true);
    expect(renderCheck(seg, at('stale'), 'c', bespoke).graphics[0].approved).toBe(false);
  });

  it('a diagram without a renderer needs a graphic, not a problem', () => {
    const plan = scenes();
    plan[0] = { ...plan[0], visual: { category: 'diagram', description: 'a flow' } };
    const rc = renderCheck(checkSegment(inputs({ plan })), null, 'c', {});
    expect(rc.needsGraphics).toEqual(['sc01']);
    expect(rc.problems).toEqual([]);
    expect(rc.ok).toBe(false);
  });

  it('a bespoke kind draws its own registered assets', () => {
    const plan = scenes();
    plan[0] = { ...plan[0], visual: { category: 'diagram', description: 'a flow', assetIds: ['phone-ui'] } };
    const bespoke: KindRegistry = { 'x-flow': { component: 'Text', accepts: ['diagram'] } };
    const unknown = { ...plan[0], visual: { ...plan[0].visual, assetIds: ['made-for-sc01'] } };
    const inp = inputs({ plan: [unknown, plan[1], plan[2]], config: { kinds: { sc01: 'x-flow' as SceneKind } } });
    expect(checkSegment(inp, bespoke).problems.join()).not.toMatch(/has no renderer/);
  });

  it('a bar with dollar points is a problem', () => {
    const plan = scenes();
    plan[1] = {
      ...plan[1],
      visual: {
        ...plan[1].visual,
        chart: { ...plan[1].visual.chart!, type: 'bar', points: [{ ...POINTS[0], unit: 'usd' }] },
      },
    };
    expect(checkSegment(inputs({ plan, config: { cues: {} } })).problems.join('\n')).toContain(
      'bar draws percent and count points',
    );
  });
});

describe('StackedBar', () => {
  it('StackedBar headline and colours', () => {
    expect(headlineNumber('bills only')).toBeNull();
    expect(headlineNumber('601 people asked')).toBe(601);
    expect(segmentColors('slate,red,muted')).toEqual([theme.slate, theme.red, theme.muted]);
    expect(segmentColors('slate,purple')).toEqual([theme.slate, theme.muted]);
    expect(segmentColors(undefined)).toEqual([theme.red, theme.slate, theme.green]);
  });
});

describe('look', () => {
  it('renders the one look: scenes read the theme at render time', () => {
    expect(segmentColors('red')).toEqual([theme.red]);
  });
  it('counts a figure up in its own format and lands on the display exactly', () => {
    expect(countUp('79.6', 79.6, 0.5)).toBe('39.8');
    expect(countUp('44%', 44, 0.5)).toBe('22%');
    expect(countUp('677,876', 677876, 0.5)).toBe('338,938');
    expect(countUp('$9,450', 9450, 0)).toBe('$0');
    expect(countUp('79.6', 79.6, 1)).toBe('79.6');
    expect(countUp('$300-$650', 300, 0.5)).toBe('$300-$650'); // not one plain figure
    expect(countUp('80', 79.6, 0.5)).toBe('80'); // a rounded display is never recomputed
  });
});

describe('shorts: portrait frame and kinds', () => {
  const short: ShortBlock = {
    parent: 'decision:mlm-and-seminars',
    key: 's02',
    slug: 'half-lost-money',
    format: 'ONE FIGURE FROM THE RECORD',
    sentences: ['s02'],
    hook: 'Nearly half of them lost money.',
    carries: [],
    maxSeconds: 170,
    parentFingerprints: { package: 'p', script: 's', release: 'r' },
  };
  const shortInputs = (over: Parameters<typeof inputs>[0] = {}) => {
    const inp = inputs({ release: true, ...over });
    return { ...inp, pkg: { ...inp.pkg, short } };
  };
  it('infers the portrait kinds from the same rules and keeps every name unique', () => {
    const q = { visual: { category: 'typography' as const, description: 'q', onScreenText: ['Why?'] } };
    expect(kindOf(q, undefined, {}, SHORT_GENERIC)).toBe('short-question');
    expect(kindOf(q)).toBe('question');
    const tiles = {
      visual: {
        category: 'data-chart' as const,
        description: 't',
        chart: { type: 'stat-tiles' as const, points: [] },
      },
    };
    expect(kindOf(tiles, undefined, {}, SHORT_GENERIC)).toBe('short-stat-tiles');
    expect(kindOf({ visual: { category: 'diagram', description: 'd' } }, undefined, {}, SHORT_GENERIC)).toBeNull();
    expect(registryFor({ short })).toBe(SHORT_GENERIC);
    expect(registryFor(null)).toBe(GENERIC);
    for (const k of Object.keys(SHORT_GENERIC)) {
      expect(GENERIC).not.toHaveProperty(k);
      for (const reg of Object.values(BESPOKE)) expect(reg).not.toHaveProperty(k);
      expect(COMPONENTS).toHaveProperty(SHORT_GENERIC[k as keyof typeof SHORT_GENERIC].component);
    }
  });
  it('selects the portrait registry for a short package and judges bar units by the chart, not the name', () => {
    const inp = shortInputs({ config: { scenes: ['sc03'] } });
    const seg = checkSegment(inp);
    expect(seg.problems).toEqual([]);
    expect(seg.scenes[0].kind).toBe('short-question');
    const whole = checkSegment(shortInputs());
    expect(whole.problems.join()).toMatch(/sc01: no renderer/);
    const usd = [{ label: 'participants', value: 601, unit: 'usd' as const, display: '$601', cite: DOC_D }];
    const bar = scenes();
    bar[1] = scene('sc02', ['s02'], {
      visual: { category: 'data-chart', description: 'bar', chart: { type: 'bar', points: usd } },
      citations: [{ label: 'Survey D', cite: DOC_D }],
    });
    const b = checkSegment(shortInputs({ plan: bar, config: { scenes: ['sc02'] } }));
    expect(b.problems.join()).toMatch(/short-bar draws percent and count/);
    bar[1] = scene('sc02', ['s02'], {
      visual: { category: 'data-chart', description: 'tiles', chart: { type: 'stat-tiles', points: usd } },
      citations: [{ label: 'Survey D', cite: DOC_D }],
    });
    const tiles = checkSegment(shortInputs({ plan: bar, config: { scenes: ['sc02'] } }));
    expect(tiles.problems).toEqual([]);
    expect(tiles.scenes[0].kind).toBe('short-stat-tiles');
  });
  it('builds a portrait timeline that names the format and the institution', () => {
    const inp = shortInputs({ config: { scenes: ['sc03'] } });
    const tl = buildTimeline(checkSegment(inp), manifest(inp), 30, read);
    expect([tl.width, tl.height]).toEqual([1080, 1920]);
    expect(tl.short).toMatchObject({ format: 'ONE FIGURE FROM THE RECORD', parent: 'decision:mlm-and-seminars' });
    expect(tl.short!.commission).toBeTruthy();
    const video = buildTimeline(checkSegment(inputs()), manifest(inputs()), 30, read);
    expect([video.width, video.height]).toEqual([1920, 1080]);
    expect(video.short).toBeUndefined();
    expect(sceneKey(tl.scenes[0], tl)).not.toBe(sceneKey(tl.scenes[0], { ...tl, width: 1920, height: 1080 }));
  });
  it('checks the three-minute rule on portrait builds only', () => {
    expect(shortChecks({ duration: 181 }, { width: 1080, height: 1920 })[0]).toMatchObject({
      name: 'short length',
      ok: false,
    });
    expect(shortChecks({ duration: 120 }, { width: 1080, height: 1920 })[0].ok).toBe(true);
    expect(shortChecks({ duration: 600 }, { width: 1920, height: 1080 })).toEqual([]);
  });
  it('lays the citation block above the overlay in portrait and leaves landscape alone', () => {
    const inp = shortInputs({ config: { scenes: ['sc03'] } });
    const tl = buildTimeline(checkSegment(inp), manifest(inp), 30, read);
    const two = {
      ...tl.scenes[0],
      citations: [
        { label: 'a', detail: 'b' },
        { label: 'c', detail: 'd' },
      ],
    };
    expect(citationTop(two, 28, PORTRAIT)).toBe(SHORT_LAYOUT.citationBottom - 76 * 2 - 28);
    expect(citationTop(two)).toBe(1080 - 56 - 72 * 2 - 28);
    expect(citationTop(tl.scenes[0], 28, PORTRAIT)).toBe(SHORT_LAYOUT.citationBottom);
    expect(SHORT_LAYOUT.captionBottom).toBeLessThan(citationTop(two, 28, PORTRAIT));
  });
  it('cuts captions into cards of at most six words from the measured timings', () => {
    const inp = inputs({ config: { scenes: ['sc02'] } });
    const tl = buildTimeline(checkSegment(inp), manifest(inp), 30, read);
    const cards = captionCards(tl.scenes[0]);
    const words = tl.scenes[0].sentences.flatMap((s) => s.words);
    expect(cards.flatMap((c) => c.words.map((w) => w.text))).toEqual(words.map((w) => w.text));
    for (const c of cards) expect(c.words.length).toBeLessThanOrEqual(6);
    expect(cards[0].words[0].frame).toBe(words[0].frame);
    // a provider token split at a hyphen is rejoined; a card breaks early after punctuation once it has three words
    const split = {
      ...tl.scenes[0],
      sentences: [
        {
          ...tl.scenes[0].sentences[0],
          words: ['For', 'oil-', 'heated', 'homes,', 'the', 'line', 'moved', 'lower.'].map((text, i) => ({
            text,
            frame: i * 10,
            end: i * 10 + 8,
          })),
        },
      ],
    };
    const sc = captionCards(split);
    expect(sc.map((c) => c.words.map((w) => w.text))).toEqual([
      ['For', 'oil-heated', 'homes,'],
      ['the', 'line', 'moved', 'lower.'],
    ]);
    expect(sc[0].words[1]).toMatchObject({ frame: 10, end: 28 });
  });
});

describe('shorts: end card and length', () => {
  it('init names the end card for the close scene of a short and never for a video', () => {
    const g = good();
    const s: Script = {
      ...g,
      sections: [
        { name: 'hook', sentences: [sentences(g)[0]] },
        { name: 'finding', sentences: [sentences(g)[1]] },
        { name: 'close', sentences: [sentences(g)[2]] },
      ],
    };
    const v = run(s, approveAll(s));
    const sb = buildStoryboard(
      { ...plan(scenes(), s), assets: { 'phone-ui': { kind: 'animation', description: 'phone' } } },
      s,
      v,
      pkg(),
      read,
    );
    expect(draftRenderConfig(sb, s, SHORT_GENERIC).config.kinds).toMatchObject({ sc03: 'short-endcard' });
    expect(draftRenderConfig(sb, s).config.kinds?.sc03).toBeUndefined();
    expect(kindOf(sb.scenes[2], 'short-endcard', {}, SHORT_GENERIC)).toBe('short-endcard');
    expect(kindOf(sb.scenes[2], undefined, {}, SHORT_GENERIC)).toBe('short-question');
  });
  it('caps a short at a minute and carries the institution and question for the end card', () => {
    expect(SHORT_MAX_SECONDS).toBe(60);
    const short: ShortBlock = {
      parent: 'decision:mlm-and-seminars',
      key: 's02',
      slug: 'x',
      format: 'ONE FIGURE FROM THE RECORD',
      sentences: ['s02'],
      hook: 'h',
      carries: [],
      maxSeconds: SHORT_MAX_SECONDS,
      parentFingerprints: { package: 'p', script: 's', release: 'r' },
    };
    const inp = inputs({ release: true, config: { scenes: ['sc03'] } });
    const tl = buildTimeline(checkSegment({ ...inp, pkg: { ...inp.pkg, short } }), manifest(inp), 30, read);
    expect(tl.short?.question).toBe(inp.pkg.question);
    expect(tl.short).toHaveProperty('commissionKey');
    const other = { ...tl, short: { ...tl.short!, question: 'Another?' } };
    expect(sceneKey(tl.scenes[0], tl)).not.toBe(sceneKey(other.scenes[0], other));
  });
});
