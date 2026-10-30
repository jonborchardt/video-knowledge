// The production board: what stage every topic, story and script is in, derived from the persisted artifacts alone.
// Nothing here is a workflow engine. Each check re-runs the library that wrote the artifact (buildPackage,
// validateScript, buildStoryboard, releaseCheck, discover) and compares fingerprints, so "current" means the same
// thing it means to `npm run script -- lock`. The only non-derivable input is production.json: a person's decision to
// queue, park or mark a story published, which no artifact records.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICLE_FILES,
  type Article,
  articleReviewUnits,
  inspectArticle,
  loadArticleRelease,
  validateArticleIn,
} from '../modules/article';
import type { Inspection } from '../shared/inspect';
import type {
  Corpus,
  PassageReader,
  ReviewFile,
  EvidencePackage,
  Release,
  ReviewFinding,
  Script,
  ScriptReviewFile,
  ScriptValidation,
  Story,
} from '../shared/types';
import { corpusOf } from './corpus';
import {
  passageReader,
  fileSha,
  lf,
  readJson,
  sha,
  toJson,
  topicDir,
  ROOT,
  docHasher,
  docReader,
  FILES,
  scriptDir,
  shortId,
  shortOf,
  storySlug,
} from '../shared/io';
import {
  RENDER_CHECK,
  type RenderCheckSummary,
  renderCheckProblems,
  renderCheckStale,
  renderConfigSha,
} from './render-check';
import {
  type Build,
  type Ledger,
  type OutputState,
  type ReviewNote,
  type UploadMetadata,
  currentBuild,
  noteLine,
  emptyLedger,
  loadLedger,
  mainOutput,
  outputStates,
  parentUrlOf,
  publishPath,
  uploadMetadataOf,
} from '../modules/publishing';
import { buildPackage } from '../modules/script';
import { releaseCheck, storyboardFingerprint } from '../shared/release-check';
import { validationFingerprint } from '../shared/sentence-validation';
import { validateScript } from '../shared/sentence-validation';
import {
  type ShortsFile,
  buildShortPackage,
  discoverShorts,
  loadShortParent,
  loadShorts,
  loadShortsReview,
  shortsPath,
} from '../modules/shorts';
import { chainOf, discover, loadReview, loadStories, reviewPath, storiesPath } from '../modules/stories';
import { buildStoryboard } from '../modules/storyboard';
import type { Storyboard, StoryboardPlan } from '../shared/types';
import { loadTopic, topicNames, type Topic } from './topics';
import type { BuildSummary, Clearance } from '../shared/build-report';
import { lookFingerprint, lookStale } from '../shared/look';
import { type Commission, commissionOf } from '../config/site';

/** Why a stage halted, for a loop that decides what to do next without parsing prose. */
export type HaltKind =
  | 'missing'
  | 'stale'
  | 'blocking-findings'
  | 'revision-limit'
  | 'needs-evidence'
  | 'review-pending'
  | 'review-findings'
  | 'storyboard-blocked'
  | 'render-check'
  | 'needs-graphics'
  | 'graphics-review'
  | 'lock'
  | 'qa-failed'
  | 'look-stale' // a packaged build drawn with an older kit or theme: a person runs video final before approving it
  | 'story-left'
  | 'no-institution' // no commission claims the topic: its videos have no brand to carry
  | 'published'; // the main output is live or scheduled: nothing rebuilds it; a re-release is a new output
/** A blocked validation: the writer revises, unless the pass has spent its revisions. */
export const validationHaltKind = (live: ScriptValidation): 'revision-limit' | 'blocking-findings' =>
  live.revisionLimitReached ? 'revision-limit' : 'blocking-findings';

export type Health = 'done' | 'current' | 'stale' | 'blocked' | 'missing' | 'pending';
export interface Check {
  name: string; // the artifact or process
  health: Health;
  detail: string; // one line a person can act on
  file?: string; // repo-relative, when there is one
  date?: string;
}

/** A person's planning decision about a story that no artifact records. Keyed `<topic>/<story-id>` in production.json.
 *  Publishing state (uploads, approvals, what is live) is not a decision here: it lives in the story's publish.json. */
export interface Decision {
  decision: 'queued' | 'parked';
  note: string;
  date: string; // ISO date
}
export const DECISIONS = ['queued', 'parked'] as const;
export const DECISIONS_FILE = 'production.json';
export function loadDecisions(root = ROOT): Record<string, Decision> {
  return readJson<Record<string, Decision>>(join(root, DECISIONS_FILE)) ?? {};
}
/** Every decision must be queued or parked with a note and a date; anything else fails the build. */
export function checkDecisions(decisions: Record<string, unknown>): void {
  for (const [k, d] of Object.entries(decisions)) {
    const x = d as Partial<Decision> | null;
    if (!x || !DECISIONS.includes(x.decision as Decision['decision']) || typeof x.note !== 'string' || !x.date)
      throw new Error(`${DECISIONS_FILE}: ${k} needs decision (${DECISIONS.join('|')}), note and date`);
  }
}

export type ProductionStage =
  | 'package'
  | 'script'
  | 'validate'
  | 'review'
  | 'storyboard'
  | 'graphics' // render.json drafted, every scene renderable, every bespoke graphic approved by a visual review
  | 'lock'
  | 'locked' // release.json, no render yet
  | 'video' // a segment rendered (partial, stale or failing QA)
  | 'rendered' // every storyboard scene rendered against the locked fingerprints and QA passed; no soundtrack yet
  | 'scored' // the soundtrack mixed in and QA passed; no released article yet
  | 'article' // the companion article written, reviewed and locked (article-release.json); a Short has none
  | 'packaged'; // video/review/ made from this build: upload it privately and review it
export const PRODUCTION_STAGES: ProductionStage[] = [
  'package',
  'script',
  'validate',
  'review',
  'storyboard',
  'graphics',
  'lock',
  'locked',
  'video',
  'rendered',
  'scored',
  'article',
  'packaged',
];
const VIDEO_REPORT = 'video/build-report.json';
const REVIEW_PACKAGE = 'video/review/review.json';
/** Technical readiness, editorial approval and licensing clearance are three different things; the board keeps the
 *  third here, read from the build report, so a card can be fully rendered and still say "release blocked". */
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
  build: Build | null; // the build packaged in video/review/: a draft (edge voice, accepted by `video final`) or the release
  publish: { main: string | null; outputs: OutputView[] } | null; // the ledger's outputs and their states, once there is a package or a ledger
  upload: UploadMetadata | null; // what the upload form takes for the main output, once there is something to upload or update
  halt: { kind: HaltKind; stage: ProductionStage; why: string } | null; // the first halt, if any
  // the companion article once the script is locked; kind is the halt it puts on the video while nothing is released
  article: { state: ArticleState; next: string; kind?: HaltKind } | null;
}
export type ArticleState = 'none' | 'writing' | 'review' | 'blocked' | 'released' | 'changed' | 'stale';
/** One output of the publishing ledger as the board shows it. */
export interface OutputView {
  id: string;
  kind: string;
  state: OutputState;
  metadata: UploadMetadata | null; // composed upload metadata; null without a review package
}
/** The main output's state, or null when there is no ledger view or every youtube-video output is retracted. */
const mainOf = (pub: Production['publish'] | undefined) => pub?.outputs.find((o) => o.id === pub.main);
export const mainState = (p: Production | null | undefined): OutputState | null => mainOf(p?.publish)?.state ?? null;

