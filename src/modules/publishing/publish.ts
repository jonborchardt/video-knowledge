// The publishing ledger: topics/<topic>/scripts/<slug>/publish.json, the one record of what publishing adds and no
// artifact records. Per output (the YouTube video, a short, a blog post, ...) an append-only event log and a person's
// metadata choices. Events are written only by `npm run publish` (src/modules/publishing/cli.ts); `metadata` may be hand-edited.
// Builds are named by the mp4 sha the QA checked, upload metadata by the sha of the composed text and thumbnail sha, so
// nothing new is versioned here. Library layer: it reads video/review/review.json by path and never imports the video module.
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { BuildSummary } from '../../shared/build-report';
import { lf, readJson, ROOT, sha, toJson } from '../../shared/io';
import { lookStale } from '../../shared/look';
import { approverProblem } from '../../shared/approver';
import { scriptDir, shortId, shortOf, storySlug, topicDir } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import type { StoriesFile } from '../../shared/types';

const PUBLISH_FILE = 'publish.json';
export const EVENT_TYPES = [
  'uploaded',
  'approved',
  'changes-requested',
  'scheduled',
  'published',
  'unpublished',
  'updated',
  'failed',
  'retracted',
  'verified',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type Visibility = 'private' | 'unlisted' | 'public';
/** One check of `npm run publish -- verify`: our own reason only, never a value read from the API (the ledger is public
 *  and API data may not be kept). */
export type CheckResult = 'pass' | 'fail' | 'pending' | 'skip';
export interface LedgerCheck {
  name: string;
  result: CheckResult;
  detail?: string;
}
export type Verdict = 'passed' | 'pending' | 'failed';
const CHECK_RESULTS: CheckResult[] = ['pass', 'fail', 'pending', 'skip'];
const VERDICTS: Verdict[] = ['passed', 'pending', 'failed'];
/** The checks a `push` answers: a failed one makes the next push resend the snippet and thumbnail. */
export const METADATA_CHECKS = ['title', 'description', 'tags', 'category', 'language', 'chapters', 'thumbnail'];

/** One reviewer note on a build: where in the video it is (any of the three, all optional) and what to change. */
export interface ReviewNote {
  text: string;
  scene?: string;
  sentence?: string;
  seconds?: number;
}
/** m:ss of a time in seconds. */
export const stampOf = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
/** A note as one line, its place first: `[3:59 sc20 s31] too fast`, or just the text. */
export const noteLine = (n: ReviewNote) => {
  const at = [n.seconds === undefined ? '' : stampOf(n.seconds), n.scene ?? '', n.sentence ?? ''].filter(Boolean);
  return at.length ? `[${at.join(' ')}] ${n.text}` : n.text;
};
export interface PublishEvent {
  at: string; // ISO
  type: EventType;
  by: string;
  build?: string; // mp4 sha (uploaded, approved)
  buildStatus?: 'draft' | 'release';
  metadata?: string; // composed upload metadata sha (uploaded, updated)
  captions?: string; // sha of the captions file that landed with it (uploaded, updated); push resends only a new one
  id?: string; // the platform's id
  url?: string;
  visibility?: Visibility;
  publishAt?: string; // ISO (scheduled)
  fields?: string[]; // updated
  step?: string; // failed
  error?: string; // failed
  retryable?: boolean; // failed
  note?: string;
  notes?: ReviewNote[]; // changes-requested
  title?: string; // approved: the composed title the person approved with the build
  result?: Verdict; // verified
  checks?: LedgerCheck[]; // verified
}
export interface OutputMetadata {
  title?: string;
  description?: string; // replaces the package's description
  descriptionAppend?: string;
  tags?: string[];
  thumbnail?: { file: string; sha: string }; // repo-relative file; the sha is what the board compares (PNGs are gitignored)
  category?: string;
  language?: string;
  playlist?: string;
  containsSyntheticMedia?: boolean; // YouTube's altered-or-synthetic disclosure; default false (a synthetic narrator over diagrams)
}
export interface Output {
  kind: string;
  derivedFrom?: string; // another output id in this ledger
  source?: string; // repo-relative file the output was made from, when it is not the build in video/review/
  metadata: OutputMetadata;
  events: PublishEvent[];
}
export interface Ledger {
  video: string; // <topic>/<story-id>
  outputs: Record<string, Output>;
}

export const publishPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), PUBLISH_FILE);
export const emptyLedger = (video: string): Ledger => ({
  video,
  outputs: { youtube: { kind: 'youtube-video', metadata: {}, events: [] } },
});

