// The review package: everything a person needs to upload the rendered MP4 to YouTube (privately for a draft build, publicly
// once the build report says narration and music are cleared, which `npm run video -- final` produces) and review it, written to topics/<topic>/scripts/<slug>/video/review/. No API call, no publishing: a folder with the file, the
// paste-ready text (working title, description with measured chapter timestamps and the research sources), the
// provenance of the voice and the music, the build report and the review checklist. The package says, in every file,
// which of the two it is: a draft build carries the private banners and the draft-voice check, a release build carries none.
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commissionKey, commissionOf, site } from '../config/site';
import { absolute, contentGraph, matterPath, storyNode } from '../lib/content-graph';
import { type CtaType, ctaPath, loadCta, resolveCtas } from '../lib/cta';
import { fileSha, readJson, ROOT, sha, toJson, topicDir } from '../lib/io';
import { loadLedger, mainOutput } from '../lib/publish';
import { sectionTitle } from '../lib/script';
import { uploadProblem } from '../lib/uploader';
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
  links: 'links.json', // every destination in the description's Links block (DescriptionLinks)
} as const;

/** The description's Links block (plan 4, D5 and D8), recorded in links.json: the calls to action, or for a Short its
 *  parent's matter page, then the record on the inquiry. `cta` is the sha of cta.json, or "default" without one. */
export interface DescriptionLinks {
  cta: string;
  links: {
    type: CtaType | 'matter' | 'inquiry-record' | 'parent-matter';
    node: string | null;
    url: string;
    text: string;
  }[];
}
const recordLink = (topic: string): DescriptionLinks['links'][number] => ({
  type: 'inquiry-record',
  node: topic,
  url: `${site.url}${topic}/`,
  text: 'The full record on this inquiry',
});

/** The links a description carries, from the content graph and the story's cta.json (a file problem throws). A story
 *  the public graph does not hold (a topic no institution publishes) gets the record line only. */
export function descriptionLinks(
  topic: string,
  story: string,
  shortParent: string | null,
  root = ROOT,
): DescriptionLinks {
  const id = shortParent ?? story;
  const node = storyNode(topic, id);
  const g = contentGraph(root, [topic], 'live', [node]);
  const s = g.stories.get(node);
  if (!s) return { cta: 'default', links: [recordLink(topic)] };
  const matter = absolute(matterPath(topic, s));
  if (shortParent)
    return {
      cta: 'default',
      links: [
        { type: 'parent-matter', node, url: matter, text: 'The evidence and the full answer' },
        recordLink(topic),
      ],
    };
  const file = loadCta(topic, story, root);
  const r = resolveCtas(file, g, node, root);
  if (r.problems.length) throw new Error(`cta.json: ${r.problems.join('; ')}`);
  const ctas = [r.primary, ...r.secondary].map((c) => ({
    type: c.type,
    node: c.node,
    url: c.url,
    text: c.disclosure ? `Paid link (${c.disclosure}): ${c.text}` : c.text,
  }));
  // The matter page always (D3.1: the URL moved.json protects), unless a call to action already leads there; then the
  // record line, unless a call to action already points at the inquiry.
  const page = ctas.some((c) => c.url.startsWith(matter))
    ? []
    : [{ type: 'matter' as const, node, url: matter, text: 'The evidence and the full answer' }];
  const record = ctas.some((c) => c.url === recordLink(topic).url) ? [] : [recordLink(topic)];
  return { cta: file ? fileSha(ctaPath(topic, story, root)) : 'default', links: [...ctas, ...page, ...record] };
}

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
  tags: string[]; // YouTube keywords, the institution first (keywordsOf)
  sources: { studies: { name: string; file: string }[]; sources: { channel: string; title: string; href: string }[] };
  provenance: {
    narration: BuildReport['narration'] & { publishable: boolean };
    music: BuildReport['music'];
    clearance: BuildReport['clearance'];
  };
  qa: { ok: boolean; passed: number; total: number };
  checklist: string[];
  files: string[];
  /** A Short: its parent story, slug and format, and the full video's live url when the parent is published. */
  short: { parent: string; slug: string; format: string; fullVideo: string | null } | null;
}