export interface StoryRow {
  story: Story;
  decision: Decision | null;
  production: Production | null;
  next: string;
  shorts: ShortRow[]; // the video's Short candidates (shorts.json), each with its production when started
  shortsNext: string | null; // the discover command when a packaged video has no current shorts.json, else null
}
/** One Short candidate of a video as the board shows it, under the video's row; never the topic's next step. */
export interface ShortRow {
  key: string;
  id: string | null; // <story-id>/shorts/<slug> once the review gave it a slug
  slug: string | null;
  format: string | null;
  readiness: 'ready' | 'needs-review' | 'rejected';
  blocking: string[];
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
  t: Corpus;
  review: ReviewFile;
  story: Story | undefined;
  chain: Story[]; // the follow-up stories the same video answers
  pkg: EvidencePackage | null;
  script: Script | null;
  sreview: ScriptReviewFile | null;
  v: ScriptValidation | null;
  plan: StoryboardPlan | null;
  release: Release | null;
  vr: BuildSummary | null;
  ledger: Ledger;
  build: Build | null;
  publish: Production['publish'];
  /** Set for a Short: its parent, the parent's shorts.json and package, which its own package stage rebuilds from. */
  short: { parent: string; slug: string; shorts: ShortsFile | null; parentPkg: EvidencePackage | null } | null;
  live: ScriptValidation | null; // the validation re-run in memory (validation stage)
  sb: Storyboard | null; // the storyboard re-filled against it (storyboard stage)
  article: { inspection: Inspection; next: string } | null; // articleOf, once per board
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
  halt?: { stage: ProductionStage; kind: HaltKind; why: string; cmd: string };
  blocker?: string;
  advance?: { stage: ProductionStage; next: string };
  live?: ScriptValidation;
  sb?: Storyboard;
}
type BoardStage = (c: BoardContext, s: Readonly<BoardState>) => StageResult;

// 1. Evidence package: rebuild from the story and compare fingerprints (what packages.test.ts does in CI).
const packageStage: BoardStage = ({ topic, storyId, root, r, read, t, review, story, chain, pkg }, s) => {
  if (!pkg)
    return {
      checks: [{ name: 'evidence package', health: 'missing', detail: 'not built', file: r(FILES.pkg) }],
      halt: { stage: 'package', kind: 'missing', why: 'no evidence package', cmd: s.next },
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
      halt: {
        stage: 'package',
        kind: 'story-left',
        why: 'the story left stories.json',
        cmd: `npm run stories -- show ${topic}`,
      },
    };
  const again = buildPackage(story, t, read, {
    review,
    inputs: pkg.inputs,
    readDoc: docReader(root),
    previous: pkg,
    chain,
  });
  const inputsNow = {
    stories: fileSha(storiesPath(topic, root)),
    review: fileSha(reviewPath(topic, root)),
    report: fileSha(join(topicDir(topic, root), 'report.json')),
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
      halt: { stage: 'package', kind: 'stale', why: 'the evidence package no longer matches its inputs', cmd: s.next },
    };
  return {
    checks: [check],
    blocker: story.readiness !== 'ready' ? `story is ${story.readiness}: ${story.readinessWhy}` : undefined,
  };
};

// 1b. A Short's evidence package: shorts.json must be what discover writes now, the candidate must be ready, and the
// package must be what buildShortPackage makes of the parent's package and the candidate (so a parent revised, re-locked
// or re-reviewed since asks for the package again).
const shortPackageStage: BoardStage = ({ topic, root, r, pkg, short }, s) => {
  const { parent, slug, shorts, parentPkg } = short!;
  const discover = `npm run shorts -- discover ${topic} ${parent}`;
  const name = 'evidence package';
  const halt = (kind: HaltKind, why: string, cmd: string, health: Health = 'blocked'): StageResult => ({
    checks: [{ name, health, detail: why, file: r(FILES.pkg), date: pkg?.generatedAt }],
    halt: { stage: 'package', kind, why, cmd },
  });
  if (!shorts) return halt('missing', `no shorts.json for ${parent}`, discover, 'missing');
  let again: ShortsFile;
  try {
    again = discoverShorts(loadShortParent(topic, parent, root), loadShortsReview(topic, parent, root));
  } catch (e) {
    return halt('stale', `the parent cannot be rediscovered: ${e instanceof Error ? e.message : e}`, discover);
  }
  if (toJson(again) !== toJson(shorts)) return halt('stale', `shorts.json is not what discover writes now`, discover);
  const c = shorts.candidates.find((x) => x.slug === slug);
  if (!c) return halt('story-left', `no candidate with slug ${slug} in shorts.json`, `stop: no candidate ${slug}`);
  if (c.readiness !== 'ready')
    return halt(
      'story-left',
      `candidate ${c.key} is ${c.readiness}: ${c.blocking.join('; ')}`,
      `stop: candidate ${c.key} is ${c.readiness}: ${c.blocking.join('; ')}`,
    );
  if (!pkg) return halt('missing', 'not built', s.next, 'missing');
  if (!parentPkg) return halt('stale', `the parent ${parent} has no evidence package`, s.next);
  const rebuilt = buildShortPackage(parentPkg, c, shorts);
  const current = rebuilt.fingerprint === pkg.fingerprint;
  if (!current)
    return halt(
      'stale',
      `rebuilds to ${rebuilt.fingerprint}, file is ${pkg.fingerprint} (the parent or the review changed)`,
      s.next,
      'stale',
    );
  return {
    checks: [
      {
        name,
        health: 'current',
        detail: `${pkg.fingerprint}: short ${c.key} of ${parent} (${c.format}), ${pkg.claims.length} claims, ${pkg.documents.length} documents`,
        file: r(FILES.pkg),
        date: pkg.generatedAt,
      },
    ],
  };
};

