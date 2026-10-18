// The build report: what was rendered from what, with what, and how the QA went. video/build-report.json and .md.
import type { Probe } from './ffmpeg';
import type { QaResult } from './qa';
import type { Segment } from './select';
import type { NarrationManifest, Timeline } from './types';

export interface BuildReport {
  topic: string;
  story: string;
  title: string;
  generatedAt: string;
  command: string;
  segment: { scenes: string[]; sentences: string[]; kinds: Record<string, string> };
  output: {
    file: string;
    seconds: number;
    width: number;
    height: number;
    fps: number;
    video: string;
    audio: string;
  } | null;
  narration: {
    provider: string;
    voice: string;
    rate: string;
    model: string | null;
    format: string;
    seconds: number;
    sentences: { id: string; seconds: number; sha: string; words: number }[];
    cost: string;
  };
  rendering: { architecture: string; seconds: number; frames: number; cost: string };
  fingerprints: Timeline['fingerprints'];
  qa: { ok: boolean; checks: QaResult['checks']; frames: string[] };
  limitations: string[];
}

export function buildReport(
  seg: Segment,
  tl: Timeline,
  manifest: NarrationManifest,
  out: { file: string; probe: Probe | null; renderSeconds: number },
  qa: QaResult,
  command: string,
): BuildReport {
  const p = out.probe;
  return {
    topic: tl.topic,
    story: tl.story,
    title: tl.title,
    generatedAt: new Date().toISOString(),
    command,
    segment: {
      scenes: tl.scenes.map((s) => s.id),
      sentences: tl.scenes.flatMap((s) => s.sentences.map((x) => x.id)),
      kinds: Object.fromEntries(tl.scenes.map((s) => [s.id, s.kind])),
    },
    output: p
      ? {
          file: out.file,
          seconds: p.duration,
          width: p.video?.width ?? 0,
          height: p.video?.height ?? 0,
          fps: p.video?.fps ?? 0,
          video: p.video?.codec ?? 'none',
          audio: p.audio?.codec ?? 'none',
        }
      : null,
    narration: {
      provider: manifest.provider,
      voice: manifest.voice,
      rate: manifest.rate,
      model: manifest.model ?? null,
      format: manifest.format,
      seconds: Math.round(manifest.sentences.reduce((n, s) => n + s.duration, 0) * 100) / 100,
      sentences: manifest.sentences.map((s) => ({ id: s.id, seconds: s.duration, sha: s.sha, words: s.words.length })),
      cost: manifest.provider === 'edge' ? '$0 (edge-tts, no key)' : 'unknown',
    },
    rendering: {
      architecture:
        'Remotion (React, frame-based) rendered through @remotion/renderer; ffmpeg from the Remotion compositor for QA',
      seconds: Math.round(out.renderSeconds * 10) / 10,
      frames: tl.durationInFrames,
      cost: '$0 (local CPU)',
    },
    fingerprints: tl.fingerprints,
    qa: { ok: qa.ok, checks: qa.checks, frames: qa.frames.map((f) => f.file) },
    limitations: [
      'edge-tts is an unofficial API with no stated licence for published media; confirm before release or switch provider',
      'word boundaries group a numeral with the word before it ("asked 601"), so a numeral cue lands at the start of that pair',
      'system fonts (Georgia, Segoe UI): renders on another machine may set type differently',
      'no loudness normalisation; one voice at one rate is consistent enough for the spike',
      'scene transitions are a short fade over the field; no cross-dissolve between scenes',
      ...(seg.release ? [] : ['no release.json: the script and storyboard are validated but not locked']),
    ],
  };
}

export function renderReportMd(r: BuildReport): string {
  const out = [
    `# Build report: ${r.title}`,
    '',
    `${r.topic} / ${r.story}, ${r.generatedAt}. \`${r.command}\``,
    '',
    `**Segment.** Scenes ${r.segment.scenes.join(', ')} (${Object.entries(r.segment.kinds)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}); sentences ${r.segment.sentences.join(', ')}.`,
    '',
    r.output
      ? `**Output.** ${r.output.file}: ${r.output.seconds.toFixed(2)}s, ${r.output.width}x${r.output.height} @ ${r.output.fps} fps, ${r.output.video} + ${r.output.audio}, ${r.rendering.frames} frames rendered in ${r.rendering.seconds}s (${r.rendering.cost}).`
      : '**Output.** none',
    '',
    `**Narration.** ${r.narration.provider} / ${r.narration.voice} (rate ${r.narration.rate}${r.narration.model ? `, ${r.narration.model}` : ''}), ${r.narration.format}, ${r.narration.seconds}s of speech, ${r.narration.cost}.`,
    '',
    '| Sentence | Seconds | Boundaries | Audio sha |',
    '|---|---|---|---|',
    ...r.narration.sentences.map((s) => `| ${s.id} | ${s.seconds} | ${s.words} | ${s.sha} |`),
    '',
    `**Architecture.** ${r.rendering.architecture}.`,
    '',
    `**Fingerprints.** script ${r.fingerprints.script}, storyboard ${r.fingerprints.storyboard}, narration ${r.fingerprints.narration}, config ${r.fingerprints.config}.`,
    '',
    `## QA: ${r.qa.ok ? 'passed' : 'FAILED'} (${r.qa.checks.filter((c) => c.ok).length} of ${r.qa.checks.length})`,
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
    ...r.qa.checks.map((c) => `| ${c.name} | ${c.ok ? 'ok' : 'FAIL'} | ${c.detail.replace(/\|/g, '/')} |`),
    '',
    `Inspection frames: ${r.qa.frames.length} in video/frames/.`,
    '',
    '## Known limitations',
    '',
    ...r.limitations.map((l) => `- ${l}`),
    '',
  ];
  return out.join('\n');
}
