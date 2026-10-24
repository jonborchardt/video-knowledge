// The publishing ledger: topics/<topic>/scripts/<slug>/publish.json, the one record of what publishing adds and no
// artifact records. Per output (the YouTube video, a short, a blog post, ...) an append-only event log and a person's
// metadata choices. Events are written only by `npm run publish` (scripts/publish.ts); `metadata` may be hand-edited.
// Builds are named by the mp4 sha the QA checked, upload metadata by the sha of the composed text and thumbnail sha, so
// nothing new is versioned here. Library layer: it reads video/review/review.json by path and never imports src/video/.
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, ROOT, toJson } from './io';
import { scriptDir } from './script';

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
    case 'published':
    case 'unpublished':
      return `${e.type}|${e.id}`;
    case 'updated':
      return `updated|${e.metadata}`;
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
  const existing = key === null ? null : (o.events.find((x) => eventKey(x) === key) ?? null);
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
}

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
  const scheduled = id ? ev.filter((e) => e.type === 'scheduled' && e.id === id).at(-1) : undefined;
  const published = id
    ? ev.filter((e) => (e.type === 'published' || e.type === 'unpublished') && e.id === id).at(-1)
    : undefined;
  const live = published?.type === 'published';
  const url =
    [...ev].reverse().find((e) => e.url && (e.id === id || !id))?.url ?? (id ? `https://youtu.be/${id}` : null);
  const sentSha = [...ev]
    .reverse()
    .find((e) => (e.type === 'uploaded' || e.type === 'updated') && e.metadata)?.metadata;
  const base: Omit<OutputState, 'status' | 'next' | 'due'> = {
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
  const where = build ? `video/review/` : 'the review package (npm run video -- package, it is missing)';

  if (ev.some((e) => e.type === 'retracted')) return done('retracted', 'retracted; nothing to do');
  if (!upload) {
    if (localApproved)
      return done(
        'approved',
        `upload the approved release build in ${where} as public, then ${verb('uploaded', ' --id <id> --visibility public')}`,
      );
    return done(
      'not-uploaded',
      `upload the mp4 in ${where} privately, then ${verb('uploaded', ' --id <id> --visibility private')}`,
    );
  }
  if (live) {
    if (metadataSha && sentSha && metadataSha !== sentSha)
      return done(
        'metadata-behind',
        `the title, description, tags or thumbnail changed since the upload: update them on YouTube, then ${verb('updated', ' --fields <a,b>')}`,
      );
    const moved =
      build && build.sha !== upload.build
        ? `; the build on disk is ${build.sha}, a re-release is ${verb('add', ' youtube-2 --kind youtube-video')}`
        : '';
    return done('published', `live at ${url}${moved}`);
  }
  if (build && build.sha !== upload.build)
    return done(
      'build-behind',
      `a new ${build.status} build ${build.sha} is packaged (uploaded: ${upload.build}): upload it privately, then ${verb('uploaded', ' --id <id> --visibility private')}`,
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
        ? `was due ${scheduled.publishAt}: confirm it is live on YouTube and record published (${verb('published')})`
        : `scheduled for ${scheduled.publishAt}; nothing until then`,
      due,
    );
  }
  if (metadataSha && sentSha && metadataSha !== sentSha)
    return done(
      'metadata-behind',
      `the title, description, tags or thumbnail changed since the upload: update them on YouTube, then ${verb('updated', ' --fields <a,b>')}`,
    );
  return done(
    'approved',
    `set ${url} public or schedule it on YouTube, then ${verb('published')} or ${verb('scheduled', ' --at <ISO>')}`,
  );
}