/** YouTube keywords: ordered, de-duplicated without regard to case, each kept while the total as `uploadProblem`
 *  counts it stays within YouTube's 500 characters; one that does not fit, or holds < or >, is skipped and the later
 *  ones still tried. */
export function keywordsOf(k: { institution: string; inquiry: string; question: string; terms: string[] }): string[] {
  const tags: string[] = [];
  for (const t of [k.institution, k.inquiry, k.question, ...k.terms].map((x) => x.trim())) {
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    if (!uploadProblem({ title: 't', description: 'd', tags: [...tags, t] })) tags.push(t);
  }
  return tags;
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
/** A Short's extra question: YouTube draws its own controls over the bottom and the right edge of a vertical frame. */
export const SHORT_CHECK =
  'Short: at phone size, is nothing you need to read under the bottom fifth or the right edge, and do the captions keep up with the voice?';
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

/** The upload's file name: the story slug (a Short: `<parent slug>-short-<slug>`), marked as a private review build
 *  unless this is the release build. */
export const reviewMp4Name = (videoDir: string, release = false) => {
  const parts = videoDir.replace(/[\\/]video$/, '').split(/[\\/]/);
  const slug = parts.at(-2) === 'shorts' ? `${parts.at(-3)}-short-${parts.at(-1)}` : parts.at(-1);
  return `${slug}${release ? '' : '-review-private'}.mp4`;
};
/** The title card a thumbnail is taken from, when the storyboard has one. */
export const thumbnailScene = (tl: Timeline) =>
  tl.scenes.find((s) => s.kind === 'title' || s.kind === 'short-title') ?? null;
/** The parent video's live url for a Short's description, from the parent's ledger; null until it is published. */
export function fullVideoUrl(topic: string, parent: string): string | null {
  const ledger = loadLedger(topic, parent);
  const main = ledger && mainOutput(ledger);
  if (!main) return null;
  const events = ledger.outputs[main].events;
  const last = [...events].reverse().find((e) => e.type === 'published' || e.type === 'unpublished');
  return last?.type === 'published' ? (last.url ?? (last.id ? `https://youtu.be/${last.id}` : null)) : null;
}

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
    fullVideo?: string | null;
  },
): ReviewPackage {
  const short = seg.pkg.short;
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
    chapters: short ? [] : chapters(seg, tl), // YouTube ignores chapters on a Short
    tags: keywordsOf({
      institution: commissionOf(tl.topic)?.name ?? '',
      inquiry:
        readJson<{ topics: { label?: string }[] }>(join(topicDir(tl.topic), 'report.json'))?.topics[0]?.label ?? '',
      question: seg.pkg.question ?? tl.title,
      terms: seg.pkg.claims.map((c) => c.text).filter((t) => t.length <= 60), // the builder's ranking; a sentence is no keyword
    }),
    sources: { studies, sources },
    provenance: { narration: report.narration, music: report.music, clearance: report.clearance },
    qa: { ok: report.qa.ok, passed: report.qa.checks.filter((c) => c.ok).length, total: report.qa.checks.length },
    checklist: [...CHECKLIST, ...(short ? [SHORT_CHECK] : []), ...(release ? [] : [DRAFT_CHECK])],
    files: [
      made.mp4,
      REVIEW_FILES.readme,
      REVIEW_FILES.description,
      REVIEW_FILES.checklist,
      REVIEW_FILES.report,
      made.thumbnailSha ? REVIEW_FILES.thumbnail : null,
      made.captionsSha ? REVIEW_FILES.captions : null,
      REVIEW_FILES.links,
      REVIEW_FILES.json,
    ].filter((f): f is string => !!f),
    short: short
      ? { parent: short.parent, slug: short.slug, format: short.format, fullVideo: made.fullVideo ?? null }
      : null,
  };
}

