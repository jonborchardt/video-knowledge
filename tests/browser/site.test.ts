// The browser half of the web-quality gate (.claude/skills/web-quality/SKILL.md): real browsers against the built site
// in dist/, served by `astro preview`. Run through `npm run test:browser` (representative pages, Chromium) or
// `npm run quality -- --audit` (every page, Chromium + Firefox + WebKit). Env: WEB_QUALITY_BROWSERS=chromium,firefox,webkit,
// WEB_QUALITY_FULL=1 for every page. Findings go through the same exceptions as the static gate (tests/web-quality.json).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import axe from 'axe-core';
import { preview } from 'astro';
import { chromium, firefox, webkit, type Browser, type BrowserContextOptions, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT } from '../../src/lib/io';
import { DIST, distPages, representativePages, summarize, triage, type Finding } from '../web-quality-helpers';

const ENGINES = { chromium, firefox, webkit };
const BROWSERS = (process.env.WEB_QUALITY_BROWSERS ?? 'chromium').split(',') as (keyof typeof ENGINES)[];
const pages = existsSync(DIST) ? (process.env.WEB_QUALITY_FULL === '1' ? distPages() : representativePages()) : [];
const BASE = process.env.DEPLOY_TARGET === 'pages' ? '/video-knowledge/' : '/';
const WIDTHS = [320, 375, 768, 1024, 1440]; // the named breakpoints; the sweep below covers the widths between
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const isTopic = (p: string) =>
  /^[^/]+\/index\.html$/.test(p) && !/^(about|commissions|inquiries|institutions|privacy)\//.test(p);

let server: Awaited<ReturnType<typeof preview>>;
let origin = '';
const seen: Finding[] = []; // every finding of the run, for the stale-exception check

const urlOf = (p: string) => origin + BASE + (p === '404.html' ? 'no-such-page/' : p.replace(/index\.html$/, ''));

/** Fails the test on findings no exception covers; records all of them for the stale check. */
function gate(findings: Finding[]) {
  seen.push(...findings);
  const { fresh } = triage(findings[0]?.check ?? 'browser', findings);
  if (fresh.length) throw new Error('new findings:\n' + summarize(fresh));
}

