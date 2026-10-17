import { author, site } from '../config/site';
import { absoluteUrl } from './url';

/** Everything a page needs to emit <head> metadata. Pages pass it as Base's props. */
export interface PageMeta {
  title: string;
  description?: string;
  /** Root-relative or absolute image URL; defaults to the site card. */
  image?: string;
  imageAlt?: string;
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
