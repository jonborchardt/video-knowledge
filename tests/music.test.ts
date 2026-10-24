// The soundtrack: the PCM mixer (placement, loops with a crossfade, fades, gain, ducking, peak management), the music
// contract (anchors, cue sheet validation against the compositions on disk, fingerprints), the mix under a narration
// track end to end (synthetic WAVs, no TTS, no strudel-bench), what it does not touch (the chunk cache), the report's
// clearance and the production board's reading of it. The MLM cue sheet is checked against its committed timeline.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson, sha, ROOT } from '../src/lib/io';
import type { Script } from '../src/lib/script';
import { draftCueSheet, pickComposition } from '../src/video/music-draft';
import { probe } from '../src/video/ffmpeg';
import {
  CHANNELS,
  type Placement,
  RATE,
  dbToGain,
  decodePcm,
  duckAt,
  mixDown,
  peak,
  placeCue,
  rmsDb,
} from '../src/video/mix';
import { mixSoundtrack } from '../src/video/assemble';
import {
  type Composition,
  MIX_FILE,
  type MixReport,
  type MusicConfig,
  anchorSeconds,
  loadComposition,
  musicFingerprint,
  parseAnchor,
  resolveCues,
  speechSpans,
} from '../src/video/music';
import { MUSIC_TOLERANCE } from '../src/video/qa';
import { sceneKey } from '../src/video/render';
import { type BuildReport, buildReport } from '../src/video/report';
import { checkSegment } from '../src/video/select';
import { buildTimeline } from '../src/video/timeline';
import type { Timeline } from '../src/video/types';
import {
  CHECKLIST,
  DRAFT_CHECK,
  REVIEW_FILES,
  chapters,
  renderChecklist,
  renderDescription,
  renderReadme,
  reviewData,
  reviewInputProblem,
  reviewMp4Name,
  thumbnailScene,
} from '../src/video/package';
import { site } from '../src/config/site';
import { inputs, manifest } from './video-helpers';

