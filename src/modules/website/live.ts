// `npm run links -- live <topic> <story-id>` (spec §4.4 step 5, phase 3): one fetch of the matter page on the public
// site, no loop: live when it answers 200, carries the story's live video id (the embed) and the path is in the
// frozen public-urls.json. The fixture's two probes (phase 3 Task 7) reuse it: negative on the production host
// (`expectAbsent`), positive on the preview host (`baseUrl`, not frozen).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { site } from '../../config/site';
import { ROOT } from '../../shared/io';
import { storyOutputs } from '../publishing';
import { loadStories } from '../stories';
import { matterPath } from './content-graph';

export interface LiveCheck {
  ok: boolean;
  url: string;
  why?: string;
  status?: number;
}

/** The matter page's path for a story id (its slug comes from stories.json), or null for an unknown story. */
export function matterPathOf(topic: string, storyId: string, root = ROOT): string | null {
  const s = loadStories(topic, root)?.stories.find((x) => x.id === storyId);
  return s ? matterPath(topic, s) : null;
}

const frozen = (root: string, path: string): boolean => {
  const list = join(root, 'public-urls.json');
  return existsSync(list) && (JSON.parse(readFileSync(list, 'utf8')) as string[]).includes(path);
};

export async function liveCheck(
  topic: string,
  storyId: string,
  fetchFn: typeof fetch = fetch,
  root = ROOT,
  opts: { baseUrl?: string; expectAbsent?: boolean; frozen?: boolean } = {},
): Promise<LiveCheck> {
  const path = matterPathOf(topic, storyId, root);
  const base = (opts.baseUrl ?? site.url).replace(/\/$/, '');
  if (!path) return { ok: false, url: base, why: `no story ${storyId} in ${topic}` };
  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    return { ok: false, url, why: `no answer: ${(e as Error).message}` };
  }
  if (opts.expectAbsent) {
    if (res.status === 200) return { ok: false, url, status: 200, why: 'the fixture page is on the production site' };
    if (frozen(root, path))
      return { ok: false, url, status: res.status, why: 'the fixture path is in public-urls.json' };
    return { ok: true, url, status: res.status };
  }
  if (res.status !== 200) return { ok: false, url, status: res.status, why: `answered ${res.status}` };
  const video = storyOutputs(topic, storyId, root).video;
  if (!video) return { ok: false, url, status: 200, why: 'the ledger has no live video to look for' };
  const html = await res.text();
  if (!html.includes(video.id))
    return { ok: false, url, status: 200, why: `the page does not carry the video ${video.id} yet` };
  if (opts.frozen !== false && !frozen(root, path))
    return { ok: false, url, status: 200, why: 'the path is not in public-urls.json (run npm run links -- freeze)' };
  return { ok: true, url, status: 200 };
}
