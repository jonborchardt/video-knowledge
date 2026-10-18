// The production board: what stage every topic, story and script is in, derived from the persisted artifacts alone.
// Nothing here is a workflow engine. Each check re-runs the library that wrote the artifact (buildPackage,
// validateScript, buildStoryboard, releaseCheck, discover) and compares fingerprints, so "current" means the same
// thing it means to `npm run script -- lock`. The only non-derivable input is production.json: a person's decision to
// queue, park or mark a story published, which no artifact records.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lf, passageReader } from './evidence';
import { loadReview, reviewPath } from './review';
import {
  type EvidencePackage,
  FILES,
  type Release,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  buildPackage,
  docHasher,
  readJson,
  releaseCheck,
  scriptDir,
  sha,
  storyboardFingerprint,
  storySlug,
  validateScript,
  validationFingerprint,
} from './script';
import { discover, loadStories, storiesPath, toJson as storiesJson, type Story } from './stories';
import { type Storyboard, type StoryboardPlan, buildStoryboard } from './storyboard';
import { loadTopic, topicNames, type Topic } from './topics';

export type Health = 'done' | 'current' | 'stale' | 'blocked' | 'missing' | 'pending';
export interface Check {
  name: string; // the artifact or process
  health: Health;
  detail: string; // one line a person can act on
  file?: string; // repo-relative, when there is one
  date?: string;
}

/** A person's decision about a story that no artifact records. Keyed `<topic>/<story-id>` in production.json. */
export interface Decision {
  decision: 'queued' | 'parked' | 'published';
  note: string;
  date: string; // ISO date
  url?: string; // the published video, when decision is published
}
export const DECISIONS_FILE = 'production.json';
export function loadDecisions(root = process.cwd()): Record<string, Decision> {
  return readJson<Record<string, Decision>>(join(root, DECISIONS_FILE)) ?? {};
}

export type ProductionStage =
  | 'package'
  | 'script'
  | 'validate'
  | 'review'
  | 'storyboard'
  | 'lock'
  | 'locked' // release.json, no render yet
  | 'video' // a segment rendered (partial, stale or failing QA)
  | 'rendered'; // every storyboard scene rendered against the locked fingerprints and QA passed
export const PRODUCTION_STAGES: ProductionStage[] = [
  'package',
  'script',
  'validate',
  'review',
  'storyboard',
  'lock',
  'locked',
  'video',
  'rendered',
];
/** The slice of video/build-report.json the board reads (written by npm run video; names in src/video/select.ts). */
interface BuildReport {
  generatedAt: string;
  segment: { scenes: string[] };
  output: { file: string; seconds: number } | null;
  narration: { provider: string; voice: string; publishable?: boolean };
  fingerprints: { script: string; storyboard: string };
  qa: { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] };
}
const VIDEO_REPORT = 'video/build-report.json';
export interface Version {
  revision: number;
  date: string;
  status: string;
  blocking: number;
  warnings: number;
  reviewed: boolean; // a script-review.json exists for this revision
  locked: boolean; // release.json names this revision
}
export interface Production {
  topic: string;
  story: string;
  slug: string;
  dir: string; // repo-relative
  stage: ProductionStage; // the first stage whose artifact is missing or not current
  health: Health;
  next: string; // the command or brief that moves it on
  blockers: string[];
  checks: Check[]; // one per artifact, in pipeline order
  versions: Version[];
  fingerprints: { script: string | null; package: string | null; validation: string | null; storyboard: string | null };
  model: string | null;
}

export interface StoryRow {
  story: Story;
  decision: Decision | null;
  production: Production | null;
  next: string;
}
export interface TopicBoard {
  topic: Topic;
  checks: Check[]; // the research pipeline: lists, fetch, extract, studies, report, stories, review
  stories: StoryRow[];
  rejected: number;
  next: string;
}

const rel = (p: string, root: string) =>
  p
    .replace(root, '')
    .replace(/^[\\/]/, '')
    .replaceAll('\\', '/');
const nonBlank = (file: string) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#')).length
    : 0;
