// Media QA: what a machine can check about the rendered MP4 against the timeline, the storyboard and the script.
// Artistic quality is not checked here; the extracted frames in video/frames/ and the contact sheet are for a person.
// qaSegment measures the file once (probe, audio stats, luma samples) and hands the measurements to pure check groups;
// extractInspectionFrames is the only part that writes to disk, and the caller decides whether to run it.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { sentences } from '../lib/script';
import { excerptWindow } from './excerpt';
import { type AudioStats, type Probe, audioStats, extractFrame, lumaSamples, probe } from './ffmpeg';
import { ALL_KINDS, unsupportedAssets } from './kinds';
import { type MixReport, type MusicConfig, musicFingerprint, resolveCues } from './music';
import type { Segment } from './select';
import { buildTimeline } from './timeline';
import { type NarrationManifest, SHORT_HARD_SECONDS, type Timeline } from './types';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
export interface QaVerdict {
  ok: boolean;
  checks: Check[];
}
export interface InspectionFrame {
  file: string;
  frame: number;
  label: string;
}
export interface QaResult extends QaVerdict {
  frames: InspectionFrame[];
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
/** The check that says the mp4 opened at all; inspection frames are extracted only after it passed. */
export const DECODABLE = 'mp4 decodable';
type Luma = { mean: number; sd: number }[];
const check = (name: string, ok: boolean, detail: string): Check => ({ name, ok, detail });
const expectedSeconds = (tl: Timeline) => tl.durationInFrames / tl.fps;

export function qaSegment(
  mp4: string,
  tl: Timeline,
  seg: Segment,
  manifest: NarrationManifest,
  opts: QaOptions = {},
): QaVerdict {
  if (!existsSync(mp4)) return verdict([check('output exists', false, mp4)]);
  let p: Probe;
  try {
    p = probe(mp4);
  } catch (e) {
    return verdict([check(DECODABLE, false, String(e))]);
  }
  const audio = p.audio ? audioStats(mp4, TOLERANCE.silenceNoiseDb, TOLERANCE.silenceSeconds) : null;
  return verdict([
    check(DECODABLE, true, `${p.duration.toFixed(3)}s`),
    ...videoChecks(p, tl, opts.duration),
    ...shortChecks(p, tl),
    ...audioChecks(p, audio, tl, manifest),
    ...contentChecks(tl, seg),
    ...soundtrackChecks(tl, opts),
    ...syncChecks(p, tl, seg, manifest),
    ...blankChecks(lumaSamples(mp4, TOLERANCE.samplesPerSecond, tl.fps), tl),
  ]);
}
const verdict = (checks: Check[]): QaVerdict => ({ ok: checks.every((c) => c.ok), checks });

/** A portrait timeline is a Short: YouTube's three-minute rule, on the measured file. */
export function shortChecks(p: Pick<Probe, 'duration'>, tl: Pick<Timeline, 'width' | 'height'>): Check[] {
  if (tl.height <= tl.width) return [];
  return [
    check(
      'short length',
      p.duration <= SHORT_HARD_SECONDS,
      `${p.duration.toFixed(1)}s of at most ${SHORT_HARD_SECONDS}s (YouTube classifies longer uploads as videos)`,
    ),
  ];
}

/** Container, stream, resolution, frame rate and length against the timeline. */
export function videoChecks(p: Probe, tl: Timeline, duration?: [number, number]): Check[] {
  const fps = tl.fps;
  const expected = expectedSeconds(tl);
  const range = duration ?? [expected - TOLERANCE.durationSlack, expected + TOLERANCE.durationSlack];
  const out = [
    check(
      'video stream',
      !!p.video,
      p.video ? `${p.video.codec} ${p.video.width}x${p.video.height} @ ${p.video.fps}` : 'none',
    ),
  ];
  if (p.video)
    out.push(
      check(
        'resolution',
        p.video.width === tl.width && p.video.height === tl.height,
        `${p.video.width}x${p.video.height}`,
      ),
      check('frame rate', Math.abs(p.video.fps - fps) < 0.01, `${p.video.fps}`),
      check('h264', p.video.codec === 'h264', p.video.codec),
      check(
        'frame count',
        p.video.frames === tl.durationInFrames,
        `${p.video.frames} frames, timeline ${tl.durationInFrames}`,
      ),
    );
  out.push(
    check(
      'duration in range',
      p.duration >= range[0] && p.duration <= range[1],
      `${p.duration.toFixed(2)}s in [${range.map((x) => x.toFixed(1))}]`,
    ),
    check(
      'duration matches timeline',
      Math.abs(p.duration - expected) <= 1 / fps + TOLERANCE.frameSlack,
      `${p.duration.toFixed(3)}s vs ${expected.toFixed(3)}s (${tl.durationInFrames} frames)`,
    ),
  );
  return out;
}

/** The audio stream, its levels and silences, and every sentence's narration fitting its slot. */
export function audioChecks(p: Probe, a: AudioStats | null, tl: Timeline, manifest: NarrationManifest): Check[] {
  const out = [
    check(
      'audio stream',
      !!p.audio,
      p.audio ? `${p.audio.codec} ${p.audio.sampleRate} Hz x${p.audio.channels}` : 'none',
    ),
  ];
  if (p.audio) {
    out.push(check('aac', p.audio.codec === 'aac', p.audio.codec));
    const d = Math.abs((p.audio.duration || p.duration) - (p.video?.duration || p.duration));
    out.push(check('audio length matches video', d <= TOLERANCE.avSyncSeconds, `${d.toFixed(3)}s apart`));
  }
  if (a)
    out.push(
      check('no clipping', a.maxVolumeDb <= TOLERANCE.peakDb, `peak ${a.maxVolumeDb} dB, mean ${a.meanVolumeDb} dB`),
      check(
        'no long silence',
        a.silences.length === 0,
        a.silences.length
          ? a.silences.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}s`).join(', ')
          : `none >= ${TOLERANCE.silenceSeconds}s`,
      ),
    );
  const all = tl.scenes.flatMap((x) => x.sentences);
  const truncated = all.filter((s) => {
    const m = manifest.sentences.find((x) => x.id === s.id);
    const lastWord = m?.words.at(-1)?.end ?? 0;
    return !m || m.duration < lastWord - 0.05 || s.duration < Math.ceil(m.duration * tl.fps);
  });
  out.push(
    check(
      'narration not truncated',
      truncated.length === 0,
      truncated.length ? truncated.map((s) => s.id).join(', ') : `${all.length} sentences fit their slots`,
    ),
  );
  return out;
}

/** Scenes, sentences, citations, chart data, excerpts and kinds against the storyboard and the script. */
export function contentChecks(tl: Timeline, seg: Segment): Check[] {
  const out: Check[] = [];
  const ids = tl.scenes.map((s) => s.id);
  out.push(check('scene order', ids.join() === seg.config.scenes.join(), `${ids[0]} to ${ids.at(-1)} (${ids.length})`));
  const sb = seg.storyboard.scenes.map((s) => s.id);
  const k = sb.indexOf(ids[0]);
  out.push(
    check(
      'scenes contiguous in storyboard',
      k >= 0 && sb.slice(k, k + ids.length).join() === ids.join(),
      `from ${ids[0]}`,
    ),
  );
  const all = sentences(seg.script);
  const text = new Map(all.map((s) => [s.id, s.text]));
  const have = new Set(tl.scenes.flatMap((x) => x.sentences.map((s) => s.id)));
  const full = ids.length === sb.length;
  out.push(
    check(
      full ? 'every storyboard scene rendered' : 'partial render',
      true,
      full ? `${ids.length} scenes` : `${ids.length} of ${sb.length} scenes`,
    ),
  );
  if (full) {
    const missing = all.filter((s) => !have.has(s.id)).map((s) => s.id);
    out.push(
      check(
        'every script sentence narrated',
        missing.length === 0,
        missing.length ? `missing ${missing.join(', ')}` : `${all.length} sentences in script order`,
      ),
    );
    const order = tl.scenes.flatMap((x) => x.sentences.map((s) => s.id));
    out.push(
      check('sentences in script order', order.join() === all.map((s) => s.id).join(), order.length + ' sentences'),
    );
  }
  const mismatched = tl.scenes.flatMap((x) => x.sentences).filter((s) => text.get(s.id) !== s.text);
  out.push(
    check(
      'narration matches script',
      mismatched.length === 0,
      mismatched.length ? mismatched.map((s) => s.id).join(', ') : 'every sentence verbatim',
    ),
    check(
      'fingerprints',
      tl.fingerprints.script === seg.fingerprints.script && tl.fingerprints.storyboard === seg.fingerprints.storyboard,
      `script ${tl.fingerprints.script}, storyboard ${tl.fingerprints.storyboard}${seg.release ? ' (locked)' : ' (no release)'}`,
    ),
  );
  const problems: string[] = [];
  for (const { scene, citations } of seg.scenes) {
    const t = tl.scenes.find((x) => x.id === scene.id);
    const want = (scene.citations ?? []).map((c) => c.label);
    const got = t?.citations.map((c) => c.label) ?? [];
    if (!want.every((l) => got.includes(l)) || citations.length !== want.length) problems.push(`${scene.id} citations`);
    if (scene.visual.chart && JSON.stringify(t?.chart?.points) !== JSON.stringify(scene.visual.chart.points))
      problems.push(`${scene.id} chart data`);
    if (!t || unsupportedAssets(t.kind, t.assets).length) problems.push(`${scene.id} assets`);
    if (!t?.kind) problems.push(`${scene.id} unsupported`);
    if (scene.visual.excerpt) {
      const ex = t?.excerpt;
      if (!ex?.text) problems.push(`${scene.id} excerpt text`);
      else if (ex.highlight && excerptWindow(ex.text, ex.highlight).match === null)
        problems.push(`${scene.id} highlight not in passage`);
    }
  }
  out.push(
    check(
      'citations present',
      !problems.some((p) => p.endsWith('citations')),
      `${tl.scenes.reduce((n, s) => n + s.citations.length, 0)} on-screen citations resolved`,
    ),
    check(
      'chart data matches storyboard',
      !problems.some((p) => p.endsWith('chart data')),
      `${tl.scenes.filter((s) => s.chart).length} charts`,
    ),
    check(
      'excerpts resolve',
      !problems.some((p) => /excerpt|highlight/.test(p)),
      `${tl.scenes.filter((s) => s.excerpt).length} excerpts with their highlights`,
    ),
    check(
      'assets and kinds supported',
      !problems.some((p) => /assets|unsupported/.test(p)),
      problems.filter((p) => /assets|unsupported/.test(p)).join(', ') ||
        `${new Set(tl.scenes.map((s) => s.kind)).size} kinds`,
    ),
  );
  return out;
}

/** The cue sheet resolves, the mix on disk is the mix of this cue sheet, and it sits under the voice. */
export function soundtrackChecks(
  tl: Timeline,
  { music, mix, root }: Pick<QaOptions, 'music' | 'mix' | 'root'>,
): Check[] {
  if (!music) return [check('soundtrack', true, 'none: no video/music.json')];
  const out: Check[] = [];
  let resolved: ReturnType<typeof resolveCues> | null = null;
  try {
    resolved = resolveCues(music, tl, root);
    out.push(
      check(
        'music cues resolve',
        true,
        `${resolved.length} cues over ${new Set(resolved.map((c) => c.composition.id)).size} compositions`,
      ),
    );
  } catch (e) {
    out.push(check('music cues resolve', false, String(e instanceof Error ? e.message : e).replace(/\s+/g, ' ')));
  }
  out.push(
    check('soundtrack mixed', !!mix, mix ? `${mix.cues.length} cues, ${mix.generatedAt}` : 'no mix.json: run render'),
  );
  if (mix && resolved) {
    const want = musicFingerprint(music, resolved);
    const silent = mix.cues.filter((c) => c.rmsDb < MUSIC_TOLERANCE.cueSilenceDb || c.sounded[1] - c.sounded[0] < 0.5);
    out.push(
      check('mix is of this cue sheet', mix.fingerprint === want, `mix ${mix.fingerprint}, cue sheet ${want}`),
      check(
        'every cue sounded',
        silent.length === 0,
        silent.map((c) => c.id).join(', ') || `${mix.cues.length} cues audible where placed`,
      ),
      check(
        'music under the voice',
        mix.musicUnderSpeechDb <= -MUSIC_TOLERANCE.minUnderSpeechDb &&
          mix.musicUnderSpeechDb >= -MUSIC_TOLERANCE.maxUnderSpeechDb,
        `${mix.musicUnderSpeechDb} dB relative to speech (want -${MUSIC_TOLERANCE.maxUnderSpeechDb} to -${MUSIC_TOLERANCE.minUnderSpeechDb})`,
      ),
      check(
        'mix under the ceiling',
        mix.peakDb <= mix.ceilingDb + 0.1,
        `peak ${mix.peakDb} dB, ceiling ${mix.ceilingDb} dB${mix.musicScale < 1 ? `, music scaled x${mix.musicScale}` : ''}`,
      ),
    );
  }
  return out;
}

/** Scene boundaries from measured audio, cues inside the sentences that speak them, a complete final scene. */
export function syncChecks(p: Probe, tl: Timeline, seg: Segment, manifest: NarrationManifest): Check[] {
  const again = buildTimeline(seg, manifest, tl.fps, () => 'x');
  const badCues: string[] = [];
  let cues = 0;
  for (const s of tl.scenes)
    for (const [name, frame] of Object.entries(s.cues)) {
      cues++;
      const c = seg.config.cues[s.id]?.[name];
      const sent = s.sentences.find((x) => x.id === c?.sentence);
      if (!c || !sent || frame < sent.start || frame >= sent.start + sent.duration) badCues.push(`${s.id}.${name}`);
    }
  const last = tl.scenes.at(-1)!;
  return [
    check(
      'scene boundaries follow measured audio',
      again.scenes.every((s, i) => s.start === tl.scenes[i]?.start && s.duration === tl.scenes[i]?.duration),
      `${tl.scenes.length} scenes, ${tl.scenes.flatMap((s) => s.sentences).length} sentences`,
    ),
    check('cues inside their sentences', badCues.length === 0, badCues.join(', ') || `${cues} cues`),
    check(
      'final scene complete',
      last.start + last.duration === tl.durationInFrames && p.duration + TOLERANCE.frameSlack >= expectedSeconds(tl),
      `ends ${((last.start + last.duration) / tl.fps).toFixed(2)}s`,
    ),
  ];
}

/** Blank sections and missing renders, from luma thumbnails taken samplesPerSecond apart. */
export function blankChecks(samples: Luma, tl: Timeline): Check[] {
  const fps = tl.fps;
  const last = tl.scenes.at(-1)!;
  const sps = TOLERANCE.samplesPerSecond;
  const maxRun = Math.ceil(TOLERANCE.blankRunSeconds * sps);
  let run = 0;
  let worst = 0;
  let where = -1;
  const runs: { from: number; to: number }[] = []; // sample indices, inclusive
  samples.forEach((s, i) => {
    run = s.sd < TOLERANCE.flatSd ? run + 1 : 0;
    if (run > worst) [worst, where] = [run, i];
    if (run === maxRun) runs.push({ from: i - run + 1, to: i });
    else if (run > maxRun) runs.at(-1)!.to = i;
  });
  const endFade = !!ALL_KINDS[last.kind]?.fadesOut; // a dim to black at the end is intentional
  const worstAt = where / sps;
  const sceneAt = (sec: number) => tl.scenes.findLast((s) => s.start / fps <= sec) ?? tl.scenes[0];
  const blank = runs.filter((r) => !(endFade && r.from / sps >= last.start / fps));
  const notRendered = tl.scenes.filter((s) => {
    const i = Math.min(samples.length - 1, Math.floor(((s.start + s.duration / 2) / fps) * TOLERANCE.samplesPerSecond));
    return samples[i] === undefined || samples[i].sd < TOLERANCE.flatSd;
  });
  return [
    check(
      'no blank sections',
      !blank.length,
      blank.length
        ? blank
            .map((r) => `${(r.from / sps).toFixed(1)}-${((r.to + 1) / sps).toFixed(1)}s in ${sceneAt(r.from / sps).id}`)
            .join('; ')
        : worst
          ? `longest flat run ${worst / sps}s ending at ${worstAt.toFixed(1)}s`
          : 'none',
    ),
    check(
      'every scene has content',
      notRendered.length === 0,
      notRendered.length ? notRendered.map((s) => s.id).join(', ') : 'mid-scene luma varies in every scene',
    ),
  ];
}

/** Writes the inspection frames into <videoDir>/frames (first frame, each scene's middle, each cue, each scene's end),
 *  replacing the previous set. */
export function extractInspectionFrames(mp4: string, videoDir: string, tl: Timeline): InspectionFrame[] {
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
  return wanted
    .sort((a, b) => a.frame - b.frame)
    .map((w) => {
      const file = join(dir, `f${String(w.frame).padStart(5, '0')}-${w.label}.png`);
      extractFrame(mp4, w.frame / tl.fps, file);
      return { file, frame: w.frame, label: w.label };
    });
}