/** What each event type must carry besides at, type and by. */
const REQUIRED: Record<EventType, (keyof PublishEvent)[]> = {
  uploaded: ['build', 'metadata', 'id'],
  approved: ['build'],
  'changes-requested': ['build', 'notes'],
  scheduled: ['id', 'publishAt'],
  published: ['id'],
  unpublished: ['id', 'note'],
  updated: ['id', 'metadata', 'fields'],
  failed: ['step', 'error'],
  retracted: ['note'],
  verified: ['id', 'result', 'checks'],
};
const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Every way the file is not a ledger for `video`, as "where: what" lines; [] when valid. */
export function ledgerProblems(x: unknown, video: string): string[] {
  const out: string[] = [];
  if (!isRecord(x)) return ['not an object'];
  if (x.video !== video) out.push(`video: is ${JSON.stringify(x.video)}, expected ${video}`);
  if (!isRecord(x.outputs)) return [...out, 'outputs: missing'];
  for (const [id, o] of Object.entries(x.outputs)) {
    const at = `outputs.${id}`;
    if (!isRecord(o)) {
      out.push(`${at}: not an object`);
      continue;
    }
    if (typeof o.kind !== 'string' || !o.kind) out.push(`${at}.kind: missing`);
    if (o.derivedFrom !== undefined && !(typeof o.derivedFrom === 'string' && o.derivedFrom in x.outputs))
      out.push(`${at}.derivedFrom: ${JSON.stringify(o.derivedFrom)} is not an output`);
    if (o.source !== undefined && typeof o.source !== 'string') out.push(`${at}.source: not a string`);
    if (!isRecord(o.metadata)) out.push(`${at}.metadata: missing (use {})`);
    else if (o.metadata.thumbnail !== undefined) {
      const t = o.metadata.thumbnail;
      if (!isRecord(t) || typeof t.file !== 'string' || typeof t.sha !== 'string')
        out.push(`${at}.metadata.thumbnail: needs { file, sha }`);
    }
    if (
      isRecord(o.metadata) &&
      o.metadata.containsSyntheticMedia !== undefined &&
      typeof o.metadata.containsSyntheticMedia !== 'boolean'
    )
      out.push(`${at}.metadata.containsSyntheticMedia: not a boolean`);
    if (!Array.isArray(o.events)) {
      out.push(`${at}.events: missing (use [])`);
      continue;
    }
    let last = '';
    o.events.forEach((e, i) => {
      const where = `${at}.events[${i}]`;
      if (!isRecord(e)) return out.push(`${where}: not an object`);
      if (typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at))) out.push(`${where}.at: not an ISO date`);
      else {
        if (e.at < last) out.push(`${where}.at ${e.at} is before the event before it (${last})`);
        last = e.at as string;
      }
      if (typeof e.by !== 'string' || !e.by) out.push(`${where}.by: missing`);
      if (!EVENT_TYPES.includes(e.type as EventType)) return out.push(`${where}.type: ${JSON.stringify(e.type)}`);
      if (e.captions !== undefined && (typeof e.captions !== 'string' || !e.captions))
        out.push(`${where}.captions: not a sha`);
      for (const k of REQUIRED[e.type as EventType])
        if (e[k] === undefined || e[k] === '') out.push(`${where}.${k}: ${e.type} needs it`);
      if (e.result !== undefined && !VERDICTS.includes(e.result as Verdict))
        out.push(`${where}.result: ${JSON.stringify(e.result)} is not ${VERDICTS.join(', ')}`);
      if (e.checks !== undefined) {
        if (!Array.isArray(e.checks)) out.push(`${where}.checks: not a list`);
        else
          e.checks.forEach((c, j) => {
            if (!isRecord(c) || typeof c.name !== 'string' || !c.name) out.push(`${where}.checks[${j}].name: missing`);
            if (!isRecord(c) || !CHECK_RESULTS.includes(c.result as CheckResult))
              out.push(
                `${where}.checks[${j}].result: ${JSON.stringify(isRecord(c) ? c.result : c)} is not ${CHECK_RESULTS.join(', ')}`,
              );
          });
      }
    });
  }
  return out;
}

/** The ledger on disk, validated; null when there is none. */
export function loadLedger(topic: string, storyId: string, root = ROOT): Ledger | null {
  const x = readJson<unknown>(publishPath(topic, storyId, root));
  if (x === null) return null;
  const problems = ledgerProblems(x, `${topic}/${storyId}`);
  if (problems.length) throw new Error(`${PUBLISH_FILE}: ${problems.join('; ')}`);
  return x as Ledger;
}

/** What makes two events the same one (a retry of a verb), or null for an event that is never deduplicated. */
export function eventKey(e: PublishEvent): string | null {
  switch (e.type) {
    case 'uploaded':
      return `uploaded|${e.build}|${e.id}`;
    case 'approved':
      return `approved|${e.build}|${e.title ?? ''}`; // the same build under a new title is a new decision
    case 'changes-requested':
      return `changes-requested|${e.build}|${sha(JSON.stringify(e.notes ?? []))}`;
    case 'scheduled':
      return `scheduled|${e.id}|${e.publishAt}`;
    case 'published':
    case 'unpublished':
      return `${e.type}|${e.id}`; // judged against the latest of the two for that id, see appendEvent
    case 'retracted':
      return 'retracted';
    case 'verified': // judged against the latest verification of the id, see appendEvent
      return `verified|${e.id}|${e.build}|${e.metadata}|${sha(JSON.stringify(e.checks))}`;
    case 'updated': // recordUpdated refuses an unchanged sha; A, B, A is three honest events
    case 'failed':
      return null;
  }
}

/** Appends `e` to `output` unless an event with the same key exists; pure. */
export function appendEvent(
  ledger: Ledger,
  output: string,
  e: PublishEvent,
): { ledger: Ledger; existing: PublishEvent | null } {
  const o = ledger.outputs[output];
  if (!o) throw new Error(`no output ${output} in the ledger (outputs: ${Object.keys(ledger.outputs).join(', ')})`);
  const key = eventKey(e);
  let existing: PublishEvent | null = null;
  if (e.type === 'published' || e.type === 'unpublished') {
    // publish, unpublish, publish again are three events; only a repeat of the latest of the pair is the same one
    const latest = o.events.findLast((x) => (x.type === 'published' || x.type === 'unpublished') && x.id === e.id);
    existing = latest?.type === e.type ? latest : null;
  } else if (e.type === 'approved' || e.type === 'changes-requested') {
    // approve, send back, approve again are three decisions; only a repeat of the latest decision on the build is one
    const latest = o.events.findLast(
      (x) => (x.type === 'approved' || x.type === 'changes-requested') && x.build === e.build,
    );
    existing = latest && eventKey(latest) === key ? latest : null;
  } else if (e.type === 'verified') {
    // pass, fail, pass are three findings; only a repeat of the latest verification of the id, with no upload or
    // update since (the boundary failedSince reads), is the same one
    const i = o.events.findLastIndex((x) => x.type === 'verified' && x.id === e.id);
    const sent = o.events.findLastIndex((x) => x.type === 'uploaded' || x.type === 'updated');
    existing = i > sent && eventKey(o.events[i]) === key ? o.events[i] : null;
  } else if (key !== null) existing = o.events.find((x) => eventKey(x) === key) ?? null;
  if (existing) return { ledger, existing };
  return {
    ledger: { ...ledger, outputs: { ...ledger.outputs, [output]: { ...o, events: [...o.events, e] } } },
    existing: null,
  };
}

export function addOutput(
  ledger: Ledger,
  id: string,
  kind: string,
  opts: { derivedFrom?: string; source?: string } = {},
): Ledger {
  if (ledger.outputs[id]) throw new Error(`output ${id} exists`);
  if (opts.derivedFrom && !ledger.outputs[opts.derivedFrom])
    throw new Error(`derivedFrom ${opts.derivedFrom} is not an output`);
  const o: Output = { kind, metadata: {}, events: [] };
  if (opts.derivedFrom) o.derivedFrom = opts.derivedFrom;
  if (opts.source) o.source = opts.source;
  return { ...ledger, outputs: { ...ledger.outputs, [id]: o } };
}

