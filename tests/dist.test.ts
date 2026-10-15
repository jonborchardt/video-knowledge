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
});
