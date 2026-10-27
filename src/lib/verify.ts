// What `npm run publish -- verify` judges: the output's approved package and ledger (what YouTube should hold) against
// what YouTube answers, as named checks, each pass, fail, pending (run it again later) or skip. Pure: the uploader reads
// YouTube and records the checks. A check's detail is our own sentence, never a value read from the API (the ledger is
// public and API data may not be kept), except the enum reason codes. Library layer: never imports the store, the
// corpus, the evidence gate or src/video/.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lf, readJson } from './io';
import {
  type CheckResult,
  type LedgerCheck,
  METADATA_CHECKS,
  type Verdict,
  type Visibility,
  nestedSource,
  type openOutput,
} from './publish';
import { CATEGORY_DEFAULT } from './uploader';
import type { RemoteCaption, RemoteVideo } from './youtube';

export { METADATA_CHECKS };
export const CHECKS = [
  'exists',
  'upload',
  'processing',
  'privacy',
  'public',
  'title',
  'description',
  'tags',
  'category',
  'language',
  'chapters',
  'declarations',
  'restrictions',
  'thumbnail',
  'captions',
  'file',
] as const;
export type CheckName = (typeof CHECKS)[number];

export interface Expected {
  visibility: Visibility; // live: public; scheduled: private; else the last upload's visibility, or private
  publishAt: string | null; // the latest schedule for the id, when the output is scheduled
  title: string;
  description: string;
  tags: string[];
  category: string;
  language: string;
  chapters: { stamp: string; title: string }[]; // review.json's measured chapters (a Short: none)
  captionsLanguage: string | null;
  thumbnail: boolean;
  syntheticMedia: boolean;
  file: { size: number } | null; // the packaged mp4 on disk, else null
}

/** What YouTube should hold for the output, or null without composed metadata (no review package). */
export function expectedOf(o: ReturnType<typeof openOutput>): Expected | null {
  const m = o.metadata;
  if (!m) return null;
  const id = o.state.id;
  const upload = o.out.events.findLast((e) => e.type === 'uploaded');
  const scheduled =
    o.state.status === 'scheduled'
      ? (o.out.events.findLast((e) => e.type === 'scheduled' && e.id === id)?.publishAt ?? null)
      : null;
  const nested = nestedSource(o.root, o.out);
  const review = readJson<{ chapters?: { stamp: string; title: string }[] }>(
    join(nested ? join(o.root, nested) : o.dir, 'video', 'review', 'review.json'),
  );
  const file = m.file ? join(o.root, m.file) : null;
  return {
    visibility: o.state.live ? 'public' : scheduled ? 'private' : (upload?.visibility ?? 'private'),
    publishAt: scheduled,
    title: m.title,
    description: m.description,
    tags: m.tags,
    category: m.category ?? CATEGORY_DEFAULT,
    language: m.language ?? 'en',
    chapters: (review?.chapters ?? []).map((c) => ({ stamp: c.stamp, title: c.title })),
    captionsLanguage: m.captions?.language ?? null,
    thumbnail: m.thumbnail !== null,
    syntheticMedia: o.out.metadata.containsSyntheticMedia ?? false,
    file: file && existsSync(file) ? { size: statSync(file).size } : null,
  };
}

const CHAPTER = /^((?:\d+:)?\d{1,2}:\d{2})\s+(.+)$/;
/** The chapter lines of a description: m:ss or h:mm:ss, then the title. */
export const chapterLines = (description: string) =>
  lf(description)
    .split('\n')
    .map((l) => CHAPTER.exec(l.trim()))
    .filter((x) => x !== null)
    .map((x) => ({ stamp: x[1], title: x[2].trim() }));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One check per CHECKS name, in that order. `anonymous` is the oEmbed status (0: no network); `captions` is null when
 *  the track list was not read. */
