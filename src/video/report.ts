// The build report: what was rendered from what, with what, and how the QA went. video/build-report.json and .md.
// The production board reads it through BuildSummary (src/lib/build-report.ts), which BuildReport extends.
import type { BuildSummary, Clearance } from '../lib/build-report';
import type { Probe } from './ffmpeg';
import type { MixReport } from './music';
import type { QaResult } from './qa';
import { RENDERER_LIMITATIONS } from './remotion/limitations';
import type { Segment } from './select';
import { providerLimitations } from './tts';
import type { NarrationManifest, Timeline } from './types';

export interface BuildReport extends BuildSummary {
  topic: string;
  story: string;
  title: string;
  generatedAt: string;
  command: string;
  segment: { scenes: string[]; sentences: string[]; kinds: Record<string, string>; storyboardScenes: number };
  output: {
    file: string;
    sha: string | null; // of the mp4 QA checked; the review package refuses any other file
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
    licence: string;
    publishable: boolean;
    seconds: number;
    wordsPerMinute: number;
    sentences: { id: string; seconds: number; sha: string; words: number }[];
    cost: string;
  };
  rendering: { architecture: string; seconds: number; frames: number; cost: string };
  /** The soundtrack, when one was mixed: provenance per composition and the mix levels. Null: narration only. */
  music: {
    fingerprint: string;
    compositions: MixReport['compositions'];
    cues: { id: string; asset: string; start: number; end: number; gain: number; rmsDb: number }[];
    levels: Pick<MixReport, 'peakDb' | 'musicPeakDb' | 'narrationPeakDb' | 'musicUnderSpeechDb' | 'musicScale'>;
  } | null;
  clearance: Clearance;
  fingerprints: Timeline['fingerprints'];
  qa: { ok: boolean; checks: QaResult['checks']; frames: string[]; contactSheet: string | null };
  limitations: string[];
}