describe('review package chapters', () => {
  const tl = (): Timeline => {
    const t = buildTimeline(checkSegment(inputs()), manifest(inputs()));
    // stretch the fixture's scenes to 20 s each so the YouTube 10 s rule is not what is being tested
    t.scenes.forEach((s, i) => Object.assign(s, { start: i * 600, duration: 600 }));
    return { ...t, durationInFrames: t.scenes.length * 600 };
  };
  const seg = (ch?: Record<string, string>) => checkSegment(inputs({ config: ch ? { chapters: ch } : {} }));
  it('takes render.json chapters at measured starts, first pinned to 0:00', () => {
    const c = chapters(seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' }), tl());
    expect(c.map((x) => [x.stamp, x.title])).toEqual([
      ['0:00', 'One'],
      ['0:20', 'Two'],
      ['0:40', 'Three'],
    ]);
  });
  it('refuses chapters YouTube would ignore, and scenes that are not there', () => {
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two' }), tl())).toThrow(/at least 3/);
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two', sc99: 'X' }), tl())).toThrow(/sc99, not in the timeline/);
    const tight = tl();
    tight.scenes[1].start = 150; // 5 s after the first
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' }), tight)).toThrow(/under 10 s: Two/);
  });
  it('packages only the mp4 QA checked, and renders every file from the package data', () => {
    const s = seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' });
    const t = tl();
    const built = buildReport(
      s,
      t,
      manifest(inputs()),
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      { ok: true, checks: [], frames: [] },
      'cmd',
    );
    const report: BuildReport = { ...built, output: { ...built.output!, sha: 'checked' } };
    expect(reviewInputProblem(report, 'checked')).toBeNull();
    expect(reviewInputProblem(report, 'other')).toMatch(/not the file QA checked/);
    expect(reviewInputProblem(report, null)).toMatch(/render first/);
    expect(reviewInputProblem({ ...report, qa: { ...report.qa, ok: false } }, 'checked')).toMatch(/QA failed/);
    const made = {
      mp4: 'x-review-private.mp4',
      mp4Sha: 'checked',
      buildReport: 'b',
      thumbnailSha: null,
      captionsSha: null,
      generatedAt: 'd',
    };
    const pkg = reviewData(s, t, report, made);
    expect(pkg.chapters.map((c) => c.title)).toEqual(['One', 'Two', 'Three']);
    expect(pkg.files).not.toContain(REVIEW_FILES.thumbnail);
    expect(pkg.thumbnailSha).toBeNull();
    const withCard = reviewData(s, t, report, { ...made, thumbnailSha: 'card1' });
    expect(withCard.thumbnailSha).toBe('card1');
    expect(withCard.files).toContain(REVIEW_FILES.thumbnail);
    expect(pkg.captionsSha).toBeNull();
    expect(pkg.files).not.toContain(REVIEW_FILES.captions);
    const withCaptions = reviewData(s, t, report, { ...made, captionsSha: 'cap1' });
    expect(withCaptions.captionsSha).toBe('cap1');
    expect(withCaptions.files).toContain('captions.en.srt');
    expect(renderDescription(pkg, s, t, report)).toContain('0:20 Two');
    expect(renderReadme(pkg, t, report)).toContain(made.mp4);
    expect(renderChecklist(pkg, t)).toContain(CHECKLIST[0]);
    expect(pkg.status).toBe('private review build');
    expect(pkg.title).toMatch(/^\[PRIVATE REVIEW\]/);
    expect(pkg.checklist).toContain(DRAFT_CHECK);
    expect(renderDescription(pkg, s, t, report)).toMatch(/^PRIVATE REVIEW BUILD/);
    expect(reviewMp4Name(join('t', 'scripts', 'x', 'video'))).toBe('x-review-private.mp4');
    // a cleared build (what `final` produces) is the release package: no private banner, no draft-voice check
    const cleared: BuildReport = {
      ...report,
      narration: { ...report.narration, publishable: true },
      clearance: { narration: true, music: true, publishable: true, why: [] },
    };
    const rel = reviewData(s, t, cleared, { ...made, mp4: 'x.mp4' });
    expect(rel.status).toBe('release build');
    expect(rel.title).toBe(t.title);
    expect(rel.checklist).not.toContain(DRAFT_CHECK);
    const desc = renderDescription(rel, s, t, cleared);
    expect(desc).not.toMatch(/PRIVATE|DRAFT|Narration|clearance/i);
    expect(desc).toContain('0:20 Two');
    // the description fits YouTube's 5000 bytes: the sources live on the site, one link replaces the list
    expect(desc).toContain(`${site.url}${t.topic}/`);
    expect(desc).not.toContain('Sources discussed');
    expect(Buffer.byteLength(desc, 'utf8')).toBeLessThan(5000);
    expect(renderReadme(withCaptions, t, report)).toContain('captions.en.srt');
    expect(renderReadme(rel, t, cleared)).toMatch(/^# RELEASE BUILD/);
    expect(renderReadme(rel, t, cleared)).toContain('**public**');
    expect(renderReadme(rel, t, cleared)).toContain('npm run publish -- approve');
    expect(renderReadme(rel, t, cleared)).not.toContain('production.json');
    expect(renderReadme(pkg, t, report)).toContain('npm run publish -- uploaded');
    expect(renderChecklist(rel, t)).toContain('release build');
    expect(reviewMp4Name(join('t', 'scripts', 'x', 'video'), true)).toBe('x.mp4');
    expect(thumbnailScene(t)).toBeNull(); // the fixture has no title card
  });
});

const sec = (s: number) => Math.round(s * RATE);
/** A stereo buffer `seconds` long filled by `f(t)` on both channels. */
const tone = (seconds: number, f: (t: number) => number) => {
  const out = new Float32Array(sec(seconds) * CHANNELS);
  for (let i = 0; i < out.length / 2; i++) out[i * 2] = out[i * 2 + 1] = f(i / RATE);
  return out;
};
const silence = (seconds: number) => new Float32Array(sec(seconds) * CHANNELS);
const place = (over: Partial<Placement>): Placement => ({
  id: 'c',
  pcm: tone(1, () => 0.5),
  start: 0,
  end: 1,
  offset: 0,
  gain: 0,
  fadeIn: 0,
  fadeOut: 0,
  loop: false,
  crossfade: 0,
  duck: null,
  ...over,
});
const at = (bus: Float32Array, t: number) => bus[sec(t) * CHANNELS];

/** A 16-bit stereo WAV of `pcm` (interleaved float). */
function wav(pcm: Float32Array): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(CHANNELS, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * CHANNELS * 2, 28);
  b.writeUInt16LE(CHANNELS * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++)
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  return b;
}

describe('pcm mixer', () => {
  it('places a cue at its gain between its anchors and nowhere else', () => {
    const bus = silence(3);
    const sounded = placeCue(bus, place({ start: 1, end: 2, gain: -6 }), []);
    expect(sounded).toEqual([1, 2]);
    expect(at(bus, 0.5)).toBe(0);
    expect(at(bus, 1.5)).toBeCloseTo(0.5 * dbToGain(-6), 4);
    expect(at(bus, 2.5)).toBe(0);
  });
  it('fades in and out, never starting or stopping on a non-zero sample', () => {
    const bus = silence(4);
    placeCue(bus, place({ start: 1, end: 3, fadeIn: 0.5, fadeOut: 1, loop: true }), []);
    expect(Math.abs(at(bus, 1))).toBeLessThan(0.01);
    expect(at(bus, 1.25)).toBeGreaterThan(0.3);
    expect(at(bus, 1.25)).toBeLessThan(0.5);
    expect(at(bus, 1.75)).toBeCloseTo(0.5, 3);
    expect(at(bus, 2.5)).toBeGreaterThan(0.3);
    expect(at(bus, 2.5)).toBeLessThan(0.5);
    expect(Math.abs(bus[(sec(3) - 1) * CHANNELS])).toBeLessThan(0.01);
    // no fade asked for still gets the declick
    const dry = silence(2);
    placeCue(dry, place({ start: 0.5, end: 1.5 }), []);
    expect(Math.abs(at(dry, 0.5))).toBeLessThan(0.01);
    expect(at(dry, 1)).toBeCloseTo(0.5, 3);
  });
  it('loops a short asset to fill the span and stops an unlooped one where the asset ends', () => {
    const ramp = tone(1, (t) => t); // 0 at the start of the asset, 1 at its end
    const looped = silence(4);
    expect(placeCue(looped, place({ pcm: ramp, start: 0, end: 3.5, loop: true }), [])).toEqual([0, 3.5]);
    expect(at(looped, 2.25)).toBeCloseTo(0.25, 2);
    expect(at(looped, 3.4)).toBeGreaterThan(0.3);
    const once = silence(4);
    expect(placeCue(once, place({ pcm: ramp, start: 1, end: 3.5 }), [])).toEqual([1, 2]);
    expect(at(once, 1.5)).toBeCloseTo(0.5, 2);
    expect(at(once, 2.5)).toBe(0);
    // an offset starts inside the asset
    const off = silence(2);
    placeCue(off, place({ pcm: ramp, start: 0, end: 1, offset: 0.5 }), []);
    expect(at(off, 0.25)).toBeCloseTo(0.75, 2);
    expect(at(off, 0.75)).toBe(0);
  });
  it('crossfades a dry-headed, cut-tailed asset at every seam instead of butt-joining it', () => {
    // a 2 s asset that starts from silence and ends mid-swing, like a strudel-bench section render
    const asset = tone(2, (t) => (t < 0.1 ? 0 : 0.5 * Math.sin(2 * Math.PI * 50.125 * t))); // ends on a peak
    const jump = (bus: Float32Array, from: number, to: number) => {
      let m = 0;
      for (let i = sec(from); i < sec(to); i++) m = Math.max(m, Math.abs(bus[i * CHANNELS] - bus[(i - 1) * CHANNELS]));
      return m;
    };
    const butt = silence(7);
    placeCue(butt, place({ pcm: asset, start: 0, end: 7, loop: true, crossfade: 0 }), []);
    const faded = silence(7);
    placeCue(faded, place({ pcm: asset, start: 0, end: 7, loop: true, crossfade: 0.5 }), []);
    const normal = jump(faded, 0.3, 1.4); // inside the asset: the sine's own slope
    expect(jump(butt, 1.99, 2.01)).toBeGreaterThan(normal * 2); // the cut tail meets the silent head: a step
    expect(jump(faded, 1.49, 1.51)).toBeLessThan(normal * 1.2); // period 1.5 s: the seam is as smooth as the sine
    expect(jump(faded, 2.99, 3.01)).toBeLessThan(normal * 1.2);
    expect(rmsDb(faded, 4, 6)).toBeGreaterThan(-20); // and the music keeps going
  });
  it('ducks under speech with an attack before and a release after', () => {
    const duck = { db: -6, attack: 1, release: 2 };
    expect(duckAt(5, [[4, 6]], duck)).toBeCloseTo(dbToGain(-6), 6);
    expect(duckAt(3.5, [[4, 6]], duck)).toBeCloseTo(dbToGain(-3), 6);
    expect(duckAt(2.9, [[4, 6]], duck)).toBe(1);
    expect(duckAt(7, [[4, 6]], duck)).toBeCloseTo(dbToGain(-3), 6);
    expect(duckAt(8.1, [[4, 6]], duck)).toBe(1);
    expect(duckAt(5, [], duck)).toBe(1);
    const bus = silence(10);
    placeCue(bus, place({ pcm: tone(1, () => 0.5), start: 0, end: 10, loop: true, duck }), [[4, 6]]);
    expect(at(bus, 2)).toBeCloseTo(0.5, 3);
    expect(at(bus, 5)).toBeCloseTo(0.5 * dbToGain(-6), 2);
    expect(at(bus, 9)).toBeCloseTo(0.5, 3);
  });
  it('turns the music down, never the voice, until the sum stays under the ceiling', () => {
    const voice = tone(1, (t) => (t > 0.4 && t < 0.6 ? 0.85 : 0));
    const music = tone(1, () => 0.3);
    const m = mixDown(voice, music, -1);
    expect(m.musicScale).toBeLessThan(1);
    expect(m.musicScale).toBeGreaterThan(0);
    expect(peak(m.pcm)).toBeLessThanOrEqual(dbToGain(-1) + 1e-4);
    expect(at(m.pcm, 0.5)).toBeGreaterThanOrEqual(0.85); // the voice is intact
    const quiet = mixDown(
      voice,
      tone(1, () => 0.01),
      -1,
    );
    expect(quiet.musicScale).toBe(1);
    expect(quiet.peakDb).toBeCloseTo(20 * Math.log10(0.86), 0);
    expect(() => mixDown(voice, silence(2), -1)).toThrow(/differ in length/);
  });
  it('adds no music where the voice alone reaches the ceiling, and does not let that sample zero the bed', () => {
    const voice = tone(1, (t) => (Math.abs(t - 0.5) < 0.001 ? 0.95 : 0.1));
    const m = mixDown(
      voice,
      tone(1, () => 0.2),
      -1,
    );
    expect(m.musicScale).toBe(1);
    expect(at(m.pcm, 0.5)).toBeCloseTo(0.95, 4);
    expect(at(m.pcm, 0.2)).toBeCloseTo(0.3, 4);
  });
  it('refuses an empty asset', () => {
    expect(() => placeCue(silence(1), place({ pcm: new Float32Array(0) }), [])).toThrow(/no audio/);
  });
});

/** A timeline of three scenes, 10 s each at 30 fps, one 4 s sentence per scene starting 1 s in. */
function timeline(): Timeline {
  const fps = 30;
  const scene = (id: string, order: number) => ({
    id,
    order,
    category: 'typography' as const,
    kind: 'question' as const,
    start: (order - 1) * 300,
    duration: 300,
    sentences: [
      {
        id: `s0${order}`,
        text: 'x',
        start: (order - 1) * 300 + 30,
        duration: 120,
        audio: 'a.wav',
        audioSeconds: 4,
        words: [],
      },
    ],
    cues: {},
    onScreenText: [],
    chart: null,
    excerpt: null,
    citations: [],
    assets: [],
    options: {},
  });
  return {
    topic: 't',
    story: 's',
    title: 'T',
    fps,
    width: 1920,
    height: 1080,
    durationInFrames: 900,
    fingerprints: { script: 'a', storyboard: 'b', narration: 'c', config: 'd' },
    narration: { provider: 'fake', voice: 'v', rate: '+0%', licence: 'test' },
    scenes: [scene('sc01', 1), scene('sc02', 2), scene('sc03', 3)],
  };
}

describe('music contract', () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-music-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const compDir = join(root, 'music', 'bed');
  mkdirSync(compDir, { recursive: true });
  const loopWav = wav(tone(2, (t) => 0.4 * Math.sin(2 * Math.PI * 220 * t)));
  const endWav = wav(tone(3, (t) => 0.4 * Math.sin(2 * Math.PI * 110 * t) * (1 - t / 3)));
  writeFileSync(join(compDir, 'loop.wav'), loopWav);
  writeFileSync(join(compDir, 'end.wav'), endWav);
  const composition: Composition = {
    id: 'bed',
    title: 'Bed',
    generator: { name: 'strudel-bench', repo: 'https://example.invalid/strudel-bench', version: 'abc1234' },
    source: { file: 'songs/bed.strudel', sha: 'deadbeef00', cps: 0.5, bpm: 120, key: 'D:minor' },
    licence: { cleared: true, samples: [], attribution: [] },
    variations: {
      loop: {
        file: 'loop.wav',
        sha: sha(loopWav),
        seconds: 2,
        cycles: 1,
        loop: true,
        crossfade: 0.25,
        command: 'x',
        renderedAt: 'd',
      },
      end: {
        file: 'end.wav',
        sha: sha(endWav),
        seconds: 3,
        cycles: 1,
        loop: false,
        crossfade: 0,
        command: 'x',
        renderedAt: 'd',
      },
    },
  };
  writeFileSync(join(compDir, 'composition.json'), JSON.stringify(composition));
  const tl = timeline();
  const cfg = (over: Partial<MusicConfig> = {}): MusicConfig => ({
    duck: { db: -3, attack: 0.3, release: 1 },
    cues: [
      { id: 'a', asset: 'bed/loop', from: 'sc01', to: 'sc02', gain: -12, fadeIn: 1, fadeOut: 2 },
      { id: 'b', asset: 'bed/end', from: 'sc03', to: 'sc03', gain: -6, duck: null },
    ],
    ...over,
  });

  it('parses anchors: a scene edge with an optional offset', () => {
    expect(parseAnchor('sc12', 'start')).toEqual({ scene: 'sc12', edge: 'start', offset: 0 });
    expect(parseAnchor('sc12', 'end')).toEqual({ scene: 'sc12', edge: 'end', offset: 0 });
    expect(parseAnchor('sc12:end-2', 'start')).toEqual({ scene: 'sc12', edge: 'end', offset: -2 });
    expect(parseAnchor('sc20+1.5', 'end')).toEqual({ scene: 'sc20', edge: 'end', offset: 1.5 });
    expect(() => parseAnchor('sc12 end', 'start')).toThrow(/bad anchor/);
    expect(anchorSeconds('sc02', 'start', tl)).toBe(10);
    expect(anchorSeconds('sc02', 'end', tl)).toBe(20);
    expect(anchorSeconds('sc02:start+2.5', 'end', tl)).toBe(12.5);
    expect(anchorSeconds('sc03+100', 'end', tl)).toBe(30); // clamped to the timeline
    expect(() => anchorSeconds('sc99', 'start', tl)).toThrow(/not in the timeline/);
  });

  it('resolves cues against the compositions with the variation defaults', () => {
    const cues = resolveCues(cfg(), tl, root);
    expect(cues.map((c) => [c.id, c.start, c.end])).toEqual([
      ['a', 0, 20],
      ['b', 20, 30],
    ]);
    expect(cues[0].loop).toBe(true);
    expect(cues[0].crossfade).toBe(0.25);
    expect(cues[0].duck).toEqual({ db: -3, attack: 0.3, release: 1 });
    expect(cues[1].loop).toBe(false);
    expect(cues[1].duck).toBeNull(); // null in the cue overrides the file's default
    expect(cues[1].fadeIn).toBe(1);
    expect(cues[1].fadeOut).toBe(2);
    expect(loadComposition('bed', root).title).toBe('Bed');
  });

  it('moves with the scenes: a longer scene stretches the cue without touching the cue sheet', () => {
    const longer = timeline();
    longer.scenes[1].duration = 600;
    longer.scenes[2].start = 900;
    longer.durationInFrames = 1200;
    const cues = resolveCues(cfg(), longer, root);
    expect(cues[0].end).toBe(30);
    expect(cues[1].start).toBe(30);
    expect(cues[1].end).toBe(40);
  });

  it('refuses what it cannot place, listing every problem', () => {
    const bad = (over: Partial<MusicConfig['cues'][number]>, re: RegExp) =>
      expect(() => resolveCues({ cues: [{ ...cfg().cues[0], ...over }] }, tl, root)).toThrow(re);
    bad({ asset: 'bed' }, /not <composition>\/<variation>/);
    bad({ asset: 'nope/loop' }, /no music\/nope\/composition.json/);
    bad({ asset: 'bed/nope' }, /no variation "nope" \(loop, end\)/);
    bad({ from: 'sc03', to: 'sc01' }, /ends .* before it starts/);
    bad({ from: 'sc09' }, /scene sc09 is not in the timeline/);
    bad({ gain: 3 }, /gain must be/);
    bad({ duck: { db: 2, attack: 0, release: 0 } }, /duck needs/);
    expect(() => resolveCues({ cues: [cfg().cues[0], cfg().cues[0]] }, tl, root)).toThrow(/duplicate id/);
    // a missing or altered asset file is a problem, with the command that regenerates it
    writeFileSync(join(compDir, 'loop.wav'), wav(silence(1)));
    bad({}, /not the file the manifest describes/);
    rmSync(join(compDir, 'loop.wav'));
    bad({}, /loop.wav is missing; regenerate it: x/);
    writeFileSync(join(compDir, 'loop.wav'), loopWav);
    // every problem at once, across cues
    expect(() =>
      resolveCues(
        {
          cues: [
            { ...cfg().cues[0], from: 'sc09' },
            { ...cfg().cues[1], gain: 1 },
          ],
        },
        tl,
        root,
      ),
    ).toThrow(/cue a: anchor "sc09"[\s\S]*cue b: gain must be/);
  });

  it('fingerprints the cue sheet, the asset bytes and the placement, and nothing visual', () => {
    const a = musicFingerprint(cfg(), resolveCues(cfg(), tl, root));
    const louder = cfg({ cues: cfg().cues.map((c) => ({ ...c, gain: c.gain + 1 })) });
    expect(musicFingerprint(louder, resolveCues(louder, tl, root))).not.toBe(a);
    const moved = timeline();
    moved.scenes[1].duration = 330;
    moved.scenes[2].start = 630;
    moved.durationInFrames = 930;
    expect(musicFingerprint(cfg(), resolveCues(cfg(), moved, root))).not.toBe(a);
    expect(musicFingerprint(cfg(), resolveCues(cfg(), tl, root))).toBe(a);
    // the chunk cache does not know the soundtrack exists: a scene's key is the same with any cue sheet
    const inp = inputs();
    const real = buildTimeline(checkSegment(inp), manifest(inp));
    const keys = real.scenes.map((s) => sceneKey(s, real));
    expect(real).not.toHaveProperty('music');
    expect(real.scenes.map((s) => sceneKey(s, real))).toEqual(keys);
    expect(speechSpans(tl)).toEqual([
      [1, 5],
      [11, 15],
      [21, 25],
    ]);
  });

  it('mixes the soundtrack under a narration track and reports the levels', () => {
    const videoDir = join(root, 'video');
    mkdirSync(videoDir, { recursive: true });
    // the "narration": a 30 s track with a -12 dB tone wherever a sentence is spoken, silence elsewhere
    const spans = speechSpans(tl);
    const voice = tone(30, (t) =>
      spans.some(([a, b]) => t >= a && t < b) ? 0.25 * Math.sin(2 * Math.PI * 300 * t) : 0,
    );
    const narration = join(videoDir, 'narration.wav');
    writeFileSync(narration, wav(voice));
    const out = join(videoDir, 'mix.m4a');
    const cues = resolveCues(cfg(), tl, root);
    const r = mixSoundtrack(narration, cfg(), cues, tl, [0, 30], out, videoDir);
    expect(existsSync(out)).toBe(true);
    expect(probe(out).duration).toBeCloseTo(30, 0);
    const onDisk = readJson<MixReport>(join(videoDir, MIX_FILE))!;
    expect(onDisk.fingerprint).toBe(musicFingerprint(cfg(), cues));
    expect(r.cues.map((c) => c.id)).toEqual(['a', 'b']);
    expect(r.cues[0].sounded).toEqual([0, 20]);
    expect(r.cues[1].sounded[1]).toBeCloseTo(23, 1); // the 3 s ending plays once and stops
    expect(r.cues.every((c) => c.rmsDb > MUSIC_TOLERANCE.cueSilenceDb)).toBe(true);
    expect(r.musicScale).toBe(1);
    expect(r.peakDb).toBeLessThanOrEqual(-1);
    expect(r.speechRmsDb).toBeCloseTo(20 * Math.log10(0.25 / Math.SQRT2), 0);
    // the bed sits under the voice: -12 dB gain on a -8 dB rms tone, ducked 3 dB, against the -15 dB voice
    expect(r.musicUnderSpeechDb).toBeLessThan(-MUSIC_TOLERANCE.minUnderSpeechDb);
    expect(r.musicUnderSpeechDb).toBeGreaterThan(-MUSIC_TOLERANCE.maxUnderSpeechDb);
    expect(r.compositions.map((c) => c.id)).toEqual(['bed']);
    // the music is actually there between sentences and the fades land on silence
    const mixed = decodePcm(out);
    expect(rmsDb(mixed, 6, 9)).toBeGreaterThan(-40);
    expect(rmsDb(mixed, 26, 30)).toBeLessThan(-70); // after the ending: intentional silence
  });
});