export function verificationChecks(
  x: Expected,
  v: RemoteVideo | null,
  captions: RemoteCaption[] | null,
  anonymous: number,
  now: Date,
): LedgerCheck[] {
  const k = (name: CheckName, result: CheckResult, detail?: string): LedgerCheck =>
    detail ? { name, result, detail } : { name, result };
  // a schedule whose time has passed may be public before sync records it: pending here as in the privacy check
  const due = x.publishAt !== null && Date.parse(x.publishAt) <= now.getTime();
  const reachable = (): LedgerCheck => {
    if (anonymous === 0) return k('public', 'pending', 'not reachable from here; run verify again');
    if (x.visibility === 'private')
      return anonymous === 200
        ? due
          ? k('public', 'pending', 'went public on schedule; npm run publish -- sync records it')
          : k('public', 'fail', 'reachable without signing in')
        : k('public', [401, 403, 404].includes(anonymous) ? 'pass' : 'pending');
    if (anonymous === 200) return k('public', 'pass');
    if (x.visibility === 'public') return k('public', 'fail', `anonymous request answered ${anonymous}`);
    return k('public', 'skip', `unlisted: an anonymous ${anonymous} says nothing either way`);
  };
  if (!v)
    return CHECKS.map((name) =>
      name === 'exists'
        ? k(name, 'fail', 'not on YouTube (deleted?)')
        : name === 'public'
          ? reachable()
          : k(name, 'skip'),
    );
  const processed = v.processingStatus === 'succeeded';
  const text = (name: 'title' | 'description' | 'tags' | 'category' | 'language', want: unknown, got: unknown) =>
    got === undefined && !(Array.isArray(want) && want.length === 0)
      ? k(name, 'fail', `not set; npm run publish -- push sends the composed ${name}`)
      : same(want, got ?? [])
        ? k(name, 'pass')
        : k(name, 'fail', `differs from the composed ${name}; npm run publish -- push resends it`);

  const checks: Record<CheckName, () => LedgerCheck> = {
    exists: () => k('exists', 'pass'),
    upload: () =>
      v.uploadStatus === 'processed'
        ? k('upload', 'pass')
        : v.uploadStatus === 'uploaded'
          ? k('upload', 'pending', 'still uploading or processing; run verify again')
          : v.uploadStatus === 'failed'
            ? k('upload', 'fail', `failed: ${v.failureReason ?? 'no reason given'}`)
            : v.uploadStatus === 'rejected'
              ? k('upload', 'fail', `rejected: ${v.rejectionReason ?? 'no reason given'}`)
              : k('upload', 'fail', v.uploadStatus === 'deleted' ? 'deleted' : `upload status ${v.uploadStatus}`),
    processing: () =>
      processed
        ? k('processing', 'pass')
        : v.processingStatus === 'failed' || v.processingStatus === 'terminated'
          ? k('processing', 'fail', v.processingStatus)
          : k('processing', 'pending', 'still processing; run verify again'),
    privacy: () => {
      if (due && v.privacyStatus === 'public')
        return k('privacy', 'pending', 'went public on schedule; npm run publish -- sync records it');
      const ok =
        v.privacyStatus === x.visibility &&
        (x.publishAt === null || (v.publishAt !== null && Date.parse(v.publishAt) === Date.parse(x.publishAt)));
      return ok
        ? k('privacy', 'pass')
        : k('privacy', 'fail', `expected ${x.visibility}${x.publishAt ? ` scheduled for ${x.publishAt}` : ''}`);
    },
    public: reachable,
    title: () => text('title', x.title, v.title),
    description: () =>
      text('description', lf(x.description).trim(), v.description === undefined ? undefined : lf(v.description).trim()),
    tags: () => text('tags', x.tags, v.tags),
    category: () => text('category', x.category, v.categoryId),
    language: () => text('language', x.language, v.defaultLanguage),
    chapters: () =>
      x.chapters.length === 0
        ? k('chapters', 'skip')
        : same(chapterLines(v.description ?? ''), x.chapters)
          ? k('chapters', 'pass')
          : k('chapters', 'fail', "the description's chapter lines differ from the measured chapters"),
    declarations: () => {
      const off = [
        v.madeForKids === true ? 'YouTube set made for kids' : '',
        v.selfDeclaredMadeForKids !== false ? 'the made-for-kids answer is not no' : '',
        (v.containsSyntheticMedia ?? false) !== x.syntheticMedia ? 'altered-content answer differs' : '',
      ].filter(Boolean);
      return off.length ? k('declarations', 'fail', off.join('; ')) : k('declarations', 'pass');
    },
    restrictions: () => {
      const r = v.regionRestriction;
      const on = [
        v.ytRating === 'ytAgeRestricted' ? 'age-restricted' : '',
        r && (r.allowed || r.blocked) ? 'region-restricted' : '',
        v.embeddable === false ? 'embedding off' : '',
        v.license !== undefined && v.license !== 'youtube' ? `licence ${v.license}` : '',
      ].filter(Boolean);
      return on.length ? k('restrictions', 'fail', on.join('; ')) : k('restrictions', 'pass');
    },
    thumbnail: () =>
      !x.thumbnail
        ? k('thumbnail', 'skip')
        : v.hasCustomThumbnail === true
          ? k('thumbnail', 'pass')
          : !processed
            ? k('thumbnail', 'pending', 'still processing; run verify again')
            : k(
                'thumbnail',
                'fail',
                'no custom thumbnail set (the API cannot return the image, only whether one is set)',
              ),
    captions: () => {
      if (!x.captionsLanguage) return k('captions', 'skip');
      if (captions === null) return k('captions', 'pending', 'captions not read; run verify again');
      // the API lists tracks in no stated order: any serving one in the language will do
      const tracks = captions.filter(
        (c) => c.trackKind.toLowerCase() === 'standard' && c.language === x.captionsLanguage,
      );
      if (tracks.some((t) => t.status === 'serving')) return k('captions', 'pass');
      if (tracks.some((t) => t.status === 'syncing'))
        return k('captions', 'pending', 'captions still syncing; run verify again');
      return k(
        'captions',
        'fail',
        tracks.length
          ? `no ${x.captionsLanguage} captions track is serving; npm run publish -- push replaces it`
          : `no ${x.captionsLanguage} captions track; npm run publish -- push sends it`,
      );
    },
    file: () =>
      !x.file
        ? k('file', 'skip', 'the packaged mp4 is not on disk')
        : v.fileAvailability !== 'available' || v.fileSize === undefined
          ? k('file', 'pending', 'the file details are not available yet; run verify again')
          : v.fileSize === x.file.size
            ? k('file', 'pass')
            : k('file', 'fail', 'the uploaded file is not the packaged build (size differs)'),
  };
  return CHECKS.map((name) => checks[name]());
}

/** Any fail: failed; else any pending: pending; else passed. */
export const verdictOf = (checks: LedgerCheck[]): Verdict =>
  checks.some((c) => c.result === 'fail')
    ? 'failed'
    : checks.some((c) => c.result === 'pending')
      ? 'pending'
      : 'passed';
