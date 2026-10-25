// Checks the built site in dist/ (run `npm run build` first; `npm run validate` does).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commissions, site } from '../src/config/site';
import { FINDING_LABELS, FINDING_TEXT } from '../src/lib/finding-label';
import { ROOT } from '../src/lib/io';
import { loadStories, storyUrlSlug } from '../src/lib/stories';
import { publicTopicNames, topicNames } from '../src/lib/topics';

const DIST = join(ROOT, 'dist');
// Same switch as astro.config.mjs: the GitHub Pages mirror under a base path, else the root site.
const PAGES = process.env.DEPLOY_TARGET === 'pages';
const SITE = PAGES ? 'https://jonborchardt.github.io' : 'https://commonwealthofreason.com';
const BASE = PAGES ? '/video-knowledge/' : '/';
const storyPages = publicTopicNames().flatMap((topic) =>
  (loadStories(topic)?.stories ?? []).map((s) => ({ topic, slug: storyUrlSlug(s), s })),
);
const pages = [
  'index.html',
  'about/index.html',
  ...Object.keys(commissions).map((k) => `commissions/${k}/index.html`),
  ...publicTopicNames().map((n) => `${n}/index.html`),
  ...storyPages.map((p) => `${p.topic}/${p.slug}/index.html`),
];

