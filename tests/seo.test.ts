import { describe, expect, it } from 'vitest';
import { author } from '../src/config/site';
import { articleJsonLd, breadcrumbJsonLd, isListed, isoDuration, unlistedPaths } from '../src/lib/seo';
import { loadStories, storyUrlSlug } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';

describe('seo', () => {
  it('unlisted paths match under a base', () => {
    const u = new Set(['/heat-pumps/x/']);
    expect(isListed('https://jonborchardt.github.io/video-knowledge/heat-pumps/x/', '/video-knowledge/', u)).toBe(
      false,
    );
    expect(isListed('https://commonwealthofreason.com/heat-pumps/x/', '/', u)).toBe(false);
    expect(isListed('https://commonwealthofreason.com/heat-pumps/', '/', u)).toBe(true);
  });

  it('unlisted paths are exactly the public stories not ready', () => {
    const want = publicTopicNames().flatMap((t) =>
      (loadStories(t)?.stories ?? []).filter((s) => s.readiness !== 'ready').map((s) => `/${t}/${storyUrlSlug(s)}/`),
    );
    expect(unlistedPaths().sort()).toEqual(want.sort());
  });

  it('isoDuration', () => {
    expect(isoDuration(474.43)).toBe('PT7M54S');
    expect(isoDuration(60)).toBe('PT1M0S');
  });

  it('the publisher is the real person and no fictional organization appears', () => {
    const a = articleJsonLd(
      {
        headline: 'h',
        description: 'd',
        path: '/x/',
        image: '/og/site.jpg',
        series: 'Commonwealth of Reason: Commission on Spending',
      },
      new URL('https://commonwealthofreason.com'),
    );
    expect(a.publisher).toEqual({ '@type': 'Person', name: author.name, url: author.links.GitHub });
    expect(JSON.stringify(a)).not.toMatch(/Organization/);
  });

  it('breadcrumbs are absolute and numbered from 1', () => {
    const b = breadcrumbJsonLd(
      [
        { name: 'A', path: '/' },
        { name: 'B', path: '/b/' },
      ],
      new URL('https://commonwealthofreason.com'),
    );
    expect(b.itemListElement.map((x: { position: number }) => x.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe('https://commonwealthofreason.com/b/');
  });
});