// 2. Script written by the writer agent.
const scriptStage: BoardStage = ({ r, pkg, script }) => {
  if (!script)
    return {
      checks: [{ name: 'script', health: 'missing', detail: 'not written', file: r(FILES.script) }],
      halt: {
        stage: 'script',
        kind: 'missing',
        why: 'no script.json',
        cmd: `agent: src/modules/script/briefs/script.md -> ${r(FILES.script)}`,
      },
    };
  const bound = !pkg || script.generation?.evidencePackage === pkg.fingerprint;
  const wants = script.generation?.needsEvidence ?? [];
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
    halt: !bound
      ? {
          stage: 'script',
          kind: 'stale',
          why: 'the script was written against an older evidence package',
          cmd: `agent: src/modules/script/briefs/script.md (revise)`,
        }
      : wants.length
        ? {
            stage: 'script',
            kind: 'needs-evidence',
            why: `the writer needs evidence: ${wants.map((w) => `${w.claim} (${w.why})`).join('; ')}`,
            cmd: 'agent: scripts/briefs/evidence.md',
          }
        : undefined,
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
    hashDoc: docHasher(docReader(root)),
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
      ? { stage: 'validate', kind: v ? 'stale' : 'missing', why: 'validation.json is not current', cmd }
      : live.status === 'blocked'
        ? {
            stage: 'script',
            kind: validationHaltKind(live),
            why: `${open.length} blocking issue${open.length === 1 ? '' : 's'}: ${open
              .slice(0, 3)
              .map((i) => `${i.sentence} ${i.category}`)
              .join(', ')}`,
            cmd: live.revisionLimitReached
              ? 'stop: revision limit reached with blocking findings'
              : `agent: src/modules/script/briefs/script.md (revise), then ${cmd}`,
          }
        : undefined;
  return { checks: [check], halt, live };
};

/** The units a review holds on open findings at their current text (an info finding holds nothing). The writer's turn
 *  only when every unapproved unit is held; any other unapproved unit needs the reviewer. Script and article alike. */
export function heldOnFindings(
  units: { id: string; fingerprint: string; approved: boolean }[],
  findings: ReviewFinding[],
): { held: string[]; writer: boolean } {
  const open = units.filter((u) => !u.approved);
  const held = open
    .filter((u) =>
      findings.some((f) => f.sentence === u.id && f.fingerprint === u.fingerprint && f.severity !== 'info'),
    )
    .map((u) => u.id);
  return { held, writer: held.length > 0 && held.length === open.length };
}

// 4. Independent review: present, bound to this package, and the revision it reviewed.
const reviewStage: BoardStage = ({ topic, storyId, r, pkg, script, sreview, live }) => {
  if (!script || !pkg) return {};
  if (!sreview)
    return {
      checks: [{ name: 'review', health: 'missing', detail: 'no independent review', file: r(FILES.review) }],
      halt: {
        stage: 'review',
        kind: 'missing',
        why: 'no script-review.json',
        cmd: `agent: src/modules/script/briefs/script-review.md -> ${r(FILES.review)}`,
      },
    };
  const bound = sreview.packageFingerprint === pkg.fingerprint;
  const sameRev = sreview.revision === script.revision;
  const unreviewed = live?.counts.unreviewed ?? 0;
  const health: Health = !bound || !sameRev ? 'stale' : unreviewed ? 'pending' : 'current';
  // The reviewer has judged the current revision and holds sentences on findings at their current text: those are the
  // writer's to fix (a warning is not a blocker, so the validation is not blocked), not another review's.
  const { held, writer: allHeld } = heldOnFindings(live?.sentences ?? [], sreview.findings);
  const writer = health === 'pending' && allHeld;
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
        : writer
          ? {
              stage: 'script',
              kind: 'review-findings',
              why: `the reviewer holds ${held.join(', ')} on findings`,
              cmd: `agent: src/modules/script/briefs/script.md (revise), then npm run script -- validate ${topic} ${storyId}`,
            }
          : {
              stage: 'review',
              kind: 'review-pending',
              why: 'the review does not cover the current script',
              cmd: `agent: src/modules/script/briefs/script-review.md (re-review), then npm run script -- validate ${topic} ${storyId}`,
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
        kind: 'missing',
        why: 'no storyboard.json',
        cmd: `agent: src/modules/storyboard/briefs/storyboard.md -> ${r(FILES.storyboard)}`,
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
            kind: 'storyboard-blocked',
            why: 'the storyboard has blocking issues',
            cmd: `agent: src/modules/storyboard/briefs/storyboard.md (revise), then ${cmd}`,
          }
        : !same
          ? { stage: 'storyboard', kind: 'stale', why: 'storyboard.json is not current', cmd }
          : undefined,
    sb,
  };
};

// 6. Graphics: render.json drafted, every scene renderable, every diagram drawn and every bespoke graphic approved by a
// visual review, all at the current script, storyboard and render.json (video/render-check.json, written by
// `npm run video -- check`).
const graphicsStage: BoardStage = ({ topic, storyId, root, p, r, live, sb }, s) => {
  if (!live || !sb || s.stopped) return {};
  const check = `npm run video -- check ${topic} ${storyId}`;
  if (!existsSync(p('video/render.json')))
    return {
      checks: [{ name: 'graphics', health: 'missing', detail: 'no video/render.json', file: r('video/render.json') }],
      halt: {
        stage: 'graphics',
        kind: 'missing',
        why: 'no video/render.json',
        cmd: `npm run video -- init ${topic} ${storyId}, then ${check}`,
      },
    };
  const rc = readJson<RenderCheckSummary>(p(RENDER_CHECK));
  const now = {
    script: live.scriptFingerprint,
    storyboard: storyboardFingerprint(sb),
    config: renderConfigSha(scriptDir(topic, storyId, root)),
  };
  const problems = renderCheckProblems(rc, now);
  const stale = renderCheckStale(rc, now);
  const unapproved = rc?.graphics.filter((g) => !g.approved).map((g) => g.scene) ?? [];
  const halt: StageResult['halt'] =
    stale || !rc
      ? { stage: 'graphics', kind: 'render-check', why: problems[0], cmd: check }
      : rc.needsGraphics.length
        ? {
            stage: 'graphics',
            kind: 'needs-graphics',
            why: `${rc.needsGraphics.join(', ')} need a graphic`,
            cmd: `agent: scripts/briefs/graphics.md (${rc.needsGraphics.join(',')}), then ${check}`,
          }
        : unapproved.length
          ? {
              stage: 'graphics',
              kind: 'graphics-review',
              why: `${unapproved.join(', ')} not approved by the visual review`,
              cmd: `agent: scripts/briefs/visual-review.md (${unapproved.join(',')}), then ${check}`,
            }
          : problems.length
            ? {
                stage: 'graphics',
                kind: 'render-check',
                why: problems.slice(0, 3).join('; '),
                cmd: `agent: scripts/briefs/video-fix.md, then ${check}`,
              }
            : undefined;
  return {
    checks: [
      {
        name: 'graphics',
        health: stale ? 'stale' : halt ? 'blocked' : 'current',
        detail: halt?.why ?? `every scene renders; ${rc!.graphics.length} bespoke graphics approved`,
        file: r(RENDER_CHECK),
        date: rc?.generatedAt,
      },
    ],
    halt,
  };
};

