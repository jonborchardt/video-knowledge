// Media QA: what a machine can check about the rendered MP4 against the timeline, the storyboard and the script.
// Artistic quality is not checked here; the extracted frames in video/frames/ are for a person to look at.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { sentences } from '../lib/script';
import { SUPPORTED_ASSETS } from './kinds';
import { audioStats, extractFrame, lumaSamples, probe } from './ffmpeg';
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
  durationSeconds: [30, 60] as [number, number], // the spike's target segment length
  frameSlack: 0.05, // seconds the container may differ from frames/fps
  avSyncSeconds: 0.25, // audio and video stream lengths
  peakDb: -0.1, // above this the narration is clipping
  silenceSeconds: 2, // the longest silence allowed (pauses are 1 s plus the audio tails)
  silenceNoiseDb: -40,
  blankRunSeconds: 1.5, // flat frames this long in a row are a missing render, not a transition
  flatSd: 1.5, // luma standard deviation below which a thumbnail is flat
  samplesPerSecond: 2,
};

export interface QaOptions {
  frames?: boolean; // extract inspection frames into video/frames (default true)
  duration?: [number, number];
}

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
  const range = opts.duration ?? TOLERANCE.durationSeconds;

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
  }
  check(
    'duration in range',
    p.duration >= range[0] && p.duration <= range[1],
    `${p.duration.toFixed(2)}s in [${range}]`,
  );
  const expected = tl.durationInFrames / fps;
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
  for (const s of tl.scenes.flatMap((x) => x.sentences)) {
    const m = manifest.sentences.find((x) => x.id === s.id);
    const lastWord = m?.words.at(-1)?.end ?? 0;
    check(
      `narration ${s.id} not truncated`,
      !!m && m.duration >= lastWord - 0.05 && s.duration >= Math.ceil(m.duration * fps),
      m ? `audio ${m.duration}s, last word ${lastWord}s, slot ${s.duration} frames` : 'not in manifest',
    );
  }

  // Content integrity.
  const ids = tl.scenes.map((s) => s.id);
  check('scene order', ids.join() === seg.config.scenes.join(), ids.join(' '));
  const sb = seg.storyboard.scenes.map((s) => s.id);
  const k = sb.indexOf(ids[0]);
  check(
    'scenes contiguous in storyboard',
    k >= 0 && sb.slice(k, k + ids.length).join() === ids.join(),
    `from ${ids[0]}`,
  );
  const text = new Map(sentences(seg.script).map((s) => [s.id, s.text]));
  for (const s of tl.scenes.flatMap((x) => x.sentences))
    check(`narration ${s.id} matches script`, text.get(s.id) === s.text, s.text.slice(0, 60));
  check(
    'fingerprints',
    tl.fingerprints.script === seg.fingerprints.script && tl.fingerprints.storyboard === seg.fingerprints.storyboard,
    `script ${tl.fingerprints.script}, storyboard ${tl.fingerprints.storyboard}`,
  );
  for (const { scene, citations } of seg.scenes) {
    const t = tl.scenes.find((x) => x.id === scene.id);
    const want = (scene.citations ?? []).map((c) => c.label);
    const have = t?.citations.map((c) => c.label) ?? [];
    check(
      `${scene.id} citations`,
      want.every((l) => have.includes(l)) && citations.length === want.length,
      want.join('; ') || 'none',
    );
    if (scene.visual.chart)
      check(
        `${scene.id} chart data`,
        JSON.stringify(t?.chart?.points) === JSON.stringify(scene.visual.chart.points),
        scene.visual.chart.points.map((p) => `${p.label}=${p.display}`).join(', '),
      );
    check(
      `${scene.id} assets`,
      (t?.assets ?? []).every((a) => SUPPORTED_ASSETS.has(a)),
      (t?.assets ?? []).join(', ') || 'none',
    );
    check(`${scene.id} rendered as`, !!t?.kind, t?.kind ?? 'unsupported');
  }

  // Synchronisation.
  const again = buildTimeline(seg, manifest, fps);
  check(
    'scene boundaries follow measured audio',
    again.scenes.every((s, i) => s.start === tl.scenes[i]?.start && s.duration === tl.scenes[i]?.duration),
    tl.scenes.map((s) => `${s.id} ${sec(s.start)}-${sec(s.start + s.duration)}s`).join(', '),
  );
  for (const s of tl.scenes)
    for (const [name, frame] of Object.entries(s.cues)) {
      const c = seg.config.cues[s.id][name];
      const sent = s.sentences.find((x) => x.id === c.sentence)!;
      check(
        `${s.id} cue ${name} inside ${c.sentence}`,
        frame >= sent.start && frame < sent.start + sent.duration,
        `"${c.word}" at ${sec(frame)}s, sentence ${sec(sent.start)}-${sec(sent.start + sent.duration)}s`,
      );
    }
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
  check(
    'no blank sections',
    worst < maxRun,
    worst
      ? `longest flat run ${worst / TOLERANCE.samplesPerSecond}s ending at ${(where / TOLERANCE.samplesPerSecond).toFixed(1)}s`
      : 'none',
  );
  for (const s of tl.scenes) {
    const i = Math.min(samples.length - 1, Math.floor(((s.start + s.duration / 2) / fps) * TOLERANCE.samplesPerSecond));
    check(
      `${s.id} rendered`,
      samples[i] !== undefined && samples[i].sd >= TOLERANCE.flatSd,
      samples[i] ? `mid-scene luma sd ${samples[i].sd.toFixed(1)}` : 'no sample',
    );
  }

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
        wanted.push({ frame: frame + 15, label: `${s.id}-${name.replace(/[^a-z0-9]+/gi, '-')}` });
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