/** The video's main output: the last youtube-video output not retracted, or null. */
export function mainOutput(ledger: Ledger): string | null {
  const live = Object.entries(ledger.outputs).filter(
    ([, o]) => o.kind === 'youtube-video' && !o.events.some((e) => e.type === 'retracted'),
  );
  return live.at(-1)?.[0] ?? null;
}

/** Whole-file atomic write: a crash leaves the previous ledger. */
export function saveLedger(path: string, ledger: Ledger): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, toJson(ledger));
  renameSync(tmp, path);
}

/** The captions sha the current video has: the latest upload, or an update of that same video since, that recorded
 *  one (none: unknown, send them). An earlier upload's captions are another video's. */
export const lastCaptions = (o: Pick<Output, 'events'>) => {
  const i = o.events.findLastIndex((e) => e.type === 'uploaded');
  const id = o.events[i]?.id;
  return (
    o.events
      .slice(Math.max(i, 0))
      .findLast((e) => (e.type === 'uploaded' || e.type === 'updated') && e.captions && (i < 0 || e.id === id))
      ?.captions ?? null
  );
};
/** The last upload or update that sent metadata: what the platform has now. */
export const lastSent = (o: Pick<Output, 'events'>) =>
  o.events.findLast((e) => (e.type === 'uploaded' || e.type === 'updated') && e.metadata);
/** Whether the latest verification since the last upload or update failed one of `names` (with a detail matching
 *  `detail`, when given): what push resends. */
export const failedSince = (o: Pick<Output, 'events'>, names: string[], detail?: RegExp): boolean => {
  const i = o.events.findLastIndex((e) => e.type === 'uploaded' || e.type === 'updated');
  const v = o.events.slice(i + 1).findLast((e) => e.type === 'verified');
  return !!v?.checks?.some(
    (c) => c.result === 'fail' && names.includes(c.name) && (!detail || detail.test(c.detail ?? '')),
  );
};
/** Whether the captions must be sent again: a verification since the last send found none serving, or a send failed. */
export const captionsDue = (o: Pick<Output, 'events'>): boolean => {
  const i = o.events.findLastIndex((e) => e.type === 'uploaded' || e.type === 'updated');
  return (
    failedSince(o, ['captions']) || o.events.slice(i + 1).some((e) => e.type === 'failed' && e.step === 'captions')
  );
};
/** A restriction a status resend fixes (embedding, licence); age and region restrictions are YouTube's to lift. */
export const FIXABLE_RESTRICTION = /embedding off|licence/;

// ---- state ------------------------------------------------------------------------------------------------------

/** The build packaged in video/review/: what an upload would send. */
export interface Build {
  sha: string; // mp4 sha, as review.json records it (the sha QA checked)
  status: 'draft' | 'release';
}
export function currentBuild(dir: string): Build | null {
  const rp = readJson<{ mp4Sha?: string; status?: string }>(join(dir, 'video', 'review', 'review.json'));
  if (!rp?.mp4Sha) return null;
  return { sha: rp.mp4Sha, status: rp.status === 'release build' ? 'release' : 'draft' };
}

/** An output made from its own file (a post): that file is its build; or from its own production (a Short: a folder
 *  with video/review/review.json): that package's build. Null when neither is on disk. */
export function sourceBuild(root: string, source: string): Build | null {
  const abs = join(root, source);
  if (!existsSync(abs)) return null;
  if (statSync(abs).isDirectory()) return currentBuild(abs);
  return { sha: sha(readFileSync(abs)), status: 'release' };
}
/** A source that is a nested production (a Short's folder under its parent's), or null. */
export const nestedSource = (root: string, output: Pick<Output, 'source'>): string | null =>
  output.source && existsSync(join(root, output.source)) && statSync(join(root, output.source)).isDirectory()
    ? output.source
    : null;

export type OutputStatus =
  | 'not-uploaded'
  | 'uploaded'
  | 'approved'
  | 'changes-requested'
  | 'scheduled'
  | 'published'
  | 'metadata-behind'
  | 'build-behind'
  | 'retracted';
export interface OutputState {
  status: OutputStatus;
  live: boolean; // published and not since unpublished, whatever else the status says (metadata-behind keeps it live)
  failed: PublishEvent | null; // an overlay: the last event (a verification aside), when it is a failure
  requested: PublishEvent | null; // the changes-requested event that holds the current build, if any
  id: string | null;
  url: string | null;
  uploadedBuild: string | null; // build of the last upload
  superseded: string[]; // ids of earlier uploads of other builds
  due: boolean; // scheduled and publishAt has passed
  next: string; // the board's next line
}
export interface StateContext {
  topic: string;
  story: string;
  output: string;
  now?: Date;
  parentLive?: boolean; // for a derivative: whether the output it derives from is published (default: yes)
  title?: string | null; // the composed title now; an approval made with another title does not count (absent: any)
}
/** The latest decision on a build: an approval (with the title it was made with) or a change request; it decides it. */
const decisionOn = (ev: PublishEvent[], b: string) =>
  ev.findLast((e) => (e.type === 'approved' || e.type === 'changes-requested') && e.build === b) ?? null;
/** Whether the latest decision on `build` is an approval made under `title` (absent on either side: any title). */
export function approvalHolds(ev: PublishEvent[], build: string, title?: string | null): boolean {
  const d = decisionOn(ev, build);
  return d?.type === 'approved' && (d.title === undefined || title == null || d.title === title);
}
/** The flow a kind follows: YouTube outputs are uploaded, watched and approved; anything else is made, approved, published. */
export const flowOf = (kind: string): 'youtube' | 'generic' => (kind.startsWith('youtube') ? 'youtube' : 'generic');