// 7. Release: locked fingerprints must still match.
const releaseStage: BoardStage = ({ topic, storyId, r, release, live, sb }, s) => {
  const lock = `npm run script -- lock ${topic} ${storyId} --approved-by "<approver>"`;
  if (!release)
    return {
      checks: [{ name: 'release', health: 'missing', detail: 'not locked', file: r(FILES.release) }],
      halt: {
        stage: 'lock',
        kind: 'lock',
        why: 'validation passed and the storyboard is ok; nobody has signed off',
        cmd: lock,
      },
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
      ? {
          stage: 'lock',
          kind: 'stale',
          why: 'release.json no longer matches the files',
          cmd: `review the drift, then ${lock}`,
        }
      : undefined,
    advance:
      !stale.length && !s.stopped ? { stage: 'locked', next: `npm run video -- spike ${topic} ${storyId}` } : undefined,
  };
};

// 8. Video: the committed build report must come from the locked script and storyboard and pass its QA.
const videoStage: BoardStage = ({ topic, storyId, p, r, release, vr, sb }, s) => {
  if (!vr || !release) return {};
  const total = sb?.scenes.length ?? 0;
  const config = readJson<unknown>(p('video/render.json'));
  const bound =
    vr.fingerprints.script === release.fingerprints.script &&
    vr.fingerprints.storyboard === release.fingerprints.storyboard &&
    (!config || vr.fingerprints.config === sha(JSON.stringify(config)));
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
      halt: {
        stage: 'video',
        kind: 'stale',
        why: 'the video was rendered from a script, storyboard or render.json that has changed since',
        cmd,
      },
    };
  if (!vr.qa.ok)
    return {
      checks: [check],
      halt: {
        stage: 'video',
        kind: 'qa-failed',
        why: `video QA failed: ${failed.map((c) => c.name).join(', ')}`,
        cmd: `agent: scripts/briefs/video-fix.md, then ${cmd}`,
      },
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
          next: `npm run music -- cues ${topic} ${storyId}, then npm run video -- render ${topic} ${storyId}, then npm run video -- qa ${topic} ${storyId}`,
        },
  };
};

