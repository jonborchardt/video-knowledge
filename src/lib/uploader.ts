// The uploader verbs: what `npm run publish -- upload | push | go-live | sync | verify` do between the ledger and YouTube.
// Each one reads the output's state, refuses what the files do not support, calls the client, and records through the
// ledger verbs in publish.ts, so a hand upload and an API upload leave the same events. `upload` is always private;
// `go-live` is the only path to public or a schedule, and it needs the ledger's `approved` for the uploaded build.
// A resumable upload session is kept in a gitignored file next to the media until the ledger has the id, so a crash
// or a quota refusal resumes the same YouTube video and never opens a second one. Library layer.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, sha, toJson } from '../shared/io';
import {
  type LedgerCheck,
  METADATA_CHECKS,
  type Output,
  type PublishEvent,
  Refusal,
  goLiveProblem,
  openOutput,
  type UploadMetadata,
  type VerbResult,
  loadLedger,
  recordFailed,
  recordPublished,
  recordScheduled,
  recordUpdated,
  recordUploaded,
  recordVerified,
  captionsDue,
  FIXABLE_RESTRICTION,
  failedSince,
  lastCaptions,
  lastSent,
} from './publish';
import { type Expected, expectedOf, verdictOf, verificationChecks } from './verify';
import {
  type RemoteCaption,
  type RemoteVideo,
  type Snippet,
  type VideoStatus,
  type YouTubeClient,
  YouTubeError,
  oembedStatus,
} from './youtube';

export const SESSION_FILE = (output: string) =>
  output === 'youtube' ? 'video/upload-session.json' : `video/upload-session.${output}.json`;
export interface Session {
  build: string; // what the session uploads: the mp4 sha
  uri: string; // YouTube's resumable session URI
  startedAt: string;
}
export const CATEGORY_DEFAULT = '27'; // Education
const LANGUAGE_DEFAULT = 'en';
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
  if (m.tags.some((t) => /[<>]/.test(t))) return 'a tag contains < or >, which YouTube refuses';
  // YouTube counts a space-holding tag with its quotes, and the comma between two tags
  const tagChars =
    m.tags.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, m.tags.length - 1);
  if (tagChars > LIMITS.tags) return `tags are ${tagChars} characters together, YouTube allows ${LIMITS.tags}`;
  return null;
}

const snippetOf = (m: UploadMetadata): Snippet => ({
  title: m.title,
  description: m.description,
  tags: m.tags,
  categoryId: m.category ?? CATEGORY_DEFAULT,
  defaultLanguage: m.language ?? LANGUAGE_DEFAULT,
});
/** Every status write carries the declarations and embedding: videos.update replaces the whole part it names, so a
 *  status with only privacyStatus would reset selfDeclaredMadeForKids, containsSyntheticMedia and embeddable (the
 *  matter page plays the video embedded). */
const statusOf = (out: Output): VideoStatus => ({
  privacyStatus: 'private',
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: out.metadata.containsSyntheticMedia ?? false,
  embeddable: true,
});
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
      ...c,
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
  const o = openOutput(topic, storyId, c);
  if (o.state.status === 'retracted' || (o.state.id && o.state.status !== 'build-behind'))
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
  const captions = o.metadata.captions;
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
        status: statusOf(o.out),
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
  // captions before the record, so the uploaded event names the captions that landed (push resends only new ones);
  // a failure is recorded after the upload
  let captionsError: YouTubeError | null = null;
  if (captions)
    try {
      await c.client.insertCaptions(id, join(o.root, captions.file), captions.language, 'English');
    } catch (e) {
      if (!(e instanceof YouTubeError)) throw e;
      captionsError = e;
    }
  const sent = captions && !captionsError ? captions.sha : undefined;
  results.push(recordUploaded(topic, storyId, { ...c, id, visibility: 'private', captions: sent }));
  if (existsSync(sessionPath)) unlinkSync(sessionPath);
  if (captionsError) {
    const f = recordFailed(topic, storyId, {
      ...c,
      step: 'captions',
      error: `${captionsError.reason}: ${captionsError.message}`,
      retryable: captionsError.retryable,
    });
    results.push({ event: f.event, existing: false, message: `captions failed: ${captionsError.message}` });
  } else if (captions) results.push({ event: null, existing: false, message: 'captions uploaded' });

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
  return results;
}
const lastEvent = (topic: string, storyId: string, c: Ctx): PublishEvent | null =>
  loadLedger(topic, storyId, c.root ?? ROOT)?.outputs[c.output ?? 'youtube']?.events.at(-1) ?? null;

