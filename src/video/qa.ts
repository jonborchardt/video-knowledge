// Media QA: what a machine can check about the rendered MP4 against the timeline, the storyboard and the script.
// Artistic quality is not checked here; the extracted frames in video/frames/ and the contact sheet are for a person.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { sentences } from '../lib/script';
import { excerptWindow } from './excerpt';
import { audioStats, extractFrame, lumaSamples, probe } from './ffmpeg';
import { SUPPORTED_ASSETS } from './kinds';
import { type MixReport, type MusicConfig, musicFingerprint, resolveCues } from './music';
import type { Segment } from './select';
import { buildTimeline } from './timeline';
import type { NarrationManifest, Timeline } from './types';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
export interface QaResult {
  ok: boolean;
  checks: Check[];
  frames: { file: string; frame: number; label: string }[];
}
export const TOLERANCE = {
  durationSlack: 1, // seconds either side of the timeline's length, unless a range is given
  frameSlack: 0.05, // seconds the container may differ from frames/fps
  avSyncSeconds: 0.25, // audio and video stream lengths
  peakDb: -0.1, // above this the narration is clipping
  silenceSeconds: 3, // the longest silence allowed (pauses are up to 2 s plus the audio tails)
  silenceNoiseDb: -40,
  blankRunSeconds: 1.5, // flat frames this long in a row are a missing render, not a transition
  flatSd: 1.5, // luma standard deviation below which a thumbnail is flat
  samplesPerSecond: 2,
};

export interface QaOptions {
  frames?: boolean; // extract inspection frames into video/frames (default true)
  duration?: [number, number]; // seconds; default the timeline's length plus or minus durationSlack
  music?: MusicConfig | null; // the cue sheet, when there is one
  mix?: MixReport | null; // what the last assembly mixed (video/mix.json)
  root?: string; // repo root for the compositions
}
export const MUSIC_TOLERANCE = {
  minUnderSpeechDb: 10, // the music bus must sit at least this far under the voice while it speaks
  maxUnderSpeechDb: 40, // and no further: beyond that it is inaudible, so the cue is wrong or the asset silent
  cueSilenceDb: -60, // a cue whose own rms is below this did not sound
};

