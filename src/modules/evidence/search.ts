// YouTube search without an API key (spec §5.2 `lists`): the results page carries `ytInitialData`, whose
// `videoRenderer` entries name the id, title, channel, length and view count. Pure parsing over the page text; the
// fetch is injected. Read-only: the one verb the collect role runs with its own query.
export interface SearchHit {
  id: string;
  title: string;
  channel: string;
  seconds: number | null;
  views: number | null;
}

const text = (x: unknown): string => {
  if (!x || typeof x !== 'object') return '';
  const o = x as { simpleText?: string; runs?: { text: string }[] };
  return o.simpleText ?? o.runs?.map((r) => r.text).join('') ?? '';
};
/** "1:02:03" or "12:34" to seconds. */
export function lengthSeconds(s: string): number | null {
  const parts = s.trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
/** "1,234,567 views" to a number; "No views" to 0. */
export function viewCount(s: string): number | null {
  if (/^no views/i.test(s.trim())) return 0;
  const m = /([\d,.]+)\s*([KMB])?\s*views?/i.exec(s);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  const mul = m[2] ? { K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase()]! : 1;
  return Number.isFinite(n) ? Math.round(n * mul) : null;
}

/** The `ytInitialData` object on a results page, or null. */
export function initialDataOf(html: string): unknown {
  const m =
    /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html) ??
    /ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Every videoRenderer in the page, in order, each id once. */
export function parseSearchPage(html: string): SearchHit[] {
  const data = initialDataOf(html);
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  const walk = (x: unknown): void => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return void x.forEach(walk);
    const o = x as Record<string, unknown>;
    const v = o.videoRenderer as Record<string, unknown> | undefined;
    if (v && typeof v.videoId === 'string') {
      if (!seen.has(v.videoId)) {
        seen.add(v.videoId);
        out.push({
          id: v.videoId,
          title: text(v.title),
          channel: text(v.ownerText) || text(v.longBylineText) || text(v.shortBylineText),
          seconds: v.lengthText ? lengthSeconds(text(v.lengthText)) : null,
          views: v.viewCountText ? viewCount(text(v.viewCountText)) : null,
        });
      }
      return;
    }
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(data);
  return out;
}

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CommonwealthOfReason/1.0 research';

/** The first `max` results of a query, from one page. */
export async function youtubeSearch(query: string, max = 40, fetchFn: typeof fetch = fetch): Promise<SearchHit[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`;
  const res = await fetchFn(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`youtube search answered ${res.status}`);
  return parseSearchPage(await res.text()).slice(0, max);
}