const fileSha = (f: string) => (existsSync(f) ? sha(lf(readFileSync(f, 'utf8'))) : 'missing');
const worst = (checks: Check[]): Health => {
  for (const h of ['blocked', 'stale', 'missing', 'pending'] as const) if (checks.some((c) => c.health === h)) return h;
  return checks.every((c) => c.health === 'done') ? 'done' : 'current';
};

/** One script directory, checked artifact by artifact against what the library would produce now. */
export function productionOf(topic: string, storyId: string, root = process.cwd()): Production | null {
  const dir = scriptDir(topic, storyId, root);
  if (!existsSync(dir)) return null;
  const p = (f: string) => join(dir, f);
  const r = (f: string) => rel(p(f), root);
  const read = passageReader(root);
  const t = loadTopic(topic);
  const review = loadReview(topic, root);
  const pkg = readJson<EvidencePackage>(p(FILES.pkg));
  const script = readJson<Script>(p(FILES.script));
  const sreview = readJson<ScriptReviewFile>(p(FILES.review));
  const v = readJson<ScriptValidation>(p(FILES.validation));
  const plan = readJson<StoryboardPlan>(p(FILES.storyboard));
  const release = readJson<Release>(p(FILES.release));
  const checks: Check[] = [];
  const blockers: string[] = [];
  let stage: ProductionStage = 'package';
  let next = `npm run script -- package ${topic} ${storyId}`;
  const stop = (s: ProductionStage, why: string, cmd: string) => {
    if (stage === s) return; // already stopped here
    stage = s;
    next = cmd;
    blockers.push(why);
  };
  let stopped = false;
  const halt = (s: ProductionStage, why: string, cmd: string) => {
    if (stopped) return;
    stopped = true;
    stop(s, why, cmd);
  };

  // 1. Evidence package: rebuild from the story and compare fingerprints (what packages.test.ts does in CI).
  const story = loadStories(topic)?.stories.find((s) => s.id === storyId);
  if (!pkg) {
    checks.push({ name: 'evidence package', health: 'missing', detail: 'not built', file: r(FILES.pkg) });
    halt('package', 'no evidence package', next);
  } else if (!story) {
    checks.push({
      name: 'evidence package',
      health: 'blocked',
      detail: `story ${storyId} is no longer in stories.json (rejected or renamed)`,
      file: r(FILES.pkg),
      date: pkg.generatedAt,
    });
    halt('package', 'the story left stories.json', `npm run stories -- show ${topic}`);
  } else {
    const again = buildPackage(story, t, read, review, pkg.inputs, root, () => null, pkg);
    const inputsNow = {
      stories: fileSha(storiesPath(topic)),
      review: fileSha(reviewPath(topic, root)),
      report: fileSha(join(root, topic, 'report.json')),
    };
    const drift = Object.entries(inputsNow)
      .filter(([k, s]) => pkg.inputs[k] !== s)
      .map(([k]) => k);
    const current = again.fingerprint === pkg.fingerprint;
    checks.push({
      name: 'evidence package',
      health: current ? (drift.length ? 'stale' : 'current') : 'stale',
      detail: current
        ? drift.length
          ? `rebuilds to the same fingerprint ${pkg.fingerprint}, but ${drift.join(', ')} changed since (re-run package to re-bind)`
          : `${pkg.fingerprint}: ${pkg.claims.length} claims, ${pkg.documents.length} documents, ${pkg.gaps.length} gaps`
        : `rebuilds to ${again.fingerprint}, file is ${pkg.fingerprint}`,
      file: r(FILES.pkg),
      date: pkg.generatedAt,
    });
    if (!current) halt('package', 'the evidence package no longer matches its inputs', next);
    else if (story.readiness !== 'ready') blockers.push(`story is ${story.readiness}: ${story.readinessWhy}`);
  }

  // 2. Script written by the writer agent.
  if (!script) {
    checks.push({ name: 'script', health: 'missing', detail: 'not written', file: r(FILES.script) });
    halt('script', 'no script.json', `agent: scripts/briefs/script.md -> ${r(FILES.script)}`);
  } else {
    const bound = !pkg || script.generation?.evidencePackage === pkg.fingerprint;
    checks.push({
      name: 'script',
      health: bound ? 'current' : 'stale',
      detail: `revision ${script.revision}, ${script.sections.reduce((n, s) => n + s.sentences.length, 0)} sentences, written against package ${script.generation?.evidencePackage ?? '(none)'}${bound ? '' : ` (now ${pkg!.fingerprint})`}`,
      file: r(FILES.script),
      date: script.generation?.date,
    });
    if (!bound)
      halt(
        'script',
        'the script was written against an older evidence package',
        `agent: scripts/briefs/script.md (revise)`,
      );
  }

  // 3. Validation: re-run in memory; the file must be what the current script, package, review and sources produce.
  let live: ScriptValidation | null = null;
  if (script && pkg) {
    live = validateScript(script, t, read, sreview, review.applicability, v, pkg, docHasher(root));
    const same = !!v && validationFingerprint(live) === validationFingerprint(v);
    const open = live.issues.filter((i) => i.severity === 'blocking' && !i.disposition);
    const health: Health = !v
      ? 'missing'
      : !same
        ? 'stale'
        : live.status === 'passed'
          ? 'current'
          : live.status === 'blocked'
            ? 'blocked'
            : 'pending';
    checks.push({
      name: 'validation',
      health,
      detail: !v
        ? `not run; it would be ${live.status}`
        : !same
          ? `validation.json is ${v.status} but a re-run is ${live.status} (${validationFingerprint(live)} vs ${validationFingerprint(v)})`
          : `${v.status}: ${v.counts.verified}/${v.counts.assertions} assertions verified, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.unreviewed} unreviewed`,
      file: r(FILES.validation),
      date: v?.date,
    });
    const cmd = `npm run script -- validate ${topic} ${storyId}`;
    if (!v || !same) halt('validate', 'validation.json is not current', cmd);
    else if (live.status === 'blocked')
      halt(
        'script',
        `${open.length} blocking issue${open.length === 1 ? '' : 's'}: ${open
          .slice(0, 3)
          .map((i) => `${i.sentence} ${i.category}`)
          .join(', ')}`,
        `agent: scripts/briefs/script.md (revise), then ${cmd}`,
      );
  }

  // 4. Independent review: present, bound to this package, and the revision it reviewed.
  if (script && pkg) {
    if (!sreview) {
      checks.push({ name: 'review', health: 'missing', detail: 'no independent review', file: r(FILES.review) });
      halt('review', 'no script-review.json', `agent: scripts/briefs/script-review.md -> ${r(FILES.review)}`);
    } else {
      const bound = sreview.packageFingerprint === pkg.fingerprint;
      const sameRev = sreview.revision === script.revision;
      const unreviewed = live?.counts.unreviewed ?? 0;
      const health: Health = !bound || !sameRev ? 'stale' : unreviewed ? 'pending' : 'current';
      checks.push({
        name: 'review',
        health,
        detail: `${sreview.reviewer}${sreview.model ? ` (${sreview.model})` : ''}: revision ${sreview.revision}, ${Object.keys(sreview.approved).length} approvals, ${sreview.findings.length} findings, ${Object.keys(sreview.dispositions ?? {}).length} dispositions${bound ? '' : `; made against package ${sreview.packageFingerprint ?? '(none)'}, not ${pkg.fingerprint}`}${sameRev ? '' : `; script is now revision ${script.revision}`}${unreviewed ? `; ${unreviewed} sentences without a current approval` : ''}`,
        file: r(FILES.review),
        date: sreview.date,
      });
      if (health !== 'current')
        halt(
          'review',
          'the review does not cover the current script',
          `agent: scripts/briefs/script-review.md (re-review), then npm run script -- validate ${topic} ${storyId}`,
        );
    }
  }

  // 5. Storyboard: the plan filled against the live validation must be ok and match the file.
  let sb: Storyboard | null = null;
  if (script && pkg && live) {
    if (!plan) {
      checks.push({ name: 'storyboard', health: 'missing', detail: 'not planned', file: r(FILES.storyboard) });
      halt('storyboard', 'no storyboard.json', `agent: scripts/briefs/storyboard.md -> ${r(FILES.storyboard)}`);
    } else {
      sb = buildStoryboard(plan, script, live, pkg, read);
      const filled = 'scenes' in plan && Array.isArray((plan as Storyboard).scenes) && 'status' in plan;
      const same = filled && storyboardFingerprint(sb) === storyboardFingerprint(plan as Storyboard);
      const health: Health = sb.status !== 'ok' ? 'blocked' : same ? 'current' : 'stale';
      checks.push({
        name: 'storyboard',
        health,
        detail:
          sb.status !== 'ok'
            ? `${sb.issues.filter((i) => i.severity === 'blocking').length} blocking: ${sb.issues
                .filter((i) => i.severity === 'blocking')
                .slice(0, 3)
                .map((i) => `${i.sentence} ${i.category}`)
                .join(', ')}`
            : same
              ? `${sb.scenes.length} scenes, ${Math.round(sb.runtime)}s, ${Object.keys(sb.assets).length} assets, against script ${sb.scriptFingerprint}`
              : `the file is not what the current script and validation produce; re-run storyboard`,
        file: r(FILES.storyboard),
      });
      const cmd = `npm run script -- storyboard ${topic} ${storyId}`;
      if (sb.status !== 'ok')
        halt(
          'storyboard',
          'the storyboard has blocking issues',
          `agent: scripts/briefs/storyboard.md (revise), then ${cmd}`,
        );
      else if (!same) halt('storyboard', 'storyboard.json is not current', cmd);
    }
  }

  // 6. Release: locked fingerprints must still match.
  if (!release) {
    checks.push({ name: 'release', health: 'missing', detail: 'not locked', file: r(FILES.release) });
    if (!stopped)
      halt(
        'lock',
        'validation passed and the storyboard is ok; nobody has signed off',
        `npm run script -- lock ${topic} ${storyId} --approved-by "<name>"`,
      );
  } else {
    const stale = live ? releaseCheck(release, live, sb) : [];
    checks.push({
      name: 'release',
      health: stale.length ? 'stale' : 'done',
      detail: stale.length
        ? stale.map((i) => i.explanation.split(';')[0]).join('; ')
        : `revision ${release.revision} locked by ${release.approvedBy}`,
      file: r(FILES.release),
      date: release.date,
    });
    if (stale.length)
      halt(
        'lock',
        'release.json no longer matches the files',
        `review the drift, then npm run script -- lock ${topic} ${storyId} --approved-by "<name>"`,
      );
    else if (!stopped) {
      stage = 'locked';
      next = `npm run video -- spike ${topic} ${storyId}`;
    }
  }

  // 7. Video: the committed build report must come from the locked script and storyboard and pass its QA.
  const vr = readJson<BuildReport>(p(VIDEO_REPORT));
  if (vr && release) {
    const total = sb?.scenes.length ?? 0;
    const bound =
      vr.fingerprints.script === release.fingerprints.script &&
      vr.fingerprints.storyboard === release.fingerprints.storyboard;
    const failed = vr.qa.checks.filter((c) => !c.ok);
    const full = total > 0 && vr.segment.scenes.length >= total;
    const draft = vr.narration.publishable === false; // the voice's terms do not cover a published video
    const health: Health = !bound ? 'stale' : !vr.qa.ok ? 'blocked' : full && !draft ? 'done' : 'pending';
    checks.push({
      name: 'video',
      health,
      detail: `${vr.output ? `${Math.round(vr.output.seconds)}s, ` : ''}${vr.segment.scenes.length} of ${total} scenes (${vr.segment.scenes[0]} to ${vr.segment.scenes.at(-1)}), ${vr.narration.provider} ${vr.narration.voice}${draft ? ' (draft voice, not for publication)' : ''}, QA ${vr.qa.checks.length - failed.length}/${vr.qa.checks.length}${failed.length ? `: ${failed.map((c) => c.name).join(', ')}` : ''}${bound ? '' : `; rendered from script ${vr.fingerprints.script} / storyboard ${vr.fingerprints.storyboard}, the lock is ${release.fingerprints.script} / ${release.fingerprints.storyboard}`}`,
      file: r(VIDEO_REPORT),
      date: vr.generatedAt,
    });
    if (stage === 'locked') {
      const cmd = `npm run video -- spike ${topic} ${storyId}`;
      if (!bound) halt('video', 'the video was rendered from fingerprints the lock no longer names', cmd);
      else if (!vr.qa.ok) halt('video', `video QA failed: ${failed.map((c) => c.name).join(', ')}`, cmd);
      else if (!full) {
        stage = 'video';
        next = `extend video/render.json past ${vr.segment.scenes.at(-1)} (${total - vr.segment.scenes.length} scenes left), then ${cmd}`;
      } else {
        stage = 'rendered';
        next = draft
          ? `review the video, then re-narrate with a commercial voice (VK_TTS_PROVIDER=openai) and ${cmd}`
          : 'review the video, publish, then record it in production.json';
      }
    }
  }

  const versions: Version[] = (v?.history ?? []).map((h) => ({
    ...h,
    reviewed: sreview?.revision === h.revision,
    locked: release?.revision === h.revision,
  }));
  const health: Health =
    stage === 'rendered' || stage === 'locked'
      ? 'done'
      : worst(checks.filter((c) => c.health !== 'missing')) === 'current' && blockers.length === 0
        ? 'current'
        : worst(checks);
  return {
    topic,
    story: storyId,
    slug: storySlug(storyId),
    dir: rel(dir, root),
    stage,
    health,
    next,
    blockers,
    checks,
    versions,
    fingerprints: {
      script: v?.scriptFingerprint ?? null,
      package: pkg?.fingerprint ?? null,
      validation: v ? validationFingerprint(v) : null,
      storyboard: plan && 'scenes' in plan ? storyboardFingerprint(plan as Storyboard) : null,
    },
    model: script?.generation?.model ?? null,
  };
}