// 9. Soundtrack: mixed into this build (the QA already checked the mix is of the committed cue sheet).
const soundtrackStage: BoardStage = ({ topic, storyId, r, release, vr, short }, s) => {
  if (!vr || !release) return {};
  // A Short is narration only (brand/design.md 2.6: no ceremonial intro, no bed): no soundtrack stage to wait for.
  if (!vr.music)
    return short && s.stage === 'rendered'
      ? { advance: { stage: 'scored', next: `npm run video -- package ${topic} ${storyId}` } }
      : {};
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

// 9b. Article: written, reviewed and locked before the review package; once released it never holds the video back
// (a correction or a stale finding is the Article column's, not a stage).
const articleStage: BoardStage = (c, s) => {
  const { r } = c;
  const article = articleView(c);
  if (!article) return {};
  const check: Check = {
    name: 'article',
    health: article.kind
      ? article.state === 'none'
        ? 'missing'
        : article.state === 'blocked'
          ? 'blocked'
          : 'pending'
      : 'done',
    detail: article.kind ? `${article.state}: ${article.next}` : article.state,
    file: r(article.kind ? ARTICLE_FILES.article : ARTICLE_FILES.release),
  };
  if (s.stage !== 'scored') return { checks: [check] };
  return article.kind
    ? {
        checks: [check],
        halt: { stage: 'article', kind: article.kind, why: `article ${article.state}`, cmd: article.next },
      }
    : { checks: [check] };
};

/** What moves the main output on, from the ledger; or the way out when every youtube-video output is retracted. */
const publishNext = (c: BoardContext) => {
  const main = mainOf(c.publish);
  if (main) return main.state.next;
  // a packaged Short records itself in the parent's ledger when it is packaged; no entry means an older package
  if (c.short)
    return `npm run video -- package ${c.topic} ${c.storyId} (records short:${c.short.slug} in ${c.short.parent}'s publish.json)`;
  return `every youtube-video output is retracted; npm run publish -- add ${c.topic} ${c.storyId} youtube-2 --kind youtube-video`;
};

// 10. Review package: made from this very build report. Past it, the publishing ledger says what is next.
const reviewPackageStage: BoardStage = (c, s) => {
  const { p, r, release, vr } = c;
  if (!vr || !release) return {};
  const rp = readJson<{ generatedAt: string; buildReport: string; mp4: string; status?: string }>(p(REVIEW_PACKAGE));
  if (!rp) return {};
  const current = rp.buildReport === fileSha(p(VIDEO_REPORT));
  return {
    checks: [
      {
        name: 'review package',
        health: current ? 'done' : 'stale',
        detail: current
          ? `video/review/${rp.mp4}, ${rp.status ?? 'private review build'}`
          : 'made from an earlier build; package again',
        file: r(REVIEW_PACKAGE),
        date: rp.generatedAt,
      },
    ],
    advance: s.stage === 'scored' && current ? { stage: 'packaged', next: publishNext(c) } : undefined,
  };
};

// 10b. Look: a packaged build drawn with an older kit palette, kit cards or theme (src/shared/look.ts) is drawn again with
// video final before anyone approves it. The stage stays packaged, so /produce (done) never re-renders it; a live or
// scheduled video is never replaced, so it does not halt.
const lookStage: BoardStage = (c, s) => {
  const { topic, storyId, root, r, vr } = c;
  if (!vr) return {};
  const stale = lookStale(vr, topic, root);
  const check: Check = {
    name: 'look',
    health: stale ? 'stale' : 'current',
    detail: stale ?? `look ${lookFingerprint(topic, root)}`,
    file: r(VIDEO_REPORT),
    date: vr.generatedAt,
  };
  const main = mainOf(c.publish)?.state;
  if (!stale || s.stage !== 'packaged' || s.stopped || main?.live || main?.status === 'scheduled')
    return { checks: [check] };
  return {
    checks: [check],
    halt: {
      stage: 'packaged',
      kind: 'look-stale',
      why: stale,
      cmd: `npm run video -- final ${topic} ${storyId} --approved-by "<approver>"`,
    },
  };
};

// 11. Clearance: a finished build whose release is blocked says why next to the next step (a halt's command stands).
const clearanceStage: BoardStage = ({ release, vr }, s) =>
  vr && release && !s.stopped && !vr.clearance.publishable && (s.stage === 'scored' || s.stage === 'packaged')
    ? { advance: { stage: s.stage, next: `${s.next}; public release is blocked: ${vr.clearance.why.join('; ')}` } }
    : {};

/** The board's stages in pipeline order; productionOf folds over them. A new stage is a new function here. */
const BOARD_STAGES: BoardStage[] = [
  packageStage,
  scriptStage,
  validationStage,
  reviewStage,
  storyboardStage,
  graphicsStage,
  releaseStage,
  videoStage,
  soundtrackStage,
  articleStage,
  reviewPackageStage,
  lookStage,
  clearanceStage,
];

/** The article beside a locked script, as the module reports it (inspectArticle) and the command that moves it on. The
 *  validation re-runs live, as the script's does, so review and blocked mean what npm run article -- validate would
 *  say now. The halt it puts on the video is articleView's. */
function articleOf({
  topic,
  storyId,
  root,
  p,
  r,
  read,
  t,
  review,
  script,
  release,
  short,
}: BoardContext): BoardContext['article'] {
  if (!release || short) return null;
  const writer = `agent: src/modules/article/briefs/article.md (revise) -> ${r(ARTICLE_FILES.article)}`;
  let live: ScriptValidation | undefined;
  let text: Article | undefined;
  const inspection = inspectArticle(topic, storyId, root, (a, pkg) => {
    text = a;
    return (live = validateArticleIn(
      topic,
      storyId,
      a,
      t,
      read,
      { judgments: review.applicability, pkg, script },
      root,
    ));
  });
  const f = inspection.findings[0];
  const code = inspection.code;
  const next = (() => {
    switch (inspection.status) {
      case 'ready':
        return 'none';
      case 'stale':
        return `${f}, then ${writer}, or if the text stands: npm run article -- reaffirm ${topic} ${storyId} --approved-by "<your name>" --note "<why unchanged>"`;
      case 'missing':
        return `agent: src/modules/article/briefs/article.md -> ${r(ARTICLE_FILES.article)}`;
      case 'invalid':
        if (code === 'needs-evidence') return 'agent: scripts/briefs/evidence.md';
        if (code === 'no-package') return `npm run script -- package ${topic} ${storyId}`;
        if (code === 'revision-limit') return 'stop: revision limit reached with blocking findings';
        if (code === 'blocking') return writer;
        if (code === 'changed')
          return `npm run article -- correct ${topic} ${storyId} --approved-by "<your name>" --note "<what changed>"`;
        if (code === 'passed') return `npm run article -- lock ${topic} ${storyId} --approved-by "<approver>"`;
        // A review of this package that holds every unapproved unit on findings is the writer's to answer; any other
        // unapproved unit (an edit beside a held sentence, a new headline) is the reviewer's, whatever the revision.
        return reviewHeld({ p, pkgFp: readJson<EvidencePackage>(p(FILES.pkg))?.fingerprint, live, text })
          ? writer
          : `agent: src/modules/article/briefs/article-review.md -> ${r(ARTICLE_FILES.review)}`;
    }
  })();
  return { inspection, next };
}

/** Whether the article review holds every unapproved unit on findings (the writer's turn). */
function reviewHeld(x: {
  p: (f: string) => string;
  pkgFp: string | undefined;
  live: ScriptValidation | undefined;
  text: Article | undefined;
}): boolean {
  const areview = readJson<ScriptReviewFile>(x.p(ARTICLE_FILES.review));
  if (!x.live || !x.text || !areview) return false;
  const units = [
    ...x.live.sentences,
    ...articleReviewUnits(x.text).map(([id, fp]) => ({ id, fingerprint: fp, approved: areview.approved?.[id] === fp })),
  ];
  return areview.packageFingerprint === x.pkgFp && heldOnFindings(units, areview.findings ?? []).writer;
}

/** The board's reading of the inspection: the state its column shows and, while nothing is released, the halt it puts
 *  on the video. The module names neither. */
function articleView(c: BoardContext): Production['article'] {
  if (!c.article) return null;
  const { inspection: i, next } = c.article;
  const code = i.code;
  const released = !!loadArticleRelease(c.topic, c.storyId, c.root);
  const k = (kind: HaltKind) => (released ? {} : { kind });
  switch (i.status) {
    case 'ready':
      return { state: 'released', next };
    case 'stale':
      return { state: 'stale', next };
    case 'missing':
      return { state: 'none', next, kind: 'missing' };
    case 'invalid':
      if (code === 'needs-evidence') return { state: 'writing', next, ...k('needs-evidence') };
      if (code === 'no-package') return { state: 'blocked', next, ...k('missing') };
      if (code === 'revision-limit') return { state: 'blocked', next, ...k('revision-limit') };
      if (code === 'blocking') return { state: 'blocked', next, ...k('blocking-findings') };
      if (code === 'changed') return { state: 'changed', next };
      if (code === 'passed') return { state: 'review', next, kind: 'lock' };
      return {
        state: 'review',
        next,
        ...k(
          next.startsWith('agent: src/modules/article/briefs/article-review.md') ? 'review-pending' : 'review-findings',
        ),
      };
  }
}

/** One script directory, checked artifact by artifact against what the library would produce now. */
export function productionOf(topic: string, storyId: string, root = ROOT): Production | null {
  const dir = scriptDir(topic, storyId, root);
  if (!existsSync(dir)) return null;
  const p = (f: string) => join(dir, f);
  const stories = loadStories(topic, root);
  const short = shortOf(storyId);
  const story = stories?.stories.find((s) => s.id === (short ? short.parent : storyId));
  // A Short's ledger entry lives in its parent's publish.json as the output short:<slug>.
  const ledgerStory = short ? short.parent : storyId;
  const ledgerDir = short ? scriptDir(topic, short.parent, root) : dir;
  const c: BoardContext = {
    topic,
    storyId,
    root,
    p,
    r: (f) => rel(p(f), root),
    read: passageReader(root),
    t: corpusOf(loadTopic(topic)),
    review: loadReview(topic, root),
    story,
    chain: story && !short ? chainOf(story, stories) : [],
    pkg: readJson<EvidencePackage>(p(FILES.pkg)),
    script: readJson<Script>(p(FILES.script)),
    sreview: readJson<ScriptReviewFile>(p(FILES.review)),
    v: readJson<ScriptValidation>(p(FILES.validation)),
    plan: readJson<StoryboardPlan>(p(FILES.storyboard)),
    release: readJson<Release>(p(FILES.release)),
    vr: readJson<BuildSummary>(p(VIDEO_REPORT)),
    ledger: loadLedger(topic, ledgerStory, root) ?? emptyLedger(`${topic}/${ledgerStory}`),
    build: currentBuild(ledgerDir),
    publish: null,
    short: short
      ? {
          ...short,
          shorts: loadShorts(topic, short.parent, root),
          parentPkg: readJson<EvidencePackage>(join(ledgerDir, FILES.pkg)),
        }
      : null,
    live: null,
    sb: null,
    article: null,
  };
  c.article = articleOf(c);
  // The ledger view: every output's state against the build on disk and the metadata it would send. A Short's view is
  // its own output in the parent's ledger (present once it is packaged), judged against its own build: c.build is the
  // parent's package, which outputStates uses only for an output without a source; a Short's output names its folder.
  const own = short ? `short:${short.slug}` : null;
  if ((own ? own in c.ledger.outputs : c.build) || (!own && existsSync(publishPath(topic, storyId, root)))) {
    const lrel = (f: string) => rel(join(ledgerDir, f), root);
    const metadata = Object.fromEntries(
      Object.entries(c.ledger.outputs).map(([id, o]) => [
        id,
        uploadMetadataOf(ledgerDir, lrel, o, parentUrlOf(c.ledger, o), root),
      ]),
    );
    const states = outputStates(c.ledger, c.build, (id) => metadata[id]?.sha ?? null, {
      topic,
      story: ledgerStory,
      root,
      titleOf: (id) => metadata[id]?.title ?? null,
    });
    const ids = own ? [own] : Object.keys(c.ledger.outputs);
    c.publish = {
      main: own ?? mainOutput(c.ledger),
      outputs: ids.map((id) => ({
        id,
        kind: c.ledger.outputs[id].kind,
        state: states[id],
        metadata: metadata[id],
      })),
    };
  }
  const s: BoardState = { stage: 'package', next: `npm run script -- package ${topic} ${storyId}`, stopped: false };
  const checks: Check[] = [];
  const blockers: string[] = [];
  let halt: Production['halt'] = null;
  for (const stage of c.short ? [shortPackageStage, ...BOARD_STAGES.slice(1)] : BOARD_STAGES) {
    const res = stage(c, s);
    checks.push(...(res.checks ?? []));
    if (res.live) c.live = res.live;
    if (res.sb) c.sb = res.sb;
    if (res.blocker) blockers.push(res.blocker);
    // The first halt sets the stage, its command and its reason; later halts are consequences of it.
    if (res.halt && !s.stopped) {
      s.stopped = true;
      s.stage = res.halt.stage;
      s.next = res.halt.cmd;
      blockers.push(res.halt.why);
      halt = { kind: res.halt.kind, stage: res.halt.stage, why: res.halt.why };
    }
    if (res.advance) {
      s.stage = res.advance.stage;
      s.next = res.advance.next;
    }
  }

  const { v, sreview, release, pkg, plan, script, vr, publish } = c;
  const stage = s.stage;
  const main = mainOf(publish);
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
    build: stage === 'packaged' ? currentBuild(dir) : null, // its own package: c.build is the parent's for a Short
    publish,
    upload: main && (stage === 'packaged' || main.state.status !== 'not-uploaded') ? main.metadata : null,
    halt,
    article: articleView(c),
    fingerprints: {
      script: v?.scriptFingerprint ?? null,
      package: pkg?.fingerprint ?? null,
      validation: v ? validationFingerprint(v) : null,
      storyboard: plan && 'scenes' in plan ? storyboardFingerprint(plan as Storyboard) : null,
    },
    model: script?.generation?.model ?? null,
  };
}

