import { describe, expect, it } from 'vitest';
import { author, site } from '../src/config/site';
import { articleJsonLd, breadcrumbJsonLd, isoDuration, websiteJsonLd } from '../src/lib/seo';

describe('seo', () => {
  it('isoDuration', () => {
    expect(isoDuration(474.43)).toBe('PT7M54S');
    expect(isoDuration(60)).toBe('PT1M0S');
  });

  it('the publisher is the real person and no fictional organization appears', () => {
    const a = articleJsonLd({
      headline: 'h',
      description: 'd',
      path: '/x/',
      image: '/og/site.jpg',
      series: 'Commonwealth of Reason: Commission on Spending',
    });
    expect(a.url).toBe('https://commonwealthofreason.com/x/');
    expect(a.image).toBe('https://commonwealthofreason.com/og/site.jpg');
    expect(a.publisher).toEqual({ '@type': 'Person', name: author.name, url: author.links.GitHub });
    expect(JSON.stringify(a)).not.toMatch(/Organization/);
  });

  it('breadcrumbs are absolute and numbered from 1', () => {
    const b = breadcrumbJsonLd([{ name: 'B', path: '/b/' }]);
    expect(b.itemListElement[0].name).toBe(site.name);
    expect(b.itemListElement.map((x: { position: number }) => x.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe('https://commonwealthofreason.com/b/');
    for (const x of b.itemListElement) expect(x.item).toMatch(/^https:\/\/commonwealthofreason\.com\//);
    expect(websiteJsonLd().url).toBe('https://commonwealthofreason.com/');
  });
});
