// The static half of the web-quality gate (.claude/skills/web-quality/SKILL.md): checks the built site in dist/
// (`npm run validate` builds it first). The browser half is tests/browser/site.test.ts (`npm run test:browser`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate';
import { describe, expect, it } from 'vitest';
import {
  config,
  DIST,
  distPages,
  summarize,
  summaryControls,
  triage,
  type Exception,
  type Finding,
} from './web-quality-helpers';

const pages = distPages();
const SITE_ORIGINS = ['https://commonwealthofreason.com', 'https://jonborchardt.github.io'];

describe('web-quality exceptions', () => {
  it('each exception is narrow and has a reason', () => {
    const narrow = (e: { page: string; reason: string }) => {
      expect(e.reason.length, JSON.stringify(e)).toBeGreaterThanOrEqual(20);
      expect(['', '.*', '.+', '^.*$'], `blanket page pattern: ${e.page}`).not.toContain(e.page);
      expect(() => new RegExp(e.page)).not.toThrow();
    };
    for (const e of config.exceptions) {
      narrow(e);
      expect(e.rule, 'an exception names one rule').toMatch(/^[\w-]+$/);
      if (e.target) expect(() => new RegExp(e.target!)).not.toThrow();
    }
    config.budgets.overrides.forEach(narrow);
  });

  it('triage fails new findings and stale exceptions', () => {
    const ex: Exception[] = [
      { check: 'html', rule: 'a', page: '^x/', reason: 'r' },
      { check: 'html', rule: 'gone', page: '^x/', reason: 'r' },
    ];
    const f = (rule: string, page: string): Finding => ({ check: 'html', rule, page, detail: '' });
    const { fresh, stale } = triage('html', [f('a', 'x/index.html'), f('a', 'y/index.html')], ex);
    expect(fresh.map((x) => x.page)).toEqual(['y/index.html']);
    expect(stale.map((x) => x.rule)).toEqual(['gone']);
  });
});

describe.skipIf(!existsSync(DIST))('web-quality: built pages', () => {
  it('finds the built pages (an empty dist/ would pass every check below)', () => {
    expect(pages).toContain('index.html');
  });

  it('HTML is valid (html-validate: WHATWG content models, duplicate ids, labels, a11y basics)', async () => {
    const hv = new HtmlValidate(new FileSystemConfigLoader());
    const findings: Finding[] = [];
    for (const page of pages) {
      const report = await hv.validateFile(join(DIST, page));
      for (const r of report.results)
        for (const m of r.messages)
          findings.push({
            check: 'html',
            rule: m.ruleId,
            page,
            detail: `${m.message} (${m.selector ?? `l${m.line}`})`,
          });
    }
    const { fresh, stale } = triage('html', findings);
    if (fresh.length) throw new Error('new HTML violations:\n' + summarize(fresh));
    expect(stale, 'exceptions that no longer match: remove them').toEqual([]);
  }, 120_000);

  it.each(pages)('%s: within its page-weight budget (gzipped)', (page) => {
    const html = readFileSync(join(DIST, page), 'utf8');
    const local = (src: string) => readFileSync(join(DIST, src.replace(/^.*?(_astro\/)/, '$1')), 'utf8');
    let js = '';
    let css = '';
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (attrs.includes('application/ld+json')) continue;
      const src = attrs.match(/src="([^"]*_astro\/[^"]+)"/)?.[1];
      js += src ? local(src) : body;
    }
    for (const [, href] of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]*_astro\/[^"]+)"/g))
      css += local(href);
    for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += body;
    const limit = Object.assign(
      { ...config.budgets.default },
      ...config.budgets.overrides.filter((o) => new RegExp(o.page).test(page)),
    );
    const size = (s: string) => gzipSync(s).length;
    expect(size(js), 'JavaScript').toBeLessThanOrEqual(limit.js);
    expect(size(css), 'CSS').toBeLessThanOrEqual(limit.css);
    expect(size(html), 'HTML').toBeLessThanOrEqual(limit.html);
  });

  it.each(pages)('%s: no inline handlers, javascript: URLs or unlisted third-party resources', (page) => {
    const html = readFileSync(join(DIST, page), 'utf8');
    expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+=["']/i); // onclick= etc.: CSP-hostile and an injection sink
    expect(html).not.toMatch(/(href|src|action)=["']\s*javascript:/i);
    const allowed = [...SITE_ORIGINS, ...config.thirdParty.map((t) => t.origin)];
    // Anything the page loads by itself (scripts, styles, frames, media, preconnects); plain links are not loads.
    const loads = [
      ...html.matchAll(/<(?:script|img|iframe|source|video|audio|embed)\b[^>]*\ssrc="(https?:[^"]+)"/g),
      ...html.matchAll(
        /<link\b(?=[^>]*rel="(?:stylesheet|preconnect|preload|modulepreload|dns-prefetch)")[^>]*href="(https?:[^"]+)"/g,
      ),
    ].map((m) => new URL(m[1]).origin);
    expect(loads.filter((o) => !allowed.includes(o))).toEqual([]);
  });

  it('summaryControls finds a control inside a summary and ignores one after it', () => {
    expect(
      summaryControls('<details><summary>x <button type="button">b</button></summary><a href="/y">y</a></details>'),
    ).toEqual(['<button type="button">']);
    expect(summaryControls('<summary>plain <span data-pick="a">a</span></summary>')).toEqual([]);
  });

  // The real checkout has no live page yet, so this guards the first go-live and the rehearsal (npm run rehearse).
  it.each(pages)('%s: no control inside a <summary> (axe nested-interactive)', (page) => {
    expect(summaryControls(readFileSync(join(DIST, page), 'utf8'))).toEqual([]);
  });

  it('serves the security headers (public/_headers, honoured by Cloudflare; GitHub Pages ignores it)', () => {
    const headers = readFileSync(join(DIST, '_headers'), 'utf8');
    for (const h of config.headers) expect(headers).toContain(h);
  });
});
