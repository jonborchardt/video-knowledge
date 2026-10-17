// Checks the built site in dist/ (run `npm run build` first; `npm run validate` does).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { topicNames } from '../src/lib/topics';

const DIST = join(process.cwd(), 'dist');
const SITE = 'https://jonborchardt.github.io';
const BASE = '/video-knowledge/';
const pages = ['index.html', 'about/index.html', ...topicNames().map((n) => `${n}/index.html`)];

describe.skipIf(!existsSync(DIST))('built site', () => {
  it.each(pages)('%s exists without template leaks', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    // A leak renders as a whole text node or attribute value; quoted prose may legitimately say "undefined".
    expect(html).not.toMatch(/[>"](undefined|NaN|\[object Object\])[<"]/);
  });

  it.each(pages)('%s: internal links resolve', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8');
    for (const [, href] of html.matchAll(/href="(\/video-knowledge\/[^"#]*)"/g)) {
      const path = join(DIST, href.slice(BASE.length));
      const file = /\.\w+$/.test(path) ? path : join(path, 'index.html'); // a page is a folder with index.html
      expect(existsSync(file), href).toBe(true);
    }
  });

  it('topic pages have their tab sections', () => {
    for (const n of topicNames()) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      for (const id of ['recap', 'top', 'claims', 'sources']) expect(html).toContain(`<section id="${id}"`);
      expect(html).toContain('data-verdict=');
    }
  });

  it('only built pages for real topics', () => {
    const dirs = readdirSync(DIST, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && !['_astro', 'og'].includes(d.name),
    );
    expect(dirs.map((d) => d.name).sort()).toEqual(['about', ...topicNames()].sort());
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
  });

  it('about page marks its nav link as current', () => {
    const html = readFileSync(join(DIST, 'about/index.html'), 'utf8');
    expect(html).toMatch(/<a href="\/video-knowledge\/about\/" aria-current="page"/);
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
    for (const n of topicNames()) {
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
