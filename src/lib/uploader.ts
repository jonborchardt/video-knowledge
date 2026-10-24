// The uploader verbs: what `npm run publish -- upload | push | go-live | sync` do between the ledger and YouTube.
// Each one reads the output's state, refuses what the files do not support, calls the client, and records through the
// ledger verbs in publish.ts, so a hand upload and an API upload leave the same events. `upload` is always private;
// `go-live` is the only path to public or a schedule, and it needs the ledger's `approved` for the uploaded build.
// A resumable upload session is kept in a gitignored file next to the media until the ledger has the id, so a crash
// or a quota refusal resumes the same YouTube video and never opens a second one. Library layer.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, sha, toJson } from './io';
import {
  type Output,
  type PublishEvent,
  Refusal,
  type UploadMetadata,
  type VerbResult,
  currentBuild,
  emptyLedger,
  loadLedger,
  outputState,
  recordFailed,
  recordPublished,
  recordScheduled,
  recordUpdated,
  recordUploaded,
  uploadMetadataOf,
} from './publish';
import { scriptDir, storySlug } from './script';
import { loadStories } from './stories';
import { type RemoteVideo, type Snippet, type YouTubeClient, YouTubeError } from './youtube';

export const SESSION_FILE = (output: string) =>
  output === 'youtube' ? 'video/upload-session.json' : `video/upload-session.${output}.json`;
export interface Session {
  build: string; // what the session uploads: the mp4 sha
  uri: string; // YouTube's resumable session URI
  startedAt: string;
}
export const CATEGORY_DEFAULT = '27'; // Education
export const LANGUAGE_DEFAULT = 'en';
export const MIN_SCHEDULE_LEAD_MS = 5 * 60_000; // a publishAt in the past publishes now; never "schedule" into that
const LIMITS = { title: 100, description: 5000, tags: 500 }; // YouTube's, 2026-10-23

export interface Ctx {
  output?: string;
  by: string;
  client: YouTubeClient;
  root?: string;
  now?: Date;
}

/** Why YouTube would reject the metadata, before any call; null when it fits. */
export function uploadProblem(m: Pick<UploadMetadata, 'title' | 'description' | 'tags'>): string | null {
  if (m.title.length > LIMITS.title)
    return `title is ${m.title.length} characters, YouTube allows ${LIMITS.title}: set metadata.title in publish.json`;
  if (/[<>]/.test(m.title)) return 'title contains < or >, which YouTube refuses';
  const bytes = Buffer.byteLength(m.description, 'utf8');
  if (bytes > LIMITS.description)
    return `description is ${bytes} bytes, YouTube allows ${LIMITS.description}: npm run video -- package writes one that fits`;
  const tagChars = m.tags.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), 0);
  if (tagChars > LIMITS.tags) return `tags are ${tagChars} characters together, YouTube allows ${LIMITS.tags}`;
  return null;
}

/** The ledger, output, build, composed metadata and state the verbs judge (publish.ts keeps its own `open`). */
function inspect(topic: string, storyId: string, c: { output?: string; root?: string }) {
  const root = c.root ?? ROOT;
  const story = loadStories(topic, root)?.stories.find((s) => s.id === storyId);
  if (story?.partOf) throw new Refusal(`${storyId} is a follow-up in ${story.partOf}; its video is that story's`);
  const dir = scriptDir(topic, storyId, root);
  if (!existsSync(dir)) throw new Refusal(`no script directory for ${topic} ${storyId}`);
  const ledger = loadLedger(topic, storyId, root) ?? emptyLedger(`${topic}/${storyId}`);
  const id = c.output ?? 'youtube';
  const out = ledger.outputs[id];
  if (!out) throw new Refusal(`no output ${id} (outputs: ${Object.keys(ledger.outputs).join(', ')}); add it first`);
  const rel = (f: string) => `topics/${topic}/scripts/${storySlug(storyId)}/${f}`;
  const build = currentBuild(dir);
  const metadata = uploadMetadataOf(dir, rel, out);
  const state = outputState(out, build, metadata?.sha ?? null, { topic, story: storyId, output: id });
  return { root, dir, ledger, id, out, rel, build, metadata, state };
}

const snippetOf = (m: UploadMetadata): Snippet => ({
  title: m.title,
  description: m.description,
  tags: m.tags,
  categoryId: m.category ?? CATEGORY_DEFAULT,
  defaultLanguage: m.language ?? LANGUAGE_DEFAULT,
});
const syntheticMedia = (out: Output) =>
  (out.metadata as { containsSyntheticMedia?: boolean }).containsSyntheticMedia ?? false;
