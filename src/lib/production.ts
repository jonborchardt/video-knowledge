// The production board: what stage every topic, story and script is in, derived from the persisted artifacts alone.
// Nothing here is a workflow engine. Each check re-runs the library that wrote the artifact (buildPackage,
// validateScript, buildStoryboard, releaseCheck, discover) and compares fingerprints, so "current" means the same
// thing it means to `npm run script -- lock`. The only non-derivable input is production.json: a person's decision to
// queue, park or mark a story published, which no artifact records.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type PassageReader, passageReader } from './evidence';
import { fileSha, lf, readJson, toJson } from './io';
import { type ReviewFile, loadReview, reviewPath } from './review';
import { buildPackage, docHasher, docReader } from './evidence-package';
import { releaseCheck, storyboardFingerprint, validationFingerprint } from './release';
import {
  type EvidencePackage,
  FILES,
  type Release,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  scriptDir,
  storySlug,
} from './script';
import { validateScript } from './script-validation';
import { discover, loadStories, storiesPath, type Story } from './stories';
import { type Storyboard, type StoryboardPlan, buildStoryboard } from './storyboard';
import { loadTopic, topicNames, type Topic } from './topics';
import type { BuildReport } from '../video/report';

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
  decision: 'queued' | 'parked' | 'reviewing' | 'published';
  note: string;
  date: string; // ISO date
  url?: string; // the private review upload (reviewing) or the published video (published)
}
export const DECISIONS = ['queued', 'parked', 'reviewing', 'published'] as const;
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
  | 'rendered' // every storyboard scene rendered against the locked fingerprints and QA passed; no soundtrack yet
  | 'scored' // the soundtrack mixed in and QA passed; no review package yet
  | 'packaged'; // video/review/ made from this build: upload it privately and review it
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
  'scored',
  'packaged',
];
const VIDEO_REPORT = 'video/build-report.json';
const REVIEW_PACKAGE = 'video/review/review.json';
/** Technical readiness, editorial approval and licensing clearance are three different things; the board keeps the
 *  third here, read from the build report, so a card can be fully rendered and still say "release blocked". */
export type Clearance = BuildReport['clearance'];
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
  clearance: Clearance | null; // from the build report, once there is one
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
const worst = (checks: Check[]): Health => {
  for (const h of ['blocked', 'stale', 'missing', 'pending'] as const) if (checks.some((c) => c.health === h)) return h;
  return checks.every((c) => c.health === 'done') ? 'done' : 'current';
};

/** Everything a stage check reads: the script directory's artifacts, loaded once, plus what earlier stages derived. */
interface BoardContext {
  topic: string;
  storyId: string;
  root: string;
  p: (f: string) => string; // absolute path in the script directory
  r: (f: string) => string; // repo-relative path in the script directory
  read: PassageReader;
  t: Topic;
  review: ReviewFile;
  story: Story | undefined;
  pkg: EvidencePackage | null;
  script: Script | null;
  sreview: ScriptReviewFile | null;
  v: ScriptValidation | null;
  plan: StoryboardPlan | null;
  release: Release | null;
  vr: BuildReport | null;
  live: ScriptValidation | null; // the validation re-run in memory (validation stage)
  sb: Storyboard | null; // the storyboard re-filled against it (storyboard stage)
}
/** Where the fold stands: the stage reached, the command that moves it on, and whether a stage has halted it. */
interface BoardState {
  stage: ProductionStage;
  next: string;
  stopped: boolean;
}
/** What one stage contributes: its checks, and at most one of halting the board, a blocker that does not halt, or
 *  advancing the stage (which a stage only asks for when the state allows it). */
interface StageResult {
  checks?: Check[];
  halt?: { stage: ProductionStage; why: string; cmd: string };
  blocker?: string;
  advance?: { stage: ProductionStage; next: string };
  live?: ScriptValidation;
  sb?: Storyboard;
}
type BoardStage = (c: BoardContext, s: Readonly<BoardState>) => StageResult;

