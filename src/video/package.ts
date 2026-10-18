// The private review package: everything a person needs to upload the rendered MP4 to YouTube as a private video and
// review it, written to <topic>/scripts/<slug>/video/review/. No API call, no publishing: a folder with the file, the
// paste-ready text (working title, description with measured chapter timestamps and the research sources), the
// provenance of the voice and the music, the build report and the review checklist. The package says, in every file,
// that it is a review build and whether it is cleared for public release.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileSha, sha, toJson } from '../lib/io';
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
} as const;

export interface Chapter {
  scene: string;
  seconds: number;
  stamp: string; // m:ss
  title: string;
}
export interface ReviewPackage {
  generatedAt: string;
  status: 'private review build';
  title: string; // the working title for the private upload
  mp4: string; // the file to upload, relative to the review dir (or the segment path when not copied)
  mp4Sha: string;
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
        const title = sec.name.charAt(0).toUpperCase() + sec.name.slice(1);
        return [{ scene, seconds: start(scene), stamp: '', title }];
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
  'Release: the narration voice is draft-only until re-narrated under commercial terms; confirm nothing in this build is cleared for public release unless the build report says so.',
];

export function buildReviewPackage(
  seg: Segment,
  tl: Timeline,
  report: BuildReport,
  videoDir: string,
  log?: (l: string) => void,
): ReviewPackage {
  const mp4 = join(videoDir, VIDEO_FILES.mp4);
  if (!existsSync(mp4)) throw new Error(`no ${mp4}; render first`);
  if (!report.qa.ok) throw new Error('the build report says QA failed; fix the build before packaging it');
  const mp4Sha = sha(readFileSync(mp4));
  if (mp4Sha !== report.output?.sha)
    throw new Error(`${VIDEO_FILES.mp4} (${mp4Sha}) is not the file QA checked (${report.output?.sha}); run qa again`);
  const dir = join(videoDir, REVIEW_DIR);
  mkdirSync(dir, { recursive: true });
  const slug = videoDir
    .replace(/[\\/]video$/, '')
    .split(/[\\/]/)
    .pop();
  const mp4Name = `${slug}-review-private.mp4`;
  copyFileSync(mp4, join(dir, mp4Name));
  const ch = chapters(seg, tl);
  const studies = seg.pkg.documents.map((d) => ({ name: d.name, file: d.file }));
  const sources = [
    ...new Map(
      seg.pkg.claims
        .flatMap((c) => c.statements)
        .map((s) => [s.href, { channel: s.channel, title: s.title, href: s.href }]),
    ).values(),
  ];
  const title = `[PRIVATE REVIEW] ${tl.title}`;
  const musicLine = report.music
    ? report.music.compositions
        .map(
          (c) =>
            `${c.title}, an original composition made with ${c.generator.name} (${c.generator.repo}), ${c.source.bpm} bpm ${c.source.key}${c.licence.attribution.length ? `; ${c.licence.attribution.join('; ')}` : ''}`,
        )
        .join('; ')
    : 'none';
  const description = [
    `PRIVATE REVIEW BUILD, not for publication. Built ${report.generatedAt.slice(0, 10)} from script ${report.fingerprints.script} / storyboard ${report.fingerprints.storyboard}.`,
    '',
    seg.pkg.question ?? tl.title,
    '',
    'Chapters',
    ...ch.map((c) => `${c.stamp} ${c.title}`),
    '',
    'Studies cited',
    ...studies.map((s) => `- ${s.name}`),
    '',
    'Sources discussed',
    ...sources.map((s) => `- ${s.channel}: ${s.title} ${s.href}`),
    '',
    `Narration: ${report.narration.provider} / ${report.narration.voice}. ${report.narration.publishable ? 'Commercial terms.' : 'DRAFT VOICE: ' + report.narration.licence + '.'}`,
    `Music: ${musicLine}.`,
    '',
    `Release clearance: ${report.clearance.publishable ? 'cleared' : 'BLOCKED: ' + report.clearance.why.join('; ')}.`,
  ].join('\n');
  // a thumbnail from the title card, when the storyboard has one
  let thumbnail: string | null = null;
  const titleScene = tl.scenes.find((s) => s.kind === 'title');
  if (titleScene) {
    thumbnail = join(dir, REVIEW_FILES.thumbnail);
    extractFrame(mp4, (titleScene.start + titleScene.duration - 15) / tl.fps, thumbnail);
  }
  const reportJson = join(videoDir, VIDEO_FILES.report);
  const files = [
    mp4Name,
    REVIEW_FILES.readme,
    REVIEW_FILES.description,
    REVIEW_FILES.checklist,
    REVIEW_FILES.report,
    thumbnail ? REVIEW_FILES.thumbnail : null,
    REVIEW_FILES.json,
  ].filter((f): f is string => !!f);
  const pkg: ReviewPackage = {
    generatedAt: new Date().toISOString(),
    status: 'private review build',
    title,
    mp4: mp4Name,
    mp4Sha,
    seconds: report.output?.seconds ?? tl.durationInFrames / tl.fps,
    buildReport: fileSha(reportJson),
    chapters: ch,
    sources: { studies, sources },
    provenance: { narration: report.narration, music: report.music, clearance: report.clearance },
    qa: { ok: report.qa.ok, passed: report.qa.checks.filter((c) => c.ok).length, total: report.qa.checks.length },
    checklist: CHECKLIST,
    files,
  };
  const readme = [
    `# PRIVATE REVIEW BUILD: ${tl.title}`,
    '',
    `Upload \`${pkg.mp4}\` to YouTube as a **private** video for review. Do not publish. ${pkg.provenance.clearance.publishable ? 'The build report says narration and music are cleared.' : `Public release is blocked: ${pkg.provenance.clearance.why.join('; ')}.`}`,
    '',
    `- Working title: ${title}`,
    `- Duration: ${stamp(pkg.seconds)} (${pkg.seconds.toFixed(1)}s), ${report.output?.width}x${report.output?.height} @ ${report.output?.fps} fps`,
    `- MP4 sha: ${pkg.mp4Sha}; build report ${pkg.buildReport}; QA ${pkg.qa.passed}/${pkg.qa.total}${pkg.qa.ok ? '' : ' FAILED'}`,
    `- Description: \`${REVIEW_FILES.description}\` (paste as is; chapters are measured from the timeline)`,
    `- Checklist: \`${REVIEW_FILES.checklist}\`; build report: \`${REVIEW_FILES.report}\`${thumbnail ? `; thumbnail: \`${REVIEW_FILES.thumbnail}\` (the title card)` : ''}`,
    '',
    '## Chapters',
    '',
    ...ch.map((c) => `- ${c.stamp} ${c.title} (${c.scene})`),
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
    `- Clearance: narration ${report.clearance.narration ? 'yes' : 'no'}, music ${report.clearance.music === null ? 'n/a' : report.clearance.music ? 'yes' : 'no'}. ${report.clearance.publishable ? 'Cleared for public release once a person approves the review.' : 'Not cleared for public release.'}`,
    '',
    '## After the review',
    '',
    '1. Record the private URL and the review outcome in `production.json` (`decision: "reviewing"`, `url`).',
    '2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.',
    '3. Public release needs, besides approval: a commercial narration voice' +
      (report.clearance.music === false ? ', cleared music' : '') +
      ', and then a fresh package from that build.',
    '',
  ].join('\n');
  writeFileSync(join(dir, REVIEW_FILES.readme), readme);
  writeFileSync(join(dir, REVIEW_FILES.description), description + '\n');
  writeFileSync(
    join(dir, REVIEW_FILES.checklist),
    [
      '# Review checklist',
      '',
      `${tl.title}, private review build ${pkg.generatedAt.slice(0, 10)}.`,
      '',
      ...CHECKLIST.map((c) => `- [ ] ${c}`),
      '',
    ].join('\n'),
  );
  copyFileSync(join(videoDir, VIDEO_FILES.reportMd), join(dir, REVIEW_FILES.report));
  writeFileSync(join(dir, REVIEW_FILES.json), toJson(pkg));
  log?.(`${files.length} files in ${dir}`);
  return pkg;
}