/** Where one output stands, from its events in file order, against the build on disk and the metadata it would send. */
export function outputState(
  output: Output,
  build: Build | null,
  metadataSha: string | null,
  ctx: StateContext,
): OutputState {
  const now = ctx.now ?? new Date();
  const verb = (v: string, flags = '') =>
    `npm run publish -- ${v} ${ctx.topic} ${ctx.story}${ctx.output === 'youtube' ? '' : ` --output ${ctx.output}`}${flags}`;
  const ev = output.events;
  const last = ev.findLast((e) => e.type !== 'verified') ?? null;
  const failed = last?.type === 'failed' ? last : null;
  const uploads = ev.filter((e) => e.type === 'uploaded');
  const upload = uploads.at(-1) ?? null;
  const id = upload?.id ?? null;
  // an approval on a draft build (a draft acceptance) counts for nothing here: only a release build is approved
  const approved = !!upload && upload.buildStatus !== 'draft' && approvalHolds(ev, upload.build!, ctx.title);
  const localApproved = !!build && build.status === 'release' && approvalHolds(ev, build.sha, ctx.title);
  const judged = upload && (!build || build.sha === upload.build) ? upload.build! : build?.sha;
  const requested = judged ? decisionOn(ev, judged) : null;
  // an unpublish closes a chapter: the schedule and publication before it are history
  const cut = id ? ev.findLastIndex((e) => e.type === 'unpublished' && e.id === id) : -1;
  const since = ev.slice(cut + 1);
  const scheduled = id ? since.filter((e) => e.type === 'scheduled' && e.id === id).at(-1) : undefined;
  const published = id ? since.filter((e) => e.type === 'published' && e.id === id).at(-1) : undefined;
  const generic = flowOf(output.kind) === 'generic';
  const out = generic ? ev.findLast((e) => e.type === 'published' || e.type === 'unpublished') : undefined;
  const live = generic ? out?.type === 'published' : !!published;
  const url = ev.findLast((e) => e.url && (e.id === id || !id))?.url ?? (id ? `https://youtu.be/${id}` : null);
  const sentSha = lastSent(output)?.metadata;
  const base: Omit<OutputState, 'status' | 'next' | 'due'> = {
    live,
    failed,
    requested: requested?.type === 'changes-requested' ? requested : null,
    id,
    url: id ? url : null,
    uploadedBuild: upload?.build ?? null,
    superseded: upload ? uploads.filter((u) => u.build !== upload.build && u.id).map((u) => u.id!) : [],
  };
  const done = (status: OutputStatus, next: string, due = false): OutputState => ({
    ...base,
    status,
    due,
    next: failed
      ? `${failed.step} failed: ${failed.error}${failed.retryable ? `; retry it, then ${next}` : '; a person decides'}`
      : next,
  });
  const short = ctx.output.startsWith('short:') ? shortId(ctx.story, ctx.output.slice('short:'.length)) : null;
  const sendBack = `send it back with the reviewer's notes: /produce ${ctx.topic} ${short ?? ctx.story}`;
  const first = ctx.parentLive === false && output.derivedFrom ? `publish ${output.derivedFrom} first; then ` : '';

  if (ev.some((e) => e.type === 'retracted')) return done('retracted', 'retracted; nothing to do');
  if (generic) {
    // No build, no private upload: the source file is made, a person approves it, it goes out. An upload is an optional
    // draft on the platform. Published needs approved; nothing is derived from the video's build.
    const anyApproved = ev.some((e) => e.type === 'approved');
    if (out?.type === 'published')
      return {
        ...done('published', `live${out.url ? ` at ${out.url}` : ''}`),
        id: out.id ?? null,
        url: out.url ?? null,
      };
    if (anyApproved) return done('approved', `${first}publish it, then ${verb('published', ' --url <url>')}`);
    if (upload) return done('uploaded', `${first}review the draft, then ${verb('approve', ' --by "<name>"')}`);
    return done(
      'not-uploaded',
      `${first}make ${output.source ?? 'it'}, then ${verb('approve', ' --by "<name>"')} and ${verb('published', ' --url <url>')}`,
    );
  }
  if (!upload) {
    if (base.requested) return done('changes-requested', sendBack);
    if (localApproved) return done('approved', `${verb('upload')}, then ${verb('go-live')}`);
    return done(
      'not-uploaded',
      `${first}${build ? '' : `npm run video -- package ${ctx.topic} ${ctx.story}, then `}${verb('upload')}`,
    );
  }
  const behind = `the title, description, tags, thumbnail or captions changed since they were sent (${verb('push')})`;
  if (live) {
    if (metadataSha && sentSha && metadataSha !== sentSha) return done('metadata-behind', behind);
    const moved =
      build && build.sha !== upload.build
        ? `; the build on disk is ${build.sha}, a re-release is ${verb('add', ' youtube-2 --kind youtube-video')}`
        : '';
    const studio = output.kind === 'youtube-short' ? '; set the related video in YouTube Studio (not in the API)' : '';
    return done('published', `live at ${url}${moved}${studio}`);
  }
  // a schedule stands until it is unpublished: YouTube publishes it whatever the ledger decides about it since
  if (scheduled) {
    const due = Date.parse(scheduled.publishAt!) <= now.getTime();
    return done(
      'scheduled',
      due
        ? `was due ${scheduled.publishAt} (${verb('sync')})`
        : `scheduled for ${scheduled.publishAt}; nothing until then`,
      due,
    );
  }
  if (build && build.sha !== upload.build)
    return done(
      'build-behind',
      `a new ${build.status} build ${build.sha} is packaged (uploaded: ${upload.build}), then ${verb('upload')}`,
    );
  if (base.requested && !live) return done('changes-requested', sendBack);
  if (!build && !approved)
    return done(
      'uploaded',
      `the review package is missing: npm run video -- package, then watch ${url} and record what follows`,
    );
  if (!approved) {
    const status = upload.buildStatus ?? build?.status ?? 'release';
    return done(
      'uploaded',
      status === 'draft'
        ? `watch ${url} with video/review/checklist.md, then npm run video -- final ${ctx.topic} ${ctx.story} --approved-by "<name>"`
        : `watch ${url} with video/review/checklist.md, then ${verb('approve', ' --by "<name>" --checked <n>')}`,
    );
  }
  if (metadataSha && sentSha && metadataSha !== sentSha) return done('metadata-behind', behind);
  return done('approved', verb('go-live', ' [--at <ISO>]'));
}

