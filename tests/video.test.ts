// The video stage: segment selection against the validated script, narration caching, the timeline from measured
// audio, cue resolution, chart timing, excerpt extraction, the render cache key, assembly contiguity, the ffmpeg
// wrapper and the providers. The synthetic fixture needs no TTS; the tests on the real MLM storyboard read the
// committed artifacts (the opening four scenes are the spike's regression fixture).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { scriptFingerprint } from '../src/lib/script';
import type { Storyboard } from '../src/lib/storyboard';
import { pointFrames } from '../src/video/chart';
import { cue, lineFrames, spokenAt } from '../src/video/cues';
import { excerptWindow, flowPassage } from '../src/video/excerpt';
import { type Probe, audioStats, probe } from '../src/video/ffmpeg';
import { BESPOKE } from '../src/video/bespoke';
import { ALL_KINDS, GENERIC, bespokeFor, kindOf, unsupportedWhy } from '../src/video/kinds';
import { COMPONENTS } from '../src/video/remotion/scenes';
import { narrate } from '../src/video/narration';
import { TOLERANCE, blankChecks, contentChecks, soundtrackChecks, syncChecks } from '../src/video/qa';
import { assemble } from '../src/video/assemble';
import { deepImports, relativeScene, sceneKey } from '../src/video/render';
import { checkSegment, citationDetail, loadSegment } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import { type TtsProvider, provider, providerLimitations } from '../src/video/tts';
import { RENDERER_LIMITATIONS } from '../src/video/remotion/limitations';
import { openaiProvider, speedOf } from '../src/video/tts/openai';
import type { TimelineScene } from '../src/video/types';
import { alignLine, findWord, tokens } from '../src/video/words';
import { DOC_D, pkg, read, scene } from './script-helpers';
import { POINTS, inputs, manifest, scenes } from './video-helpers';

const MLM = ['get-rich-quick', 'decision:mlm-and-seminars'] as const;

describe('segment selection', () => {
  it('accepts the fixture: kinds, sentences, citations', () => {
    const seg = checkSegment(inputs({ release: true }));
    expect(seg.problems).toEqual([]);
    expect(seg.scenes.map((s) => s.kind)).toEqual(['phone', 'stacked-bar', 'question']);
    expect(seg.sentences.map((s) => s.id)).toEqual(['s01', 's02', 's03']);
    expect(seg.scenes[1].citations[0]).toMatchObject({ label: 'Survey D' });
    expect(seg.scenes[1].citations[0].detail).toMatch(/survey-d\.txt, lines 1-2/);
  });
  it('loads the whole MLM storyboard with a kind for every scene', () => {
    const seg = loadSegment(...MLM);
    expect(seg.scenes.length).toBe(seg.storyboard.scenes.length);
    expect(seg.scenes.slice(0, 4).map((s) => s.kind)).toEqual(['phone', 'tree', 'quote', 'stacked-bar']); // the spike
    expect(seg.sentences.slice(0, 5).map((s) => s.id)).toEqual(['s01', 's02', 's03', 's04', 's05']);
    expect(seg.scenes[3].scene.visual.chart?.points.map((p) => p.value)).toEqual([47, 27, 25]);
    expect(seg.scenes[3].citations[0].detail).toContain('lines 135-139');
    expect(new Set(seg.scenes.map((s) => s.kind)).size).toBeGreaterThan(20);
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
  });
  it('takes a bespoke kind from render.json only when it draws the category', () => {
    const p = scenes();
    p[0] = scene('sc01', ['s01'], { visual: { category: 'animation', description: 'push in' } });
    const mine = bespokeFor('get-rich-quick/decision-mlm-and-seminars');
    const ok = checkSegment(inputs({ plan: p, config: { kinds: { sc01: 'fine-print' } } }), mine);
    expect(ok.problems).toEqual([]);
    expect(ok.scenes[0].kind).toBe('fine-print');
    // Another video's bespoke kind is unknown here: the fixture's video registers none.
    const elsewhere = checkSegment(inputs({ plan: p, config: { kinds: { sc01: 'fine-print' } } }));
    expect(elsewhere.problems.join()).toMatch(/unknown to this video/);
    const wrong = checkSegment(inputs({ plan: p, config: { kinds: { sc01: 'waffle' } } }), mine);
    expect(wrong.problems.join()).toMatch(/does not draw animation/);
    const unknown = checkSegment(inputs({ config: { kinds: { sc01: 'hologram' as never } } }));
    expect(unknown.problems.join()).toMatch(/unknown/);
  });
  it('one record per kind: a known component, a category, and names unique across videos', () => {
    const names = [GENERIC, ...Object.values(BESPOKE)].flatMap((r) => Object.keys(r));
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
    expect(() => provider('nope')).toThrow(/unknown TTS provider/);
    expect(speedOf('-20%')).toBeCloseTo(0.8);
    expect(speedOf('+0%')).toBe(1);
    expect(speedOf('junk')).toBe(1);
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
    const committed = JSON.parse(
      readFileSync(
        join(...MLM.slice(0, 1), 'scripts', 'decision-mlm-and-seminars', 'video', 'build-report.json'),
        'utf8',
      ),
    ) as { narration: { provider: string }; limitations: string[] };
    expect(committed.limitations.slice(1, 4)).toEqual([
      ...providerLimitations(committed.narration.provider),
      ...RENDERER_LIMITATIONS,
    ]);
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
