/** Site-relative href that respects Astro's `base` (`/video-knowledge/` in production). Pass root-relative paths. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
