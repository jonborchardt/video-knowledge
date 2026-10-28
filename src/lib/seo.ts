import { author, site } from '../config/site';
import { absoluteUrl } from './url';
import type { PublicVideo } from './outputs';

/** Everything a page needs to emit <head> metadata. Pages pass it as Base's props. */
export interface PageMeta {
  title: string;
  description?: string;
  /** The share card, a site path to a 1200x675 image: a brand's `og-default` (public/og/<brand>.jpg, written by
   *  `npm run brand`). Defaults to the Commonwealth's. */
  image?: string;
  /** Error and dev-only pages: emit noindex, no canonical, no structured data. */
  noindex?: boolean;
  /** The page's own structured data, emitted after the WebSite object (never on a noindex page). */
  jsonLd?: object[];
}

const person = () => ({ '@type': 'Person', name: author.name, url: author.links.GitHub });

export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  description: site.description,
  url: absoluteUrl('/'),
  publisher: person(),
});

// Per-page structured data (plan D11). The publisher is always the real person; an institution appears only as the
// name of a series, never as an Organization, so search engines are not told a fictional government exists.
// ClaimReview is deliberately not used: our ratings are confidence-weighted across many sources, not one claimant.
const ld = (type: string) => ({ '@context': 'https://schema.org', '@type': type });

/** Whole seconds as an ISO 8601 duration: `PT7M54S`. */
export const isoDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
};

/** A BreadcrumbList from the home page down: pass the levels below it. */
export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  ...ld('BreadcrumbList'),
  itemListElement: [{ name: site.name, path: '/' }, ...items].map((x, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: x.name,
    item: absoluteUrl(x.path),
  })),
});

export const articleJsonLd = (a: {
  headline: string;
  description: string;
  path: string;
  image: string;
  series: string;
  datePublished?: string;
  dateModified?: string;
}) => ({
  ...ld('Article'),
  headline: a.headline,
  description: a.description,
  url: absoluteUrl(a.path),
  image: absoluteUrl(a.image),
  ...(a.datePublished && { datePublished: a.datePublished }),
  ...(a.dateModified && { dateModified: a.dateModified }),
  author: person(),
  publisher: person(),
  isPartOf: { '@type': 'CreativeWorkSeries', name: a.series },
});

export const videoJsonLd = (v: PublicVideo, description: string, thumbnail: string) => ({
  ...ld('VideoObject'),
  name: v.title,
  description,
  thumbnailUrl: absoluteUrl(thumbnail),
  uploadDate: v.publishedAt,
  ...(v.seconds !== null && { duration: isoDuration(v.seconds) }),
  embedUrl: v.embedUrl,
  url: v.url,
});

export const reportJsonLd = (
  name: string,
  description: string,
  path: string,
  dateModified: string | null,
  series: string,
) => ({
  ...ld('Report'),
  name,
  description,
  url: absoluteUrl(path),
  ...(dateModified && { dateModified }),
  author: person(),
  publisher: person(),
  isPartOf: { '@type': 'CreativeWorkSeries', name: series },
});

export const collectionJsonLd = (name: string, description: string, path: string) => ({
  ...ld('CollectionPage'),
  name,
  description,
  url: absoluteUrl(path),
  publisher: person(),
});