const lastSentSha = (out: Output) =>
  [...out.events].reverse().find((e) => (e.type === 'uploaded' || e.type === 'updated') && e.metadata)?.metadata ??
  null;
const urlOf = (id: string) => `https://youtu.be/${id}`;

/** Runs one client call; a YouTubeError becomes a `failed` ledger event for `step` and is rethrown. */
async function guarded<T>(
  topic: string,
  storyId: string,
  c: Ctx,
  step: string,
  fn: () => Promise<T>,
  final?: (e: YouTubeError) => string | null, // a message that makes the failure a person's, not a retry
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof YouTubeError)) throw e;
    const custom = final?.(e) ?? null;
    recordFailed(topic, storyId, {
      output: c.output,
      by: c.by,
      root: c.root,
      now: c.now,
      step,
      error: custom ?? `${e.reason}: ${e.message}`,
      retryable: custom ? false : e.retryable,
    });
    throw e;
  }
}

/** Uploads the packaged build (or a derivative's source) as a private video, then its thumbnail and captions. One
 *  result per step done; a thumbnail or captions failure is recorded and the verb goes on. */
export async function upload(topic: string, storyId: string, c: Ctx): Promise<VerbResult[]> {
  const o = inspect(topic, storyId, c);
  if (o.state.status !== 'not-uploaded' && o.state.status !== 'build-behind')
    throw new Refusal(`${o.id} is ${o.state.status}: ${o.state.next}`);
  if (!o.metadata || !o.metadata.file || !o.build)
    throw new Refusal('no review package to upload; npm run video -- package first');
  const problem = uploadProblem(o.metadata);
  if (problem) throw new Refusal(problem);
  const file = join(o.root, o.metadata.file);
  if (!existsSync(file)) throw new Refusal(`${o.metadata.file} is missing on disk`);
  const fileSha = sha(readFileSync(file));
  if (!o.out.source && fileSha !== o.build.sha)
    throw new Refusal(
      `${o.metadata.file} is ${fileSha}, review.json says ${o.build.sha}; run npm run video -- package`,
    );
  const thumbnail = o.metadata.thumbnail ? join(o.root, o.metadata.thumbnail.file) : null;
  if (thumbnail && !existsSync(thumbnail))
    throw new Refusal(`${o.metadata.thumbnail!.file} is missing on disk; package again or set another thumbnail`);
  const captions = (o.metadata as { captions?: { file: string; sha: string; language: string } }).captions ?? null;
  if (captions && !existsSync(join(o.root, captions.file)))
    throw new Refusal(`${captions.file} is missing on disk; npm run video -- package writes it`);

  const sessionPath = join(o.dir, SESSION_FILE(o.id));
  const session = readJson<Session>(sessionPath);
  if (session && session.build !== fileSha)
    throw new Refusal(
      `${o.rel(SESSION_FILE(o.id))} is an unfinished upload of build ${session.build}, not ${fileSha}: finish it or delete the file`,
    );
  const results: VerbResult[] = [];
  const { id } = await guarded(
    topic,
    storyId,
    c,
    'upload',
    () =>
      c.client.insertVideo({
        file,
        snippet: snippetOf(o.metadata!),
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: syntheticMedia(o.out),
        },
        session: session?.uri ?? null,
        onSession: (uri) =>
          writeFileSync(sessionPath, toJson({ build: fileSha, uri, startedAt: (c.now ?? new Date()).toISOString() })),
      }),
    session
      ? (e) =>
          e.status === 404 || e.status === 410
            ? `upload session lost (${e.reason}): look for an upload titled "${o.metadata!.title}" in YouTube Studio and record it with npm run publish -- uploaded ${topic} ${storyId} --id <id>, or delete ${o.rel(SESSION_FILE(o.id))} to upload again`
            : null
      : undefined,
  );
  results.push(
    recordUploaded(topic, storyId, { output: c.output, by: c.by, root: c.root, now: c.now, id, visibility: 'private' }),
  );
  if (existsSync(sessionPath)) unlinkSync(sessionPath);

  const asset = async (step: string, fn: () => Promise<void>, done: string) => {
    try {
      await guarded(topic, storyId, c, step, fn);
      results.push({ event: null, existing: false, message: done });
    } catch (e) {
      if (!(e instanceof YouTubeError)) throw e;
      results.push({ event: lastEvent(topic, storyId, c), existing: false, message: `${step} failed: ${e.message}` });
    }
  };
  if (thumbnail) await asset('thumbnail', () => c.client.setThumbnail(id, thumbnail), 'thumbnail set');
  if (captions)
    await asset(
      'captions',
      () => c.client.insertCaptions(id, join(o.root, captions.file), captions.language, 'English'),
      'captions uploaded',
    );
  return results;
}
const lastEvent = (topic: string, storyId: string, c: Ctx): PublishEvent | null =>
  loadLedger(topic, storyId, c.root ?? ROOT)?.outputs[c.output ?? 'youtube']?.events.at(-1) ?? null;

