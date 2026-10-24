// The review package: everything a person needs to upload the rendered MP4 to YouTube (privately for a draft build, publicly
// once the build report says narration and music are cleared, which `npm run video -- final` produces) and review it, written to topics/<topic>/scripts/<slug>/video/review/. No API call, no publishing: a folder with the file, the
// paste-ready text (working title, description with measured chapter timestamps and the research sources), the
// provenance of the voice and the music, the build report and the review checklist. The package says, in every file,
// which of the two it is: a draft build carries the private banners and the draft-voice check, a release build carries none.
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { site } from '../config/site';
import { fileSha, sha, toJson } from '../lib/io';
import { sectionTitle } from '../lib/script';
import { renderSrt } from './captions';
import { extractFrame } from './ffmpeg';
import type { BuildReport } from './report';
import { VIDEO_FILES } from './files';
import type { Segment } from './select';
import type { Timeline } from './types';

export const REVIEW_DIR = 'review';
export const REVIEW_FILES = {
  json: 'review.json',
  readme: 'README.md',
  description: 'description.txt',
  checklist: 'checklist.md',
  report: 'build-report.md',
  thumbnail: 'thumbnail.png',
  captions: 'captions.en.srt', // one cue per sentence from the measured timeline (src/video/captions.ts)
} as const;

export interface Chapter {
  scene: string;
  seconds: number;
  stamp: string; // m:ss
  title: string;
}
export interface ReviewPackage {
  generatedAt: string;
  status: 'private review build' | 'release build';
  title: string; // the working title for a private upload, the real title for a release
  mp4: string; // the file to upload, relative to the review dir (or the segment path when not copied)
  mp4Sha: string;
  thumbnailSha: string | null; // of thumbnail.png (gitignored), so the board can tell a changed thumbnail in CI
  captionsSha: string | null; // of captions.en.srt; the uploader sends the file, the ledger records the sha
  seconds: number;
  buildReport: string; // sha of video/build-report.json this package was made from; the board compares it
  chapters: Chapter[];
  sources: { studies: { name: string; file: string }[]; sources: { channel: string; title: string; href: string }[] };
  provenance: {
    narration: BuildReport['narration'] & { publishable: boolean };
    music: BuildReport['music'];
    clearance: BuildReport['clearance'];
  };
  qa: { ok: boolean; passed: number; total: number };
  checklist: string[];
  files: string[];
}