// 1. Evidence package: rebuild from the story and compare fingerprints (what packages.test.ts does in CI).
const packageStage: BoardStage = ({ topic, storyId, root, r, read, t, review, story, pkg }, s) => {
  if (!pkg)
    return {
      checks: [{ name: 'evidence package', health: 'missing', detail: 'not built', file: r(FILES.pkg) }],
      halt: { stage: 'package', why: 'no evidence package', cmd: s.next },
    };
  if (!story)
    return {
      checks: [
        {
          name: 'evidence package',
          health: 'blocked',
          detail: `story ${storyId} is no longer in stories.json (rejected or renamed)`,
          file: r(FILES.pkg),
          date: pkg.generatedAt,
        },
      ],
      halt: { stage: 'package', why: 'the story left stories.json', cmd: `npm run stories -- show ${topic}` },
    };
  const again = buildPackage(story, t, read, { review, inputs: pkg.inputs, readDoc: docReader(root), previous: pkg });
  const inputsNow = {
    stories: fileSha(storiesPath(topic)),
    review: fileSha(reviewPath(topic, root)),
    report: fileSha(join(root, topic, 'report.json')),
  };
  const drift = Object.entries(inputsNow)
    .filter(([k, sha]) => pkg.inputs[k] !== sha)
    .map(([k]) => k);
  const current = again.fingerprint === pkg.fingerprint;
  const check: Check = {
    name: 'evidence package',
    health: current ? (drift.length ? 'stale' : 'current') : 'stale',
    detail: current
      ? drift.length
        ? `rebuilds to the same fingerprint ${pkg.fingerprint}, but ${drift.join(', ')} changed since (re-run package to re-bind)`
        : `${pkg.fingerprint}: ${pkg.claims.length} claims, ${pkg.documents.length} documents, ${pkg.gaps.length} gaps`
      : `rebuilds to ${again.fingerprint}, file is ${pkg.fingerprint}`,
    file: r(FILES.pkg),
    date: pkg.generatedAt,
  };
  if (!current)
    return {
      checks: [check],
      halt: { stage: 'package', why: 'the evidence package no longer matches its inputs', cmd: s.next },
    };
  return {
    checks: [check],
    blocker: story.readiness !== 'ready' ? `story is ${story.readiness}: ${story.readinessWhy}` : undefined,
  };
};

// 2. Script written by the writer agent.
const scriptStage: BoardStage = ({ r, pkg, script }) => {
  if (!script)
    return {
      checks: [{ name: 'script', health: 'missing', detail: 'not written', file: r(FILES.script) }],
      halt: { stage: 'script', why: 'no script.json', cmd: `agent: scripts/briefs/script.md -> ${r(FILES.script)}` },
    };
  const bound = !pkg || script.generation?.evidencePackage === pkg.fingerprint;
  return {
    checks: [
      {
        name: 'script',
        health: bound ? 'current' : 'stale',
        detail: `revision ${script.revision}, ${script.sections.reduce((n, x) => n + x.sentences.length, 0)} sentences, written against package ${script.generation?.evidencePackage ?? '(none)'}${bound ? '' : ` (now ${pkg!.fingerprint})`}`,
        file: r(FILES.script),
        date: script.generation?.date,
      },
    ],
    halt: bound
      ? undefined
      : {
          stage: 'script',
          why: 'the script was written against an older evidence package',
          cmd: `agent: scripts/briefs/script.md (revise)`,
        },
  };
};