/** The loop's one question: where is this story, and what moves it on. */
export interface BoardNext {
  topic: string;
  story: string;
  stage: ProductionStage;
  next: string;
  steps: Step[];
  halt: Production['halt'];
  done: boolean;
}
/** The stop for a topic no institution claims: the board row and boardNext say the same. */
const unclaimed = (topic: string) =>
  `stop: no institution claims ${topic}: add it to commissions in src/config/site.ts`;
export function boardNext(
  topic: string,
  storyId: string,
  root = ROOT,
  owner: (topic: string) => Commission | null = commissionOf,
): BoardNext {
  const short = shortOf(storyId);
  const story = loadStories(topic, root)?.stories.find((s) => s.id === storyId);
  // A follow-up question in another story's chain is produced inside that story's video, never on its own.
  const prod = story?.partOf ? null : productionOf(topic, storyId, root);
  // A Short starts from a ready candidate in its parent's shorts.json.
  const cand = short ? loadShorts(topic, short.parent, root)?.candidates.find((c) => c.slug === short.slug) : null;
  const ready = short ? cand?.readiness === 'ready' : story?.readiness === 'ready' && !story.partOf;
  const why = short
    ? cand
      ? `candidate ${cand.key} is ${cand.readiness}: ${cand.blocking.join('; ')}`
      : `no candidate with slug ${short.slug} in shorts.json (npm run shorts -- discover ${topic} ${short.parent})`
    : story?.partOf
      ? `the story is a follow-up question in ${story.partOf}; produce that story instead`
      : 'the story is not ready in stories.json';
  const live = mainState(prod);
  if (prod && live && (live.live || live.status === 'scheduled')) {
    const again = short
      ? `a new Short of ${short.parent}, never this one rebuilt`
      : `npm run publish -- add ${topic} ${storyId} youtube-2 --kind youtube-video`;
    const next = `stop: ${live.live ? 'live' : 'scheduled'} at ${live.url}; a re-release is ${again}`;
    return {
      topic,
      story: storyId,
      stage: prod.stage,
      next,
      steps: stepsOf(next, topic, storyId),
      halt: {
        kind: 'published',
        stage: prod.stage,
        why: `the video is ${live.live ? 'live' : 'scheduled'} at ${live.url}`,
      },
      done: true,
    };
  }
  if (!owner(topic)) {
    const next = unclaimed(topic);
    const stage = prod?.stage ?? 'package';
    return {
      topic,
      story: storyId,
      stage,
      next,
      steps: stepsOf(next, topic, storyId),
      halt: { kind: 'no-institution', stage, why: `no institution claims ${topic}` },
      done: false,
    };
  }
  const { stage, next, halt } = prod ?? {
    stage: 'package' as const,
    next: ready ? `npm run script -- package ${topic} ${storyId}` : `stop: ${why}`,
    halt: ready
      ? { kind: 'missing' as const, stage: 'package' as const, why: 'no evidence package' }
      : { kind: 'story-left' as const, stage: 'package' as const, why },
  };
  return { topic, story: storyId, stage, next, steps: stepsOf(next, topic, storyId), halt, done: stage === 'packaged' };
}

interface StoreVideo {
  id: string;
  transcript: string;
  assertions?: unknown[];
  supersededBy?: string;
}