const stamp = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s - m * 60)).padStart(2, '0')}`;
};

/** Chapters: render.json's `chapters` (scene id -> title) when present, else the script's sections, each at the
 *  measured start of its first scene. YouTube wants the first at 0:00, so the first chapter is pinned there. */
export function chapters(seg: Segment, tl: Timeline): Chapter[] {
  const sceneOf = new Map(tl.scenes.flatMap((s) => s.sentences.map((x) => [x.id, s.id] as const)));
  const start = (id: string) => (tl.scenes.find((s) => s.id === id)?.start ?? 0) / tl.fps;
  const named = seg.config.chapters;
  for (const id of Object.keys(named ?? {}))
    if (!tl.scenes.some((s) => s.id === id)) throw new Error(`render.json chapters names ${id}, not in the timeline`);
  const list: Chapter[] = named
    ? Object.entries(named).map(([scene, title]) => ({ scene, seconds: start(scene), stamp: '', title }))
    : seg.script.sections.flatMap((sec) => {
        const scene = sec.sentences.map((s) => sceneOf.get(s.id)).find((x): x is string => !!x);
        if (!scene) return [];
        return [{ scene, seconds: start(scene), stamp: '', title: sectionTitle(sec) }];
      });
  list.sort((a, b) => a.seconds - b.seconds);
  if (list.length) list[0].seconds = 0;
  // YouTube ignores every chapter unless there are at least three, starting at 0:00, each at least 10 s long
  if (list.length < 3) throw new Error(`${list.length} chapters; YouTube needs at least 3`);
  const short = list.filter((c, i) => i > 0 && c.seconds - list[i - 1].seconds < 10);
  if (short.length) throw new Error(`chapters under 10 s: ${short.map((c) => c.title).join(', ')}`);
  return list.map((c) => ({ ...c, stamp: stamp(c.seconds) }));
}

export const CHECKLIST = [
  'Opening: does the cold open land before the music enters, and does the title card read cleanly?',
  'Narration: is every sentence intelligible at normal volume on headphones and on a laptop speaker?',
  'Music balance: does the bed ever compete with the voice, especially under the dense explanations?',
  'Music continuity: do the loops and the cue changes pass unnoticed, with no click, pump or abrupt change at a scene boundary?',
  'Citations: is every on-screen citation legible at 1080p and at 720p for long enough to read?',
  'Charts: do the numbers on screen match the storyboard and the cited passages (spot-check three)?',
  'Pacing: are there dead stretches or rushed passages; do the pauses after key figures feel right?',
  'Transitions: does every scene change read as intended; nothing cut off, nothing held too long?',
  'Visual glitches: any flicker, overlapping text, clipped labels or wrong fonts (compare the contact sheet)?',
  'Conclusion: does the ending answer the question asked at the start, and does the black hold as the storyboard says?',
  'Playback: compare the local MP4 with the YouTube transcode at 1080p and 480p for banding, blur on small text and audio level.',
];
/** The last question of a draft build's checklist; a release build (cleared narration and music) has no draft voice. */
export const DRAFT_CHECK =
  'Release: the narration voice is draft-only until re-narrated under commercial terms; confirm nothing in this build is cleared for public release unless the build report says so.';

/** Why this build cannot be packaged, or null: QA must have passed on exactly this mp4. */
export function reviewInputProblem(report: BuildReport, mp4Sha: string | null): string | null {
  if (mp4Sha === null) return `no ${VIDEO_FILES.mp4}; render first`;
  if (!report.qa.ok) return 'the build report says QA failed; fix the build before packaging it';
  if (mp4Sha !== report.output?.sha)
    return `${VIDEO_FILES.mp4} (${mp4Sha}) is not the file QA checked (${report.output?.sha}); run qa again`;
  return null;
}

/** The upload's file name: the story slug, marked as a private review build unless this is the release build. */
export const reviewMp4Name = (videoDir: string, release = false) =>
  `${videoDir
    .replace(/[\\/]video$/, '')
    .split(/[\\/]/)
    .pop()}${release ? '' : '-review-private'}.mp4`;
/** The title card a thumbnail is taken from, when the storyboard has one. */
export const thumbnailScene = (tl: Timeline) => tl.scenes.find((s) => s.kind === 'title') ?? null;

/** The package's data (review.json), pure: what the files below are rendered from. */
export function reviewData(
  seg: Segment,
  tl: Timeline,
  report: BuildReport,
  made: {
    mp4: string;
    mp4Sha: string;
    buildReport: string;
    thumbnailSha: string | null;
    captionsSha: string | null;
    generatedAt: string;
  },
): ReviewPackage {
  const studies = seg.pkg.documents.map((d) => ({ name: d.name, file: d.file }));
  const sources = [
    ...new Map(
      seg.pkg.claims
        .flatMap((c) => c.statements)
        .map((s) => [s.href, { channel: s.channel, title: s.title, href: s.href }]),
    ).values(),
  ];
  const release = report.clearance.publishable;
  return {
    generatedAt: made.generatedAt,
    status: release ? 'release build' : 'private review build',
    title: release ? tl.title : `[PRIVATE REVIEW] ${tl.title}`,
    mp4: made.mp4,
    mp4Sha: made.mp4Sha,
    thumbnailSha: made.thumbnailSha,
    captionsSha: made.captionsSha,
    seconds: report.output?.seconds ?? tl.durationInFrames / tl.fps,
    buildReport: made.buildReport,
    chapters: chapters(seg, tl),
    sources: { studies, sources },
    provenance: { narration: report.narration, music: report.music, clearance: report.clearance },
    qa: { ok: report.qa.ok, passed: report.qa.checks.filter((c) => c.ok).length, total: report.qa.checks.length },
    checklist: release ? CHECKLIST : [...CHECKLIST, DRAFT_CHECK],
    files: [
      made.mp4,
      REVIEW_FILES.readme,
      REVIEW_FILES.description,
      REVIEW_FILES.checklist,
      REVIEW_FILES.report,
      made.thumbnailSha ? REVIEW_FILES.thumbnail : null,
      made.captionsSha ? REVIEW_FILES.captions : null,
      REVIEW_FILES.json,
    ].filter((f): f is string => !!f),
  };
}

/** description.txt: paste-ready for the upload, with the measured chapters and the research sources. */
export function renderDescription(pkg: ReviewPackage, seg: Segment, tl: Timeline, report: BuildReport): string {
  const musicLine = report.music
    ? report.music.compositions
        .map(
          (c) =>
            `${c.title}, an original composition made with ${c.generator.name} (${c.generator.repo}), ${c.source.bpm} bpm ${c.source.key}${c.licence.attribution.length ? `; ${c.licence.attribution.join('; ')}` : ''}`,
        )
        .join('; ')
    : 'none';
  const release = pkg.status === 'release build';
  return (
    [
      ...(release
        ? []
        : [
            `PRIVATE REVIEW BUILD, not for publication. Built ${report.generatedAt.slice(0, 10)} from script ${report.fingerprints.script} / storyboard ${report.fingerprints.storyboard}.`,
            '',
          ]),
      seg.pkg.question ?? tl.title,
      '',
      'Chapters',
      ...pkg.chapters.map((c) => `${c.stamp} ${c.title}`),
      '',
      'Studies cited',
      ...pkg.sources.studies.map((s) => `- ${s.name}`),
      '',
      // YouTube allows 5000 bytes; the sources discussed (often forty) live on the topic page, one link replaces the list
      `${site.publicRecord}, with every source discussed and how each claim held up: ${site.url}${tl.topic}/`,
      '',
      `${site.name}. ${site.disclosure}`,
      '',
      ...(release
        ? [`Music: ${musicLine}.`]
        : [
            `Narration: ${report.narration.provider} / ${report.narration.voice}. ${report.narration.publishable ? 'Commercial terms.' : 'DRAFT VOICE: ' + report.narration.licence + '.'}`,
            `Music: ${musicLine}.`,
            '',
            `Release clearance: BLOCKED: ${report.clearance.why.join('; ')}.`,
          ]),
    ].join('\n') + '\n'
  );
}

/** README.md: how to upload it, what it is made of, and what comes after the review. */
export function renderReadme(pkg: ReviewPackage, tl: Timeline, report: BuildReport): string {
  const thumbnail = pkg.files.includes(REVIEW_FILES.thumbnail);
  const release = pkg.status === 'release build';
  return [
    release ? `# RELEASE BUILD: ${tl.title}` : `# PRIVATE REVIEW BUILD: ${tl.title}`,
    '',
    release
      ? `Upload \`${pkg.mp4}\` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).`
      : `Upload \`${pkg.mp4}\` to YouTube as a **private** video for review. Do not publish. Public release is blocked: ${pkg.provenance.clearance.why.join('; ')}.`,
    '',
    `- ${release ? 'Title' : 'Working title'}: ${pkg.title}`,
    `- Duration: ${stamp(pkg.seconds)} (${pkg.seconds.toFixed(1)}s), ${report.output?.width}x${report.output?.height} @ ${report.output?.fps} fps`,
    `- MP4 sha: ${pkg.mp4Sha}; build report ${pkg.buildReport}; QA ${pkg.qa.passed}/${pkg.qa.total}${pkg.qa.ok ? '' : ' FAILED'}`,
    `- Description: \`${REVIEW_FILES.description}\` (paste as is; chapters are measured from the timeline)`,
    `- Checklist: \`${REVIEW_FILES.checklist}\`; build report: \`${REVIEW_FILES.report}\`${thumbnail ? `; thumbnail: \`${REVIEW_FILES.thumbnail}\` (the title card)` : ''}${pkg.captionsSha ? `; captions: \`${REVIEW_FILES.captions}\`` : ''}`,
    '',
    '## Chapters',
    '',
    ...pkg.chapters.map((c) => `- ${c.stamp} ${c.title} (${c.scene})`),
    '',
    '## Provenance',
    '',
    `- Narration: ${report.narration.provider} / ${report.narration.voice} (rate ${report.narration.rate}), ${report.narration.seconds}s of speech, ${report.narration.cost}. Licence: ${report.narration.licence}. ${report.narration.publishable ? 'Publishable.' : '**Draft only.**'}`,
    ...(report.music
      ? report.music.compositions.map(
          (c) =>
            `- Music: ${c.title} (${c.id}), ${c.generator.name} ${c.generator.version} at ${c.generator.repo}, source ${c.source.file} ${c.source.sha}, ${c.source.bpm} bpm ${c.source.key}. ${c.licence.cleared ? 'Cleared' : '**Not cleared**'}${c.licence.samples.length ? `; samples: ${c.licence.samples.map((s) => `${s.pack} (${s.licence})`).join(', ')}` : '; no samples'}${c.licence.attribution.length ? `; attribution required: ${c.licence.attribution.join(' / ')}` : ''}${c.licence.notes ? `. ${c.licence.notes}` : ''}.`,
        )
      : ['- Music: none (narration only).']),
    ...(report.music
      ? [
          `- Mix: ${report.music.cues.length} cues, music ${report.music.levels.musicUnderSpeechDb} dB under the voice while it speaks, peak ${report.music.levels.peakDb} dB.`,
        ]
      : []),
    `- Clearance: narration ${report.clearance.narration ? 'yes' : 'no'}, music ${report.clearance.music === null ? 'n/a' : report.clearance.music ? 'yes' : 'no'}. ${report.clearance.publishable ? 'Cleared for public release.' : 'Not cleared for public release.'}`,
    '',
    ...(release
      ? [
          '## After the upload',
          '',
          `1. Record it: \`npm run publish -- uploaded ${tl.topic} ${tl.story} --id <youtube id> --visibility private\` (or \`public\` once approved).`,
          `2. Watch the upload with the checklist, then approve this build: \`npm run publish -- approve ${tl.topic} ${tl.story} --by "<name>"\`.`,
          `3. Set it public or schedule it on YouTube, then \`npm run publish -- published ${tl.topic} ${tl.story}\` (or \`scheduled --at <ISO>\`).`,
          '4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).',
        ]
      : [
          '## After the review',
          '',
          `1. Record the private upload: \`npm run publish -- uploaded ${tl.topic} ${tl.story} --id <youtube id> --visibility private\`.`,
          '2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.',
          '3. Public release needs, besides approval: `npm run video -- final <topic> <story-id> --approved-by "<name>"` (the commercial voice' +
            (report.clearance.music === false ? '; music must be cleared too' : '') +
            '), which packages the release build.',
        ]),
    '',
  ].join('\n');
}

