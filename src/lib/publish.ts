// The publishing ledger: topics/<topic>/scripts/<slug>/publish.json, the one record of what publishing adds and no
// artifact records. Per output (the YouTube video, a short, a blog post, ...) an append-only event log and a person's
// metadata choices. Events are written only by `npm run publish` (scripts/publish.ts); `metadata` may be hand-edited.
// Builds are named by the mp4 sha the QA checked, upload metadata by the sha of the composed text and thumbnail sha, so
// nothing new is versioned here. Library layer: it reads video/review/review.json by path and never imports src/video/.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { lf, readJson, ROOT, sha, toJson } from './io';
import { approverProblem } from './release';
import { scriptDir, storySlug } from './script';
import { loadStories } from './stories';

export const PUBLISH_FILE = 'publish.json';
export const EVENT_TYPES = [
  'uploaded',
  'approved',
  'scheduled',
  'published',
  'unpublished',
  'updated',
  'failed',
  'retracted',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
/** Known kinds; any string is allowed, unknown kinds get the generic flow. */
export const KNOWN_KINDS = ['youtube-video', 'youtube-short', 'blog-post', 'web-page', 'post'] as const;
export type Visibility = 'private' | 'unlisted' | 'public';

export interface PublishEvent {
  at: string; // ISO
  type: EventType;
  by: string;
  build?: string; // mp4 sha (uploaded, approved)
  buildStatus?: 'draft' | 'release';
  metadata?: string; // composed upload metadata sha (uploaded, updated)
  id?: string; // the platform's id
  url?: string;
  visibility?: Visibility;
  publishAt?: string; // ISO (scheduled)
  fields?: string[]; // updated
  step?: string; // failed
  error?: string; // failed
  retryable?: boolean; // failed
  note?: string;
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
  scheduled: ['id', 'publishAt'],
  published: ['id'],
  unpublished: ['id', 'note'],
  updated: ['id', 'metadata', 'fields'],
  failed: ['step', 'error'],
  retracted: ['note'],
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
      for (const k of REQUIRED[e.type as EventType])
        if (e[k] === undefined || e[k] === '') out.push(`${where}.${k}: ${e.type} needs it`);
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
      return `approved|${e.build}`;
    case 'scheduled':
      return `scheduled|${e.id}|${e.publishAt}`;
    case 'published':
    case 'unpublished':
      return `${e.type}|${e.id}`; // judged against the latest of the two for that id, see appendEvent
    case 'updated':
      return null; // recordUpdated refuses an unchanged sha; A, B, A is three honest events
    case 'retracted':
      return 'retracted';
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
    const latest = [...o.events]
      .reverse()
      .find((x) => (x.type === 'published' || x.type === 'unpublished') && x.id === e.id);
    existing = latest?.type === e.type ? latest : null;
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
  if (existsSync(tmp)) throw new Error(`${tmp} still exists after rename`);
}

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

/** An output made from its own file (a short, a post): that file is its build. Null when the file is not on disk. */
export function sourceBuild(root: string, source: string): Build | null {
  const abs = join(root, source);
  return existsSync(abs) ? { sha: sha(readFileSync(abs)), status: 'release' } : null;
}

export type OutputStatus =
  | 'not-uploaded'
  | 'uploaded'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'metadata-behind'
  | 'build-behind'
  | 'retracted';
export interface OutputState {
  status: OutputStatus;
  live: boolean; // published and not since unpublished, whatever else the status says (metadata-behind keeps it live)
  failed: PublishEvent | null; // an overlay: the last event, when it is a failure
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
  const last = ev.at(-1) ?? null;
  const failed = last?.type === 'failed' ? last : null;
  const uploads = ev.filter((e) => e.type === 'uploaded');
  const upload = uploads.at(-1) ?? null;
  const id = upload?.id ?? null;
  const approved = !!upload && ev.some((e) => e.type === 'approved' && e.build === upload.build);
  const localApproved = !!build && ev.some((e) => e.type === 'approved' && e.build === build.sha);
  // an unpublish closes a chapter: the schedule and publication before it are history
  const cut = id ? ev.findLastIndex((e) => e.type === 'unpublished' && e.id === id) : -1;
  const since = ev.slice(cut + 1);
  const scheduled = id ? since.filter((e) => e.type === 'scheduled' && e.id === id).at(-1) : undefined;
  const published = id ? since.filter((e) => e.type === 'published' && e.id === id).at(-1) : undefined;
  const generic = flowOf(output.kind) === 'generic';
  const out = generic ? [...ev].reverse().find((e) => e.type === 'published' || e.type === 'unpublished') : undefined;
  const live = generic ? out?.type === 'published' : !!published;
  const url =
    [...ev].reverse().find((e) => e.url && (e.id === id || !id))?.url ?? (id ? `https://youtu.be/${id}` : null);
  const sentSha = [...ev]
    .reverse()
    .find((e) => (e.type === 'uploaded' || e.type === 'updated') && e.metadata)?.metadata;
  const base: Omit<OutputState, 'status' | 'next' | 'due'> = {
    live,
    failed,
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
  if (build && build.sha !== upload.build)
    return done(
      'build-behind',
      `a new ${build.status} build ${build.sha} is packaged (uploaded: ${upload.build}), then ${verb('upload')}`,
    );
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
        : `watch ${url} with video/review/checklist.md, then ${verb('approve', ' --by "<name>"')}`,
    );
  }
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
  if (metadataSha && sentSha && metadataSha !== sentSha) return done('metadata-behind', behind);
  return done('approved', verb('go-live', ' [--at <ISO>]'));
}

