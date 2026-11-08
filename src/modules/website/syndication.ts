// The site's text outputs beside its pages: the RSS feed, llms.txt and each matter's Markdown copy. Pure renderers
// over the same models the pages use (the Astro endpoints in src/pages gather the data); no dependency, no second
// interpretation of the research: every line here is a published sentence, figure, quote or link.

/** The five XML-significant characters; `]]>` can then never appear raw. */
export const xmlEscape = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export interface FeedItem {
  title: string;
  url: string; // absolute, on the canonical host
  answer: string; // the matter's one-paragraph answer
  inquiry: string; // the topic's label
  publishedAt?: string; // the live video's publication; absent while releasing (no fabricated date)
}
export interface FeedMeta {
  title: string;
  url: string;
  description: string;
  language: string;
}

const rfc822 = (iso: string) => new Date(iso).toUTCString();

/** RSS 2.0: dated items newest first, undated last, ties by title. */
export function feedXml(items: FeedItem[], meta: FeedMeta): string {
  const sorted = [...items].sort(
    (a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.title.localeCompare(b.title),
  );
  const newest = sorted[0]?.publishedAt;
  const item = (x: FeedItem) =>
    [
      '    <item>',
      `      <title>${xmlEscape(x.title)}</title>`,
      `      <link>${xmlEscape(x.url)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(x.url)}</guid>`,
      `      <category>${xmlEscape(x.inquiry)}</category>`,
      `      <description>${xmlEscape(x.answer)}</description>`,
      ...(x.publishedAt ? [`      <pubDate>${rfc822(x.publishedAt)}</pubDate>`] : []),
      '    </item>',
    ].join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${xmlEscape(meta.title)}</title>`,
    `    <link>${xmlEscape(meta.url)}</link>`,
    `    <description>${xmlEscape(meta.description)}</description>`,
    `    <language>${xmlEscape(meta.language)}</language>`,
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    ...sorted.map(item),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