describe('build report clearance and the board', () => {
  const inp = inputs();
  const seg = checkSegment(inp);
  const m = manifest(inp);
  const tl = buildTimeline(seg, m);
  const qa = { ok: true, checks: [], frames: [] };
  const mix = (cleared: boolean): MixReport => ({
    generatedAt: 'd',
    fingerprint: 'f',
    window: [0, 10],
    ceilingDb: -1,
    narrationPeakDb: -1.5,
    musicPeakDb: -20,
    peakDb: -1.2,
    musicScale: 1,
    speechRmsDb: -19,
    musicUnderSpeechDb: -21,
    cues: [
      {
        id: 'a',
        asset: 'bed/loop',
        start: 0,
        end: 10,
        sounded: [0, 10],
        rmsDb: -40,
        gain: -12,
        loop: true,
        duck: null,
      },
    ],
    compositions: [
      {
        id: 'bed',
        title: 'Bed',
        generator: { name: 'strudel-bench', repo: 'r', version: 'v' },
        source: { file: 'songs/bed.strudel', sha: 's', cps: 0.5, bpm: 120, key: 'D:minor' },
        licence: {
          cleared,
          samples: [{ pack: 'rooms', licence: 'CC BY 4.0', source: 'OpenAIR' }],
          attribution: ['OpenAIR, University of York'],
          notes: cleared ? undefined : 'pack terms unchecked',
        },
      },
    ],
  });
  it('keeps narration and music clearance apart and never publishable on a draft voice', () => {
    const draft = { ...m, licence: 'draft only: test voice' };
    const r = buildReport(seg, tl, draft, { file: 'x.mp4', probe: null, renderSeconds: 1 }, qa, 'cmd', null, mix(true));
    expect(r.clearance).toEqual({
      narration: false,
      music: true,
      publishable: false,
      why: [
        expect.stringMatching(
          /^narration is draft only: test voice; .*npm run video -- final demo decision:mlm-and-seminars --approved-by <name>/,
        ),
      ],
    });
    expect(r.clearance.music).toBe(true);
    expect(r.music?.compositions[0].licence.attribution).toEqual(['OpenAIR, University of York']);
    const commercial = { ...m, licence: 'commercial: test terms' };
    const ok = buildReport(
      seg,
      tl,
      commercial,
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      qa,
      'cmd',
      null,
      mix(true),
    );
    expect(ok.clearance.publishable).toBe(true);
    const unclearedMusic = buildReport(
      seg,
      tl,
      commercial,
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      qa,
      'cmd',
      null,
      mix(false),
    );
    expect(unclearedMusic.clearance).toEqual({
      narration: true,
      music: false,
      publishable: false,
      why: ['music bed is not cleared: pack terms unchecked'],
    });
    const none = buildReport(
      seg,
      tl,
      commercial,
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      qa,
      'cmd',
      null,
      null,
    );
    expect(none.music).toBeNull();
    expect(none.clearance.music).toBeNull();
    expect(none.limitations).toContain('no soundtrack: narration only');
  });
});

