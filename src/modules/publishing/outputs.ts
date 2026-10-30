// A story's public outputs (plan D8): its live YouTube video and Shorts, read from the publishing ledger and the
// committed review package. The only site-side reader of publishing state; it never imports the store. A video is
// public only after a person's go-live is in the ledger: the site never decides what is public.
import { join } from 'node:path';
import { readJson, ROOT } from '../../shared/io';
import { loadLedger, nestedSource, type Output } from './publish';
import { scriptDir } from '../../shared/io';

export interface PublicVideo {
  output: string;
  kind: 'youtube-video' | 'youtube-short';
  id: string;
  url: string;
  embedUrl: string;
  publishedAt: string;
  title: string;
  seconds: number | null;
  chapters: { stamp: string; seconds: number; title: string }[];
}
export interface StoryOutputs {
  video: PublicVideo | null;
  shorts: PublicVideo[];
}
interface ReviewJson {
  title?: string;
  seconds?: number;
  chapters?: { stamp: string; seconds: number; title: string }[];
}

/** The live `published` event: the latest of published / unpublished / retracted, public (or no visibility given). */
const liveEvent = (o: Output) => {
  const last = o.events.findLast((e) => ['published', 'unpublished', 'retracted'].includes(e.type));
  return last?.type === 'published' && last.id && (!last.visibility || last.visibility === 'public') ? last : null;
};

function publicVideo(output: string, o: Output, reviewDir: string | null): PublicVideo | null {
  const e = liveEvent(o);
  if (!e || (o.kind !== 'youtube-video' && o.kind !== 'youtube-short')) return null;
  const short = o.kind === 'youtube-short';
  const r = (reviewDir && readJson<ReviewJson>(join(reviewDir, 'video', 'review', 'review.json'))) || {};
  return {
    output,
    kind: o.kind,
    id: e.id!,
    url: e.url ?? (short ? `https://www.youtube.com/shorts/${e.id}` : `https://www.youtube.com/watch?v=${e.id}`),
    embedUrl: `https://www.youtube-nocookie.com/embed/${e.id}`,
    publishedAt: e.at,
    title: o.metadata.title ?? r.title ?? '',
    seconds: r.seconds ?? null,
    chapters: short ? [] : (r.chapters ?? []).map(({ stamp, seconds, title }) => ({ stamp, seconds, title })),
  };
}

export function storyOutputs(topic: string, storyId: string, root = ROOT): StoryOutputs {
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger) return { video: null, shorts: [] };
  // The last video output that is live: a re-release in progress (a new output, not yet public) leaves the original.
  // ponytail: chapters and title come from the current review package, which a re-release's build replaces.
  const video =
    Object.entries(ledger.outputs)
      .filter(([, o]) => o.kind === 'youtube-video')
      .map(([id, o]) => publicVideo(id, o, scriptDir(topic, storyId, root)))
      .findLast((v) => !!v) ?? null;
  const shorts = Object.entries(ledger.outputs)
    .filter(([, o]) => o.kind === 'youtube-short')
    .map(([id, o]) => {
      const src = nestedSource(root, o);
      return publicVideo(id, o, src && join(root, src));
    })
    .filter((v): v is PublicVideo => !!v);
  return { video, shorts };
}

/** A watch URL that starts at `seconds` (whole seconds, rounded down). */
export const seekUrl = (v: Pick<PublicVideo, 'url'>, seconds: number) =>
  `${v.url}${v.url.includes('?') ? '&' : '?'}t=${Math.floor(seconds)}s`;