/** checklist.md: the questions a person answers while watching the private upload. */
export const renderChecklist = (pkg: ReviewPackage, tl: Timeline) =>
  [
    '# Review checklist',
    '',
    `${tl.title}, ${pkg.status} ${pkg.generatedAt.slice(0, 10)}.`,
    '',
    ...pkg.checklist.map((c) => `- [ ] ${c}`),
    '',
  ].join('\n');

/** Check, copy the mp4, take the thumbnail, then write the package's files: the only part that touches the disk. */
export function buildReviewPackage(
  seg: Segment,
  tl: Timeline,
  report: BuildReport,
  videoDir: string,
  log?: (l: string) => void,
): ReviewPackage {
  const mp4 = join(videoDir, VIDEO_FILES.mp4);
  const mp4Sha = existsSync(mp4) ? sha(readFileSync(mp4)) : null;
  const problem = reviewInputProblem(report, mp4Sha);
  if (problem) throw new Error(problem);
  const dir = join(videoDir, REVIEW_DIR);
  mkdirSync(dir, { recursive: true });
  const card = thumbnailScene(tl);
  const release = report.clearance.publishable;
  const thumbnail = join(dir, REVIEW_FILES.thumbnail);
  if (card) extractFrame(mp4, (card.start + card.duration - 15) / tl.fps, thumbnail);
  const srt = renderSrt(tl);
  writeFileSync(join(dir, REVIEW_FILES.captions), srt);
  const pkg = reviewData(seg, tl, report, {
    mp4: reviewMp4Name(videoDir, release),
    mp4Sha: mp4Sha!,
    buildReport: fileSha(join(videoDir, VIDEO_FILES.report)),
    thumbnailSha: card && existsSync(thumbnail) ? sha(readFileSync(thumbnail)) : null,
    captionsSha: sha(srt),
    generatedAt: new Date().toISOString(),
  });
  const other = join(dir, reviewMp4Name(videoDir, !release)); // one mp4 in the folder: the build this package describes
  if (existsSync(other)) unlinkSync(other);
  copyFileSync(mp4, join(dir, pkg.mp4));
  writeFileSync(join(dir, REVIEW_FILES.readme), renderReadme(pkg, tl, report));
  writeFileSync(join(dir, REVIEW_FILES.description), renderDescription(pkg, seg, tl, report));
  writeFileSync(join(dir, REVIEW_FILES.checklist), renderChecklist(pkg, tl));
  copyFileSync(join(videoDir, VIDEO_FILES.reportMd), join(dir, REVIEW_FILES.report));
  writeFileSync(join(dir, REVIEW_FILES.json), toJson(pkg));
  log?.(`${pkg.files.length} files in ${dir}`);
  return pkg;
}
