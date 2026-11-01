// A fake YouTube client for tests that run the publish CLI as a child (the release loop's acceptance tests): its state
// is one JSON file named by YOUTUBE_FAKE, re-read before and written after every call, so a test can read what was
// sent and plant a failure between two CLI runs. It never reaches the network. Production code paths are the same:
// cli.ts picks this client only when YOUTUBE_FAKE is set, and nothing in the repo sets it.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import {
  type RemoteCaption,
  type RemoteVideo,
  type Snippet,
  type VideoStatus,
  type YouTubeClient,
  YouTubeError,
} from './youtube';

export interface FakeVideo {
  snippet: Snippet;
  status: VideoStatus;
  privacyStatus: 'private' | 'unlisted' | 'public';
  publishAt: string | null;
  uploadStatus: string;
  processingStatus: string;
  captions: RemoteCaption[];
  thumbnail: boolean;
  fileSize: number;
  gets: number;
}
export interface FakeFailure {
  method: keyof YouTubeClient;
  status: number;
  reason: string;
  retryable: boolean;
  times: number; // how many more calls fail
  after?: number; // let this many calls of the method pass first
}
export interface FakeState {
  nextId: number;
  videos: Record<string, FakeVideo>;
  calls: { method: string; args: unknown[]; at: string }[];
  fail: FakeFailure[];
  /** getVideo answers `processing` this many times per video before `succeeded` (YouTube still processing). */
  slowProcessing: number;
}

export const emptyFakeState = (): FakeState => ({ nextId: 1, videos: {}, calls: [], fail: [], slowProcessing: 0 });
export const readFakeState = (path: string): FakeState =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as FakeState) : emptyFakeState();
export const writeFakeState = (path: string, s: FakeState): void => writeFileSync(path, JSON.stringify(s, null, 1));

/** The id the fake gives the n-th upload: eleven characters, as YouTube's. */
export const fakeId = (n: number) => `fake${String(n).padStart(7, '0')}`;

export function fakeYoutubeClient(path: string): YouTubeClient {
  const call = <T>(method: keyof YouTubeClient, args: unknown[], fn: (s: FakeState) => T): T => {
    const s = readFakeState(path);
    s.calls.push({
      method,
      args: args.map((a) => (typeof a === 'string' ? a : JSON.parse(JSON.stringify(a)))),
      at: new Date().toISOString(),
    });
    const f = s.fail.find((x) => x.method === method && x.times > 0);
    if (f && (f.after ?? 0) > 0) f.after!--;
    else if (f) {
      f.times -= 1;
      writeFakeState(path, s);
      throw new YouTubeError(`${f.reason}: planted failure`, f.status, f.reason, f.retryable);
    }
    const out = fn(s);
    writeFakeState(path, s);
    return out;
  };
  const video = (s: FakeState, id: string): FakeVideo => {
    const v = s.videos[id];
    if (!v) throw new YouTubeError(`video ${id} not found`, 404, 'videoNotFound', false);
    return v;
  };
  return {
    async insertVideo({ file, snippet, status, onSession }) {
      return call('insertVideo', [{ file, snippet, status }], (s) => {
        onSession(`https://fake/upload/${s.nextId}`);
        const id = fakeId(s.nextId++);
        s.videos[id] = {
          snippet,
          status,
          privacyStatus: status.privacyStatus ?? 'private',
          publishAt: status.publishAt ?? null,
          uploadStatus: 'processed',
          processingStatus: 'succeeded',
          captions: [],
          thumbnail: false,
          fileSize: existsSync(file) ? statSync(file).size : 0,
          gets: 0,
        };
        return { id };
      });
    },
    async setThumbnail(id) {
      call('setThumbnail', [id], (s) => void (video(s, id).thumbnail = true));
    },
    async insertCaptions(id, _file, language) {
      call(
        'insertCaptions',
        [id, language],
        (s) =>
          void video(s, id).captions.push({
            id: `cap-${id}-${video(s, id).captions.length + 1}`,
            language,
            trackKind: 'standard',
            status: 'serving',
          }),
      );
    },
    async updateVideo(id, body) {
      call('updateVideo', [id, body], (s) => {
        const v = video(s, id);
        if (body.snippet) v.snippet = body.snippet;
        if (body.status) {
          v.status = { ...v.status, ...body.status };
          if (body.status.privacyStatus) v.privacyStatus = body.status.privacyStatus;
          v.publishAt = body.status.publishAt ?? null;
        }
      });
    },
    async getVideo(id) {
      return call('getVideo', [id], (s): RemoteVideo | null => {
        const v = s.videos[id];
        if (!v) return null;
        v.gets += 1;
        const processing = v.gets <= s.slowProcessing ? 'processing' : v.processingStatus;
        return {
          id,
          privacyStatus: v.privacyStatus,
          uploadStatus: processing === 'processing' ? 'uploaded' : v.uploadStatus,
          rejectionReason: null,
          publishAt: v.publishAt,
          processingStatus: processing,
          title: v.snippet.title,
          description: v.snippet.description,
          tags: v.snippet.tags,
          categoryId: v.snippet.categoryId,
          defaultLanguage: v.snippet.defaultLanguage,
          license: 'youtube',
          embeddable: v.status.embeddable ?? true,
          madeForKids: false,
          selfDeclaredMadeForKids: v.status.selfDeclaredMadeForKids ?? false,
          containsSyntheticMedia: v.status.containsSyntheticMedia ?? false,
          hasCustomThumbnail: v.thumbnail,
          fileSize: v.fileSize,
          fileAvailability: 'available',
        };
      });
    },
    async listCaptions(videoId) {
      return call('listCaptions', [videoId], (s) => video(s, videoId).captions);
    },
    async deleteCaptions(trackId) {
      call('deleteCaptions', [trackId], (s) => {
        for (const v of Object.values(s.videos)) v.captions = v.captions.filter((c) => c.id !== trackId);
      });
    },
  };
}

/** The anonymous oEmbed request against the fake: 200 for a public video, 401 for a private or unlisted one, 404 for
 *  an unknown id. */
export const fakeAnonymous =
  (path: string): typeof fetch =>
  async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const m = /watch%3Fv%3D([\w-]{11})|v=([\w-]{11})/.exec(decodeURIComponent(url));
    const id = m?.[1] ?? m?.[2] ?? '';
    const v = readFakeState(path).videos[id];
    return new Response('', { status: !v ? 404 : v.privacyStatus === 'public' ? 200 : 401 });
  };
