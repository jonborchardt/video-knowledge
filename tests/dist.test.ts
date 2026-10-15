// Checks the built site in dist/ (run `npm run build` first; `npm run validate` does).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { topicNames } from '../src/lib/topics';

const DIST = join(process.cwd(), 'dist');
const BASE = '/video-knowledge/';
const pages = ['index.html', ...topicNames().map((n) => join(n, 'index.html'))];

describe.skipIf(!existsSync(DIST))('built site', () => {
  it.each(pages)('%s exists without template leaks', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    for (const bad of ['undefined', 'NaN', '[object Object]']) expect(html).not.toContain(bad);
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
    const dirs = readdirSync(DIST, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== '_astro');
    expect(dirs.map((d) => d.name).sort()).toEqual(topicNames().sort());
  });

  it('serves a 404 page', () => {
    expect(readFileSync(join(DIST, '404.html'), 'utf8')).toContain('<h1');
  });

  it.each([...pages, '404.html'])('%s: document metadata and accessibility basics', (p) => {
    const html = readFileSync(join(DIST, p), 'utf8');
    expect(html).toMatch(/<html lang="[a-z]{2}(-[A-Z]{2})?"/);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+"/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('href="#main"'); // skip link
    expect(html).toContain('<main id="main"');
    // Every input is labelled and every icon is either hidden or named.
    for (const [tag] of html.matchAll(/<input[^>]*>/g)) expect(tag).toMatch(/aria-label=|id="/);
    for (const [tag] of html.matchAll(/<svg[^>]*>/g)) expect(tag).toMatch(/aria-hidden="true"|aria-label=/);
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