/** Each state a reader can put the page in: every tab of a tabbed page, every disclosure open. */
async function* views(page: Page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  const tabs = await page.locator('[role=tab]').all();
  if (!tabs.length) yield 'page';
  for (const t of tabs) {
    await t.click();
    yield (await t.getAttribute('aria-controls')) ?? 'tab';
  }
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

beforeAll(async () => {
  if (!pages.length) return;
  server = await preview({ root: ROOT, server: { host: '127.0.0.1', port: 4329 }, logLevel: 'error' });
  origin = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => server?.stop());

// Without a build every suite below skips, so the gate would pass having checked nothing.
it('has the built site to check (npm run build), one page per template', () => {
  expect(pages.length, 'no pages in dist/: run npm run build').toBeGreaterThan(0);
  if (process.env.WEB_QUALITY_FULL !== '1')
    expect(pages, 'representativePages() lost a template').toHaveLength(
      // 7 fixed templates (home, about, privacy, directory, inquiries, a commission, 404); a topic, a story and an article page
      // exist only once a story is live.
      7 +
        (pages.some(
          (p) => p.split('/').length === 2 && !/^(about|commissions|inquiries|institutions|privacy)\//.test(p),
        )
          ? 1
          : 0) +
        (pages.some((p) => p.split('/').length === 3 && !p.startsWith('commissions/')) ? 1 : 0) +
        (pages.some((p) => readFileSync(join(DIST, p), 'utf8').includes('data-article')) ? 1 : 0),
    );
});

describe.skipIf(!pages.length).each(BROWSERS)('%s', (name) => {
  let browser: Browser;
  beforeAll(async () => void (browser = await ENGINES[name].launch()));
  afterAll(async () => browser?.close());

  // Playwright's WebKit keeps Safari's default: Tab never stops on links (Option+Tab does not either), so the skip
  // link cannot be reached there; WebKit still walks the controls it does stop on. Real Safari is a manual check.
  const links = name !== 'webkit';

  async function open(p: string, options: BrowserContextOptions = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // A failed load is counted from its response, so the 404 page's own status is not an error.
    page.on(
      'console',
      (m) => m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && errors.push(m.text()),
    );
    page.on(
      'response',
      (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && errors.push(`${r.status()} ${r.url()}`),
    );
    page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
    const res = await page.goto(urlOf(p), { waitUntil: 'load' });
    expect(res?.status(), p).toBe(p === '404.html' ? 404 : 200);
    return { page, errors, close: () => ctx.close() };
  }

  describe.each(pages)('%s', (p) => {
    it('loads without script errors and reflows without horizontal scroll (320-1440, 200% text, text spacing)', async () => {
      const { page, errors, close } = await open(p);
      const findings: Finding[] = errors.map((e) => ({ check: 'browser', rule: 'console-error', page: p, detail: e }));
      const at = async (label: string) => {
        for await (const v of views(page)) {
          const px = await overflow(page);
          if (px > 1)
            findings.push({ check: 'browser', rule: 'overflow-x', page: p, detail: `${px}px at ${label} (${v})` });
        }
      };
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w < 768 ? 740 : 900 });
        await at(`${w}px`);
      }
      // Content-driven breakpoints: a sweep of the widths between, without reloading.
      for (let w = 336; w < 1440; w += 48) {
        await page.setViewportSize({ width: w, height: 800 });
        const px = await overflow(page);
        if (px > 1) findings.push({ check: 'browser', rule: 'overflow-x', page: p, detail: `${px}px at ${w}px` });
      }
      // WCAG 1.4.4 (text at 200% at a 1280px window zoomed to 640) and 1.4.12 (text spacing at 320).
      await page.setViewportSize({ width: 640, height: 800 });
      await page.addStyleTag({ content: 'html { font-size: 200% !important }' });
      await at('640px, 200% text');
      await page.setViewportSize({ width: 320, height: 740 });
      await page.addStyleTag({
        content: `html { font-size: 100% !important } * { line-height: 1.5 !important; letter-spacing: .12em !important;
          word-spacing: .16em !important } p { margin-bottom: 2em !important }`,
      });
      await at('320px, WCAG text spacing');
      await close();
      gate(findings);
    });

    it('is keyboard operable: skip link first, focus always visible, never trapped', async () => {
      const { page, close } = await open(p);
      if (links) {
        await page.keyboard.press('Tab');
        const skip = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement;
          const r = a.getBoundingClientRect();
          return { href: a.getAttribute('href'), visible: r.width > 1 && r.height > 1 && r.top >= 0 };
        });
        expect(skip, 'the first Tab reaches the visible skip link').toEqual({ href: '#main', visible: true });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => !document.querySelector('header')?.contains(document.activeElement))).toBe(
          true,
        );
      }

      const findings: Finding[] = [];
      let last: string | null = null;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate((focusable) => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const id = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent ?? '').trim().slice(0, 30) || el.getAttribute('aria-label')}"`;
          return {
            id: id + `@${Math.round(r.top + scrollY)}:${Math.round(r.left)}`,
            ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none',
            inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
            // the last tab stop in the document: the next Tab leaves for the browser (Firefox keeps activeElement)
            end: el === [...document.querySelectorAll(focusable)].filter((e) => e.getClientRects().length).at(-1),
          };
        }, FOCUSABLE);
        if (!f || (f.end && f.id === last)) break; // tabbed off the end of the document
        if (f.id === last) findings.push({ check: 'browser', rule: 'focus-trap', page: p, detail: f.id });
        if (!f.ring) findings.push({ check: 'browser', rule: 'focus-visible', page: p, detail: f.id });
        if (!f.inView) findings.push({ check: 'browser', rule: 'focus-offscreen', page: p, detail: f.id });
        last = f.id;
      }
      await close();
      gate(findings);
    });

    it.runIf(isTopic(p))('topic page: tabs, claim filter, disclosures and theme work from the keyboard', async () => {
      const { page, close } = await open(p);
      const selected = () => page.locator('[role=tab][aria-selected=true]').getAttribute('aria-controls');
      const first = await selected();
      await page.locator('[role=tab][aria-selected=true]').focus();
      await page.keyboard.press('ArrowRight');
      const second = await selected();
      expect(second).not.toBe(first);
      expect(page.url()).toContain(`#${second}`);
      await expect.poll(() => page.locator(`#${second}`).isVisible()).toBe(true);
      expect(await page.locator(`#${first}`).isVisible()).toBe(false);

      await page.locator('[role=tab][aria-controls=claims]').click();
      await page.locator('#q').fill('zzzz-no-claim-says-this');
      await expect.poll(() => page.locator('[data-status]').textContent()).toBe('No claims match.');
      await page.locator('#q').fill('');
      expect(await page.locator('[data-status]').textContent()).toMatch(/^Showing \d+ of \d+ claims\.$/);

      const card = page.locator('[data-claims] details').first();
      await card.locator('summary').focus();
      await page.keyboard.press('Enter');
      expect(await card.evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);

      const toggle = page.locator('[data-theme-toggle]');
      const before = await toggle.getAttribute('aria-label');
      await toggle.click();
      expect(await toggle.getAttribute('aria-label')).not.toBe(before);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.reload();
      expect(await page.evaluate(() => document.documentElement.dataset.theme), 'the choice persists').toBe(theme);
      await close();
    });

    it.runIf(name === 'chromium')(
      'has no WCAG 2.2 A/AA violations axe can detect (light 320 and 1280, dark 1280)',
      async () => {
        const findings: Finding[] = [];
        const runs = [
          ['light', 320],
          ['light', 1280],
          ['dark', 1280],
        ] as const; // dark at 320 adds time, not rules
        for (const [colorScheme, width] of runs) {
          const { page, close } = await open(p, { colorScheme, viewport: { width, height: 800 } });
          await page.addScriptTag({ content: axe.source });
          for await (const v of views(page)) {
            const r = await page.evaluate(
              (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
              WCAG,
            );
            for (const x of r.violations)
              for (const n of x.nodes)
                findings.push({
                  check: 'axe',
                  rule: x.id,
                  page: p,
                  detail: `${x.impact}: ${x.help} [${colorScheme} ${width}px ${v}] ${n.target.join(' ')}`,
                });
          }
          await close();
        }
        gate(findings);
      },
      600_000, // axe over every tab of a topic page is slow
    );

    it.runIf(name === 'chromium')(
      'lab CLS stays under 0.1 at 375 and 1440 (field CWV are not measured here)',
      async () => {
        for (const width of [375, 1440]) {
          const ctx = await browser.newContext({ viewport: { width, height: 800 } });
          const page = await ctx.newPage();
          await page.addInitScript(() => {
            (window as unknown as { cls: number }).cls = 0;
            new PerformanceObserver((l) => {
              for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
                if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
            }).observe({ type: 'layout-shift', buffered: true });
          });
          await page.goto(urlOf(p), { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const cls = await page.evaluate(() => (window as unknown as { cls: number }).cls);
          await ctx.close();
          gate(
            cls < 0.1 ? [] : [{ check: 'browser', rule: 'cls', page: p, detail: `${cls.toFixed(3)} at ${width}px` }],
          );
        }
      },
    );

    it.runIf(name === 'chromium')('honours prefers-reduced-motion', async () => {
      const { page, close } = await open(p, { reducedMotion: 'reduce' });
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = !d.open)));
      const moving = await page.evaluate(() =>
        document
          .getAnimations()
          .map((a) => Number(a.effect?.getTiming().duration ?? 0))
          .filter((d) => d > 1),
      );
      expect(moving, 'animations longer than 1ms under reduced motion').toEqual([]);
      await close();
    });
  });
});