/** The research pipeline for one topic, as the store records it, then every story with its production (if any). */
export function topicBoard(
  name: string,
  root = ROOT,
  decisions = loadDecisions(root),
  owner: (topic: string) => Commission | null = commissionOf,
): TopicBoard {
  const dir = topicDir(name, root);
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
    detail: `${listed} listed, ${recs.length} in the store${unfetched ? `; ${unfetched} not fetched (npm run watcher -- fetch topics/${name}/videos.txt --store topics/${name}/store)` : ''}`,
    file: `topics/${name}/videos.txt`,
  });
  const raw = recs.filter((v) => !v.assertions && v.transcript !== 'none');
  const noCaptions = recs.filter((v) => v.transcript === 'none' && !v.assertions).length;
  checks.push({
    name: 'claims',
    health: raw.length ? 'pending' : 'current',
    detail: `${topic.claims.length} claims from ${recs.length - raw.length - noCaptions} sources${raw.length ? `; ${raw.length} fetched but not extracted (scripts/briefs/extract.md)` : ''}${noCaptions ? `; ${noCaptions} without captions` : ''}`,
    file: `topics/${name}/store/topics.json`,
  });
  const docs = existsSync(join(dir, 'sources'))
    ? readdirSync(join(dir, 'sources')).filter((f) => f.endsWith('.txt')).length
    : 0;
  const unjudged = docs - topic.studies;
  checks.push({
    name: 'studies',
    health: docs ? (unjudged > 0 ? 'pending' : 'current') : 'missing',
    detail: `${docs} documents, ${topic.studies} with verdicts, ${topic.decided}/${topic.claims.length} claims decided by a study${unjudged > 0 ? `; ${unjudged} documents without a recorded verdict (scripts/briefs/sources.md)` : ''}`,
    file: `topics/${name}/sources/`,
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
    file: `topics/${name}/report.json`,
  });
  const review = loadReview(name, root);
  const file = loadStories(name, root);
  const stories: StoryRow[] = [];
  let next: string;
  if (!file) {
    checks.push({ name: 'stories', health: 'missing', detail: 'not discovered', file: `topics/${name}/stories.json` });
    next = `npm run stories -- discover ${name}`;
  } else {
    const again = toJson(discover(topic, passageReader(root), review));
    const current = lf(again) === lf(readFileSync(storiesPath(name, root), 'utf8'));
    checks.push({
      name: 'stories',
      health: current ? 'current' : 'stale',
      detail: `${file.stories.length} candidates, ${file.rejected.length} rejected, from ${file.basis.claims} claims${current ? '' : `; a re-run differs (npm run stories -- discover ${name})`}`,
      file: `topics/${name}/stories.json`,
    });
    const reviewed = file.stories.filter((s) => s.reviewed).length;
    checks.push({
      name: 'story review',
      health: !existsSync(reviewPath(name, root)) ? 'missing' : reviewed < file.stories.length ? 'pending' : 'current',
      detail: `${reviewed}/${file.stories.length} candidates reviewed, ${Object.keys(review.applicability ?? {}).length} applicability judgments${reviewed < file.stories.length ? ' (src/modules/stories/briefs/stories.md)' : ''}`,
      file: `topics/${name}/story-review.json`,
    });
    for (const story of file.stories) {
      const key = `${name}/${story.id}`;
      const decision = decisions[key] ?? null;
      const production = productionOf(name, story.id, root);
      const live = mainState(production);
      let n: string;
      if (decision?.decision === 'parked') n = `parked: ${decision.note}`;
      else if (live?.live) n = `live: ${live.url}`;
      else if (live?.status === 'scheduled') n = live.next;
      else if (!owner(name)) n = unclaimed(name);
      else if (story.partOf) n = `part of ${story.partOf}: answered in that video`;
      else if (production) n = production.next;
      else if (story.readiness === 'ready') n = `npm run script -- package ${name} ${story.id}`;
      else if (story.readiness === 'needs-review')
        n = `settle in story-review.json: ${story.blocking[0] ?? story.readinessWhy}`;
      else n = `research: ${story.blocking[0] ?? story.readinessWhy}`;
      stories.push({ story, decision, production, next: n, ...shortRows(name, story.id, production, root) });
    }
    // A follow-up question is produced inside its chain's video, so it is never the topic's next step.
    const queued = stories.find((s) => s.decision?.decision === 'queued' && !s.story.partOf);
    const active = stories.find(
      (s) =>
        s.production &&
        !s.story.partOf &&
        !['locked', 'rendered', 'scored', 'packaged'].includes(s.production.stage) &&
        s.decision?.decision !== 'parked' &&
        !publishing(s),
    );
    const ready = stories.find((s) => !s.production && s.story.readiness === 'ready' && !s.story.partOf && !s.decision);
    next =
      (queued ?? active ?? ready)?.next ??
      checks.find((c) => c.health === 'stale' || c.health === 'pending')?.detail ??
      'nothing pending';
  }
  for (const key of Object.keys(decisions))
    if (key.startsWith(`${name}/`) && !file?.stories.some((s) => `${name}/${s.id}` === key))
      throw new Error(`${DECISIONS_FILE}: ${key} is not a story in topics/${name}/stories.json`);
  return { topic, checks, stories, rejected: file?.rejected.length ?? 0, next };
}

/** A video's Short candidates as rows under it, each with its production when its folder exists, and the discover
 *  command when a packaged video has no current shorts.json. Shorts never become the topic's next step: a person
 *  starts /produce on one. */
function shortRows(
  topic: string,
  storyId: string,
  production: Production | null,
  root: string,
): Pick<StoryRow, 'shorts' | 'shortsNext'> {
  const file = loadShorts(topic, storyId, root);
  const discover = `npm run shorts -- discover ${topic} ${storyId}`;
  if (!file) return { shorts: [], shortsNext: production?.stage === 'packaged' ? discover : null };
  const reviewFile = rel(shortsPath(topic, storyId, root), root).replace(/shorts\.json$/, 'shorts-review.json');
  const shorts: ShortRow[] = file.candidates.map((c) => {
    const id = c.slug ? shortId(storyId, c.slug) : null;
    const prod = id && existsSync(scriptDir(topic, id, root)) ? productionOf(topic, id, root) : null;
    const live = mainState(prod);
    const next = prod
      ? live?.live
        ? `live: ${live.url}`
        : prod.next
      : c.readiness === 'ready'
        ? `npm run script -- package ${topic} ${id}`
        : c.reviewed
          ? `stop: candidate ${c.key} is ${c.readiness}: ${c.blocking.join('; ')}`
          : `agent: src/modules/shorts/briefs/shorts.md -> ${reviewFile}`;
    return {
      key: c.key,
      id,
      slug: c.slug,
      format: c.format,
      readiness: c.readiness,
      blocking: c.blocking,
      production: prod,
      next,
    };
  });
  for (const r of file.rejected)
    shorts.push({
      key: r.key,
      id: null,
      slug: null,
      format: null,
      readiness: 'rejected',
      blocking: [r.reason],
      production: null,
      next: `rejected: ${r.reason}`,
    });
  let current = false;
  try {
    current =
      toJson(discoverShorts(loadShortParent(topic, storyId, root), loadShortsReview(topic, storyId, root))) ===
      toJson(file);
  } catch {
    // a parent that cannot be rediscovered: shorts.json is not current
  }
  return { shorts, shortsNext: current ? null : discover };
}

/** A row whose main output has left the person's hands: uploaded or beyond. Never the topic's next `/produce` step. */
const publishing = (s: StoryRow) => {
  const st = mainState(s.production)?.status;
  return !!st && !['not-uploaded', 'build-behind', 'retracted'].includes(st);
};

/** The board's columns, one card per video, grouped by who acts next: research, a person settling a story, a person
 *  starting `/produce`, `/produce` itself (every stage from package to scored; the card's strip shows which), a person
 *  watching the draft build (uploaded or not) and accepting it with `video final`, a person uploading the release
 *  package, then the publishing ledger's states (a live or scheduled video wins whatever its stage), the Shorts an
 *  approved video still owes before it goes live, and the parked decision in production.json. */