// 3. Validation: re-run in memory; the file must be what the current script, package, review and sources produce.
const validationStage: BoardStage = ({ topic, storyId, root, r, read, t, review, pkg, script, sreview, v }) => {
  if (!script || !pkg) return {};
  const live = validateScript(script, t, read, {
    review: sreview,
    judgments: review.applicability,
    previous: v,
    pkg,
    hashDoc: docHasher(root),
  });
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
  const check: Check = {
    name: 'validation',
    health,
    detail: !v
      ? `not run; it would be ${live.status}`
      : !same
        ? `validation.json is ${v.status} but a re-run is ${live.status} (${validationFingerprint(live)} vs ${validationFingerprint(v)})`
        : `${v.status}: ${v.counts.verified}/${v.counts.assertions} assertions verified, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.unreviewed} unreviewed`,
    file: r(FILES.validation),
    date: v?.date,
  };
  const cmd = `npm run script -- validate ${topic} ${storyId}`;
  const halt: StageResult['halt'] =
    !v || !same
      ? { stage: 'validate', why: 'validation.json is not current', cmd }
      : live.status === 'blocked'
        ? {
            stage: 'script',
            why: `${open.length} blocking issue${open.length === 1 ? '' : 's'}: ${open
              .slice(0, 3)
              .map((i) => `${i.sentence} ${i.category}`)
              .join(', ')}`,
            cmd: `agent: scripts/briefs/script.md (revise), then ${cmd}`,
          }
        : undefined;
  return { checks: [check], halt, live };
};

// 4. Independent review: present, bound to this package, and the revision it reviewed.
const reviewStage: BoardStage = ({ topic, storyId, r, pkg, script, sreview, live }) => {
  if (!script || !pkg) return {};
  if (!sreview)
    return {
      checks: [{ name: 'review', health: 'missing', detail: 'no independent review', file: r(FILES.review) }],
      halt: {
        stage: 'review',
        why: 'no script-review.json',
        cmd: `agent: scripts/briefs/script-review.md -> ${r(FILES.review)}`,
      },
    };
  const bound = sreview.packageFingerprint === pkg.fingerprint;
  const sameRev = sreview.revision === script.revision;
  const unreviewed = live?.counts.unreviewed ?? 0;
  const health: Health = !bound || !sameRev ? 'stale' : unreviewed ? 'pending' : 'current';
  return {
    checks: [
      {
        name: 'review',
        health,
        detail: `${sreview.reviewer}${sreview.model ? ` (${sreview.model})` : ''}: revision ${sreview.revision}, ${Object.keys(sreview.approved).length} approvals, ${sreview.findings.length} findings, ${Object.keys(sreview.dispositions ?? {}).length} dispositions${bound ? '' : `; made against package ${sreview.packageFingerprint ?? '(none)'}, not ${pkg.fingerprint}`}${sameRev ? '' : `; script is now revision ${script.revision}`}${unreviewed ? `; ${unreviewed} sentences without a current approval` : ''}`,
        file: r(FILES.review),
        date: sreview.date,
      },
    ],
    halt:
      health === 'current'
        ? undefined
        : {
            stage: 'review',
            why: 'the review does not cover the current script',
            cmd: `agent: scripts/briefs/script-review.md (re-review), then npm run script -- validate ${topic} ${storyId}`,
          },
  };
};

// 5. Storyboard: the plan filled against the live validation must be ok and match the file.
const storyboardStage: BoardStage = ({ topic, storyId, r, read, pkg, script, plan, live }) => {
  if (!script || !pkg || !live) return {};
  if (!plan)
    return {
      checks: [{ name: 'storyboard', health: 'missing', detail: 'not planned', file: r(FILES.storyboard) }],
      halt: {
        stage: 'storyboard',
        why: 'no storyboard.json',
        cmd: `agent: scripts/briefs/storyboard.md -> ${r(FILES.storyboard)}`,
      },
    };
  const sb = buildStoryboard(plan, script, live, pkg, read);
  const filled = 'scenes' in plan && Array.isArray((plan as Storyboard).scenes) && 'status' in plan;
  const same = filled && storyboardFingerprint(sb) === storyboardFingerprint(plan as Storyboard);
  const health: Health = sb.status !== 'ok' ? 'blocked' : same ? 'current' : 'stale';
  const blocking = sb.issues.filter((i) => i.severity === 'blocking');
  const cmd = `npm run script -- storyboard ${topic} ${storyId}`;
  return {
    checks: [
      {
        name: 'storyboard',
        health,
        detail:
          sb.status !== 'ok'
            ? `${blocking.length} blocking: ${blocking
                .slice(0, 3)
                .map((i) => `${i.sentence} ${i.category}`)
                .join(', ')}`
            : same
              ? `${sb.scenes.length} scenes, ${Math.round(sb.runtime)}s, ${Object.keys(sb.assets).length} assets, against script ${sb.scriptFingerprint}`
              : `the file is not what the current script and validation produce; re-run storyboard`,
        file: r(FILES.storyboard),
      },
    ],
    halt:
      sb.status !== 'ok'
        ? {
            stage: 'storyboard',
            why: 'the storyboard has blocking issues',
            cmd: `agent: scripts/briefs/storyboard.md (revise), then ${cmd}`,
          }
        : !same
          ? { stage: 'storyboard', why: 'storyboard.json is not current', cmd }
          : undefined,
    sb,
  };
};