interface StoreVideo {
  id: string;
  transcript: string;
  assertions?: unknown[];
  supersededBy?: string;
}

/** The research pipeline for one topic, as the store records it, then every story with its production (if any). */
export function topicBoard(name: string, root = process.cwd(), decisions = loadDecisions(root)): TopicBoard {
  const dir = join(root, name);
  const topic = loadTopic(name);
  const checks: Check[] = [];
  const listed = nonBlank(join(dir, 'videos.txt')) + nonBlank(join(dir, 'blogs.txt'));
  const recs = readdirSync(join(dir, 'store', 'videos')).map(
    (f) => JSON.parse(readFileSync(join(dir, 'store', 'videos', f), 'utf8')) as StoreVideo,
  );
  const unfetched = Math.max(0, listed - recs.length);
  checks.push({
    name: 'sources',
    health: unfetched ? 'pending' : 'current',
    detail: `${listed} listed, ${recs.length} in the store${unfetched ? `; ${unfetched} not fetched (npm run watcher -- fetch)` : ''}`,
    file: `${name}/videos.txt`,
  });
  const raw = recs.filter((v) => !v.assertions && v.transcript !== 'none');
  const noCaptions = recs.filter((v) => v.transcript === 'none' && !v.assertions).length;
  checks.push({
    name: 'claims',
    health: raw.length ? 'pending' : 'current',
    detail: `${topic.claims.length} claims from ${recs.length - raw.length - noCaptions} sources${raw.length ? `; ${raw.length} fetched but not extracted (scripts/briefs/extract.md)` : ''}${noCaptions ? `; ${noCaptions} without captions` : ''}`,
    file: `${name}/store/topics.json`,
  });
  const docs = existsSync(join(dir, 'sources'))
    ? readdirSync(join(dir, 'sources')).filter((f) => f.endsWith('.txt')).length
    : 0;
  const unjudged = docs - topic.studies;
  checks.push({
    name: 'studies',
    health: docs ? (unjudged > 0 ? 'pending' : 'current') : 'missing',
    detail: `${docs} documents, ${topic.studies} with verdicts, ${topic.decided}/${topic.claims.length} claims decided by a study${unjudged > 0 ? `; ${unjudged} documents without a recorded verdict (scripts/briefs/sources.md)` : ''}`,
    file: `${name}/sources/`,
  });
  const storeClaims = (
    readJson<{ topics: { claims: unknown[] }[] }>(join(dir, 'store', 'topics.json'))?.topics[0]?.claims ?? []
  ).length;
  checks.push({
    name: 'report',
    health: storeClaims === topic.claims.length ? 'current' : 'stale',
    detail:
      storeClaims === topic.claims.length
        ? `${topic.claims.length} claims, ${topic.counted} sources counted`
        : `report has ${topic.claims.length} claims, the store ${storeClaims} (npm run report)`,
    file: `${name}/report.json`,
  });
  const review = loadReview(name, root);
  const file = loadStories(name);
  const stories: StoryRow[] = [];
  let next: string;
  if (!file) {
    checks.push({ name: 'stories', health: 'missing', detail: 'not discovered', file: `${name}/stories.json` });
    next = `npm run stories -- discover ${name}`;
  } else {
    const again = storiesJson(discover(topic, passageReader(root), review));
    const current = lf(again) === lf(readFileSync(storiesPath(name), 'utf8'));
    checks.push({
      name: 'stories',
      health: current ? 'current' : 'stale',
      detail: `${file.stories.length} candidates, ${file.rejected.length} rejected, from ${file.basis.claims} claims${current ? '' : '; a re-run differs (npm run stories -- discover)'}`,
      file: `${name}/stories.json`,
    });
    const reviewed = file.stories.filter((s) => s.reviewed).length;
    checks.push({
      name: 'story review',
      health: !existsSync(reviewPath(name, root)) ? 'missing' : reviewed < file.stories.length ? 'pending' : 'current',
      detail: `${reviewed}/${file.stories.length} candidates reviewed, ${Object.keys(review.applicability ?? {}).length} applicability judgments${reviewed < file.stories.length ? ' (scripts/briefs/stories.md)' : ''}`,
      file: `${name}/story-review.json`,
    });
    for (const story of file.stories) {
      const key = `${name}/${story.id}`;
      const decision = decisions[key] ?? null;
      const production = productionOf(name, story.id, root);
      let n: string;
      if (decision?.decision === 'published') n = `published${decision.url ? `: ${decision.url}` : ''}`;
      else if (decision?.decision === 'parked') n = `parked: ${decision.note}`;
      else if (production) n = production.next;
      else if (story.readiness === 'ready') n = `npm run script -- package ${name} ${story.id}`;
      else if (story.readiness === 'needs-review')
        n = `settle in story-review.json: ${story.blocking[0] ?? story.readinessWhy}`;
      else n = `research: ${story.blocking[0] ?? story.readinessWhy}`;
      stories.push({ story, decision, production, next: n });
    }
    const queued = stories.find((s) => s.decision?.decision === 'queued');
    const active = stories.find(
      (s) => s.production && !['locked', 'rendered'].includes(s.production.stage) && s.decision?.decision !== 'parked',
    );
    const ready = stories.find((s) => !s.production && s.story.readiness === 'ready' && !s.decision);
    next =
      (queued ?? active ?? ready)?.next ??
      checks.find((c) => c.health === 'stale' || c.health === 'pending')?.detail ??
      'nothing pending';
  }
  for (const key of Object.keys(decisions))
    if (key.startsWith(`${name}/`) && !file?.stories.some((s) => `${name}/${s.id}` === key))
      throw new Error(`${DECISIONS_FILE}: ${key} is not a story in ${name}/stories.json`);
  return { topic, checks, stories, rejected: file?.rejected.length ?? 0, next };
}

/** The kanban columns, in lifecycle order: story readiness, then the script stages, then the decisions. */
export const COLUMNS = [
  'needs-research',
  'needs-review',
  'ready',
  'package',
  'script',
  'validate',
  'script-review',
  'storyboard',
  'lock',
  'locked',
  'video',
  'rendered',
  'published',
  'parked',
] as const;
export type Column = (typeof COLUMNS)[number];
export function columnOf(r: StoryRow): Column {
  if (r.decision?.decision === 'published') return 'published';
  if (r.decision?.decision === 'parked') return 'parked';
  if (r.production) return r.production.stage === 'review' ? 'script-review' : r.production.stage;
  return r.story.readiness === 'rejected' ? 'parked' : r.story.readiness;
}

export function board(root = process.cwd()): TopicBoard[] {
  const decisions = loadDecisions(root);
  for (const [k, d] of Object.entries(decisions)) {
    if (!['queued', 'parked', 'published'].includes(d.decision) || typeof d.note !== 'string' || !d.date)
      throw new Error(`${DECISIONS_FILE}: ${k} needs decision (queued|parked|published), note and date`);
  }
  return topicNames().map((n) => topicBoard(n, root, decisions));
}