/** Every output's state, derivatives gated on the output they derive from being live. */
export function outputStates(
  ledger: Ledger,
  build: Build | null,
  metadataShaOf: (id: string, o: Output) => string | null,
  ctx: { topic: string; story: string; now?: Date; root?: string; titleOf?: (id: string, o: Output) => string | null },
): Record<string, OutputState> {
  const states: Record<string, OutputState> = {};
  const { root = ROOT, titleOf, ...rest } = ctx;
  const state = (id: string, parentLive?: boolean) => {
    const o = ledger.outputs[id];
    const b = o.source ? sourceBuild(root, o.source) : build;
    return outputState(o, b, metadataShaOf(id, o), { ...rest, output: id, parentLive, title: titleOf?.(id, o) });
  };
  for (const id of Object.keys(ledger.outputs)) states[id] = state(id);
  for (const [id, o] of Object.entries(ledger.outputs))
    if (o.derivedFrom && states[o.derivedFrom]) states[id] = state(id, states[o.derivedFrom].status === 'published');
  return states;
}

// ---- metadata ---------------------------------------------------------------------------------------------------

/** What the upload form takes: the review package's text and thumbnail, then the output's overrides. */
export interface UploadMetadata {
  file: string | null; // repo-relative mp4 to upload (the main output), or the output's source
  title: string;
  description: string;
  tags: string[];
  thumbnail: { file: string; sha: string } | null;
  captions: { file: string; sha: string; language: string } | null; // the package's captions.en.srt
  category?: string;
  language?: string;
  playlist?: string;
  sha: string; // of the composed text and the thumbnail sha: what an uploaded/updated event records
}
interface ReviewJson {
  title: string;
  mp4: string;
  thumbnailSha?: string | null;
  captionsSha?: string | null;
  tags?: string[];
  files?: string[];
}
/** The parent output's live url for a derivative (its description links the full video), else null. */
export function parentUrlOf(ledger: Ledger, output: Output): string | null {
  const parent = output.derivedFrom ? ledger.outputs[output.derivedFrom] : null;
  if (!parent) return null;
  const last = parent.events.findLast((e) => e.type === 'published' || e.type === 'unpublished');
  if (last?.type !== 'published') return null;
  return last.url ?? (last.id ? `https://youtu.be/${last.id}` : null);
}

/** Null without a review package. `rel` turns a path in the script directory into a repo-relative one; `parentUrl`
 *  (a derivative's live parent) is appended to the description as the full video's link. */
export function uploadMetadataOf(
  dir: string,
  rel: (f: string) => string,
  output: Output,
  parentUrl: string | null = null,
  root = ROOT,
): UploadMetadata | null {
  // a nested production (a Short) has its own package: its title, description, thumbnail and captions, not the parent's
  const nested = nestedSource(root, output);
  const base = nested ? join(root, nested) : dir;
  const review = join(base, 'video', 'review');
  const rp = readJson<ReviewJson>(join(review, 'review.json'));
  if (!rp) return null;
  const at = (f: string) => (nested ? `${nested}/${f}` : rel(f));
  const desc = join(review, 'description.txt');
  const m = output.metadata;
  const packaged = existsSync(desc) ? lf(readFileSync(desc, 'utf8')).trim() : '';
  const link = parentUrl && output.derivedFrom && output.kind !== 'youtube-video' ? `\n\nFull video: ${parentUrl}` : '';
  const description =
    lf(m.description ?? packaged) + (m.descriptionAppend ? `\n\n${lf(m.descriptionAppend)}` : '') + link;
  const thumbnail = m.thumbnail
    ? { file: m.thumbnail.file, sha: m.thumbnail.sha }
    : rp.thumbnailSha
      ? { file: at('video/review/thumbnail.png'), sha: rp.thumbnailSha }
      : null;
  const captions =
    rp.captionsSha && (!output.source || nested) // the package's captions are timed for its own video, never a derivative's
      ? { file: at(`video/review/captions.en.srt`), sha: rp.captionsSha, language: m.language ?? 'en' }
      : null;
  const text = {
    title: m.title ?? rp.title,
    description,
    tags: m.tags ?? rp.tags ?? [],
    category: m.category,
    language: m.language,
    playlist: m.playlist,
  };
  return {
    file: nested ? `${nested}/video/review/${rp.mp4}` : (output.source ?? rel(`video/review/${rp.mp4}`)),
    ...text,
    thumbnail,
    captions,
    sha: sha(toJson({ ...text, thumbnail: thumbnail?.sha ?? null, captions: captions?.sha ?? null })),
  };
}

// ---- verbs (what `npm run publish` does) ------------------------------------------------------------------------

export interface VerbResult {
  event: PublishEvent | null;
  existing: boolean; // the key was already in the ledger: nothing written
  message: string;
}
interface VerbArgs {
  output?: string;
  by: string;
  root?: string;
  now?: Date;
}
const YOUTUBE_ID = /^[\w-]{11}$/;