// 6. Release: locked fingerprints must still match.
const releaseStage: BoardStage = ({ topic, storyId, r, release, live, sb }, s) => {
  const lock = `npm run script -- lock ${topic} ${storyId} --approved-by "<name>"`;
  if (!release)
    return {
      checks: [{ name: 'release', health: 'missing', detail: 'not locked', file: r(FILES.release) }],
      halt: { stage: 'lock', why: 'validation passed and the storyboard is ok; nobody has signed off', cmd: lock },
    };
  const stale = live ? releaseCheck(release, live, sb) : [];
  return {
    checks: [
      {
        name: 'release',
        health: stale.length ? 'stale' : 'done',
        detail: stale.length
          ? stale.map((i) => i.explanation.split(';')[0]).join('; ')
          : `revision ${release.revision} locked by ${release.approvedBy}`,
        file: r(FILES.release),
        date: release.date,
      },
    ],
    halt: stale.length
      ? { stage: 'lock', why: 'release.json no longer matches the files', cmd: `review the drift, then ${lock}` }
      : undefined,
    advance:
      !stale.length && !s.stopped ? { stage: 'locked', next: `npm run video -- spike ${topic} ${storyId}` } : undefined,
  };
};

// 7. Video: the committed build report must come from the locked script and storyboard and pass its QA.
const videoStage: BoardStage = ({ topic, storyId, r, release, vr, sb }, s) => {
  if (!vr || !release) return {};
  const total = sb?.scenes.length ?? 0;
  const bound =
    vr.fingerprints.script === release.fingerprints.script &&
    vr.fingerprints.storyboard === release.fingerprints.storyboard;
  const failed = vr.qa.checks.filter((c) => !c.ok);
  const full = total > 0 && vr.segment.scenes.length >= total;
  const draft = vr.narration.publishable === false; // the voice's terms do not cover a published video
  const health: Health = !bound ? 'stale' : !vr.qa.ok ? 'blocked' : full ? 'done' : 'pending';
  const check: Check = {
    name: 'video',
    health,
    detail: `${vr.output ? `${Math.round(vr.output.seconds)}s, ` : ''}${vr.segment.scenes.length} of ${total} scenes (${vr.segment.scenes[0]} to ${vr.segment.scenes.at(-1)}), ${vr.narration.provider} ${vr.narration.voice}${draft ? ' (draft voice, not for publication)' : ''}, QA ${vr.qa.checks.length - failed.length}/${vr.qa.checks.length}${failed.length ? `: ${failed.map((c) => c.name).join(', ')}` : ''}${bound ? '' : `; rendered from script ${vr.fingerprints.script} / storyboard ${vr.fingerprints.storyboard}, the lock is ${release.fingerprints.script} / ${release.fingerprints.storyboard}`}`,
    file: r(VIDEO_REPORT),
    date: vr.generatedAt,
  };
  if (s.stage !== 'locked') return { checks: [check] };
  const cmd = `npm run video -- spike ${topic} ${storyId}`;
  if (!bound)
    return {
      checks: [check],
      halt: { stage: 'video', why: 'the video was rendered from fingerprints the lock no longer names', cmd },
    };
  if (!vr.qa.ok)
    return {
      checks: [check],
      halt: { stage: 'video', why: `video QA failed: ${failed.map((c) => c.name).join(', ')}`, cmd },
    };
  return {
    checks: [check],
    advance: !full
      ? {
          stage: 'video',
          next: `extend video/render.json past ${vr.segment.scenes.at(-1)} (${total - vr.segment.scenes.length} scenes left), then ${cmd}`,
        }
      : {
          stage: 'rendered',
          next: `write video/music.json (cues over music/<composition>/ assets), then npm run video -- render ${topic} ${storyId} and qa`,
        },
  };
};