export const COLUMNS = [
  'needs-research',
  'needs-review',
  'ready',
  'producing',
  'article',
  'draft-review',
  'your-review',
  'changes-requested',
  'uploaded',
  'approved',
  'shorts',
  'scheduled',
  'published',
  'parked',
] as const;
export type Column = (typeof COLUMNS)[number];
/** The card's column, or null for a chain's follow-up question, which is answered on its first question's card. */
export function columnOf(r: StoryRow): Column | null {
  if (r.decision?.decision === 'parked') return 'parked';
  const c = buildColumn(r.production);
  if (c) return c === 'approved' && shortsOwed(r) ? 'shorts' : c;
  if (r.story.partOf) return null;
  if (r.production) return producingColumn(r.production);
  return r.story.readiness === 'rejected' ? 'parked' : r.story.readiness;
}
/** A Short's column under its parent's row: the same states, a rejected candidate none. */
export function shortColumnOf(s: ShortRow): Column | null {
  if (s.readiness === 'rejected') return null;
  return buildColumn(s.production) ?? (s.production ? producingColumn(s.production) : s.readiness);
}
/** An approved video waits for its Shorts: candidates not found or not reviewed, or a Short not yet approved. */
const shortsOwed = (r: StoryRow) =>
  !!r.shortsNext ||
  r.shorts.some((s) => {
    const c = shortColumnOf(s);
    return c && !['approved', 'scheduled', 'published', 'parked'].includes(c);
  });
/** The ledger's say, once the main output is uploaded: it wins whatever the production stage. A draft build stays
 *  at draft review until `video final` replaces it, uploaded or not. */
function buildColumn(p: Production | null): Column | null {
  const main = mainState(p);
  const c: Column | null = main?.live
    ? 'published'
    : main?.status === 'scheduled' || main?.status === 'approved' || main?.status === 'changes-requested'
      ? main.status
      : main?.status === 'uploaded' || main?.status === 'metadata-behind'
        ? 'uploaded'
        : null;
  return c === 'uploaded' && p?.build?.status === 'draft' ? 'draft-review' : c;
}
const producingColumn = (p: Production): Column =>
  p.stage === 'article'
    ? 'article'
    : p.stage !== 'packaged'
      ? 'producing'
      : p.build?.status === 'draft'
        ? 'draft-review'
        : 'your-review';

export function board(root = ROOT): TopicBoard[] {
  const decisions = loadDecisions(root);
  checkDecisions(decisions);
  return topicNames().map((n) => topicBoard(n, root, decisions));
}

/** One thing to do next, as the board's dialog shows it: a command to run, a prompt for an agent, or a manual step. */
export interface Step {
  kind: 'run' | 'prompt' | 'do';
  text: string;
}

/** The prompt that starts or resumes a whole /produce run (.claude/skills/produce/SKILL.md) on one story. */
export const runPromptOf = (topic: string, storyId: string) => `/produce ${topic} ${storyId}\nApprover: <your name>`;
/** The same run as a send-back pass: the editor's notes go after the last line. */
export const sendBackPromptOf = (topic: string, storyId: string, notes: ReviewNote[] = []) =>
  `${runPromptOf(topic, storyId)}\nNotes:\n${notes.length ? notes.map((n) => `- ${noteLine(n)}`).join('\n') : '- '}`;

const MODES: Record<string, string> = {
  revise:
    'This is a revision: the file exists. Fix what validation.json, script-review.json or the storyboard check flag and keep what passed.',
  're-review':
    'This is a re-review: script-review.json exists. Judge every sentence without a current approval (the show sheet lists them).',
  notes:
    'This is a send-back pass: apply the editor notes below to the artifact this brief owns, change nothing else, and keep what passed.',
  corrective: 'This is a corrective pass: change only the sentences listed in generation.corrective for this revision.',
};

const promptOf = (
  brief: string,
  topic: string,
  story?: string,
  mode?: string,
  out?: string,
  point?: string,
  dir = 'scripts/briefs',
) =>
  [
    `Read ${dir}/${brief} and follow it.`,
    `Topic: ${topic}`,
    story && `Story: ${story}`,
    mode && /^sc\d+(,sc\d+)*$/.test(mode) && `Scenes: ${mode}`,
    out && `Write: ${out}`,
    brief === 'script-review.md' && 'You did not write this script; review it independently.',
    brief === 'article-review.md' && 'You did not write this article; review it independently.',
    brief === 'visual-review.md' && 'You did not build these graphics; judge them independently.',
    mode && !/^sc\d/.test(mode) && (MODES[mode] ?? `Mode: ${mode}`),
    point && `Settle: ${point}`,
    'Finish by running the command the brief names, and stop when it passes.',
  ]
    .filter(Boolean)
    .join('\n');

/** Splits a board `next` line into steps. It reads the conventions the stages above write: `npm run ...`,
 *  `agent: <briefs dir>/<brief> (<mode>) -> <file>` (`scripts/briefs` or a module's `briefs`), `settle in story-review.json: ...`, a check detail with its
 *  fix in parentheses, steps joined by "then", and the clearance suffix. Anything else is a manual step. */
export function stepsOf(next: string, topic: string, story?: string): Step[] {
  const [main, blocked] = next.split('; public release is blocked: ');
  const steps = main.split(/,? then /).flatMap((part): Step[] => {
    if (part.startsWith('npm run ')) return [{ kind: 'run', text: part }];
    const agent =
      /^agent: (scripts\/briefs|src\/modules\/[\w-]+\/briefs)\/(\S+?\.md)(?: \(([\w,-]+)\))?(?: -> (\S+))?$/.exec(part);
    if (agent)
      return [{ kind: 'prompt', text: promptOf(agent[2], topic, story, agent[3], agent[4], undefined, agent[1]) }];
    const settle = /^settle in story-review\.json: (.*)$/s.exec(part);
    if (settle)
      return [
        {
          kind: 'prompt',
          text: promptOf('stories.md', topic, undefined, undefined, `topics/${topic}/story-review.json`, settle[1]),
        },
      ];
    const research = /^research: (.*)$/s.exec(part);
    if (research)
      return [
        {
          kind: 'prompt',
          text: [
            `Find studies or public data that would decide this gap in topic ${topic}${story ? `, story ${story}` : ''}:`,
            research[1],
            `Save each document to topics/${topic}/sources/ as text (pdftotext -layout for PDFs), then follow scripts/briefs/sources.md for the new documents against every claim and record with npm run record-sources -- ${topic} topics/${topic}/work/sv_*.json.`,
            `Then run npm run report and npm run stories -- discover ${topic}. If nothing decides it, say so and stop.`,
          ].join('\n'),
        },
      ];
    const hint = /\((npm run [^)]+|scripts\/briefs\/([\w-]+\.md))\)/.exec(part);
    if (!hint) return [{ kind: 'do', text: part }];
    const rest = part.replace(hint[0], '').trim();
    return [
      ...(rest ? [{ kind: 'do' as const, text: rest }] : []),
      hint[2] ? { kind: 'prompt', text: promptOf(hint[2], topic) } : { kind: 'run', text: hint[1] },
    ];
  });
  return blocked ? [...steps, { kind: 'do', text: `Public release is blocked: ${blocked}` }] : steps;
}
