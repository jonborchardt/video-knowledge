// The site's text outputs beside its pages: the RSS feed, llms.txt and each matter's Markdown copy. Pure renderers
// over the same models the pages use (the Astro endpoints in src/pages gather the data); no dependency, no second
// interpretation of the research: every line here is a published sentence, figure, quote or link.
import type { ArticleView } from '../article';
import { FINDING_TEXT, type Topic, verdictLabel } from '../evidence';
import type { Commission } from '../../config/site';
import { citeHref, citeLines } from '../../lib/url';
import { revisionLine } from '../../shared/public-record';
import type { Story } from '../../shared/types';
import type { MatterModel } from './matter';

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

export interface LlmsEntry {
  inquiry: string;
  inquiryUrl: string;
  title: string;
  question: string;
  markdownUrl: string; // the matter's index.md, absolute
}

/** llms.txt: the public matters under their inquiries, each linking its Markdown copy; entries in the order given. */
export function llmsTxt(
  entries: LlmsEntry[],
  site: { name: string; description: string; disclosure: string; url: string },
): string {
  const out = [
    `# ${site.name}`,
    `> ${site.description}`,
    `${site.disclosure} Pages: ${site.url}. This file lists each public matter with its Markdown copy, which carries the article, its sources, the claims examined with their verdicts and the exhibits.`,
  ];
  const byInquiry = new Map<string, LlmsEntry[]>();
  for (const e of entries) byInquiry.set(e.inquiry, [...(byInquiry.get(e.inquiry) ?? []), e]);
  for (const [inquiry, list] of byInquiry)
    out.push(
      `## [${inquiry}](${list[0].inquiryUrl})`,
      list.map((e) => `- [${e.title}](${e.markdownUrl}): ${e.question}`).join('\n'),
    );
  return out.join('\n\n') + '\n';
}

export interface MatterMeta {
  canonical: string; // the HTML page's absolute URL
  inquiryUrl: string;
  firstUrl?: string; // a follow-up's first question
  repo: string;
  disclosure: string;
  publisher: string;
}

type Block = ArticleView['sections'][number]['blocks'][number];

/** A table cell: no pipe or line break can break the row. */
const cell = (s: string) => s.replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|');
const row = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`;
const table = (columns: string[], rows: string[][]) =>
  [row(['', ...columns]), row(['---', ...columns.map(() => '---')]), ...rows.map(row)].join('\n');

function block(b: Block): string {
  if (b.kind === 'p') {
    const text = b.sentences
      .map(
        (x) =>
          `${x.text}${x.refs.length ? ` [${x.refs.join('][')}]` : ''}${x.correctedOn ? ` (Corrected ${x.correctedOn})` : ''}`,
      )
      .join(' ');
    return b.callout ? `**${FINDING_TEXT[b.callout].name}:** ${text}` : text;
  }
  if (b.kind === 'table')
    return `${b.caption}\n\n${table(
      b.columns,
      b.rows.map((r) => [r.label, ...r.cells]),
    )}`;
  const d = b.draw;
  if (!d) return b.caption;
  // The figure's data as the page's table: the dataset's cells, else the chart's points, each as the passage states it.
  const data = d.table
    ? table(
        d.table.columns.map((c) => c.label),
        d.table.rows.map((r) => [r.label, ...r.cells.map((c) => c.display)]),
      )
    : d.chart
      ? table(
          ['Value'],
          d.chart.points.map((p) => [p.label, p.display]),
        )
      : '';
  const note = d.chart?.note ? ` ${d.chart.note}` : '';
  return `${b.caption}${note}\nSource: ${d.source}\n\n${data}`;
}

/** A public matter as Markdown: what its HTML page shows, in the page's order and wording, with absolute links. */
export function matterMarkdown(t: Topic, s: Story, m: MatterModel, c: Commission, meta: MatterMeta): string {
  const out: string[] = [`# ${s.title}`, s.question];
  out.push(
    `Published by ${c.fullName}. Part of the inquiry [${t.label}](${meta.inquiryUrl}). HTML version: ${meta.canonical}.`,
  );
  if (m.first && meta.firstUrl) out.push(`A follow-up question to [${m.first.title}](${meta.firstUrl}).`);
  if (m.embed) out.push(`Video: ${m.embed.url}`);
  out.push('## What the Record finds', s.arc.resolution);
  if (m.firstArticle && m.first && meta.firstUrl)
    out.push(`The article answering this question is on [${m.first.title}](${meta.firstUrl}#article).`);
  const v = m.view;
  if (v) {
    for (const x of v.corrections) out.push(`Corrected ${x.date}: ${x.note}`);
    if (v.stale)
      out.push(`A finding this article relies on was revised on ${v.stale.at}; the article is being reviewed.`);
    out.push(`## ${v.headline}`, `> ${v.dek}`);
    for (const sec of v.sections) out.push(`### ${sec.heading}`, ...sec.blocks.map(block));
    if (v.refs.length) out.push('### Sources', v.refs.map((r) => `${r.n}. [${r.label}](${r.href})`).join('\n'));
  } else {
    out.push('## The dispute', s.tension, '## What the evidence shows', s.premise);
    if (s.arc.takeaway) out.push(`**Takeaway:** ${s.arc.takeaway}`);
  }
  out.push('## The claims examined');
  for (const g of m.groups) {
    out.push(`### ${FINDING_TEXT[g.label].name}`);
    out.push(
      g.claims
        .map((cl) => {
          const label = verdictLabel(cl.verdict, cl.confidence).text;
          const lines = [`- **${cl.text}** (${label}${cl.note ? `. ${cl.note}` : ''})`];
          for (const x of cl.sources)
            lines.push(
              `  - ${x.stance === 'denies' ? 'Denies' : 'Asserts'}: [${x.title}](${x.href}) (${x.channel})${x.quote ? ` "${x.quote}"` : ''}`,
            );
          for (const x of cl.verdicts)
            lines.push(
              `  - ${verdictLabel(x.verdict, x.confidence).text} by ${x.by}${x.cite ? `, [lines ${citeLines(x.cite)}](${citeHref(meta.repo, x.cite)})` : ''}${x.note ? `. ${x.note}` : ''}`,
            );
          for (const r of cl.revisions) lines.push(`  - ${revisionLine(r)}`);
          return lines.join('\n');
        })
        .join('\n'),
    );
  }
  out.push(
    '## Exhibits',
    m.exhibits
      .map(
        (x) =>
          `- ${x.exhibit ? `Exhibit ${x.exhibit}` : 'Exhibit number assigned at release'}: [${x.title}](${x.href}) (${x.channel})`,
      )
      .join('\n'),
  );
  if (m.revisions.length)
    out.push('## Revisions', m.revisions.map(({ r, text }) => `- ${revisionLine(r)} (${text})`).join('\n'));
  out.push('---', `${meta.disclosure} Published by ${meta.publisher}.`);
  return out.join('\n\n') + '\n';
}