/** description.txt: paste-ready for the upload, with the measured chapters and the research sources. */
export function renderDescription(
  pkg: ReviewPackage,
  seg: Segment,
  tl: Timeline,
  report: BuildReport,
  links: DescriptionLinks = { cta: 'default', links: [recordLink(tl.topic)] },
): string {
  const musicLine = report.music
    ? report.music.compositions
        .map(
          (c) =>
            `${c.title}, an original composition made with ${c.generator.name} (${c.generator.repo}), ${c.source.bpm} bpm ${c.source.key}${c.licence.attribution.length ? `; ${c.licence.attribution.join('; ')}` : ''}`,
        )
        .join('; ')
    : 'none';
  const release = pkg.status === 'release build';
  // The Links block opens the description: the calls to action (a Short: its parent's matter page) and the record.
  // YouTube allows 5000 bytes; the sources discussed (often forty) live on the topic page, the record link replaces them.
  // The institution's page sits before the inquiry record (after it when a call to action took the record's place).
  const c = commissionOf(tl.topic);
  const block = links.links.map((l) => `${l.text}: ${l.url}`);
  const at = links.links.findIndex((l) => l.type === 'inquiry-record');
  if (c) block.splice(at < 0 ? block.length : at, 0, `${c.name}: ${absolute(`/commissions/${commissionKey(c)}/`)}`);
  // a Short (brand/design.md 2.6): the hook, the links, the studies, #Shorts; the uploader adds the full video once live
  const body = pkg.short
    ? [seg.pkg.short?.hook ?? tl.title, '', ...block]
    : [seg.pkg.question ?? tl.title, '', ...block, '', 'Chapters', ...pkg.chapters.map((c) => `${c.stamp} ${c.title}`)];
  return (
    [
      ...(release
        ? []
        : [
            `PRIVATE REVIEW BUILD, not for publication. Built ${report.generatedAt.slice(0, 10)} from script ${report.fingerprints.script} / storyboard ${report.fingerprints.storyboard}.`,
            '',
          ]),
      ...(c ? [c.fullName, ...(c.slogan ? [c.slogan] : []), ''] : []),
      ...body,
      '',
      'Studies cited',
      ...pkg.sources.studies.map((s) => `- ${s.name}`),
      '',
      `${site.name}. ${site.disclosure}`,
      ...(pkg.short ? ['', '#Shorts'] : []),
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

/** Refuses a package whose title, description or tags YouTube would reject (`uploadProblem`), before it is written. */
export function assertWithinLimits(m: Parameters<typeof uploadProblem>[0]): void {
  const problem = uploadProblem(m);
  if (problem) throw new Error(`package: ${problem}`);
}

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
  const pkg = reviewData(seg, tl, report, {
    mp4: reviewMp4Name(videoDir, release),
    mp4Sha: mp4Sha!,
    buildReport: fileSha(join(videoDir, VIDEO_FILES.report)),
    thumbnailSha: card && existsSync(thumbnail) ? sha(readFileSync(thumbnail)) : null,
    captionsSha: sha(srt),
    generatedAt: new Date().toISOString(),
    fullVideo: seg.pkg.short ? fullVideoUrl(seg.script.topic, seg.pkg.short.parent) : null,
  });
  // compose and check the description first: a refusal leaves nothing half-written (only the gitignored thumbnail)
  const links = descriptionLinks(seg.script.topic, seg.script.story, seg.pkg.short?.parent ?? null);
  const description = renderDescription(pkg, seg, tl, report, links);
  assertWithinLimits({ title: pkg.title, description, tags: pkg.tags });
  writeFileSync(join(dir, REVIEW_FILES.captions), srt);
  const other = join(dir, reviewMp4Name(videoDir, !release)); // one mp4 in the folder: the build this package describes
  if (existsSync(other)) unlinkSync(other);
  copyFileSync(mp4, join(dir, pkg.mp4));
  writeFileSync(join(dir, REVIEW_FILES.readme), renderReadme(pkg, tl, report));
  writeFileSync(join(dir, REVIEW_FILES.description), description);
  writeFileSync(join(dir, REVIEW_FILES.links), toJson(links));
  writeFileSync(join(dir, REVIEW_FILES.checklist), renderChecklist(pkg, tl));
  copyFileSync(join(videoDir, VIDEO_FILES.reportMd), join(dir, REVIEW_FILES.report));
  writeFileSync(join(dir, REVIEW_FILES.json), toJson(pkg));
  log?.(`${pkg.files.length} files in ${dir}`);
  return pkg;
}