/** Built pages whose HTML contains `attr`: a template that only renders for some data (a live video). */
const pagesMatching = (attr: string) =>
  existsSync(DIST) ? distPages().filter((p) => readFileSync(join(DIST, p), 'utf8').includes(attr)) : [];
const withVideo = pagesMatching('data-embed');

describe.skipIf(!withVideo.length || !BROWSERS.includes('chromium'))('video facade', () => {
  it('the video loads nothing from YouTube until played, then embeds youtube-nocookie', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const youtube: string[] = [];
    page.on('request', (r) => /youtube/.test(new URL(r.url()).hostname) && youtube.push(r.url()));
    await page.route(/youtube/, (r) => r.abort()); // nothing leaves the machine, even after the click
    await page.goto(urlOf(withVideo[0]), { waitUntil: 'load' });
    expect(youtube, 'requests to YouTube before the click').toEqual([]);
    await page.locator('[data-play]').first().click();
    await expect
      .poll(() => page.locator('[data-embed] iframe').first().getAttribute('src'))
      .toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    await browser.close();
  });
});

const withTool = pagesMatching('data-tool=');

describe.skipIf(!withTool.length || !BROWSERS.includes('chromium'))('calculator', () => {
  it('the calculator updates its result, names missing inputs, and is keyboard operable', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(urlOf(withTool[0]), { waitUntil: 'load' });
    const out = page.locator('[data-tool] output');
    await expect.poll(() => out.textContent()).toContain('Break-even');
    const before = await out.textContent();
    await page.locator('[data-tool] select[name=state]').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab'); // reached by Tab from the control before it
    expect(await page.evaluate(() => (document.activeElement as HTMLSelectElement).name)).toBe('state');
    await page.locator('[data-tool] select[name=state]').selectOption({ label: 'Massachusetts' });
    await expect.poll(() => out.textContent()).not.toBe(before);
    await page.locator('[data-tool] input[name=gas]').fill('');
    await expect.poll(() => out.textContent()).toContain('Enter a gas price above zero');
    expect(await out.textContent()).not.toMatch(/NaN|Infinity/);
    await browser.close();
  });
  it('a unit change restates the price; text in the therms field is named as not a number', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(urlOf(withTool[0]), { waitUntil: 'load' });
    const out = page.locator('[data-tool] output');
    await expect.poll(() => out.textContent()).toContain('Break-even');
    const before = await out.textContent();
    const elec = page.locator('[data-tool] input[name=elec]');
    expect(await elec.inputValue()).toBe('48.30'); // the U.S. default, $ per MMBtu
    await page.locator('[data-tool] select[name=elec-unit]').selectOption('kwh');
    expect(Number(await elec.inputValue())).toBeCloseTo(16.48, 2);
    expect(await out.textContent()).toBe(before); // the same price, so the same answer
    await page.locator('[data-tool] input[name=therms]').pressSequentially('e');
    await expect.poll(() => out.textContent()).toContain('not a number');
    await browser.close();
  });
});

describe.skipIf(!pages.length || !BROWSERS.includes('chromium'))('exceptions', () => {
  it('every exception for a page this run covered still matches a finding', () => {
    const ran = (re: string) => pages.some((p) => new RegExp(re).test(p));
    const stale = (['axe', 'browser'] as const).flatMap((c) =>
      triage(
        c,
        seen.filter((f) => f.check === c),
      ).stale.filter((e) => ran(e.page)),
    );
    expect(stale, 'remove exceptions that no longer match').toEqual([]);
  });
});

declare global {
  interface Window {
    axe: typeof axe;
  }
}
export {};