/** The ledger (or a fresh one), the output, the build and the metadata the verbs judge; refuses a follow-up story. */
export function openOutput(topic: string, storyId: string, a: { output?: string; root?: string }) {
  const root = a.root ?? ROOT;
  // A Short's ledger entry is the output short:<slug> in its parent's publish.json.
  const short = shortOf(storyId);
  if (short) {
    storyId = short.parent;
    a = { ...a, output: a.output ?? `short:${short.slug}` };
  }
  const story = readJson<StoriesFile>(join(topicDir(topic, root), 'stories.json'))?.stories.find(
    (s) => s.id === storyId,
  );
  if (story?.partOf)
    throw new Refusal(`${storyId} is a follow-up in ${story.partOf}; its video is that story's, record it there`);
  const dir = scriptDir(topic, storyId, root);
  if (!existsSync(dir)) throw new Refusal(`no script directory for ${topic} ${storyId}`);
  const path = publishPath(topic, storyId, root);
  const ledger = loadLedger(topic, storyId, root) ?? emptyLedger(`${topic}/${storyId}`);
  const id = a.output ?? 'youtube';
  const out = ledger.outputs[id];
  if (!out) throw new Refusal(`no output ${id} (outputs: ${Object.keys(ledger.outputs).join(', ')}); add it first`);
  const rel = (f: string) => `topics/${topic}/scripts/${storySlug(storyId)}/${f}`;
  const build = out.source ? sourceBuild(root, out.source) : currentBuild(dir);
  const metadata = uploadMetadataOf(dir, rel, out, parentUrlOf(ledger, out), root);
  // a derivative (a Short) goes live only after the output it derives from
  const parentLive = out.derivedFrom ? parentUrlOf(ledger, out) !== null : true;
  const state = outputState(out, build, metadata?.sha ?? null, {
    topic,
    story: storyId,
    output: id,
    parentLive,
    title: metadata?.title ?? null,
  });
  return { root, topic, story: storyId, dir, path, ledger, id, out, rel, build, metadata, state, parentLive };
}
function write(o: ReturnType<typeof openOutput>, e: PublishEvent, then?: (l: Ledger) => Ledger): VerbResult {
  const r = appendEvent(o.ledger, o.id, e);
  if (r.existing) return { event: r.existing, existing: true, message: `already recorded: ${describe(r.existing)}` };
  saveLedger(o.path, then ? then(r.ledger) : r.ledger);
  return { event: e, existing: false, message: `recorded ${describe(e)}` };
}
const describe = (e: PublishEvent) =>
  `${e.type}${e.id ? ` ${e.id}` : ''}${e.build ? ` (build ${e.build})` : ''} at ${e.at} by ${e.by}`;
const stamp = (a: { now?: Date }) => (a.now ?? new Date()).toISOString();

export function recordUploaded(
  topic: string,
  storyId: string,
  // captionsSent: the package's captions went up with the upload (a Studio upload recorded by hand)
  a: VerbArgs & { id: string; url?: string; visibility?: Visibility; captions?: string; captionsSent?: boolean },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (o.out.kind.startsWith('youtube') && !YOUTUBE_ID.test(a.id)) {
    const m = /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(a.id);
    throw new Refusal(`not a YouTube video id: ${a.id}${m ? `; did you mean ${m[1]}?` : ''}`);
  }
  if (!o.build || !o.metadata)
    throw new Refusal(
      o.out.source ? `${o.out.source} is not on disk` : 'no review package to upload; npm run video -- package first',
    );
  const mp4 = join(o.dir, 'video', 'review', o.metadata.file!.split('/').pop()!);
  if (!o.out.source && existsSync(mp4) && sha(readFileSync(mp4)) !== o.build.sha)
    throw new Refusal(`${o.metadata.file} is not the build review.json describes (${o.build.sha}); package again`);
  const visibility = a.visibility ?? 'private';
  if (!['private', 'unlisted', 'public'].includes(visibility))
    throw new Refusal(`--visibility ${visibility}: private, unlisted or public`);
  if (visibility === 'public' && o.build.status === 'draft')
    throw new Refusal('a draft build (edge voice) never goes public; npm run video -- final makes the release build');
  if (visibility === 'public') {
    if (!approvalHolds(o.out.events, o.build.sha, o.metadata.title))
      throw new Refusal(
        `build ${o.build.sha} is not approved under the title "${o.metadata.title}"; a public upload needs npm run publish -- approve first`,
      );
    const problem = goLiveProblem(o, a.by, o.build.status);
    if (problem) throw new Refusal(problem);
  }
  if (a.captionsSent && !a.captions && !o.metadata.captions)
    throw new Refusal('the package has no captions; upload without --captions');
  const at = stamp(a);
  const e: PublishEvent = {
    at,
    type: 'uploaded',
    by: a.by,
    build: o.build.sha,
    buildStatus: o.build.status,
    metadata: o.metadata.sha,
    id: a.id,
    visibility,
  };
  if (a.url) e.url = a.url;
  const captions = a.captions ?? (a.captionsSent ? o.metadata.captions?.sha : undefined);
  if (captions) e.captions = captions;
  return write(o, e, (l) =>
    visibility === 'public'
      ? appendEvent(l, o.id, { at, type: 'published', by: a.by, id: a.id, ...(a.url ? { url: a.url } : {}) }).ledger
      : l,
  );
}

export function recordApproved(
  topic: string,
  storyId: string,
  a: VerbArgs & { note?: string; build?: string; accepted?: boolean; checked?: number },
): VerbResult {
  const problem = approverProblem(a.by);
  if (problem) throw new Refusal(problem.replace('--approved-by', '--by'));
  // publication is authorised by a person: an automated run may lock a script, never approve a build
  if (a.by.trim().startsWith('automated:'))
    throw new Refusal('a build is approved by a person, never by an automated run');
  const o = openOutput(topic, storyId, a);
  if (a.checked !== undefined) {
    const list = reviewJsonOf(o)?.checklist ?? [];
    if (a.checked < list.length)
      throw new Refusal(
        `${a.checked} of ${list.length} checklist items ticked; every one is needed to approve (tick them on the review page, or pass --checked ${list.length} after going through video/review/checklist.md)`,
      );
  }
  // a generic output (blog post, page, post) is approved as its source file: that file's sha stands in for the build
  const generic = flowOf(o.out.kind) === 'generic';
  if (a.accepted && !a.build)
    throw new Refusal('accept-draft names the draft build (--build <sha>); nothing is accepted by default');
  const build = a.build ?? o.build?.sha ?? (generic ? 'none' : undefined);
  if (!build) throw new Refusal('nothing to approve: no review package, no source file and no build named');
  const uploaded = o.out.events.findLast((e) => e.type === 'uploaded' && e.build === build);
  const onDisk = o.build?.sha === build ? o.build : null;
  if (a.accepted) acceptedProblem(o, build, uploaded);
  // `accepted` is `npm run video -- final` naming the draft it accepted; nobody else approves a draft (edge voice)
  if (!a.accepted && (uploaded?.buildStatus === 'draft' || onDisk?.status === 'draft'))
    throw new Refusal(
      `build ${build} is a draft (edge voice): a draft is accepted by npm run video -- final, never approved for publication`,
    );
  // the approval is given to the current look: a build on disk drawn with an older kit or theme is drawn again first
  if (onDisk && !a.accepted) {
    const problem = lookProblem(o);
    if (problem) throw new Refusal(problem);
  }
  const localRelease = onDisk?.status === 'release';
  if (!generic && !a.accepted && !uploaded && !localRelease)
    throw new Refusal(
      `build ${build} has no upload to approve and is not the release build on disk; upload it first (a draft is accepted by npm run video -- final)`,
    );
  const e: PublishEvent = { at: stamp(a), type: 'approved', by: a.by, build };
  if (o.metadata?.title) e.title = o.metadata.title;
  if (uploaded?.id) e.id = uploaded.id;
  if (a.note) e.note = a.note;
  return write(o, e);
}