/** Sends the composed metadata to YouTube when it changed since the last upload or update, then records it. */
export async function push(topic: string, storyId: string, c: Ctx): Promise<VerbResult> {
  const o = inspect(topic, storyId, c);
  if (!o.state.id) throw new Refusal(`${o.id} is ${o.state.status}; there is nothing on YouTube to update`);
  if (!o.metadata) throw new Refusal('no review package; the metadata cannot be composed');
  if (lastSentSha(o.out) === o.metadata.sha)
    return { event: null, existing: true, message: `the metadata on YouTube is current (${o.metadata.sha})` };
  const problem = uploadProblem(o.metadata);
  if (problem) throw new Refusal(problem);
  const id = o.state.id;
  const fields = ['snippet'];
  await guarded(topic, storyId, c, 'update', () => c.client.updateVideo(id, { snippet: snippetOf(o.metadata!) }));
  if (o.metadata.thumbnail) {
    const file = join(o.root, o.metadata.thumbnail.file);
    if (!existsSync(file)) throw new Refusal(`${o.metadata.thumbnail.file} is missing on disk`);
    await guarded(topic, storyId, c, 'thumbnail', () => c.client.setThumbnail(id, file));
    fields.push('thumbnail');
  }
  const captions = (o.metadata as { captions?: { file: string; language: string } }).captions;
  if (captions) {
    await guarded(topic, storyId, c, 'captions', () =>
      c.client.insertCaptions(id, join(o.root, captions.file), captions.language, 'English'),
    );
    fields.push('captions');
  }
  return recordUpdated(topic, storyId, { output: c.output, by: c.by, root: c.root, now: c.now, fields });
}

/** Makes the approved upload public now, or schedules it (private with a publishAt) for `at`. */
export async function goLive(topic: string, storyId: string, c: Ctx & { at?: string }): Promise<VerbResult> {
  const o = inspect(topic, storyId, c);
  if (o.state.status === 'scheduled' || o.state.status === 'published')
    return { event: null, existing: true, message: `${o.id} is already ${o.state.status}: ${o.state.next}` };
  if (o.state.status !== 'approved') throw new Refusal(`${o.id} is ${o.state.status}, not approved: ${o.state.next}`);
  const id = o.state.id!;
  if (c.at) {
    const t = Date.parse(c.at);
    if (Number.isNaN(t)) throw new Refusal(`--at ${c.at} is not an ISO date`);
    if (t - (c.now ?? new Date()).getTime() < MIN_SCHEDULE_LEAD_MS)
      throw new Refusal(`--at ${c.at} must be at least 5 minutes ahead; a past publishAt publishes immediately`);
    const at = new Date(t).toISOString();
    await guarded(topic, storyId, c, 'go-live', () =>
      c.client.updateVideo(id, { status: { privacyStatus: 'private', publishAt: at } }),
    );
    return recordScheduled(topic, storyId, { output: c.output, by: c.by, root: c.root, now: c.now, at });
  }
  await guarded(topic, storyId, c, 'go-live', () => c.client.updateVideo(id, { status: { privacyStatus: 'public' } }));
  return recordPublished(topic, storyId, { output: c.output, by: c.by, root: c.root, now: c.now, url: urlOf(id) });
}

/** Reads the video back: a rejection or a deletion is a final failure, a scheduled video gone public is recorded,
 *  anything else is returned for the CLI to print. */
export async function sync(topic: string, storyId: string, c: Ctx): Promise<VerbResult | RemoteVideo> {
  const o = inspect(topic, storyId, c);
  if (!o.state.id) throw new Refusal(`${o.id} is ${o.state.status}; nothing on YouTube to read`);
  const id = o.state.id;
  const v = await guarded(topic, storyId, c, 'sync', () => c.client.getVideo(id));
  const failed = (error: string) =>
    recordFailed(topic, storyId, {
      output: c.output,
      by: c.by,
      root: c.root,
      now: c.now,
      step: 'sync',
      error,
      retryable: false,
    });
  if (!v) return failed(`${id} is not on YouTube (deleted?); a person decides`);
  if (v.uploadStatus === 'rejected') return failed(`rejected: ${v.rejectionReason ?? 'no reason given'}`);
  if (v.privacyStatus === 'public' && (o.state.status === 'scheduled' || o.state.status === 'approved'))
    return recordPublished(topic, storyId, { output: c.output, by: c.by, root: c.root, now: c.now, url: urlOf(id) });
  return v;
}