/** Every output's state, derivatives gated on the output they derive from being live. */
export function outputStates(
  ledger: Ledger,
  build: Build | null,
  metadataShaOf: (id: string, o: Output) => string | null,
  ctx: { topic: string; story: string; now?: Date; root?: string },
): Record<string, OutputState> {
  const states: Record<string, OutputState> = {};
  const { root = ROOT, ...rest } = ctx;
  const state = (id: string, parentLive?: boolean) => {
    const o = ledger.outputs[id];
    const b = o.source ? sourceBuild(root, o.source) : build;
    return outputState(o, b, metadataShaOf(id, o), { ...rest, output: id, parentLive });
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
  files?: string[];
}
/** The parent output's live url for a derivative (its description links the full video), else null. */
export function parentUrlOf(ledger: Ledger, output: Output): string | null {
  const parent = output.derivedFrom ? ledger.outputs[output.derivedFrom] : null;
  if (!parent) return null;
  const last = [...parent.events].reverse().find((e) => e.type === 'published' || e.type === 'unpublished');
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
): UploadMetadata | null {
  const review = join(dir, 'video', 'review');
  const rp = readJson<ReviewJson>(join(review, 'review.json'));
  if (!rp) return null;
  const desc = join(review, 'description.txt');
  const m = output.metadata;
  const packaged = existsSync(desc) ? lf(readFileSync(desc, 'utf8')).trim() : '';
  const link = parentUrl && output.derivedFrom && output.kind !== 'youtube-video' ? `\n\nFull video: ${parentUrl}` : '';
  const description =
    lf(m.description ?? packaged) + (m.descriptionAppend ? `\n\n${lf(m.descriptionAppend)}` : '') + link;
  const thumbnail = m.thumbnail
    ? { file: m.thumbnail.file, sha: m.thumbnail.sha }
    : rp.thumbnailSha
      ? { file: rel('video/review/thumbnail.png'), sha: rp.thumbnailSha }
      : null;
  const captions = rp.captionsSha
    ? { file: rel(`video/review/captions.en.srt`), sha: rp.captionsSha, language: m.language ?? 'en' }
    : null;
  const text = {
    title: m.title ?? rp.title,
    description,
    tags: m.tags ?? [],
    category: m.category,
    language: m.language,
    playlist: m.playlist,
  };
  return {
    file: output.source ?? rel(`video/review/${rp.mp4}`),
    ...text,
    thumbnail,
    captions,
    sha: sha(toJson({ ...text, thumbnail: thumbnail?.sha ?? null, captions: captions?.sha ?? null })),
  };
}

// ---- verbs (what `npm run publish` does) ------------------------------------------------------------------------

/** A verb the files do not support; the CLI prints the message and exits 2 without writing. */
export class Refusal extends Error {}
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
  const story = loadStories(topic, root)?.stories.find((s) => s.id === storyId);
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
  const metadata = uploadMetadataOf(dir, rel, out, parentUrlOf(ledger, out));
  const state = outputState(out, build, metadata?.sha ?? null, { topic, story: storyId, output: id });
  return { root, dir, path, ledger, id, out, rel, build, metadata, state };
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
  a: VerbArgs & { id: string; url?: string; visibility?: Visibility },
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
  const approved = o.out.events.some((e) => e.type === 'approved' && e.build === o.build!.sha);
  if (visibility === 'public' && !approved)
    throw new Refusal(`build ${o.build.sha} is not approved; a public upload needs npm run publish -- approve first`);
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
  return write(o, e, (l) =>
    visibility === 'public'
      ? appendEvent(l, o.id, { at, type: 'published', by: a.by, id: a.id, ...(a.url ? { url: a.url } : {}) }).ledger
      : l,
  );
}