/** Why `npm run publish -- accept-draft` refuses before recording, or null: the `--by` name (a person, never
 *  `automated:`), the `--build` sha (the mp4
 *  sha as review.json records it), then, once the output is open, an output already approved for publication (live,
 *  scheduled, or its release build on disk approved). `o` is null when only the arguments are checked. */
export function acceptDraftProblem(by: string, build: string, o: ReturnType<typeof openOutput> | null): string | null {
  const problem = approverProblem(by);
  if (problem) return problem.replace('--approved-by', '--by');
  if (by.trim().startsWith('automated:'))
    return 'a draft is accepted by a person; an automated run never records an acceptance';
  if (!/^[0-9a-f]{6,64}$/.test(build))
    return `--build needs the draft's mp4 sha as review.json records it${build ? `, not ${build}` : ''}`;
  if (!o) return null;
  const why = o.state.live
    ? 'it is live'
    : o.state.status === 'scheduled'
      ? 'it is scheduled'
      : o.build?.status === 'release' && approvalHolds(o.out.events, o.build.sha, o.metadata?.title ?? null)
        ? `the release build ${o.build.sha} is approved`
        : null;
  return why
    ? `${o.id} is already approved for publication (${why}); a draft acceptance after that is meaningless`
    : null;
}

/** Refuses a draft acceptance unless `build` is the draft-voice build the build on disk replaced: its build report's
 *  `replaces`, with narration that was not publishable (how `video final` names the draft it accepted, after the
 *  release build took its place). A draft is a draft voice, never a review.json label: a label flips to release when
 *  music is cleared under the same sha, a draft voice never does (release re-narrates). So an accepted build can never
 *  be the one published, and every public path refuses a draft build. Generic outputs have no draft. */
function acceptedProblem(o: ReturnType<typeof openOutput>, build: string, uploaded?: PublishEvent): void {
  if (flowOf(o.out.kind) === 'generic')
    throw new Refusal(
      `a ${o.out.kind} output has no draft build; it is approved as its source file by npm run publish -- approve`,
    );
  const report = readJson<BuildSummary>(join(videoDirOf(o), 'build-report.json'));
  const replaces = report?.replaces;
  const onDisk = o.build?.sha === build;
  if (
    (onDisk && (o.build!.status === 'release' || report?.narration.publishable !== false)) ||
    uploaded?.buildStatus === 'release' ||
    (replaces?.sha === build && replaces.narrationPublishable !== false)
  )
    throw new Refusal(
      `build ${build} was narrated under commercial terms; it is approved for publication by npm run publish -- approve, never accepted as a draft`,
    );
  if (!onDisk && replaces?.sha === build) return; // the draft voice final replaced
  throw new Refusal(
    `build ${build} is not the draft the current build replaced (${replaces?.sha ?? 'none'}); a draft is accepted by npm run video -- final`,
  );
}

/** The output's video folder (a Short's own, in its folder). */
export const videoDirOf = (o: ReturnType<typeof openOutput>) => {
  const nested = nestedSource(o.root, o.out);
  return join(nested ? join(o.root, nested) : o.dir, 'video');
};
/** Why the output's build on disk is not drawn with the current look (src/shared/look.ts), with the step that draws it
 *  again; null when it is, or for an output without a build report (a generic one). */
export function lookProblem(o: ReturnType<typeof openOutput>): string | null {
  const why = lookStale(readJson<BuildSummary>(join(videoDirOf(o), 'build-report.json')), o.topic, o.root);
  if (!why) return null;
  const target = o.id.startsWith('short:') ? shortId(o.story, o.id.slice(6)) : o.story;
  return `build ${o.build?.sha ?? 'on disk'} ${why}; npm run video -- final ${o.topic} ${target} --approved-by "<your name>" draws it again`;
}
/** The output's review package, or null. */
const reviewJsonOf = (o: ReturnType<typeof openOutput>) =>
  readJson<{ checklist?: string[] }>(join(videoDirOf(o), 'review', 'review.json'));

/** A person sends the current build back with notes; a later approval of the same build (or a new build) moves on. */
export function recordChangesRequested(
  topic: string,
  storyId: string,
  a: VerbArgs & { build: string; notes: ReviewNote[] },
): VerbResult {
  const problem = approverProblem(a.by);
  if (problem || a.by.trim().startsWith('automated:'))
    throw new Refusal('a change request needs a person’s name (--by)');
  const notes = a.notes.filter((n) => n.text?.trim());
  if (!notes.length) throw new Refusal('a change request needs at least one note');
  const o = openOutput(topic, storyId, a);
  if (!o.build || o.build.sha !== a.build)
    throw new Refusal(`build ${a.build} is not the current build (${o.build?.sha ?? 'none'}); reload and review it`);
  if (o.state.live) throw new Refusal(`${o.id} is live; a re-release is a new output (npm run publish -- add)`);
  if (o.state.status === 'scheduled')
    throw new Refusal(`${o.id} is scheduled on YouTube; unschedule it in YouTube Studio first, then record it`);
  return write(o, { at: stamp(a), type: 'changes-requested', by: a.by, build: a.build, notes });
}

/** Why `o` may not go public or be scheduled by `by`, or null: only a person does it, never with a draft upload (edge
 *  voice), and a derivative (a Short) only after the output it derives from is live. go-live asks before calling YouTube. */
