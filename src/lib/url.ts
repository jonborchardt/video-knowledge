import { site } from '../config/site';

/** Site-relative href that respects Astro's `base` (`/` on commonwealthofreason.com, `/video-knowledge/` on the GitHub
 *  Pages mirror). Pass root-relative paths. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The URLs in plain text (a video description), without the punctuation that closes the sentence around them. */
export const textUrls = (text: string) => [...text.matchAll(/https?:\/\/\S+/g)].map(([u]) => u.replace(/[),.;]+$/, ''));

/** A root-relative site path as its absolute URL on the canonical host `site.url`, from both deploy targets (the
 *  mirror's canonical, og and JSON-LD URLs point at commonwealthofreason.com), never with the build's base. */
export const absoluteUrl = (path: string): string => new URL(path.replace(/^\//, ''), site.url).href;

/** A built page's pathname without the build's base (`/video-knowledge/about/` on the mirror is `/about/`). */
export function sitePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return pathname.startsWith(base + '/') ? pathname.slice(base.length) : pathname;
}

/** A study cite (`<topic>/sources/<file>.txt#L10-L24`, relative to topics/) as a link to the committed text in the
 *  repo; GitHub honours the #L anchor. */
export const citeHref = (repo: string, cite: string) => `${repo}/blob/main/topics/${cite}`;
/** The cite's line range, `10-24`. */
export const citeLines = (cite: string) => cite.split('#')[1]?.replace(/L/g, '') ?? '';
/** The cite as its document's name and line range, "EIA table, lines 10-24". */
export function citeLabel(docNames: Record<string, string>, cite: string): string {
  const file = cite.split('#')[0].split('/').pop()!;
  return `${docNames[file] ?? file}, lines ${citeLines(cite)}`;
}

/** A dataset's source line: each document once with the overall line range its cells cite, then the period:
 *  "EIA table, lines 135-186 (2024 annual)". */
export function datasetSource(docNames: Record<string, string>, cites: string[], asOf: string): string {
  const spans = new Map<string, [number, number]>();
  for (const c of cites) {
    const file = c.split('#')[0].split('/').pop()!;
    const nums = (citeLines(c).match(/\d+/g) ?? []).map(Number);
    if (!nums.length) continue;
    const [lo, hi] = spans.get(file) ?? [Infinity, -Infinity];
    spans.set(file, [Math.min(lo, ...nums), Math.max(hi, ...nums)]);
  }
  const docs = [...spans].map(([f, [lo, hi]]) => `${docNames[f] ?? f}, lines ${lo}-${hi}`);
  return `${docs.join('; ')} (${asOf})`;
}
