/** Site-relative href that respects Astro's `base` (`/` on commonwealthofreason.com, `/video-knowledge/` on the GitHub
 *  Pages mirror). Pass root-relative paths. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL for canonical and social tags. Requires `site` in astro.config. */
export function absoluteUrl(path: string, site: URL | string): string {
  return new URL(href(path), site).toString();
}