// 8. Soundtrack: mixed into this build (the QA already checked the mix is of the committed cue sheet).
const soundtrackStage: BoardStage = ({ topic, storyId, r, release, vr }, s) => {
  if (!vr || !release || !vr.music) return {};
  return {
    checks: [
      {
        name: 'soundtrack',
        health: vr.clearance.music ? 'done' : 'pending',
        detail: `${vr.music.compositions.map((c) => c.title).join(', ')}${vr.clearance.music ? '' : ' (not cleared for publication)'}`,
        file: r('video/mix.json'),
        date: vr.generatedAt,
      },
    ],
    advance:
      s.stage === 'rendered' ? { stage: 'scored', next: `npm run video -- package ${topic} ${storyId}` } : undefined,
  };
};

// 9. Review package: made from this very build report.
const reviewPackageStage: BoardStage = ({ p, r, release, vr }, s) => {
  if (!vr || !release) return {};
  const rp = readJson<{ generatedAt: string; buildReport: string; mp4: string }>(p(REVIEW_PACKAGE));
  if (!rp) return {};
  const current = rp.buildReport === fileSha(p(VIDEO_REPORT));
  return {
    checks: [
      {
        name: 'review package',
        health: current ? 'done' : 'stale',
        detail: current ? `video/review/${rp.mp4}, private review build` : 'made from an earlier build; package again',
        file: r(REVIEW_PACKAGE),
        date: rp.generatedAt,
      },
    ],
    advance:
      s.stage === 'scored' && current
        ? {
            stage: 'packaged',
            next: `upload video/review/${rp.mp4} to YouTube as a private video, review it with video/review/checklist.md, then record {"decision": "reviewing", "url": ...} in production.json`,
          }
        : undefined,
  };
};

// 10. Clearance: a finished build whose release is blocked says why next to the next step.
const clearanceStage: BoardStage = ({ release, vr }, s) =>
  vr && release && !vr.clearance.publishable && (s.stage === 'scored' || s.stage === 'packaged')
    ? { advance: { stage: s.stage, next: `${s.next}; public release is blocked: ${vr.clearance.why.join('; ')}` } }
    : {};

/** The board's stages in pipeline order; productionOf folds over them. A new stage is a new function here. */
const BOARD_STAGES: BoardStage[] = [
  packageStage,
  scriptStage,
  validationStage,
  reviewStage,
  storyboardStage,
  releaseStage,
  videoStage,
  soundtrackStage,
  reviewPackageStage,
  clearanceStage,
];

