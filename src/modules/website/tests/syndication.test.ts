import { describe, expect, it } from 'vitest';
import type { ArticleRelease, ArticleView } from '../../article';
import type { ClaimView, SourceView, Topic } from '../../evidence';
import type { PublicVideo } from '../../publishing';
import type { Commission } from '../../../config/site';
import type { Story } from '../../../shared/types';
import type { MatterModel } from '../matter';
import { verdictLabel } from '../../evidence';
import { feedXml, llmsTxt, matterMarkdown, xmlEscape } from '../syndication';

const meta = { title: 'Site', url: 'https://example.test/', description: 'About. The disclosure.', language: 'en-US' };

describe('xmlEscape', () => {
  it('escapes the five characters, so no text can open markup or close a CDATA section', () => {
    const out = xmlEscape(`a & b < c > "d" 'e' ]]>`);
    expect(out).toBe('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos; ]]&gt;');
    expect(out).not.toMatch(/[<>"']/);
  });
});

describe('feedXml', () => {
  const items = [
    {
      title: 'Old',
      url: 'https://example.test/t/old/',
      answer: 'old answer',
      inquiry: 'T',
      publishedAt: '2026-10-28T10:00:00Z',
    },
    { title: 'Undated', url: 'https://example.test/t/undated/', answer: 'releasing', inquiry: 'T' },
    {
      title: 'New',
      url: 'https://example.test/t/new/',
      answer: 'new answer',
      inquiry: 'T',
      publishedAt: '2026-11-04T18:00:00Z',
    },
  ];

  it('is RSS 2.0, newest first, an undated item last with no pubDate, lastBuildDate the newest date', () => {
    const xml = feedXml(items, meta);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">')).toBe(true);
    const titles = [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    expect(titles).toEqual(['New', 'Old', 'Undated']);
    expect(xml.match(/<pubDate>/g)).toHaveLength(2);
    expect(xml).toContain('<lastBuildDate>Wed, 04 Nov 2026 18:00:00 GMT</lastBuildDate>');
    expect(xml).toContain('<guid isPermaLink="true">https://example.test/t/new/</guid>');
    expect(xml).toContain('<description>About. The disclosure.</description>');
    expect(xml).toContain('<category>T</category>');
    const undated = xml.slice(xml.indexOf('<title>Undated</title>'));
    expect(undated).not.toContain('<pubDate>');
  });

  it('escapes titles and answers', () => {
    const xml = feedXml([{ ...items[0], title: 'Oil & gas <cheaper>?', answer: 'Yes "if" <so>' }], meta);
    expect(xml).toContain('<title>Oil &amp; gas &lt;cheaper&gt;?</title>');
    expect(xml).toContain('<description>Yes &quot;if&quot; &lt;so&gt;</description>');
    expect(xml).not.toContain('<cheaper>');
  });

  it('an empty Record is a valid feed with no items', () => {
    const xml = feedXml([], meta);
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
    expect(xml).not.toContain('<lastBuildDate>');
  });
});

describe('llmsTxt', () => {
  const site = { name: 'Site', description: 'About.', disclosure: 'The disclosure.', url: 'https://example.test/' };
  const entries = [
    {
      inquiry: 'Heat pumps',
      inquiryUrl: 'https://example.test/hp/',
      title: 'A',
      question: 'Q1?',
      markdownUrl: 'https://example.test/hp/a/index.md',
    },
    {
      inquiry: 'Heat pumps',
      inquiryUrl: 'https://example.test/hp/',
      title: 'B',
      question: 'Q2?',
      markdownUrl: 'https://example.test/hp/b/index.md',
    },
    {
      inquiry: 'Tariffs',
      inquiryUrl: 'https://example.test/t/',
      title: 'C',
      question: 'Q3?',
      markdownUrl: 'https://example.test/t/c/index.md',
    },
  ];

  it('groups the matters under their inquiries, each linking its Markdown copy, the disclosure once', () => {
    const txt = llmsTxt(entries, site);
    expect(txt.startsWith('# Site\n\n> About.\n')).toBe(true);
    expect(txt.match(/^## /gm)).toHaveLength(2);
    expect(txt).toContain(
      '## [Heat pumps](https://example.test/hp/)\n\n- [A](https://example.test/hp/a/index.md): Q1?\n- [B](https://example.test/hp/b/index.md): Q2?',
    );
    expect(txt).toContain('## [Tariffs](https://example.test/t/)\n\n- [C](https://example.test/t/c/index.md): Q3?');
    expect(txt.split('The disclosure.').length).toBe(2);
    expect(txt).toContain('https://example.test/');
  });

  it('an empty Record is the header alone', () => {
    const txt = llmsTxt([], site);
    expect(txt).toContain('# Site');
    expect(txt).not.toContain('## ');
  });
});

describe('matterMarkdown', () => {
  const cite = 'heat-pumps/sources/nrel.txt#L10-L12';
  const citeUrl = `https://github.com/x/blob/main/topics/${cite}`;
  const view: ArticleView = {
    headline: 'The headline',
    dek: 'The dek.',
    sections: [
      {
        heading: 'First section',
        blocks: [
          {
            kind: 'p',
            sentences: [
              { id: 's01', text: 'First sentence.', refs: [1] },
              { id: 's02', text: 'Second sentence.', refs: [2], correctedOn: '2026-11-02' },
            ],
          },
          { kind: 'p', callout: 'unresolved', sentences: [{ id: 's03', text: 'A gap.', refs: [] }] },
          { kind: 'table', caption: 'Costs', columns: ['Saving'], rows: [{ label: 'a | b', cells: ['53%'] }] },
          {
            kind: 'figure',
            ref: 'f1',
            caption: 'Projects',
            draw: {
              source: 'Doc, lines 1-2',
              chart: {
                type: 'bar',
                points: [
                  { label: 'Projects', value: 273, unit: 'count', display: '273', cite },
                  { label: 'Largest rise', value: 1000, unit: 'usd', display: '$1,000', cite },
                ],
              },
            },
          },
        ],
      },
    ],
    refs: [
      { n: 1, label: 'NREL model, lines 10-12', href: citeUrl },
      { n: 2, label: 'Exhibit 3: A video', href: 'https://www.youtube.com/watch?v=abc' },
    ],
    corrections: [{ date: '2026-11-02', note: 'Fixed a figure.', sentences: ['s02'] }],
    stale: null,
  };
  const claim = {
    id: 'heat-pumps/c1',
    text: 'Heat pumps cost less to run than oil.',
    asserted: 2,
    denied: 1,
    verdict: 'partly',
    confidence: 0.8,
    note: 'Depends on the oil price.',
    decidedBy: 'NREL model',
    studies: 1,
    lean: null,
    sources: [
      {
        id: 'v1',
        title: 'A video',
        channel: 'Chan',
        kind: 'video',
        href: 'https://www.youtube.com/watch?v=abc',
        stance: 'denies',
        quote: 'Oil was cheaper that winter.',
      },
    ],
    verdicts: [
      {
        by: 'NREL model',
        verdict: 'partly',
        confidence: 0.8,
        note: 'Above a switchover temperature.',
        cite,
        date: '2026-10-01',
      },
    ],
    revisions: [
      {
        kind: 'claim',
        id: 'heat-pumps/c1',
        at: '2026-11-01',
        note: 'Verdict moved from right to partly.',
        from: 'right',
        to: 'partly',
      },
    ],
  } as unknown as ClaimView;
  const exhibit = {
    id: 'v1',
    title: 'A video',
    channel: 'Chan',
    kind: 'video',
    href: 'https://www.youtube.com/watch?v=abc',
    exhibit: 3,
  } as SourceView;
  const t = { name: 'heat-pumps', label: 'Heat pumps' } as Topic;
  const s = {
    id: 'decision:x',
    title: 'Is it cheaper?',
    question: 'Is a heat pump cheaper to run?',
    tension: 'Some say yes.',
    premise: 'Studies measured it.',
    arc: { resolution: 'Mostly, except against oil.', takeaway: 'Check your oil price.' },
    claims: ['heat-pumps/c1'],
  } as unknown as Story;
  const model = (over: Partial<MatterModel> = {}): MatterModel => ({
    first: undefined,
    claims: [claim],
    groups: [{ label: 'qualification', claims: [claim] }],
    exhibits: [exhibit],
    revisions: [{ r: claim.revisions[0], text: claim.text }],
    revised: '2026-11-01',
    outputs: { video: null, releasing: null, shorts: [] },
    embed: { url: 'https://www.youtube.com/watch?v=vid' } as PublicVideo,
    release: {} as ArticleRelease,
    previewArticle: false,
    firstArticle: false,
    view,
    path: '/heat-pumps/is-it-cheaper/',
    ...over,
  });
  const c = { fullName: 'Commission on Spending' } as Commission;
  const mdMeta = {
    canonical: 'https://example.test/heat-pumps/is-it-cheaper/',
    inquiryUrl: 'https://example.test/heat-pumps/',
    repo: 'https://github.com/x',
    disclosure: 'The disclosure.',
    publisher: 'J',
    toolUrl: 'https://example.test/heat-pumps/is-it-cheaper/#tool',
  };

  it('keeps the article, its refs and URLs, tables, figure data, corrections, claims, quotes, cites, exhibits, revisions', () => {
    const md = matterMarkdown(t, s, model(), c, mdMeta);
    expect(md).toContain('# Is it cheaper?');
    expect(md).toContain('Mostly, except against oil.');
    expect(md).toContain('Video: https://www.youtube.com/watch?v=vid');
    expect(md).toContain('Corrected 2026-11-02: Fixed a figure.');
    expect(md).toContain('## The headline');
    expect(md).toContain('> The dek.');
    expect(md).toContain('First sentence. [1] Second sentence. [2] (Corrected 2026-11-02)');
    expect(md).toContain('**Unresolved claim:** A gap.');
    expect(md).toContain('| a \\| b | 53% |');
    expect(md).toContain('|  | Saving |\n| --- | --- |');
    expect(md).toContain('Source: Doc, lines 1-2');
    expect(md).toContain('| Projects | 273 |');
    expect(md).toContain('| Largest rise | $1,000 |');
    expect(md).toContain(`1. [NREL model, lines 10-12](${citeUrl})`);
    expect(md).toContain('2. [Exhibit 3: A video](https://www.youtube.com/watch?v=abc)');
    expect(md).toContain('### Qualified claim');
    const label = verdictLabel('partly', 0.8).text;
    expect(md).toContain(`- **Heat pumps cost less to run than oil.** (${label}. Depends on the oil price.)`);
    expect(md).toContain(
      '  - Denies: [A video](https://www.youtube.com/watch?v=abc) (Chan) "Oil was cheaper that winter."',
    );
    expect(md).toContain(`  - ${label} by NREL model, [lines 10-12](${citeUrl}). Above a switchover temperature.`);
    expect(md).toContain('  - Revised 2026-11-01: Verdict moved from right to partly.');
    expect(md).toContain('- Exhibit 3: [A video](https://www.youtube.com/watch?v=abc) (Chan)');
    expect(md).toContain('## Revisions');
    expect(md).toContain(
      'Calculator: run the comparison with your own prices on the page, https://example.test/heat-pumps/is-it-cheaper/#tool',
    );
    expect(md).toContain('HTML version: https://example.test/heat-pumps/is-it-cheaper/');
    expect(md.split('The disclosure.').length).toBe(2);
    expect(md).not.toContain('undefined');
  });

  it('without an article it renders the dispute, the premise and the takeaway; a follow-up points at its first question', () => {
    const first = { id: 'decision:first', title: 'The first question' } as Story;
    const md = matterMarkdown(
      t,
      { ...s, partOf: first.id },
      model({ view: null, release: null, first, firstArticle: true }),
      c,
      { ...mdMeta, firstUrl: 'https://example.test/heat-pumps/first/' },
    );
    expect(md).toContain('A follow-up question to [The first question](https://example.test/heat-pumps/first/).');
    expect(md).toContain('## The dispute\n\nSome say yes.');
    expect(md).toContain('## What the evidence shows\n\nStudies measured it.');
    expect(md).toContain('**Takeaway:** Check your oil price.');
    expect(md).toContain(
      'The article answering this question is on [The first question](https://example.test/heat-pumps/first/#article).',
    );
    expect(md).not.toContain('## The headline');
  });
});