export function recordApproved(
  topic: string,
  storyId: string,
  a: VerbArgs & { note?: string; build?: string; accepted?: boolean },
): VerbResult {
  const problem = approverProblem(a.by);
  if (problem) throw new Refusal(problem.replace('--approved-by', '--by'));
  const o = openOutput(topic, storyId, a);
  // a generic output (blog post, page, post) is approved as its source file: that file's sha stands in for the build
  const generic = flowOf(o.out.kind) === 'generic';
  const build = a.build ?? o.build?.sha ?? (generic ? 'none' : undefined);
  if (!build) throw new Refusal('nothing to approve: no review package, no source file and no build named');
  const uploaded = o.out.events.find((e) => e.type === 'uploaded' && e.build === build);
  const onDisk = o.build?.sha === build ? o.build : null;
  // `accepted` is `npm run video -- final` naming the draft it accepted; nobody else approves a draft (edge voice)
  if (!a.accepted && (uploaded?.buildStatus === 'draft' || onDisk?.status === 'draft'))
    throw new Refusal(
      `build ${build} is a draft (edge voice): a draft is accepted by npm run video -- final, never approved for publication`,
    );
  const localRelease = onDisk?.status === 'release';
  if (!generic && !a.accepted && !uploaded && !localRelease)
    throw new Refusal(
      `build ${build} has no upload to approve and is not the release build on disk; upload it first (a draft is accepted by npm run video -- final)`,
    );
  const e: PublishEvent = { at: stamp(a), type: 'approved', by: a.by, build };
  if (uploaded?.id) e.id = uploaded.id;
  if (a.note) e.note = a.note;
  return write(o, e);
}

/** The last upload's build status: a draft (edge voice) is never scheduled or published. */
const refuseDraft = (o: ReturnType<typeof openOutput>) => {
  if ([...o.out.events].reverse().find((e) => e.type === 'uploaded')?.buildStatus === 'draft')
    throw new Refusal('the upload is a draft build (edge voice); npm run video -- final makes the release build');
};

export function recordScheduled(topic: string, storyId: string, a: VerbArgs & { at: string }): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (o.state.status !== 'approved' && o.state.status !== 'scheduled')
    throw new Refusal(`the upload is ${o.state.status}, not approved: ${o.state.next}`);
  refuseDraft(o);
  const t = Date.parse(a.at);
  if (Number.isNaN(t)) throw new Refusal(`--at ${a.at} is not an ISO date`);
  if (t <= (a.now ?? new Date()).getTime()) throw new Refusal(`--at ${a.at} is in the past`);
  return write(o, { at: stamp(a), type: 'scheduled', by: a.by, id: o.state.id!, publishAt: a.at });
}

export function recordPublished(
  topic: string,
  storyId: string,
  a: VerbArgs & { url?: string; id?: string },
): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (o.state.status !== 'approved' && o.state.status !== 'scheduled')
    throw new Refusal(`the output is ${o.state.status}, not approved or scheduled: ${o.state.next}`);
  refuseDraft(o);
  // a generic output has no platform id of its own: the url (or the output id) names what went live
  const id = o.state.id ?? a.id ?? a.url ?? o.id;
  const e: PublishEvent = { at: stamp(a), type: 'published', by: a.by, id };
  if (a.url) e.url = a.url;
  return write(o, e);
}

export function recordUpdated(topic: string, storyId: string, a: VerbArgs & { fields: string[] }): VerbResult {
  const o = openOutput(topic, storyId, a);
  if (!o.state.id) throw new Refusal('nothing uploaded yet; there is nothing on YouTube to update');
  if (!o.metadata) throw new Refusal('no review package; the metadata cannot be composed');
  const sent = [...o.out.events].reverse().find((e) => (e.type === 'uploaded' || e.type === 'updated') && e.metadata);
  if (sent?.metadata === o.metadata.sha)
    return { event: sent, existing: true, message: `the metadata is unchanged since ${describe(sent)}` };
  return write(o, {
    at: stamp(a),
    type: 'updated',
    by: a.by,
    id: o.state.id,
    metadata: o.metadata.sha,
    fields: a.fields,
  });
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