/** One script directory, checked artifact by artifact against what the library would produce now. */
export function productionOf(topic: string, storyId: string, root = process.cwd()): Production | null {
  const dir = scriptDir(topic, storyId, root);
  if (!existsSync(dir)) return null;
  const p = (f: string) => join(dir, f);
  const c: BoardContext = {
    topic,
    storyId,
    root,
    p,
    r: (f) => rel(p(f), root),
    read: passageReader(root),
    t: loadTopic(topic),
    review: loadReview(topic, root),
    story: loadStories(topic)?.stories.find((s) => s.id === storyId),
    pkg: readJson<EvidencePackage>(p(FILES.pkg)),
    script: readJson<Script>(p(FILES.script)),
    sreview: readJson<ScriptReviewFile>(p(FILES.review)),
    v: readJson<ScriptValidation>(p(FILES.validation)),
    plan: readJson<StoryboardPlan>(p(FILES.storyboard)),
    release: readJson<Release>(p(FILES.release)),
    vr: readJson<BuildReport>(p(VIDEO_REPORT)),
    live: null,
    sb: null,
  };
  const s: BoardState = { stage: 'package', next: `npm run script -- package ${topic} ${storyId}`, stopped: false };
  const checks: Check[] = [];
  const blockers: string[] = [];
  for (const stage of BOARD_STAGES) {
    const res = stage(c, s);
    checks.push(...(res.checks ?? []));
    if (res.live) c.live = res.live;
    if (res.sb) c.sb = res.sb;
    if (res.blocker) blockers.push(res.blocker);
    // The first halt sets the stage; halting at the stage already reached adds no blocker.
    if (res.halt && !s.stopped) {
      s.stopped = true;
      if (s.stage !== res.halt.stage) {
        s.stage = res.halt.stage;
        s.next = res.halt.cmd;
        blockers.push(res.halt.why);
      }
    }
    if (res.advance) {
      s.stage = res.advance.stage;
      s.next = res.advance.next;
    }
  }

  const { v, sreview, release, pkg, plan, script, vr } = c;
  const stage = s.stage;
  const versions: Version[] = (v?.history ?? []).map((h) => ({
    ...h,
    reviewed: sreview?.revision === h.revision,
    locked: release?.revision === h.revision,
  }));
  const health: Health =
    stage === 'rendered' || stage === 'scored' || stage === 'packaged' || stage === 'locked'
      ? 'done'
      : worst(checks.filter((x) => x.health !== 'missing')) === 'current' && blockers.length === 0
        ? 'current'
        : worst(checks);
  return {
    topic,
    story: storyId,
    slug: storySlug(storyId),
    dir: rel(dir, root),
    stage,
    health,
    next: s.next,
    blockers,
    checks,
    versions,
    clearance: vr && release ? vr.clearance : null,
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
    const again = toJson(discover(topic, passageReader(root), review));
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
      else if (decision?.decision === 'reviewing')
        n = `human review pending${decision.url ? ` at ${decision.url}` : ''}: ${decision.note}${
          production?.clearance && !production.clearance.publishable
            ? `; public release blocked: ${production.clearance.why.join('; ')}`
            : ''
        }`;
      else if (production) n = production.next;
      else if (story.readiness === 'ready') n = `npm run script -- package ${name} ${story.id}`;
      else if (story.readiness === 'needs-review')
        n = `settle in story-review.json: ${story.blocking[0] ?? story.readinessWhy}`;
      else n = `research: ${story.blocking[0] ?? story.readinessWhy}`;
      stories.push({ story, decision, production, next: n });
    }
    const queued = stories.find((s) => s.decision?.decision === 'queued');
    const active = stories.find(
      (s) =>
        s.production &&
        !['locked', 'rendered', 'scored', 'packaged'].includes(s.production.stage) &&
        !['parked', 'reviewing'].includes(s.decision?.decision ?? ''),
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
  'scored',
  'packaged',
  'reviewing',
  'published',
  'parked',
] as const;
export type Column = (typeof COLUMNS)[number];
export function columnOf(r: StoryRow): Column {
  if (r.decision?.decision === 'published') return 'published';
  if (r.decision?.decision === 'parked') return 'parked';
  if (r.decision?.decision === 'reviewing') return 'reviewing';
  if (r.production) return r.production.stage === 'review' ? 'script-review' : r.production.stage;
  return r.story.readiness === 'rejected' ? 'parked' : r.story.readiness;
}

export function board(root = process.cwd()): TopicBoard[] {
  const decisions = loadDecisions(root);
  for (const [k, d] of Object.entries(decisions)) {
    if (!DECISIONS.includes(d.decision) || typeof d.note !== 'string' || !d.date)
      throw new Error(`${DECISIONS_FILE}: ${k} needs decision (${DECISIONS.join('|')}), note and date`);
  }
  return topicNames().map((n) => topicBoard(n, root, decisions));
}