describe.skipIf(!existsSync(DIST))('built site', () => {
  it.each(pages)('%s exists without template leaks', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    // A leak renders as a whole text node or attribute value; quoted prose may legitimately say "undefined".
    expect(html).not.toMatch(/[>"](undefined|NaN|\[object Object\])[<"]/);
  });

  it.each(pages)('%s: internal links and images resolve under the base path', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8');
    for (const [, href] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#]*)"/g)) {
      expect(href.startsWith(BASE), `${href} skips the base: build it with href()`).toBe(true);
      const path = join(DIST, href.slice(BASE.length));
      const file = /\.\w+$/.test(path) ? path : join(path, 'index.html'); // a page is a folder with index.html
      expect(existsSync(file), href).toBe(true);
    }
  });

  it('topic pages have their tab sections', () => {
    for (const n of publicTopicNames()) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      for (const id of ['recap', 'top', 'claims', 'sources']) expect(html).toContain(`<section id="${id}"`);
      expect(html).toContain('data-verdict=');
    }
  });

  it('only built pages for topics an institution publishes; no admin pages', () => {
    const dirs = readdirSync(DIST, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && !['_astro', 'og', 'stamps'].includes(d.name),
    );
    expect(dirs.map((d) => d.name).sort()).toEqual(['about', 'commissions', ...publicTopicNames()].sort());
    for (const n of topicNames()) {
      expect(existsSync(join(DIST, n, 'stories')), `${n}/stories`).toBe(false);
      expect(existsSync(join(DIST, n, 'scripts')), `${n}/scripts`).toBe(false);
      for (const r of ['review', 'review-media', 'review-action'])
        expect(existsSync(join(DIST, n, r)), `${n}/${r}`).toBe(false);
    }
    // the review builds are streamed by the dev server only: no video is ever part of the site
    const files = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)],
      );
    expect(files(DIST).filter((f) => f.endsWith('.mp4'))).toEqual([]);
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).not.toContain(`href="${BASE}production/"`);
  });

  it('the home page lists every institution, links only real channels and features a story', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    for (const c of Object.values(commissions)) {
      expect(html).toContain(c.name);
      if (c.youtube) expect(html).toContain(`href="${c.youtube}"`);
    }
    expect(html).toContain('Channel coming soon');
    expect(html).toContain('Featured inquiry');
    expect(html).toContain('The Commonwealth is fictional. The research is real.');
  });

  it('commission pages name the institution, its inquiries and their stories', () => {
    for (const [k, c] of Object.entries(commissions)) {
      const html = readFileSync(join(DIST, 'commissions', k, 'index.html'), 'utf8');
      expect(html).toContain(c.ceremonialName);
      expect(html).toContain(c.fullName);
      const published = c.topics.filter((n) => publicTopicNames().includes(n));
      for (const n of published) expect(html).toContain(`href="${BASE}${n}/"`);
      if (published.length) expect(html).toContain('Matters before the');
      else expect(html).toContain('no inquiry published yet');
    }
  });

  it('story pages carry the question and its claims, and the commission page links to them', () => {
    for (const { topic, slug, s } of storyPages) {
      const html = readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8');
      expect(html).toContain('<section aria-labelledby="claims"');
      expect(html).toContain('data-verdict=');
      expect(html).toContain(`href="${BASE}${topic}/"`);
      // its own share card, the question drawn on it (npm run brand)
      expect(html).toContain(`<meta property="og:image" content="${SITE}${BASE}og/stories/${topic}/${slug}.jpg"`);
      expect(existsSync(join(DIST, 'og/stories', topic, `${slug}.jpg`)), `${topic}/${slug} card`).toBe(true);
      if (!s.partOf) {
        const c = Object.entries(commissions).find(([, c]) => c.topics.includes(topic))![0];
        expect(readFileSync(join(DIST, 'commissions', c, 'index.html'), 'utf8')).toContain(
          `href="${BASE}${topic}/${slug}/"`,
        );
      }
    }
  });

  it('topic pages are branded as the institution that publishes them', () => {
    for (const n of publicTopicNames()) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      const [key, c] = Object.entries(commissions).find(([, c]) => c.topics.includes(n))!;
      // The institution's brand kit: its share card and its seal (written by npm run brand).
      expect(html).toContain(`/og/${key}.jpg"`);
      expect(html).toContain(`src="${BASE}commissions/${key}.png"`);
      expect(html).toContain('Published by');
      expect(html).toContain(c.fullName);
      expect(html).toContain(c.ceremonialName);
      expect(html).toContain('Entered into the Public Record');
      // the kit's record stamp closes the page, in both inks (dark mode swaps them)
      for (const g of ['paper', 'ground'])
        expect(html).toContain(`src="${BASE}stamps/${key}/stamp-record-rect-${g}.png"`);
    }
  });

  it('about explains the four finding labels', () => {
    const html = readFileSync(join(DIST, 'about/index.html'), 'utf8');
    expect(html).toContain('id="labels"');
    for (const l of FINDING_LABELS) expect(html).toContain(FINDING_TEXT[l].name);
  });

  it('every claim card carries one finding label', () => {
    for (const n of publicTopicNames()) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      const cards = html.match(/<details[^>]*data-claim/g)!.length;
      expect(html.match(/data-label="(verified|qualification|unresolved|reported)"/g)!.length).toBe(cards);
    }
  });

  it('serves a 404 page', () => {
    expect(readFileSync(join(DIST, '404.html'), 'utf8')).toContain('<h1');
  });

  it.each(pages)('%s: canonical and social metadata', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8');
    expect(html).toContain(`<link rel="canonical" href="${SITE}${BASE}`);
    expect(html).not.toContain('name="robots"');
    expect(html).toContain('type="application/ld+json"');
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(image, 'og:image').toMatch(new RegExp(`^${SITE}${BASE}`));
    expect(existsSync(join(DIST, image!.slice((SITE + BASE).length))), image).toBe(true);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it('404 is noindex and makes no canonical claim', () => {
    const html = readFileSync(join(DIST, '404.html'), 'utf8');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
  });

  it('robots.txt points at the sitemap, which lists every page', () => {
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE}${BASE}sitemap-index.xml`);
    const index = readFileSync(join(DIST, 'sitemap-index.xml'), 'utf8');
    const part = index.match(/<loc>[^<]*\/(sitemap-\d+\.xml)<\/loc>/)![1];
    const sitemap = readFileSync(join(DIST, part), 'utf8');
    for (const p of pages) {
      expect(sitemap).toContain(`<loc>${SITE}${BASE}${p.replace('index.html', '')}</loc>`);
    }
    expect(sitemap).not.toContain('404');
    expect(sitemap).not.toContain('/production/');
  });

  it('about page marks its nav link as current', () => {
    const html = readFileSync(join(DIST, 'about/index.html'), 'utf8');
    expect(html).toContain(`<a href="${BASE}about/" aria-current="page"`);
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).not.toContain('aria-current="page"');
  });

  it.each([...pages, '404.html'])('%s: document metadata and accessibility basics', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8');
    expect(html).toMatch(/<html lang="[a-z]{2}(-[A-Z]{2})?"/);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('href="#main"'); // skip link
    expect(html).toContain('<main id="main"');
    // The truth boundary is said once per surface: the footer, nowhere else (CLAUDE.md, Names).
    expect(html.split(site.disclosure).length - 1, 'site.disclosure once').toBe(1);
    // Every input is labelled and every icon is either hidden or named.
    for (const [tag] of html.matchAll(/<input[^>]*>/g)) expect(tag).toMatch(/aria-label=|id="/);
    for (const [tag] of html.matchAll(/<svg[^>]*>/g)) expect(tag).toMatch(/aria-hidden="true"|aria-label=/);
    // Images carry alt text and dimensions (none today; this guards the first one).
    for (const [tag] of html.matchAll(/<img[^>]*>/g)) {
      expect(tag).toMatch(/alt="/);
      expect(tag).toMatch(/width="/);
      expect(tag).toMatch(/height="/);
    }
    // No fixed pixel widths that could overflow a narrow screen.
    expect(html).not.toMatch(/style="[^"]*width:\s*\d{3,}px/);
  });

  it('topic pages: tabs, table headers and the search box are wired up', () => {
    for (const n of publicTopicNames()) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      expect(html).toContain('role="tablist"');
      for (const [tab] of html.matchAll(/<button[^>]*role="tab"[^>]*>/g)) {
        const id = tab.match(/aria-controls="([^"]+)"/)![1];
        expect(html).toContain(`<section id="${id}"`);
      }
      for (const [th] of html.matchAll(/<th[\s>][^>]*>/g)) expect(th).toContain('scope="col"');
      expect(html).toContain('role="status"');
      expect(html).toContain('<symbol id="icon-video"'); // the shared icon sprite SourceLink points at
    }
  });
});
