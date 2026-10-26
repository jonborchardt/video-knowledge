// Checks the built site in dist/ (run `npm run build` first; `npm run validate` does).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { author, commissionKey, commissionOf, commissions, site } from '../src/config/site';
import { FINDING_LABELS, FINDING_TEXT } from '../src/lib/finding-label';
import { loadArticleRelease } from '../src/lib/article';
import {
  contentGraph,
  distPages,
  matterPath,
  storyNode,
  hasVideo,
  loadMoved,
  manifestProblems,
} from '../src/lib/content-graph';
import { datasetChart } from '../src/lib/chart-geometry';
import { dataRef, loadDatasets } from '../src/lib/datasets';
import { ROOT, readJson, topicDir } from '../src/lib/io';
import type { Storyboard } from '../src/lib/storyboard';
import { loadStories, storyUrlSlug } from '../src/lib/stories';
import { loadPublicRecord } from '../src/lib/public-record';
import { loadTopic, publicTopicNames, topicNames } from '../src/lib/topics';

const DIST = join(ROOT, 'dist');
// Same switch as astro.config.mjs: the GitHub Pages mirror under a base path, else the root site.
const PAGES = process.env.DEPLOY_TARGET === 'pages';
const SITE = PAGES ? 'https://jonborchardt.github.io' : 'https://commonwealthofreason.com';
const BASE = PAGES ? '/video-knowledge/' : '/';
// The live view, never siteGraph: vitest runs with DEV true, which would pick the preview view.
const live = contentGraph();
const liveTopics = publicTopicNames().filter((t) => live.nodes.get(t)?.public);
const storyPages = liveTopics.flatMap((topic) =>
  (loadStories(topic)?.stories ?? [])
    .filter((s) => live.nodes.get(storyNode(topic, s.id))?.public)
    .map((s) => ({ topic, slug: storyUrlSlug(s), s })),
);
const liveData = (topic: string) => loadDatasets(topic).filter((d) => live.nodes.get(dataRef(topic, d.id))?.public);
const pages = [
  'index.html',
  'about/index.html',
  'inquiries/index.html',
  'institutions/index.html',
  ...Object.keys(commissions).map((k) => `commissions/${k}/index.html`),
  ...liveTopics.map((n) => `${n}/index.html`),
  ...storyPages.map((p) => `${p.topic}/${p.slug}/index.html`),
  ...liveTopics.filter((n) => liveData(n).length > 0).map((n) => `${n}/data/index.html`),
];
const sitemapXml = () => {
  const index = readFileSync(join(DIST, 'sitemap-index.xml'), 'utf8');
  const part = index.match(/<loc>[^<]*\/(sitemap-\d+\.xml)<\/loc>/)![1];
  return readFileSync(join(DIST, part), 'utf8');
};
const ldOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v); // RFC 4180
const decode = (s: string) => s.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');

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

  it('builds no page or file for a story, topic or dataset that is not live', () => {
    for (const t of publicTopicNames()) expect(existsSync(join(DIST, t)), t).toBe(!!live.nodes.get(t)?.public);
    for (const n of live.nodes.values()) {
      if (n.kind === 'story' && !n.public)
        expect(existsSync(join(DIST, matterPath(n.topic!, live.stories.get(n.id)!))), n.id).toBe(false);
      if (n.kind === 'dataset' && !n.public) {
        const id = n.id.slice(n.id.indexOf('/') + 1); // data:<topic>/<id>
        expect(existsSync(join(DIST, n.topic!, 'data', `${id}.json`)), n.id).toBe(false);
      }
    }
  });

  it('with nothing live the home page and inquiries say so', () => {
    if (liveTopics.length) return;
    for (const p of ['index.html', 'inquiries/index.html'])
      expect(readFileSync(join(DIST, p), 'utf8'), p).toContain('No findings published yet.');
  });

  it('an inquiry page carries its matters and exhibits, and no register', () => {
    for (const t of liveTopics) {
      const html = readFileSync(join(DIST, t, 'index.html'), 'utf8');
      expect(html).toContain('id="matters"');
      expect(html).toContain('id="sources"');
      for (const id of ['recap', 'top', 'wrong-claims', 'contested-claims', 'claims', 'studies'])
        expect(html).not.toContain(`id="${id}"`);
    }
    expect(existsSync(join(DIST, 'heat-pumps', 'register'))).toBe(false);
  });

  it('only built pages for topics an institution publishes; no admin pages', () => {
    const dirs = readdirSync(DIST, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && !['_astro', 'og', 'stamps'].includes(d.name),
    );
    expect(dirs.map((d) => d.name).sort()).toEqual(
      ['about', 'commissions', 'inquiries', 'institutions', ...liveTopics].sort(),
    );
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
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).not.toContain(`href="${BASE}admin`);
  });

  it('the directory lists every institution, links only real channels and features a story', () => {
    const html = readFileSync(join(DIST, 'institutions/index.html'), 'utf8');
    for (const c of Object.values(commissions)) {
      expect(html).toContain(c.name);
      if (c.youtube) expect(html).toContain(`href="${c.youtube}"`);
    }
    expect(html).toContain('Channel coming soon');
    if (liveTopics.length) expect(html).toContain('Featured matter');
    expect(html).toContain('The Commonwealth is fictional. The research is real.');
  });

  it('commission pages name the institution, its inquiries and their stories', () => {
    for (const [k, c] of Object.entries(commissions)) {
      const html = readFileSync(join(DIST, 'commissions', k, 'index.html'), 'utf8');
      expect(html).toContain(c.ceremonialName);
      expect(html).toContain(c.fullName);
      const published = c.topics.filter((n) => liveTopics.includes(n));
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

  it('a matter with a released article shows it with its headline and sources; a follow-up links to it', () => {
    for (const { topic, slug, s } of storyPages) {
      const r = loadArticleRelease(topic, s.partOf ?? s.id);
      if (!r) continue;
      const html = decode(readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8'));
      if (s.partOf) {
        expect(html).not.toContain('data-article');
        expect(html).toContain(`${storyUrlSlug({ id: s.partOf })}/#article"`);
      } else {
        expect(html).toContain('data-article');
        expect(html).toContain(r.article.meta.headline);
      }
    }
  });

  it('an article figure is an svg with a text alternative and its data table', () => {
    let drawn = 0;
    for (const { topic, slug, s } of storyPages) {
      const r = s.partOf ? null : loadArticleRelease(topic, s.id);
      const figures = (r?.article.sections.flatMap((x) => x.blocks) ?? []).filter((b) => b.kind === 'figure');
      if (!figures.length) continue;
      const html = decode(readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8'));
      const charts = html.match(/<figure[^>]*>[\s\S]*?<\/figure>/g) ?? [];
      // what each figure draws: a storyboard chart, or a dataset's chart when one fits
      const specs = figures.flatMap((f) => {
        const d = loadDatasets(topic).find((x) => dataRef(topic, x.id) === f.ref);
        const [sl, scene] = f.ref.split('/');
        const sb = readJson<Storyboard>(join(topicDir(topic), 'scripts', sl, 'storyboard.json'));
        const spec = d ? datasetChart(d) : sb?.scenes.find((x) => x.id === scene)?.visual.chart;
        return spec ? [{ spec, data: !!d }] : [];
      });
      expect(charts, `${topic}/${slug}`).toHaveLength(specs.length);
      specs.forEach(({ spec, data }, i) => {
        const c = charts[i];
        if (['bar', 'stacked-bar', 'dot-plot', 'stat-tiles'].includes(spec.type))
          expect(c).toMatch(/<svg[^>]*role="img"[^>]*aria-label="[^"]+"/);
        else expect(c).not.toContain('<svg');
        if (data)
          expect(c).not.toContain('<details'); // the dataset's own table carries the data
        else expect(c).toMatch(/<details[\s\S]*<table[\s\S]*<td/);
        expect(c).toContain('Source:');
        drawn++;
      });
    }
    if (storyPages.length) expect(drawn).toBeGreaterThan(0);
  });

  it('no two story pages share a title', () => {
    const titles = storyPages.map(
      ({ topic, slug }) =>
        readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8').match(/<title>([^<]+)<\/title>/)![1],
    );
    expect(titles.filter((x, i) => titles.indexOf(x) !== i)).toEqual([]);
  });

  it('topic pages are branded as the institution that publishes them', () => {
    for (const n of liveTopics) {
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
    for (const n of liveTopics) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      const cards = html.match(/<details[^>]*data-claim/g)!.length;
      expect(html.match(/data-label="(verified|qualification|unresolved|reported)"/g)!.length).toBe(cards);
    }
  });

  it('topic, matter and institution pages open with one report header and the seal', () => {
    const heads = [
      ...liveTopics.map((n) => `${n}/index.html`),
      ...storyPages.map((p) => `${p.topic}/${p.slug}/index.html`),
      ...Object.keys(commissions).map((k) => `commissions/${k}/index.html`),
    ];
    for (const p of heads) {
      const html = readFileSync(join(DIST, p), 'utf8');
      expect(html.match(/data-report-header/g), p).toHaveLength(1);
      expect(html).toMatch(new RegExp(`src="${BASE}commissions/[a-z-]+\\.png"`));
    }
  });

  it('a matter answers first: the resolution and label strip come before the claims', () => {
    for (const { topic, slug, s } of storyPages) {
      const html = decode(readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8'));
      expect(html.indexOf('id="answer"')).toBeGreaterThan(-1);
      expect(html.indexOf('id="answer"')).toBeLessThan(html.indexOf('aria-labelledby="claims"'));
      if (s.readiness === 'ready') expect(html).toContain(s.arc.resolution); // an unready arc is the writer's brief
    }
  });

  it('matter pages list their exhibits by number', () => {
    for (const { topic, slug } of storyPages) {
      const html = readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8');
      expect(html).toContain('aria-labelledby="exhibits"');
      // the exhibits list only: an article's sources are numbered in reading order
      const list = html.slice(html.indexOf('aria-labelledby="exhibits"'));
      const nums = [...list.matchAll(/Exhibit (\d+)/g)].map((m) => Number(m[1]));
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
  });

  it('ready matters carry Article and BreadcrumbList; unsettled ones carry none; nothing claims a review', () => {
    for (const { topic, slug, s } of storyPages) {
      const html = readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8');
      const types = ldOf(html).map((x) => x['@type']);
      if (s.readiness === 'ready') expect(types).toEqual(expect.arrayContaining(['Article', 'BreadcrumbList']));
      else expect(types).toEqual([]);
      expect(html).not.toContain('ClaimReview');
    }
  });

  it('inquiries carry a Report and institutions a CollectionPage, each with breadcrumbs', () => {
    for (const n of liveTopics)
      expect(ldOf(readFileSync(join(DIST, n, 'index.html'), 'utf8')).map((x) => x['@type'])).toEqual(
        expect.arrayContaining(['Report', 'BreadcrumbList']),
      );
    for (const k of Object.keys(commissions))
      expect(ldOf(readFileSync(join(DIST, 'commissions', k, 'index.html'), 'utf8')).map((x) => x['@type'])).toEqual(
        expect.arrayContaining(['CollectionPage', 'BreadcrumbList']),
      );
  });

  it('the front page leads with ready matters and links the directory', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const ready = storyPages.filter((p) => p.s.readiness === 'ready' && !p.s.partOf);
    if (ready.length) expect(ready.some((p) => html.includes(`href="${BASE}${p.topic}/${p.slug}/"`))).toBe(true);
    expect(html).toContain(`href="${BASE}institutions/"`);
  });

  it('about names the real publisher and gives no contact address', () => {
    const html = readFileSync(join(DIST, 'about/index.html'), 'utf8');
    expect(html).toContain('id="publisher"');
    expect(html).toContain(author.name);
    expect(html).not.toContain('mailto:');
  });

  it('the directory carries a CollectionPage', () => {
    const types = ldOf(readFileSync(join(DIST, 'institutions/index.html'), 'utf8')).map((x) => x['@type']);
    expect(types).toEqual(expect.arrayContaining(['CollectionPage', 'BreadcrumbList']));
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
    const sitemap = sitemapXml();
    for (const p of pages) {
      expect(sitemap).toContain(`<loc>${SITE}${BASE}${p.replace('index.html', '')}</loc>`);
    }
    expect(sitemap).not.toContain('404');
    expect(sitemap).not.toContain('/admin');
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
    for (const n of liveTopics) {
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

  it.skipIf(!storyPages.some((p) => p.slug === 'is-it-cheaper-to-run-than-gas'))(
    'the tool section informs without JavaScript',
    () => {
      const html = readFileSync(join(DIST, 'heat-pumps', 'is-it-cheaper-to-run-than-gas', 'index.html'), 'utf8');
      expect(html).toContain('data-tool="heating-cost"');
      expect(html).toContain('3.28'); // the U.S. break-even in the worked examples
      expect(html).toContain('not a prediction');
      expect(html).toContain('Gas used for heating'); // not the whole bill: winter use minus summer use
    },
  );

  it('a topic with datasets has a data page with each table and its downloads', () => {
    for (const n of liveTopics) {
      const ds = liveData(n);
      expect(existsSync(join(DIST, n, 'data/index.html'))).toBe(ds.length > 0);
      for (const d of ds) {
        expect(readFileSync(join(DIST, n, 'data', `${d.id}.csv`), 'utf8').split('\n')[0]).toBe(
          ['label', ...d.columns.map((c) => c.label)].map(csvCell).join(','),
        );
        expect(JSON.parse(readFileSync(join(DIST, n, 'data', `${d.id}.json`), 'utf8'))).toEqual(d);
      }
    }
  });

  it('ready matters list related matters that exist, never themselves', () => {
    let seen = 0;
    for (const { topic, slug, s } of storyPages.filter((p) => p.s.readiness === 'ready')) {
      const html = readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8');
      const sec = html.match(/<section aria-labelledby="related">([\s\S]*?)<\/section>/)?.[1];
      if (!sec) continue;
      seen++;
      for (const [, h] of sec.matchAll(/href="([^"#]*)"/g)) {
        expect(existsSync(join(DIST, h.slice(BASE.length), 'index.html')), h).toBe(true);
        expect(h, s.id).not.toBe(`${BASE}${topic}/${slug}/`);
      }
    }
    if (storyPages.some((p) => p.s.readiness === 'ready')) expect(seen).toBeGreaterThan(0);
  });

  it('the built site keeps every url in public-urls.json', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'public-urls.json'), 'utf8')) as string[];
    const { built, indexed } = distPages(DIST);
    expect(manifestProblems(manifest, built, indexed)).toEqual([]);
  });

  it('a redirect page is noindex, points at its target and is not in the sitemap', () => {
    const sitemap = sitemapXml();
    for (const topic of liveTopics)
      for (const [from, to] of Object.entries(loadMoved(topic))) {
        const [old, now] = [from, to].map((id) => `${topic}/${storyUrlSlug({ id })}/`);
        const html = readFileSync(join(DIST, old, 'index.html'), 'utf8');
        expect(html).toContain('content="noindex"');
        expect(html).toContain(`rel="canonical" href="${SITE}${BASE}${now}"`);
        expect(html).toContain('http-equiv="refresh"');
        expect(sitemap).not.toContain(`${BASE}${old}<`);
      }
  });

  it('every ready matter shows one primary call to action that resolves', () => {
    for (const { topic, slug } of storyPages.filter((p) => p.s.readiness === 'ready' && !p.s.partOf)) {
      const html = readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8');
      expect(html.match(/data-cta="/g), slug).toHaveLength(1);
      const target = html.match(/href="([^"]*)"[^>]*data-cta="/)![1];
      if (target.startsWith('#')) expect(html, `${slug} ${target}`).toContain(`id="${target.slice(1)}"`);
    }
  });

  // Breadth-first over the built pages from `start`, following hrefs under the base: page -> clicks from start.
  const crawl = (start: string) => {
    const depth = new Map([[start, 0]]);
    const queue = [start];
    for (let page = queue.shift(); page !== undefined; page = queue.shift()) {
      const html = readFileSync(join(DIST, page), 'utf8');
      for (const [, h] of html.matchAll(/href="([^"#?]*)/g)) {
        if (!h.startsWith(BASE) || /\.\w+$/.test(h)) continue;
        const next = `${h.slice(BASE.length)}index.html`.replace(/^\//, '');
        if (depth.has(next) || !existsSync(join(DIST, next))) continue;
        depth.set(next, depth.get(page)! + 1);
        queue.push(next);
      }
    }
    return depth;
  };
  const header = (html: string) => html.match(/<header[^>]*data-report-header[\s\S]*?<\/header>/)?.[0] ?? '';

  it('every public page is reachable from home, matters within three clicks', () => {
    const depth = crawl('index.html');
    const sitemap = [...sitemapXml().matchAll(/<loc>([^<]*)<\/loc>/g)].map(
      (m) => `${m[1].slice(SITE.length + BASE.length)}index.html`,
    );
    for (const p of sitemap) expect(depth.has(p), p).toBe(true);
    for (const { topic, slug, s } of storyPages.filter((x) => !x.s.partOf))
      expect(depth.get(`${topic}/${slug}/index.html`), s.id).toBeLessThanOrEqual(3);
  });

  it('every source on a live matter page has an exhibit number', () => {
    for (const { topic, s } of storyPages) {
      const rec = loadPublicRecord(topic);
      const claims = new Set(s.claims);
      for (const c of loadTopic(topic).claims.filter((c) => claims.has(c.id)))
        for (const x of c.sources) expect(rec.exhibits[x.id], `${s.id} ${x.id}`).toBeGreaterThan(0);
    }
  });

  it('an inquiry page links every matter of the inquiry and marks the live videos', () => {
    const g = contentGraph();
    for (const n of liveTopics) {
      const html = readFileSync(join(DIST, n, 'index.html'), 'utf8');
      const sec = html.match(/<section id="matters"[\s\S]*?<\/section>/)?.[0] ?? '';
      for (const { slug, s } of storyPages.filter((x) => x.topic === n)) {
        const at = sec.indexOf(`href="${BASE}${n}/${slug}/"`);
        expect(at, `${n} ${s.id}`).toBeGreaterThan(-1);
        if (s.partOf) continue;
        const entry = sec.slice(at, sec.indexOf('</li>', at));
        expect(entry.includes('Video'), `${s.id} video mark`).toBe(hasVideo(g, `${n}/${s.id}`));
      }
    }
  });

  it('every page below home links to its parent', () => {
    for (const key of Object.keys(commissions))
      expect(header(readFileSync(join(DIST, 'commissions', key, 'index.html'), 'utf8')), key).toContain(
        `href="${BASE}"`,
      );
    for (const n of liveTopics) {
      const inst = `href="${BASE}commissions/${commissionKey(commissionOf(n)!)}/"`;
      expect(header(readFileSync(join(DIST, n, 'index.html'), 'utf8')), n).toContain(inst);
      if (liveData(n).length)
        expect(header(readFileSync(join(DIST, n, 'data', 'index.html'), 'utf8'))).toContain(`href="${BASE}${n}/"`);
    }
    for (const { topic, slug } of storyPages)
      expect(header(readFileSync(join(DIST, topic, slug, 'index.html'), 'utf8')), slug).toContain(
        `href="${BASE}${topic}/"`,
      );
  });

  it('a list that mixes kinds of page marks each kind; an inquiry is never called a matter', () => {
    const dir = readFileSync(join(DIST, 'institutions', 'index.html'), 'utf8');
    for (const k of liveTopics.length ? ['inquiry', 'matter', 'external'] : ['external'])
      expect(dir, k).toContain(`href="#icon-${k}"`);
    if (liveTopics.length) expect(dir).toContain('Featured matter');
    expect(dir).not.toContain('Featured inquiry');
    for (const n of liveTopics)
      expect(header(readFileSync(join(DIST, n, 'index.html'), 'utf8')), n).not.toMatch(/>Matter</);
  });
});