export function goLiveProblem(
  o: ReturnType<typeof openOutput>,
  by: string,
  buildStatus?: 'draft' | 'release', // the build about to go public (a public upload), else the last upload's
): string | null {
  if (by.trim().startsWith('automated:')) return 'an output goes live by a person, never by an automated run';
  if ((buildStatus ?? o.out.events.findLast((e) => e.type === 'uploaded')?.buildStatus) === 'draft')
    return 'the upload is a draft build (edge voice); npm run video -- final makes the release build';
  if (!o.parentLive) return `${o.id} derives from ${o.out.derivedFrom}: publish ${o.out.derivedFrom} first`;
  // a kit or theme redrawn since the approval: the build is drawn again before it goes public (a scheduled one has)
  if (o.state.status !== 'scheduled') return lookProblem(o);
  return null;
}
const refuseGoLive = (o: ReturnType<typeof openOutput>, by: string) => {
  const problem = goLiveProblem(o, by);
  if (problem) throw new Refusal(problem);
};

export function recordScheduled(topic: string, storyId: string, a: VerbArgs & { at: string }): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (o.state.status !== 'approved' && o.state.status !== 'scheduled')
    throw new Refusal(`the upload is ${o.state.status}, not approved: ${o.state.next}`);
  refuseGoLive(o, a.by);
  const t = Date.parse(a.at);
  if (Number.isNaN(t)) throw new Refusal(`--at ${a.at} is not an ISO date`);
  if (t <= (a.now ?? new Date()).getTime()) throw new Refusal(`--at ${a.at} is in the past`);
  return write(o, { at: stamp(a), type: 'scheduled', by: a.by, id: o.state.id!, publishAt: a.at });
}

export function recordPublished(
  topic: string,
  storyId: string,
  a: VerbArgs & { url?: string; id?: string; observed?: boolean }, // observed: sync read it back public, a fact to record
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (o.state.status !== 'approved' && o.state.status !== 'scheduled')
    throw new Refusal(`the output is ${o.state.status}, not approved or scheduled: ${o.state.next}`);
  if (!a.observed) refuseGoLive(o, a.by);
  // a generic output has no platform id of its own: the url (or the output id) names what went live
  const id = o.state.id ?? a.id ?? a.url ?? o.id;
  const e: PublishEvent = { at: stamp(a), type: 'published', by: a.by, id };
  if (a.url) e.url = a.url;
  return write(o, e);
}

export function recordUpdated(
  topic: string,
  storyId: string,
  a: VerbArgs & { fields: string[]; captions?: string },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (!o.state.id) throw new Refusal('nothing uploaded yet; there is nothing on YouTube to update');
  if (!o.metadata) throw new Refusal('no review package; the metadata cannot be composed');
  const sent = lastSent(o.out);
  // unchanged text is nothing new unless captions landed that the video did not have, or a verification found it missing
  const captionsNew = !!a.captions && (a.captions !== lastCaptions(o.out) || captionsDue(o.out));
  // a status resent for a restriction is new too, so the verification that asked for it is answered
  if (
    sent?.metadata === o.metadata.sha &&
    !failedSince(o.out, METADATA_CHECKS) &&
    !captionsNew &&
    !a.fields.includes('status')
  )
    return { event: sent, existing: true, message: `the metadata is unchanged since ${describe(sent)}` };
  return write(o, {
    at: stamp(a),
    type: 'updated',
    by: a.by,
    id: o.state.id,
    metadata: o.metadata.sha,
    fields: a.fields,
    ...(a.captions ? { captions: a.captions } : {}),
  });
}

export function recordVerified(
  topic: string,
  storyId: string,
  a: VerbArgs & { result: Verdict; checks: LedgerCheck[] },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (!o.state.id) throw new Refusal('nothing uploaded; there is nothing on YouTube to verify');
  const e: PublishEvent = {
    at: stamp(a),
    type: 'verified',
    by: a.by,
    id: o.state.id,
    result: a.result,
    checks: a.checks,
  };
  if (o.state.uploadedBuild) e.build = o.state.uploadedBuild;
  if (o.metadata?.sha) e.metadata = o.metadata.sha;
  return write(o, e);
}

export function recordFailed(
  topic: string,
  storyId: string,
  a: VerbArgs & { step: string; error: string; retryable?: boolean },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  const e: PublishEvent = { at: stamp(a), type: 'failed', by: a.by, step: a.step, error: a.error };
  if (a.retryable !== undefined) e.retryable = a.retryable;
  if (o.state.id) e.id = o.state.id;
  return write(o, e);
}

export function recordSimple(
  topic: string,
  storyId: string,
  type: 'unpublished' | 'retracted',
  a: VerbArgs & { note: string },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (!a.note) throw new Refusal(`${type} needs --note`);
  if (type === 'unpublished' && !o.state.id) throw new Refusal('nothing uploaded, nothing to unpublish');
  const e: PublishEvent = { at: stamp(a), type, by: a.by, note: a.note };
  if (o.state.id) e.id = o.state.id;
  return write(o, e);
}

/** Records a person's thumbnail as the output's: repo-relative path and sha (the file itself is gitignored). */
export function setThumbnail(
  topic: string,
  storyId: string,
  a: { output?: string; file: string; root?: string },
): string {
  const o = openOutput(topic, storyId, a);
  const abs = resolve(a.file);
  if (!existsSync(abs)) throw new Refusal(`${a.file} does not exist`);
  if (!/\.(png|jpe?g)$/i.test(abs)) throw new Refusal(`${a.file} is not a PNG or JPEG`);
  const inside = relative(o.dir, abs);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw new Refusal(`${a.file} is outside ${o.rel('')}; put it under video/publish/`);
  const thumbSha = sha(readFileSync(abs));
  const out: Output = {
    ...o.out,
    metadata: { ...o.out.metadata, thumbnail: { file: o.rel(inside.replaceAll('\\', '/')), sha: thumbSha } },
  };
  saveLedger(o.path, { ...o.ledger, outputs: { ...o.ledger.outputs, [o.id]: out } });
  return thumbSha;
}

export function addOutputTo(
  topic: string,
  storyId: string,
  id: string,
  kind: string,
  opts: { derivedFrom?: string; source?: string; root?: string } = {},
): void {
  const o = openOutput(topic, storyId, { root: opts.root });
  if (opts.source && !existsSync(join(o.root, opts.source)))
    throw new Refusal(`--source ${opts.source} is not a file under the repo root`);
  saveLedger(o.path, addOutput(o.ledger, id, kind, opts));
}
