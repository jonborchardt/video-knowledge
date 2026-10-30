// A copy of one committed topic in a temp root, so board tests can edit artifacts without touching the repo, and a
// synthetic production in it built by the library code itself, so the board tests depend on no committed video.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { ARTICLE_FILES } from '../src/modules/article';
import type { BuildSummary } from '../src/shared/build-report';
import { article } from '../src/modules/article/tests/article-helpers';
import { corpusOf } from '../src/modules/evidence';
import {
  passageReader,
  docHasher,
  docReader,
  fileSha,
  readJson,
  sha,
  toJson,
  topicDir,
  FILES,
  scriptDir,
  shortId,
} from '../src/shared/io';
import { buildPackage } from '../src/modules/script';
import { lookFingerprint } from '../src/shared/look';
import { storyboardFingerprint } from '../src/shared/release-check';
import { validationFingerprint } from '../src/shared/sentence-validation';
import { renderCheckProblems } from '../src/modules/video/render-check';
import { scriptFingerprint, sentenceFingerprint, sentences } from '../src/shared/sentences';
import type { Release, Script, ScriptReviewFile, SectionName, SentenceType } from '../src/shared/types';
import { validateScript } from '../src/shared/sentence-validation';
import {
  type ShortsReviewFile,
  buildShortPackage,
  discoverShorts,
  loadShortParent,
  shortsPath,
  shortsReviewPath,
} from '../src/modules/shorts';
import { chainOf, loadReview, loadStories, reviewPath, storiesPath } from '../src/modules/stories';
import { buildStoryboard } from '../src/modules/storyboard';
import type { StoryboardPlan } from '../src/shared/types';
import { loadTopic } from '../src/modules/evidence';
import { writeRenderCheck } from '../src/modules/video/check';
import { initVideo } from '../src/modules/video/init';

// Matched against the path inside the topic, never the checkout's own path (CI checks out under .../work/...).
const SKIP = ['/store/transcripts', '/work', '/video/scenes', '/video/narration', '/video/frames', '/publish.json'];
const SKIP_EXT = ['.pdf', '.mp4', '.wav', '.png'];

/** Re-record a build's look (undefined: a report from before builds recorded it) and re-point the review package at
 *  the edited report, so only the look differs. */
export function setLook(dir: string, look: string | undefined): void {
  const rp = join(dir, 'video', 'build-report.json');
  const r = readJson<BuildSummary>(rp)!;
  writeFileSync(rp, toJson({ ...r, fingerprints: { ...r.fingerprints, look } }));
  const pp = join(dir, 'video', 'review', 'review.json');
  writeFileSync(pp, toJson({ ...readJson<object>(pp)!, buildReport: fileSha(rp) }));
}

