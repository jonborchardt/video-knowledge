import { absoluteUrl } from '../lib/url';

// The canonical sitemap from both deploy targets: the mirror names commonwealthofreason.com's.
export function GET() {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap-index.xml')}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}