/** Sends the composed metadata to YouTube when it changed since the last upload or update, then records it. */
export async function push(topic: string, storyId: string, c: Ctx): Promise<VerbResult> {
  const o = openOutput(topic, storyId, c);
  if (!o.state.id) throw new Refusal(`${o.id} is ${o.state.status}; there is nothing on YouTube to update`);
  if (!o.metadata) throw new Refusal('no review package; the metadata cannot be composed');
  // what a verification since the last send found missing is sent again, whatever the shas say
  const captionsCurrent =
    !o.metadata.captions || (o.metadata.captions.sha === lastCaptions(o.out) && !captionsDue(o.out));
  const restricted = failedSince(o.out, ['restrictions'], FIXABLE_RESTRICTION);
  if (
    lastSent(o.out)?.metadata === o.metadata.sha &&
    !failedSince(o.out, METADATA_CHECKS) &&
    captionsCurrent &&
    !restricted
  )
    return { event: null, existing: true, message: `the metadata on YouTube is current (${o.metadata.sha})` };
  const problem = uploadProblem(o.metadata);
  if (problem) throw new Refusal(problem);
  const id = o.state.id;
  const thumbnail = o.metadata.thumbnail ? join(o.root, o.metadata.thumbnail.file) : null;
  if (thumbnail && !existsSync(thumbnail)) throw new Refusal(`${o.metadata.thumbnail!.file} is missing on disk`);
  // captions.insert adds a track: send them only when they are not the ones YouTube already has
  const captions = captionsCurrent ? null : o.metadata.captions;
  await guarded(topic, storyId, c, 'update', () => c.client.updateVideo(id, { snippet: snippetOf(o.metadata!) }));
  // the snippet landed: record it even if an asset fails, so the board does not stay metadata-behind and resend it
  const landed = ['snippet'];
  const failures: { step: string; e: YouTubeError }[] = [];
  const asset = async (step: string, fn: () => Promise<void>) => {
    try {
      await fn();
      landed.push(step);
    } catch (e) {
      if (!(e instanceof YouTubeError)) throw e;
      failures.push({ step, e });
    }
  };
  if (thumbnail) await asset('thumbnail', () => c.client.setThumbnail(id, thumbnail));
  // a verification found a restriction (embedding off): send the status again, keeping the visibility and schedule
  // YouTube holds now (a schedule may have gone public since the ledger last looked)
  if (restricted)
    await asset('status', async () => {
      const now = await c.client.getVideo(id);
      if (!now) throw new YouTubeError(`video ${id} not found`, 404, 'videoNotFound', false);
      await c.client.updateVideo(id, {
        status: {
          ...statusOf(o.out),
          privacyStatus: now.privacyStatus as VideoStatus['privacyStatus'],
          ...(now.privacyStatus === 'private' && now.publishAt ? { publishAt: now.publishAt } : {}),
        },
      });
    });
  if (captions)
    await asset('captions', async () => {
      // a verification found no serving track: replace the ones not serving rather than pile up another
      // (captions.list and captions.delete, 50 units each, only on this path)
      if (captionsDue(o.out))
        for (const t of await c.client.listCaptions(id))
          if (t.trackKind.toLowerCase() === 'standard' && t.language === captions.language && t.status !== 'serving')
            await c.client.deleteCaptions(t.id);
      await c.client.insertCaptions(id, join(o.root, captions.file), captions.language, 'English');
    });
  const r = recordUpdated(topic, storyId, {
    ...c,
    fields: landed,
    captions: captions && landed.includes('captions') ? captions.sha : undefined,
  });
  for (const f of failures)
    recordFailed(topic, storyId, {
      ...c,
      step: f.step,
      error: `${f.e.reason}: ${f.e.message}`,
      retryable: f.e.retryable,
    });
  return r;
}

/** How long after a schedule's publishAt sync waits before calling a still-private video a failure. */
export const SCHEDULE_GRACE_MS = 15 * 60_000;
/** Why a video is not public after go-live (or its schedule), and the Studio route that gets it out. */
export const keptPrivate = (id: string, privacy: string): string =>
  `YouTube kept ${id} ${privacy} after go-live (an upload from an unaudited API project can be locked private): upload the same video/review file in YouTube Studio, record it with npm run publish -- uploaded --id <id> [--captions], approve it if it is not yet approved, then go live; if Studio shows ${id} public, npm run publish -- sync records it`;

/** Makes the approved upload public now, or schedules it (private with a publishAt) for `at`. Going public now is
 *  recorded only when the read-back says public: YouTube can keep an upload private whatever the write asked. */