export function buildReport(
  seg: Segment,
  tl: Timeline,
  manifest: NarrationManifest,
  out: { file: string; probe: Probe | null; sha?: string | null; renderSeconds: number },
  qa: QaResult,
  command: string,
  contactSheet: string | null = null,
  mix: MixReport | null = null,
): BuildReport {
  const p = out.probe;
  const speech = manifest.sentences.reduce((n, s) => n + s.duration, 0);
  const words = seg.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  const publishable = /^commercial/.test(manifest.licence);
  const musicCleared = mix ? mix.compositions.every((c) => c.licence.cleared) : null;
  const why = [
    ...(publishable
      ? []
      : [
          `narration is ${manifest.licence}; when the draft is accepted, "npm run video -- final ${tl.topic} ${tl.story} --approved-by <name>" re-narrates it for release`,
        ]),
    ...(mix?.compositions ?? [])
      .filter((c) => !c.licence.cleared)
      .map((c) => `music ${c.id} is not cleared${c.licence.notes ? `: ${c.licence.notes}` : ''}`),
  ];
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
      storyboardScenes: seg.storyboard.scenes.length,
    },
    output: p
      ? {
          file: out.file,
          sha: out.sha ?? null,
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
      licence: manifest.licence,
      publishable,
      seconds: Math.round(speech * 100) / 100,
      wordsPerMinute: Math.round((words / speech) * 60),
      sentences: manifest.sentences.map((s) => ({ id: s.id, seconds: s.duration, sha: s.sha, words: s.words.length })),
      cost:
        manifest.provider === 'edge'
          ? '$0 (edge-tts, no key)'
          : `$${manifest.cost} (estimated from ${manifest.provider === 'azure' ? 'characters' : 'minutes of audio'})`,
    },
    rendering: {
      architecture:
        'Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS)',
      seconds: Math.round(out.renderSeconds * 10) / 10,
      frames: tl.durationInFrames,
      cost: '$0 (local CPU)',
    },
    music: mix
      ? {
          fingerprint: mix.fingerprint,
          compositions: mix.compositions,
          cues: mix.cues.map((c) => ({
            id: c.id,
            asset: c.asset,
            start: c.start,
            end: c.end,
            gain: c.gain,
            rmsDb: c.rmsDb,
          })),
          levels: {
            peakDb: mix.peakDb,
            musicPeakDb: mix.musicPeakDb,
            narrationPeakDb: mix.narrationPeakDb,
            musicUnderSpeechDb: mix.musicUnderSpeechDb,
            musicScale: mix.musicScale,
          },
        }
      : null,
    clearance: { narration: publishable, music: musicCleared, publishable: publishable && musicCleared !== false, why },
    fingerprints: tl.fingerprints,
    qa: { ok: qa.ok, checks: qa.checks, frames: qa.frames.map((f) => f.file), contactSheet },
    limitations: [
      publishable
        ? `narration licence: ${manifest.licence}`
        : `NOT FOR PUBLICATION: narration is ${manifest.licence}; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release`,
      ...providerLimitations(manifest.provider),
      ...RENDERER_LIMITATIONS,
      'automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision',
      mix
        ? 'music levels are measured, not heard: a person judges the balance and the continuity in the review pass'
        : 'no soundtrack: narration only',
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
    `**Segment.** ${r.segment.scenes.length} of ${r.segment.storyboardScenes} storyboard scenes (${r.segment.scenes[0]} to ${r.segment.scenes.at(-1)}), ${r.segment.sentences.length} sentences. Kinds: ${Object.entries(
      r.segment.kinds,
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}.`,
    '',
    r.output
      ? `**Output.** ${r.output.file}: ${r.output.seconds.toFixed(2)}s, ${r.output.width}x${r.output.height} @ ${r.output.fps} fps, ${r.output.video} + ${r.output.audio}, ${r.rendering.frames} frames, rendered in ${r.rendering.seconds}s (${r.rendering.cost}).`
      : '**Output.** none',
    '',
    `**Narration.** ${r.narration.provider} / ${r.narration.voice} (rate ${r.narration.rate}${r.narration.model ? `, ${r.narration.model}` : ''}), ${r.narration.format}, ${r.narration.seconds}s of speech at about ${r.narration.wordsPerMinute} wpm, ${r.narration.cost}. Licence: ${r.narration.licence}. ${r.narration.publishable ? 'Publishable.' : '**Draft only, not publishable.**'}`,
    '',
    '| Sentence | Seconds | Boundaries | Audio sha |',
    '|---|---|---|---|',
    ...r.narration.sentences.map((s) => `| ${s.id} | ${s.seconds} | ${s.words} | ${s.sha} |`),
    '',
    `**Architecture.** ${r.rendering.architecture}.`,
    '',
    ...(r.music
      ? [
          `**Soundtrack.** ${r.music.compositions
            .map(
              (c) =>
                `${c.title} (${c.generator.name} ${c.generator.version}, ${c.source.file} ${c.source.sha}, ${c.source.bpm} bpm ${c.source.key}; ${c.licence.cleared ? 'cleared' : 'NOT cleared'}${c.licence.samples.length ? `; samples: ${c.licence.samples.map((s) => `${s.pack} ${s.licence}`).join(', ')}` : '; no samples'}${c.licence.attribution.length ? `; attribution: ${c.licence.attribution.join(' / ')}` : ''})`,
            )
            .join(
              '; ',
            )}. Mix ${r.music.fingerprint}: music ${r.music.levels.musicUnderSpeechDb} dB under the voice while it speaks, peak ${r.music.levels.peakDb} dB${r.music.levels.musicScale < 1 ? ` (music scaled x${r.music.levels.musicScale})` : ''}.`,
          '',
          '| Cue | Asset | From | To | Gain | Level |',
          '|---|---|---|---|---|---|',
          ...r.music.cues.map(
            (c) =>
              `| ${c.id} | ${c.asset} | ${c.start.toFixed(1)}s | ${c.end.toFixed(1)}s | ${c.gain} dB | ${c.rmsDb.toFixed(1)} dB |`,
          ),
          '',
        ]
      : ['**Soundtrack.** none (narration only).', '']),
    `**Clearance.** ${r.clearance.publishable ? 'Narration and music are both cleared for publication.' : `**Not cleared for public release:** ${r.clearance.why.join('; ')}.`} A passing build is technical completion only; a person approves the release.`,
    '',
    `**Fingerprints.** script ${r.fingerprints.script}, storyboard ${r.fingerprints.storyboard}, narration ${r.fingerprints.narration}, config ${r.fingerprints.config}, look ${r.fingerprints.look}${r.music ? `, music ${r.music.fingerprint}` : ''}.`,
    '',
    `## QA: ${r.qa.ok ? 'passed' : 'FAILED'} (${r.qa.checks.filter((c) => c.ok).length} of ${r.qa.checks.length})`,
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
    ...r.qa.checks.map((c) => `| ${c.name} | ${c.ok ? 'ok' : 'FAIL'} | ${c.detail.replace(/\|/g, '/')} |`),
    '',
    `Inspection frames: ${r.qa.frames.length} in video/frames/${r.qa.contactSheet ? `; contact sheet ${r.qa.contactSheet}` : ''}.`,
    '',
    '## Known limitations',
    '',
    ...r.limitations.map((l) => `- ${l}`),
    '',
  ];
  return out.join('\n');
}
