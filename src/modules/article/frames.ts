// `npm run article -- frames`: photographs the matter page as the dev server renders the validated, unreleased
// article (the preview release), at 375 and 1280 wide in light and dark, as tiles 1000 px tall from the top of the
// page to its end, into `page/`, with `index.json` naming the article fingerprint the page carried. The page review
// reads the tiles; the lock accepts a review only at that fingerprint. The page must carry `data-article-preview`
// with that fingerprint: a page that rendered the fallback sections, a release or another text is refused and
// nothing is written. The dev server is a child for the duration and is killed, tree and all, on the way out.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Browser, chromium } from 'playwright';
import { ROOT, scriptDir, toJson } from '../../shared/io';
import { Refusal } from '../../shared/refusal';

export const PAGE_DIR = 'page';
export const PAGE_INDEX = 'index.json';
const TILE = 1000;
export const VIEWS = [
  { width: 375, theme: 'light' },
  { width: 375, theme: 'dark' },
  { width: 1280, theme: 'light' },
  { width: 1280, theme: 'dark' },
] as const;

export interface PageIndex {
  key: string; // the article fingerprint the page carried in data-article-preview
  path: string; // the matter's site path
  captured: string;
  tiles: { file: string; width: number; theme: 'light' | 'dark'; n: number; top: number }[];
}

const killTree = (c: ChildProcess) => {
  if (!c.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(c.pid)], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-c.pid, 'SIGKILL');
  } catch {
    try {
      c.kill('SIGKILL');
    } catch {
      /* gone */
    }
  }
};

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the dev server did not answer at ${url} within ${ms / 1000} s`);
}

/** Photographs the matter page at `path` for the article whose fingerprint is `key`. Returns the index it wrote. */
export async function captureFrames(
  topic: string,
  storyId: string,
  opts: { path: string; key: string; port: number; root?: string },
): Promise<{ dir: string; index: PageIndex }> {
  const root = opts.root ?? ROOT;
  const dir = join(scriptDir(topic, storyId, root), PAGE_DIR);
  const base = `http://127.0.0.1:${opts.port}`;
  const server = spawn(`npx astro dev --port ${opts.port} --host 127.0.0.1`, {
    cwd: root,
    shell: true,
    stdio: 'ignore',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    await waitFor(`${base}${opts.path}`, 120_000);
    const tiles: PageIndex['tiles'] = [];
    const shots: { file: string; buffer: Buffer }[] = [];
    for (const v of VIEWS) {
      const context = await browser.newContext({ viewport: { width: v.width, height: 900 }, colorScheme: v.theme });
      // the site's own theme mechanism: the pre-paint script in Base.astro reads localStorage.theme
      await context.addInitScript((theme) => localStorage.setItem('theme', theme), v.theme);
      const page = await context.newPage();
      const res = await page.goto(`${base}${opts.path}`, { waitUntil: 'networkidle' });
      if (!res || res.status() >= 400) throw new Refusal(`${opts.path} answered ${res?.status() ?? 'nothing'}`);
      // read once, now: a page without the marker answers at once (a locator would wait on the selector)
      const carried = await page.evaluate(
        () => document.querySelector('[data-article-preview]')?.getAttribute('data-article-preview') ?? null,
      );
      if (carried !== opts.key)
        throw new Refusal(
          `the page did not render the validated article: it carries ${carried ?? 'no preview marker'}, article.json is ${opts.key}`,
        );
      // the dev toolbar and its audit outlines are the dev server's, not the page's: a reviewer must not see them
      await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
      await page.evaluate(() => document.fonts.ready);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let top = 0, n = 1; top < height; top += TILE, n++) {
        const file = `${v.width}-${v.theme}-${n}.png`;
        const buffer = await page.screenshot({
          fullPage: true,
          clip: { x: 0, y: top, width: v.width, height: Math.min(TILE, height - top) },
        });
        shots.push({ file, buffer });
        tiles.push({ file, width: v.width, theme: v.theme, n, top });
      }
      await context.close();
    }
    // written only once every view carried the right text: a refusal above leaves no stale tiles behind
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const s of shots) writeFileSync(join(dir, s.file), s.buffer);
    const index: PageIndex = { key: opts.key, path: opts.path, captured: new Date().toISOString(), tiles };
    writeFileSync(join(dir, PAGE_INDEX), toJson(index));
    return { dir: relative(root, dir).replaceAll('\\', '/'), index };
  } finally {
    await browser?.close();
    killTree(server);
  }
}