export async function goLive(topic: string, storyId: string, c: Ctx & { at?: string }): Promise<VerbResult> {
  const o = openOutput(topic, storyId, c);
  if (o.state.status === 'scheduled' || o.state.status === 'published')
    return { event: null, existing: true, message: `${o.id} is already ${o.state.status}: ${o.state.next}` };
  if (o.state.status !== 'approved') throw new Refusal(`${o.id} is ${o.state.status}, not approved: ${o.state.next}`);
  if (!o.state.id) throw new Refusal(`${o.id} is approved but not uploaded yet: ${o.state.next}`);
  const problem = goLiveProblem(o, c.by); // what recordPublished and recordScheduled refuse, asked before YouTube is
  if (problem) throw new Refusal(problem);
  const id = o.state.id;
  if (c.at) {
    const t = Date.parse(c.at);
    if (Number.isNaN(t)) throw new Refusal(`--at ${c.at} is not an ISO date`);
    if (t - (c.now ?? new Date()).getTime() < MIN_SCHEDULE_LEAD_MS)
      throw new Refusal(`--at ${c.at} must be at least 5 minutes ahead; a past publishAt publishes immediately`);
    const at = new Date(t).toISOString();
    await guarded(topic, storyId, c, 'go-live', () =>
      c.client.updateVideo(id, { status: { ...statusOf(o.out), privacyStatus: 'private', publishAt: at } }),
    );
    return recordScheduled(topic, storyId, { ...c, at });
  }
  await guarded(topic, storyId, c, 'go-live', () =>
    c.client.updateVideo(id, { status: { ...statusOf(o.out), privacyStatus: 'public' } }),
  );
  const v = await guarded(topic, storyId, c, 'go-live', () => c.client.getVideo(id));
  if (v?.privacyStatus !== 'public')
    return recordFailed(topic, storyId, {
      ...c,
      step: 'go-live',
      error: keptPrivate(id, v?.privacyStatus ?? 'missing'),
      retryable: false,
    });
  return recordPublished(topic, storyId, { ...c, url: urlOf(id) });
}

/** Reads the video back: a rejection or a deletion is a final failure, a scheduled video gone public is recorded,
 *  anything else is returned for the CLI to print. */
export async function sync(topic: string, storyId: string, c: Ctx): Promise<VerbResult | RemoteVideo> {
  const o = openOutput(topic, storyId, c);
  if (!o.state.id) throw new Refusal(`${o.id} is ${o.state.status}; nothing on YouTube to read`);
  const id = o.state.id;
  const v = await guarded(topic, storyId, c, 'sync', () => c.client.getVideo(id));
  const failed = (error: string): VerbResult => {
    // the same finding, with nothing since, is not recorded again on every sync
    const last = o.out.events.findLast((e) => e.type !== 'verified'); // a verification in between changes nothing
    if (last?.type === 'failed' && last.step === 'sync' && last.id === id && last.error === error)
      return { event: last, existing: true, message: `already recorded: sync failed: ${error}` };
    return recordFailed(topic, storyId, { ...c, step: 'sync', error, retryable: false });
  };
  if (!v) return failed(`${id} is not on YouTube (deleted?); a person decides`);
  if (v.uploadStatus === 'rejected') return failed(`rejected: ${v.rejectionReason ?? 'no reason given'}`);
  if (v.privacyStatus === 'public' && (o.state.status === 'scheduled' || o.state.status === 'approved'))
    return recordPublished(topic, storyId, { ...c, url: urlOf(id), observed: true });
  const publishAt = o.out.events.findLast((e) => e.type === 'scheduled' && e.id === id)?.publishAt;
  if (
    o.state.status === 'scheduled' &&
    publishAt &&
    Date.parse(publishAt) + SCHEDULE_GRACE_MS < (c.now ?? new Date()).getTime()
  )
    return failed(
      `the schedule ${publishAt} passed and ${id} is still ${v.privacyStatus}: ${keptPrivate(id, v.privacyStatus)}`,
    );
  return v;
}

/** Reads the video back (one videos.list, a captions.list when the package has captions, an anonymous oEmbed request)
 *  and records the checks against the package as a `verified` event. `remote` and `expected` are for the CLI to print;
 *  they are never written. A captions.list failure leaves that check pending rather than recording a failure. */
export async function verify(
  topic: string,
  storyId: string,
  c: Ctx & { anonymous?: typeof fetch },
): Promise<{ result: VerbResult; checks: LedgerCheck[]; remote: RemoteVideo | null; expected: Expected }> {
  const o = openOutput(topic, storyId, c);
  if (!o.state.id) throw new Refusal(`${o.id} is ${o.state.status}; nothing on YouTube to verify`);
  const expected = expectedOf(o);
  if (!expected) throw new Refusal('no review package; nothing to verify against');
  const id = o.state.id;
  const remote = await guarded(topic, storyId, c, 'verify', () => c.client.getVideo(id));
  let captions: RemoteCaption[] | null = null;
  if (expected.captionsLanguage && remote)
    try {
      captions = await c.client.listCaptions(id);
    } catch (e) {
      if (!(e instanceof YouTubeError)) throw e;
    }
  const anonymous = await oembedStatus(id, c.anonymous ?? fetch);
  const checks = verificationChecks(expected, remote, captions, anonymous, c.now ?? new Date());
  const result = recordVerified(topic, storyId, { ...c, result: verdictOf(checks), checks });
  return { result, checks, remote, expected };
}