export function copyTopic(topic: string): { root: string; dir: (storyId: string) => string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'vk-topic-'));
  const from = topicDir(topic);
  cpSync(from, topicDir(topic, root), {
    recursive: true,
    filter: (src) => {
      const f = '/' + relative(from, src).replaceAll('\\', '/');
      return !SKIP.some((s) => f.endsWith(s) || f.includes(`${s}/`)) && !SKIP_EXT.some((e) => f.endsWith(e));
    },
  });
  return {
    root,
    dir: (storyId) => scriptDir(topic, storyId, root),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** How far the synthetic production goes: `graphics` stops after render.json (no render check), `locked` adds the
 *  render check and release.json, `packaged` adds a build report, the soundtrack and a review package. */
export type FixtureStage = 'graphics' | 'locked' | 'packaged';
export interface Fixture {
  root: string;
  topic: string;
  story: string;
  dir: string;
  cleanup: () => void;
}

const TOPIC = 'heat-pumps';
// No figures, no quotations and no factual types: nothing for the pacing or provenance checks to flag, so the reviewer's
// approvals alone pass the validation.
const LINES: [SectionName, SentenceType, string][] = [
  ['hook', 'rhetorical', 'Does a heat pump really cost less to run?'],
  ['setup', 'transitional', 'Here is what the sources say and how they disagree.'],
  ['investigation', 'transitional', 'We look at the studies one at a time.'],
  ['answer', 'transitional', 'The answer depends on the home and the prices it pays.'],
  ['takeaway', 'transitional', 'Check your own bills before you decide.'],
];

/** A production for the first one-question ready story of heat-pumps, in a temp root, built up to `upTo`. */
export function syntheticProduction(upTo: FixtureStage, opts: { release?: boolean } = {}): Fixture {
  const c = copyTopic(TOPIC);
  const { root } = c;
  const stories = loadStories(TOPIC, root)!;
  const story = stories.stories.find((s) => s.readiness === 'ready' && !s.chain && !s.partOf)!;
  const dir = c.dir(story.id);
  // The copied topic may hold this story's real production; the fixture builds its own from scratch.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const write = (f: string, x: unknown) => writeFileSync(join(dir, f), typeof x === 'string' ? x : toJson(x));
  const read = passageReader(root);
  const t = corpusOf(loadTopic(TOPIC));
  const review = loadReview(TOPIC, root);

  // 1. the evidence package, as `npm run script -- package` builds it (the board rebuilds it the same way)
  const pkg = buildPackage(story, t, read, {
    review,
    inputs: {
      stories: fileSha(storiesPath(TOPIC, root)),
      review: fileSha(reviewPath(TOPIC, root)),
      report: fileSha(join(topicDir(TOPIC, root), 'report.json')),
    },
    readDoc: docReader(root),
    previous: null,
    chain: chainOf(story, stories),
  });
  write(FILES.pkg, pkg);

  // 2. the writer's script, bound to the package
  const script: Script = {
    topic: TOPIC,
    story: story.id,
    title: story.title,
    revision: 1,
    generation: {
      model: 'fixture',
      brief: 'src/modules/script/briefs/script.md',
      date: '2026-01-01',
      wordsPerMinute: 150,
      evidencePackage: pkg.fingerprint,
    },
    sections: LINES.map(([name, type, text], i) => ({ name, sentences: [{ id: `s${i + 1}`, text, type }] })),
  };
  write(FILES.script, script);

  // 3. the reviewer approves every sentence at its fingerprint; then the validation
  const sreview: ScriptReviewFile = {
    reviewer: 'fixture reviewer',
    date: '2026-01-01',
    revision: 1,
    packageFingerprint: pkg.fingerprint,
    approved: Object.fromEntries(sentences(script).map((s) => [s.id, sentenceFingerprint(s)])),
    findings: [],
  };
  write(FILES.review, sreview);
  const v = validateScript(script, t, read, {
    review: sreview,
    judgments: review.applicability,
    previous: null,
    pkg,
    hashDoc: docHasher(docReader(root)),
  });
  if (v.status !== 'passed' || v.counts.warnings) throw new Error(`fixture validation is ${v.status}`);
  write(FILES.validation, v);

  // 4. a storyboard plan, one title card per sentence, filled as `npm run script -- storyboard` fills it
  const plan: StoryboardPlan = {
    topic: TOPIC,
    story: story.id,
    scriptFingerprint: scriptFingerprint(script),
    generation: { model: 'fixture', brief: 'src/modules/storyboard/briefs/storyboard.md', date: '2026-01-01' },
    assets: {},
    scenes: sentences(script).map((s, i) => ({
      id: `sc${i + 1}`,
      sentences: [s.id],
      purpose: s.section,
      visual: { category: 'typography', description: 'the line as a title card', onScreenText: [s.section] },
    })),
  };
  const sb = buildStoryboard(plan, script, v, pkg, read);
  if (sb.status !== 'ok') throw new Error('fixture storyboard is blocked');
  write(FILES.storyboard, sb);

  // 5. video/render.json drafted by `npm run video -- init`
  initVideo(TOPIC, story.id, { root });
  const fixture = { root, topic: TOPIC, story: story.id, dir, cleanup: c.cleanup };
  if (upTo === 'graphics') return fixture;

  // 6. the render check and the lock, with the preconditions `npm run script -- lock` enforces
  const rc = writeRenderCheck(TOPIC, story.id, root);
  const problems = renderCheckProblems(rc, rc.fingerprints);
  if (problems.length) throw new Error(`fixture render check: ${problems.join('; ')}`);
  const release: Release = {
    topic: TOPIC,
    story: story.id,
    approvedBy: 'fixture approver',
    date: '2026-01-01',
    revision: v.revision,
    fingerprints: {
      script: v.scriptFingerprint,
      package: v.packageFingerprint ?? '',
      validation: validationFingerprint(v),
      storyboard: storyboardFingerprint(sb),
    },
  };
  write(FILES.release, release);
  if (upTo === 'locked') return fixture;

  // 7a. a released article: the stage between scored and packaged
  write(ARTICLE_FILES.release, {
    topic: TOPIC,
    story: story.id,
    approvedBy: 'fixture approver',
    date: '2026-01-01',
    revision: 1,
    fingerprints: { article: '', package: '', validation: '' },
    article: article({ topic: TOPIC, story: story.id }),
    history: [],
  });

  // 7. a passing full build with a soundtrack, and the review package made from it. No media: the board reads the
  // build report's summary and the review package's sha of it, never the mp4.
  const config = readJson<unknown>(join(dir, 'video', 'render.json'));
  const report: BuildSummary = {
    generatedAt: '2026-01-01',
    segment: { scenes: sb.scenes.map((s) => s.id) },
    output: { seconds: sb.runtime },
    narration: {
      provider: opts.release ? 'azure' : 'edge',
      voice: 'en-US-AndrewMultilingualNeural',
      publishable: !!opts.release,
    },
    music: { compositions: [{ title: 'Fixture' }] },
    clearance: opts.release
      ? { narration: true, music: true, publishable: true, why: [] }
      : { narration: false, music: false, publishable: false, why: ['draft voice'] },
    fingerprints: { ...release.fingerprints, config: sha(JSON.stringify(config)), look: lookFingerprint(TOPIC, root) },
    qa: { ok: true, checks: [{ name: 'fixture', ok: true }] },
  };
  write('video/build-report.json', report);
  mkdirSync(join(dir, 'video', 'review'), { recursive: true });
  write('video/review/review.json', {
    generatedAt: '2026-01-01',
    status: opts.release ? 'release build' : 'private review build',
    buildReport: fileSha(join(dir, 'video', 'build-report.json')),
    mp4: 'fixture.mp4',
    mp4Sha: opts.release ? 'releasesha' : 'draftsha',
    thumbnailSha: 'thumbsha',
    captionsSha: 'capsha',
    title: script.title,
  });
  write('video/review/description.txt', `${script.title}\n\nChapters\n0:00 Hook\n`);
  write(
    'video/review/captions.en.srt',
    '1\n00:00:00,000 --> 00:00:02,000\nDoes a heat pump really cost less to run?\n',
  );
  return fixture;
}

export interface ShortFixture extends Fixture {
  parent: string; // the parent story id
}
/** A Short of a real produced video in the copied topic (the first locked story with a candidate), reviewed into
 *  shorts.json (`reviewed`) or built through package, script, review, validation, storyboard, render check, lock, a
 *  build report and a review package (`packaged`), every artifact by the library code. */
export function syntheticShort(upTo: 'reviewed' | 'packaged', opts: { release?: boolean } = {}): ShortFixture {
  const c = copyTopic(TOPIC);
  const { root } = c;
  const stories = loadStories(TOPIC, root)!;
  let parent: string | null = null;
  for (const s of stories.stories) {
    if (s.partOf || !existsSync(join(c.dir(s.id), FILES.release))) continue;
    try {
      if (discoverShorts(loadShortParent(TOPIC, s.id, root), null).candidates.length) {
        parent = s.id;
        break;
      }
    } catch {
      /* a story whose folder lacks an artifact: next */
    }
  }
  if (!parent) throw new Error(`no locked story with a Short candidate in topic ${TOPIC}`);
  const first = discoverShorts(loadShortParent(TOPIC, parent, root), null).candidates[0];
  const review: ShortsReviewFile = {
    candidates: {
      [first.key]: {
        keep: true,
        slug: 'fixture-short',
        format: 'ONE FIGURE FROM THE RECORD',
        hook: 'One figure from the record.',
        carries: first.qualifications.map((q) => q.text),
      },
    },
  };
  writeFileSync(shortsReviewPath(TOPIC, parent, root), toJson(review));
  const p = loadShortParent(TOPIC, parent, root);
  const shorts = discoverShorts(p, review);
  writeFileSync(shortsPath(TOPIC, parent, root), toJson(shorts));
  const cand = shorts.candidates[0];
  if (cand.readiness !== 'ready')
    throw new Error(`fixture candidate is ${cand.readiness}: ${cand.blocking.join('; ')}`);
  const short = shortId(parent, 'fixture-short');
  const dir = scriptDir(TOPIC, short, root);
  const fixture: ShortFixture = { root, topic: TOPIC, story: short, parent, dir, cleanup: c.cleanup };
  if (upTo === 'reviewed') return fixture;

  mkdirSync(dir, { recursive: true });
  const write = (f: string, x: unknown) => writeFileSync(join(dir, f), typeof x === 'string' ? x : toJson(x));
  const read = passageReader(root);
  const t = corpusOf(loadTopic(TOPIC));
  const topicReview = loadReview(TOPIC, root);
  const pkg = buildShortPackage(p.pkg, cand, shorts);
  write(FILES.pkg, pkg);
  // the finding: the candidate's parent sentences with their assertions, each qualification placed on the sentence
  const parentById = new Map(sentences(p.script).map((s) => [s.id, s]));
  const finding = cand.sentences.map((pid, i) => {
    const id = `s${i + 2}`;
    const s = parentById.get(pid)!;
    return {
      id,
      text: s.text,
      type: s.type,
      ...(s.assertions
        ? {
            assertions: s.assertions.map((a) => ({
              ...a,
              id: a.id.replace(/^s\d+\./, `${id}.`),
              ...(a.kind === 'fact' ? { qualifications: [`${id} carries the limitation beside the figure.`] } : {}),
            })),
          }
        : {}),
    };
  });
  const script: Script = {
    topic: TOPIC,
    story: short,
    title: cand.hook!,
    revision: 1,
    generation: {
      model: 'fixture',
      brief: 'src/modules/script/briefs/script.md',
      date: '2026-01-01',
      wordsPerMinute: 150,
      evidencePackage: pkg.fingerprint,
    },
    sections: [
      { name: 'hook', sentences: [{ id: 's1', text: 'Does the record agree?', type: 'rhetorical' }] },
      { name: 'finding', sentences: finding },
      { name: 'close', sentences: [{ id: 's9', text: 'The full inquiry is linked below.', type: 'transitional' }] },
    ],
  };
  write(FILES.script, script);
  const sreview: ScriptReviewFile = {
    reviewer: 'fixture reviewer',
    date: '2026-01-01',
    revision: 1,
    packageFingerprint: pkg.fingerprint,
    approved: Object.fromEntries(sentences(script).map((s) => [s.id, sentenceFingerprint(s)])),
    findings: [],
  };
  write(FILES.review, sreview);
  const v = validateScript(script, t, read, {
    review: sreview,
    judgments: topicReview.applicability,
    previous: null,
    pkg,
    hashDoc: docHasher(docReader(root)),
  });
  if (v.status !== 'passed')
    throw new Error(
      `short fixture validation is ${v.status}: ${v.issues
        .filter((i) => i.severity === 'blocking')
        .map((i) => `${i.sentence} ${i.category}: ${i.explanation}`)
        .join('; ')}`,
    );
  write(FILES.validation, v);
  const plan: StoryboardPlan = {
    topic: TOPIC,
    story: short,
    scriptFingerprint: scriptFingerprint(script),
    generation: { model: 'fixture', brief: 'src/modules/storyboard/briefs/storyboard.md', date: '2026-01-01' },
    assets: {},
    scenes: sentences(script).map((s, i) => ({
      id: `sc${i + 1}`,
      sentences: [s.id],
      purpose: s.section,
      visual: { category: 'typography', description: 'the line as a title card', onScreenText: [s.section] },
    })),
  };
  const sb = buildStoryboard(plan, script, v, pkg, read);
  if (sb.status !== 'ok')
    throw new Error(`short fixture storyboard is blocked: ${sb.issues.map((i) => i.explanation).join('; ')}`);
  write(FILES.storyboard, sb);
  initVideo(TOPIC, short, { root });
  const rc = writeRenderCheck(TOPIC, short, root);
  const problems = renderCheckProblems(rc, rc.fingerprints);
  if (problems.length) throw new Error(`short fixture render check: ${problems.join('; ')}`);
  const release: Release = {
    topic: TOPIC,
    story: short,
    approvedBy: 'fixture approver',
    date: '2026-01-01',
    revision: 1,
    fingerprints: {
      script: v.scriptFingerprint,
      package: pkg.fingerprint,
      validation: validationFingerprint(v),
      storyboard: storyboardFingerprint(sb),
    },
  };
  write(FILES.release, release);
  const config = readJson<unknown>(join(dir, 'video', 'render.json'));
  const report: BuildSummary = {
    generatedAt: '2026-01-01',
    segment: { scenes: sb.scenes.map((s) => s.id) },
    output: { seconds: sb.runtime },
    narration: { provider: 'edge', voice: 'en-US-AndrewMultilingualNeural', publishable: !!opts.release },
    music: null,
    clearance: opts.release
      ? { narration: true, music: null, publishable: true, why: [] }
      : { narration: false, music: null, publishable: false, why: ['draft voice'] },
    fingerprints: { ...release.fingerprints, config: sha(JSON.stringify(config)), look: lookFingerprint(TOPIC, root) },
    qa: { ok: true, checks: [{ name: 'fixture', ok: true }] },
  };
  write('video/build-report.json', report);
  mkdirSync(join(dir, 'video', 'review'), { recursive: true });
  write('video/review/review.json', {
    generatedAt: '2026-01-01',
    status: opts.release ? 'release build' : 'private review build',
    buildReport: fileSha(join(dir, 'video', 'build-report.json')),
    mp4: 'fixture-short.mp4',
    mp4Sha: opts.release ? 'shortreleasesha' : 'shortdraftsha',
    thumbnailSha: 'shortthumbsha',
    captionsSha: 'shortcapsha',
    title: script.title,
  });
  write('video/review/description.txt', `${script.title}\n\n#Shorts\n`);
  write('video/review/captions.en.srt', '1\n00:00:00,000 --> 00:00:02,000\nDoes the record agree?\n');
  return fixture;
}
