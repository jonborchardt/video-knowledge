import { author, site } from '../config/site';
import { absoluteUrl } from './url';
import { loadStories, storyUrlSlug } from './stories';
import { publicTopicNames } from './topics';

/** Everything a page needs to emit <head> metadata. Pages pass it as Base's props. */
export interface PageMeta {
  title: string;
  description?: string;
  /** The share card, a site path to a 1200x675 image: a brand's `og-default` (public/og/<brand>.jpg, written by
   *  `npm run brand`). Defaults to the Commonwealth's. */
  image?: string;
  /** Error and dev-only pages: emit noindex, no canonical, no structured data. */
  noindex?: boolean;
}

export const websiteJsonLd = (siteUrl: URL) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  description: site.description,
  url: absoluteUrl('/', siteUrl),
  publisher: { '@type': 'Person', name: author.name, url: author.links.GitHub },
});

/** Root-relative paths (`/<topic>/<slug>/`) of every public story that is not ready: its matter page is noindex and
 *  left out of the sitemap until it is, so search engines only send visitors to settled answers. */
export const unlistedPaths = (): string[] =>
  publicTopicNames().flatMap((t) =>
    (loadStories(t)?.stories ?? []).filter((s) => s.readiness !== 'ready').map((s) => `/${t}/${storyUrlSlug(s)}/`),
  );

/** The sitemap filter: strips Astro's `base` from the page URL before matching. */
export const isListed = (pageUrl: string, base: string, unlisted: Set<string>): boolean => {
  const path = new URL(pageUrl).pathname;
  const b = base.replace(/\/$/, '');
  return !unlisted.has(b && path.startsWith(b) ? path.slice(b.length) : path);
};
