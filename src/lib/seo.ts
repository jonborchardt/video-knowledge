import { author, site } from '../config/site';
import { absoluteUrl } from './url';

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
