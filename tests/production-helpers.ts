// A copy of one committed topic in a temp root, so board tests can edit artifacts without touching the repo, and a
// synthetic production in it built by the library code itself, so the board tests depend on no committed video.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { BuildSummary } from '../src/lib/build-report';
import { corpusOf } from '../src/lib/corpus';
import { passageReader } from '../src/lib/evidence';
import { buildPackage, docHasher, docReader } from '../src/lib/evidence-package';
import { fileSha, readJson, sha, toJson, topicDir } from '../src/lib/io';
import { storyboardFingerprint, validationFingerprint } from '../src/lib/release';
import { renderCheckProblems } from '../src/lib/render-check';
import { loadReview, reviewPath } from '../src/lib/review';
import {
  FILES,
  type Release,
  type Script,
  type ScriptReviewFile,
  type SectionName,
  type SentenceType,
  scriptDir,
  scriptFingerprint,
  sentenceFingerprint,
  sentences,
} from '../src/lib/script';
import { validateScript } from '../src/lib/script-validation';
import { chainOf, loadStories, storiesPath } from '../src/lib/stories';
import { type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import { loadTopic } from '../src/lib/topics';
import { writeRenderCheck } from '../src/video/check';
import { initVideo } from '../src/video/init';

// Matched against the path inside the topic, never the checkout's own path (CI checks out under .../work/...).
const SKIP = ['/store/transcripts', '/work', '/video/scenes', '/video/narration', '/video/frames'];
const SKIP_EXT = ['.pdf', '.mp4', '.wav', '.png'];

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
export function syntheticProduction(upTo: FixtureStage): Fixture {
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
      brief: 'scripts/briefs/script.md',
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
    generation: { model: 'fixture', brief: 'scripts/briefs/storyboard.md', date: '2026-01-01' },
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

  // 7. a passing full build with a soundtrack, and the review package made from it. No media: the board reads the
  // build report's summary and the review package's sha of it, never the mp4.
  const config = readJson<unknown>(join(dir, 'video', 'render.json'));
  const report: BuildSummary = {
    generatedAt: '2026-01-01',
    segment: { scenes: sb.scenes.map((s) => s.id) },
    output: { seconds: sb.runtime },
    narration: { provider: 'edge', voice: 'en-US-AndrewMultilingualNeural', publishable: false },
    music: { compositions: [{ title: 'Fixture' }] },
    clearance: { narration: false, music: false, publishable: false, why: ['draft voice'] },
    fingerprints: { ...release.fingerprints, config: sha(JSON.stringify(config)) },
    qa: { ok: true, checks: [{ name: 'fixture', ok: true }] },
  };
  write('video/build-report.json', report);
  mkdirSync(join(dir, 'video', 'review'), { recursive: true });
  write('video/review/review.json', {
    generatedAt: '2026-01-01',
    buildReport: fileSha(join(dir, 'video', 'build-report.json')),
    mp4: 'fixture.mp4',
    title: script.title,
  });
  write('video/review/description.txt', `${script.title}\n\nChapters\n0:00 Hook\n`);
  return fixture;
}