describe('cue sheet draft', () => {
  // The video fixture's three scenes over a hook, an investigation and an answer.
  const fixture = () => {
    const inp = inputs();
    const [s01, s02, s03] = inp.script.sections.flatMap((x) => x.sentences);
    const sections: Script['sections'] = [
      { name: 'hook', sentences: [s01] },
      { name: 'investigation', sentences: [s02] },
      { name: 'answer', sentences: [s03] },
    ];
    return { script: { ...inp.script, sections }, storyboard: inp.storyboard };
  };
  const script = () => fixture().script;
  const sb = () => fixture().storyboard;
  const undertow = () => readJson<Composition>(join(ROOT, 'music', 'undertow', 'composition.json'))!;

  it('draftCueSheet covers every scene contiguously by section', () => {
    const m = draftCueSheet(script(), sb(), undertow());
    expect(m.cues.map((c) => [c.id, c.asset, c.from, c.to])).toEqual([
      ['opening', 'undertow/pulse', 'sc01', 'sc01'],
      ['evidence', 'undertow/texture', 'sc02', 'sc02'],
      ['ending', 'undertow/pulse', 'sc03', 'sc03'],
    ]);
  });

  it('fallback variation', () => {
    const c = { ...undertow(), variations: { bed: { ...undertow().variations.texture, loop: true } } };
    const cues = draftCueSheet(script(), sb(), c).cues;
    expect(new Set(cues.map((x) => x.asset))).toEqual(new Set(['undertow/bed']));
    expect(cues.every((x) => x.loop)).toBe(true);
  });

  it('no cleared composition', () => {
    const u = undertow();
    expect(pickComposition([{ ...u, licence: { ...u.licence, cleared: false } }])).toBeNull();
    expect(pickComposition([u])?.id).toBe('undertow');
    expect(pickComposition([u], 'undertoe')).toBeNull();
  });
});