export function qaSegment(
  mp4: string,
  videoDir: string,
  tl: Timeline,
  seg: Segment,
  manifest: NarrationManifest,
  opts: QaOptions = {},
): QaResult {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const fps = tl.fps;
  const sec = (frame: number) => (frame / fps).toFixed(2);
  const expected = tl.durationInFrames / fps;
  const range = opts.duration ?? [expected - TOLERANCE.durationSlack, expected + TOLERANCE.durationSlack];

  // Video integrity.
  if (!existsSync(mp4)) {
    check('output exists', false, mp4);
    return { ok: false, checks, frames: [] };
  }
  let p: ReturnType<typeof probe>;
  try {
    p = probe(mp4);
    check('mp4 decodable', true, `${p.duration.toFixed(3)}s`);
  } catch (e) {
    check('mp4 decodable', false, String(e));
    return { ok: false, checks, frames: [] };
  }
  check(
    'video stream',
    !!p.video,
    p.video ? `${p.video.codec} ${p.video.width}x${p.video.height} @ ${p.video.fps}` : 'none',
  );
  if (p.video) {
    check(
      'resolution',
      p.video.width === tl.width && p.video.height === tl.height,
      `${p.video.width}x${p.video.height}`,
    );
    check('frame rate', Math.abs(p.video.fps - fps) < 0.01, `${p.video.fps}`);
    check('h264', p.video.codec === 'h264', p.video.codec);
    check(
      'frame count',
      p.video.frames === tl.durationInFrames,
      `${p.video.frames} frames, timeline ${tl.durationInFrames}`,
    );
  }
  check(
    'duration in range',
    p.duration >= range[0] && p.duration <= range[1],
    `${p.duration.toFixed(2)}s in [${range.map((x) => x.toFixed(1))}]`,
  );
  check(
    'duration matches timeline',
    Math.abs(p.duration - expected) <= 1 / fps + TOLERANCE.frameSlack,
    `${p.duration.toFixed(3)}s vs ${expected.toFixed(3)}s (${tl.durationInFrames} frames)`,
  );

  // Audio integrity.
  check('audio stream', !!p.audio, p.audio ? `${p.audio.codec} ${p.audio.sampleRate} Hz x${p.audio.channels}` : 'none');
  if (p.audio) {
    check('aac', p.audio.codec === 'aac', p.audio.codec);
    const d = Math.abs((p.audio.duration || p.duration) - (p.video?.duration || p.duration));
    check('audio length matches video', d <= TOLERANCE.avSyncSeconds, `${d.toFixed(3)}s apart`);
    const a = audioStats(mp4, TOLERANCE.silenceNoiseDb, TOLERANCE.silenceSeconds);
    check('no clipping', a.maxVolumeDb <= TOLERANCE.peakDb, `peak ${a.maxVolumeDb} dB, mean ${a.meanVolumeDb} dB`);
    check(
      'no long silence',
      a.silences.length === 0,
      a.silences.length
        ? a.silences.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}s`).join(', ')
        : `none >= ${TOLERANCE.silenceSeconds}s`,
    );
  }
  const truncated = tl.scenes
    .flatMap((x) => x.sentences)
    .filter((s) => {
      const m = manifest.sentences.find((x) => x.id === s.id);
      const lastWord = m?.words.at(-1)?.end ?? 0;
      return !m || m.duration < lastWord - 0.05 || s.duration < Math.ceil(m.duration * fps);
    });
  check(
    'narration not truncated',
    truncated.length === 0,
    truncated.length
      ? truncated.map((s) => s.id).join(', ')
      : `${tl.scenes.flatMap((x) => x.sentences).length} sentences fit their slots`,
  );

  // Content integrity.
  const ids = tl.scenes.map((s) => s.id);
  check('scene order', ids.join() === seg.config.scenes.join(), `${ids[0]} to ${ids.at(-1)} (${ids.length})`);
  const sb = seg.storyboard.scenes.map((s) => s.id);
  const k = sb.indexOf(ids[0]);
  check(
    'scenes contiguous in storyboard',
    k >= 0 && sb.slice(k, k + ids.length).join() === ids.join(),
    `from ${ids[0]}`,
  );
  const all = sentences(seg.script);
  const text = new Map(all.map((s) => [s.id, s.text]));
  const have = new Set(tl.scenes.flatMap((x) => x.sentences.map((s) => s.id)));
  const full = ids.length === sb.length;
  check(
    full ? 'every storyboard scene rendered' : 'partial render',
    true,
    full ? `${ids.length} scenes` : `${ids.length} of ${sb.length} scenes`,
  );
  if (full) {
    const missing = all.filter((s) => !have.has(s.id)).map((s) => s.id);
    check(
      'every script sentence narrated',
      missing.length === 0,
      missing.length ? `missing ${missing.join(', ')}` : `${all.length} sentences in script order`,
    );
    const order = tl.scenes.flatMap((x) => x.sentences.map((s) => s.id));
    check('sentences in script order', order.join() === all.map((s) => s.id).join(), order.length + ' sentences');
  }
  const mismatched = tl.scenes.flatMap((x) => x.sentences).filter((s) => text.get(s.id) !== s.text);
  check(
    'narration matches script',
    mismatched.length === 0,
    mismatched.length ? mismatched.map((s) => s.id).join(', ') : 'every sentence verbatim',
  );
  check(
    'fingerprints',
    tl.fingerprints.script === seg.fingerprints.script && tl.fingerprints.storyboard === seg.fingerprints.storyboard,
    `script ${tl.fingerprints.script}, storyboard ${tl.fingerprints.storyboard}${seg.release ? ' (locked)' : ' (no release)'}`,
  );
  const problems: string[] = [];
  for (const { scene, citations } of seg.scenes) {
    const t = tl.scenes.find((x) => x.id === scene.id);
    const want = (scene.citations ?? []).map((c) => c.label);
    const got = t?.citations.map((c) => c.label) ?? [];
    if (!want.every((l) => got.includes(l)) || citations.length !== want.length) problems.push(`${scene.id} citations`);
    if (scene.visual.chart && JSON.stringify(t?.chart?.points) !== JSON.stringify(scene.visual.chart.points))
      problems.push(`${scene.id} chart data`);
    if (!(t?.assets ?? []).every((a) => SUPPORTED_ASSETS.has(a))) problems.push(`${scene.id} assets`);
    if (!t?.kind) problems.push(`${scene.id} unsupported`);
    if (scene.visual.excerpt) {
      const ex = t?.excerpt;
      if (!ex?.text) problems.push(`${scene.id} excerpt text`);
      else if (ex.highlight && excerptWindow(ex.text, ex.highlight).match === null)
        problems.push(`${scene.id} highlight not in passage`);
    }
  }
  check(
    'citations present',
    !problems.some((p) => p.endsWith('citations')),
    `${tl.scenes.reduce((n, s) => n + s.citations.length, 0)} on-screen citations resolved`,
  );
  check(
    'chart data matches storyboard',
    !problems.some((p) => p.endsWith('chart data')),
    `${tl.scenes.filter((s) => s.chart).length} charts`,
  );
  check(
    'excerpts resolve',
    !problems.some((p) => /excerpt|highlight/.test(p)),
    `${tl.scenes.filter((s) => s.excerpt).length} excerpts with their highlights`,
  );
  check(
    'assets and kinds supported',
    !problems.some((p) => /assets|unsupported/.test(p)),
    problems.filter((p) => /assets|unsupported/.test(p)).join(', ') ||
      `${new Set(tl.scenes.map((s) => s.kind)).size} kinds`,
  );

  // Soundtrack: the cue sheet resolves, the mix on disk is the mix of this cue sheet, and it sits under the voice.
  if (opts.music) {
    let resolved: ReturnType<typeof resolveCues> | null = null;
    try {
      resolved = resolveCues(opts.music, tl, opts.root);
      check(
        'music cues resolve',
        true,
        `${resolved.length} cues over ${new Set(resolved.map((c) => c.composition.id)).size} compositions`,
      );
    } catch (e) {
      check('music cues resolve', false, String(e instanceof Error ? e.message : e).replace(/\s+/g, ' '));
    }
    const mix = opts.mix;
    check('soundtrack mixed', !!mix, mix ? `${mix.cues.length} cues, ${mix.generatedAt}` : 'no mix.json: run render');
    if (mix && resolved) {
      const want = musicFingerprint(opts.music, resolved);
      check('mix is of this cue sheet', mix.fingerprint === want, `mix ${mix.fingerprint}, cue sheet ${want}`);
      const silent = mix.cues.filter(
        (c) => c.rmsDb < MUSIC_TOLERANCE.cueSilenceDb || c.sounded[1] - c.sounded[0] < 0.5,
      );
      check(
        'every cue sounded',
        silent.length === 0,
        silent.map((c) => c.id).join(', ') || `${mix.cues.length} cues audible where placed`,
      );
      check(
        'music under the voice',
        mix.musicUnderSpeechDb <= -MUSIC_TOLERANCE.minUnderSpeechDb &&
          mix.musicUnderSpeechDb >= -MUSIC_TOLERANCE.maxUnderSpeechDb,
        `${mix.musicUnderSpeechDb} dB relative to speech (want -${MUSIC_TOLERANCE.maxUnderSpeechDb} to -${MUSIC_TOLERANCE.minUnderSpeechDb})`,
      );
      check(
        'mix under the ceiling',
        mix.peakDb <= mix.ceilingDb + 0.1,
        `peak ${mix.peakDb} dB, ceiling ${mix.ceilingDb} dB${mix.musicScale < 1 ? `, music scaled x${mix.musicScale}` : ''}`,
      );
    }
  } else check('soundtrack', true, 'none: no video/music.json');

  // Synchronisation.
  const again = buildTimeline(seg, manifest, fps, () => 'x');
  check(
    'scene boundaries follow measured audio',
    again.scenes.every((s, i) => s.start === tl.scenes[i]?.start && s.duration === tl.scenes[i]?.duration),
    `${tl.scenes.length} scenes, ${tl.scenes.flatMap((s) => s.sentences).length} sentences`,
  );
  const badCues: string[] = [];
  let cues = 0;
  for (const s of tl.scenes)
    for (const [name, frame] of Object.entries(s.cues)) {
      cues++;
      const c = seg.config.cues[s.id]?.[name];
      const sent = s.sentences.find((x) => x.id === c?.sentence);
      if (!c || !sent || frame < sent.start || frame >= sent.start + sent.duration) badCues.push(`${s.id}.${name}`);
    }
  check('cues inside their sentences', badCues.length === 0, badCues.join(', ') || `${cues} cues`);
  const last = tl.scenes.at(-1)!;
  check(
    'final scene complete',
    last.start + last.duration === tl.durationInFrames && p.duration + TOLERANCE.frameSlack >= expected,
    `ends ${sec(last.start + last.duration)}s`,
  );

  // Blank sections and missing renders, from luma thumbnails.
  const samples = lumaSamples(mp4, TOLERANCE.samplesPerSecond, fps);
  const flat = samples.map((s) => s.sd < TOLERANCE.flatSd);
  const maxRun = TOLERANCE.blankRunSeconds * TOLERANCE.samplesPerSecond;
  let run = 0;
  let worst = 0;
  let where = -1;
  flat.forEach((f, i) => {
    run = f ? run + 1 : 0;
    if (run > worst) [worst, where] = [run, i];
  });
  const endFade = last.kind === 'phone-end'; // the storyboard's dim to black at the end is intentional
  const worstAt = where / TOLERANCE.samplesPerSecond;
  check(
    'no blank sections',
    worst < maxRun || (endFade && worstAt >= last.start / fps),
    worst ? `longest flat run ${worst / TOLERANCE.samplesPerSecond}s ending at ${worstAt.toFixed(1)}s` : 'none',
  );
  const notRendered = tl.scenes.filter((s) => {
    const i = Math.min(samples.length - 1, Math.floor(((s.start + s.duration / 2) / fps) * TOLERANCE.samplesPerSecond));
    return samples[i] === undefined || samples[i].sd < TOLERANCE.flatSd;
  });
  check(
    'every scene has content',
    notRendered.length === 0,
    notRendered.length ? notRendered.map((s) => s.id).join(', ') : 'mid-scene luma varies in every scene',
  );

  // Inspection frames.
  const frames: QaResult['frames'] = [];
  if (opts.frames !== false) {
    const dir = join(videoDir, 'frames');
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (f.endsWith('.png')) unlinkSync(join(dir, f));
    const wanted: { frame: number; label: string }[] = [{ frame: 1, label: 'first' }];
    for (const s of tl.scenes) {
      wanted.push({ frame: s.start + Math.round(s.duration / 2), label: `${s.id}-mid` });
      for (const [name, frame] of Object.entries(s.cues))
        wanted.push({
          frame: Math.min(frame + 15, s.start + s.duration - 1),
          label: `${s.id}-${name.replace(/[^a-z0-9]+/gi, '-')}`,
        });
      wanted.push({ frame: s.start + s.duration - 2, label: `${s.id}-end` });
    }
    for (const w of wanted.sort((a, b) => a.frame - b.frame)) {
      const file = join(dir, `f${String(w.frame).padStart(5, '0')}-${w.label}.png`);
      extractFrame(mp4, w.frame / fps, file);
      frames.push({ file, frame: w.frame, label: w.label });
    }
  }
  return { ok: checks.every((c) => c.ok), checks, frames };
}
