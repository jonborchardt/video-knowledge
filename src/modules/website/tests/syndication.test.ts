import { describe, expect, it } from 'vitest';
import { feedXml, xmlEscape } from '../syndication';

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
    { title: 'Old', url: 'https://example.test/t/old/', answer: 'old answer', inquiry: 'T', publishedAt: '2026-10-28T10:00:00Z' },
    { title: 'Undated', url: 'https://example.test/t/undated/', answer: 'releasing', inquiry: 'T' },
    { title: 'New', url: 'https://example.test/t/new/', answer: 'new answer', inquiry: 'T', publishedAt: '2026-11-04T18:00:00Z' },
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
