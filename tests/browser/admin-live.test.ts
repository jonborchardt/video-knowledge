// The admin page's live updates against the real dev server (M3 2.2, decision 5): /admin is opened once, a filter,
// a sort, a popover and a scroll are applied, then the fixture story's run folder and one of its authoritative
// artifacts change on disk (a lock and an open attempt for the script writer, then the reviewer; storyboard.json
// moved aside so the board's stage is `storyboard`; a halt), and the row's Now cell, its state and its stage strip
// and the Automation tab's running and blocked lists follow through /admin/live.json and the poll, with no navigation
// and the interaction state intact. Only the fixture topic (spec 5.8) is touched, and everything the test wrote is
// removed; it never runs over a fixture run that is live or halted (their lock and halt are real operational state),
// and never in CI (it needs the fixture's production on disk and a dev server at the root base).
// Run through `npm run test:browser` (the browser project); needs `npx playwright install chromium` once.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, openSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, request, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FILES, ROOT, scriptDir, writeJsonAtomic } from '../../src/shared/io';
import { type AttemptRecord, attemptPath, writeAttempt, writeHalt } from '../../src/orchestration/run/journal';
import { killTree } from '../../src/orchestration/run/proc';

const TOPIC = 'test-fixture';
const STORY = 'decision:most-discussed-claims';
const KEY = `${TOPIC}/${STORY}`;
const dir = scriptDir(TOPIC, STORY);
const run = join(dir, 'run');
const storyboard = join(dir, FILES.storyboard);
const aside = `${storyboard}.live-test-aside`;
const lockFile = join(run, 'lock.json');
const haltFile = join(run, 'halt.json');
const WRITER = 'Read src/modules/script/briefs/script.md and follow it.';
const REVIEWER = 'Read src/modules/script/briefs/script-review.md and follow it.';
// a line no journal of this story will reach: the record is an orphan the test alone owns and removes
const ATTEMPT_LINE = 9_000_001;
const attemptFile = attemptPath(run, ATTEMPT_LINE, 1);
/** Real operational state of the fixture story: a live or halted run. The test never touches it. */
const busy = existsSync(lockFile) || existsSync(haltFile);
const skip = !!process.env.CI || busy || !existsSync(storyboard);

let server: ChildProcess | undefined;
let browser: Browser | undefined;
const PORT = 4331;
const origin = `http://127.0.0.1:${PORT}`;
const DEV_LOG = join(tmpdir(), 'vk-admin-live-dev.log');
const created = new Set<string>(); // what this test wrote and may remove

/** The dev server as a person runs it (`npm run dev`), on its own port and at the root base; ready once the live
 *  endpoint answers. */
async function startDev(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    [join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'dev', '--host', '127.0.0.1', '--port', String(PORT)],
    {
      cwd: ROOT,
      // vitest's own variables would put Vite into test mode (the admin routes are not served); DEPLOY_TARGET
      // would move the base under /video-knowledge/
      env: Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !/^(VITEST|VITE_|TEST$|DEPLOY_TARGET$)/.test(k)),
      ),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  // the server's output goes to a log in the temp dir: an unread pipe would block the server once it fills
  const fd = openSync(DEV_LOG, 'w');
  child.stdout?.on('data', (d: Buffer) => writeSync(fd, d));
  child.stderr?.on('data', (d: Buffer) => writeSync(fd, d));
  child.on('error', (e) => writeSync(fd, `spawn error: ${e.message}\n`));
  child.on('exit', (code) => writeSync(fd, `exited ${code}\n`));
  const deadline = Date.now() + 170_000;
  const probe = await request.newContext();
  try {
    for (let i = 0; Date.now() < deadline; i++) {
      try {
        const r = await probe.get(`${origin}/admin/live.json`, { timeout: 60_000 });
        if (r.ok()) return child;
        writeSync(fd, `probe: status ${r.status()}\n`);
      } catch (e) {
        if (i % 10 === 0) writeSync(fd, `probe: ${(e as Error).message}\n`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await probe.dispose();
  }
  throw new Error(`the dev server did not answer within the hook timeout; its log: ${DEV_LOG}`);
}

/** The artifact the test moved, put back (also from a crashed earlier run); only the files this test wrote, removed. */
function restore() {
  if (existsSync(aside)) renameSync(aside, storyboard);
  for (const f of created) if (existsSync(f)) rmSync(f, { force: true });
  const agents = join(run, 'agents');
  if (existsSync(agents) && readdirSync(agents).length === 0) rmSync(agents, { recursive: true, force: true });
}
const write = (file: string, value: unknown) => {
  created.add(file);
  writeJsonAtomic(file, value);
};

beforeAll(async () => {
  if (skip) return;
  restore();
  server = await startDev();
  browser = await chromium.launch();
});
afterAll(async () => {
  restore();
  await browser?.close();
  if (server?.pid) killTree(server.pid);
});

const lock = (childStep: string | null) =>
  write(lockFile, {
    runId: 'live-test',
    pid: process.pid,
    host: 'test',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    heartbeatAt: new Date().toISOString(),
    command: `story ${TOPIC} ${STORY}`,
    ...(childStep && { childPid: process.pid, childStep, childAt: new Date().toISOString() }),
  });
const openAttempt = (step: string, role: string) => {
  const rec: AttemptRecord = {
    line: ATTEMPT_LINE,
    round: 1,
    at: new Date().toISOString(),
    finishedAt: null,
    step,
    role,
    modelRequested: 'sonnet',
    models: [],
    effort: 'high',
    turns: null,
    costUsd: 0,
    budgetUsd: 8,
    overCap: false,
    ms: 0,
    apiMs: null,
    exit: null,
    isError: false,
    subtype: null,
    stopReason: null,
    errors: [],
    denials: [],
    sessionId: null,
    resumedFrom: null,
    pid: process.pid,
  };
  created.add(attemptFile);
  writeAttempt(run, rec);
};

const row = (page: Page) => page.locator(`tr[data-live-row="${KEY}"]`);
const nowCell = (page: Page) => page.locator(`[data-live="${KEY}.now"]`);
const stripCurrent = (page: Page) => page.locator(`[data-live="${KEY}.strip"] li[title$=": current"]`);
const runningRow = (page: Page) => page.locator(`[data-live-list="running"] tr[data-key="${KEY}"]`);
const blockedItem = (page: Page) => page.locator(`[data-live-list="blocked"] li[data-key="${KEY}"]`);
const WAIT = { timeout: 45_000 }; // the idle cadence is 30 s; running, 5 s

describe.skipIf(skip)('the admin page follows the fixture story live, without a reload', () => {
  it('Now cell, state, stage strip, running and blocked lists move while the filter, sort, popover and scroll stay', async () => {
    const page = await browser!.newPage({ viewport: { width: 1400, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(`${origin}/admin#board`, { waitUntil: 'load', timeout: 120_000 });
    expect(res?.status()).toBe(200);
    await expect.poll(() => row(page).count(), { timeout: 30_000 }).toBe(1);
    const url = page.url();
    const stageBefore = await stripCurrent(page).getAttribute('title');
    expect(stageBefore).toBe('packaged: current');

    // the interaction state the refreshes must not lose
    await page.fill('#story-filter input[name=q]', 'leap second');
    await expect.poll(() => page.locator('#story-table tbody tr:not([hidden])').count()).toBe(1);
    await page.click('#story-table thead th[data-type=num] button');
    const sortedHeader = page.locator('#story-table thead th[aria-sort]');
    expect(await sortedHeader.count()).toBe(1);
    const sortBefore = await sortedHeader.getAttribute('aria-sort');
    await row(page).locator('button[popovertarget]').first().click();
    const popoverOpen = () => page.evaluate(() => document.querySelectorAll(':popover-open').length);
    expect(await popoverOpen()).toBe(1);
    await page.evaluate(() => {
      window.scrollTo(0, 120);
      (window as unknown as { __liveMarker: number }).__liveMarker = 1;
    });
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // 1. the script writer runs: a live lock with the step and its open attempt record
    lock(WRITER);
    openAttempt(WRITER, 'writer');
    await expect.poll(() => nowCell(page).innerText(), WAIT).toMatch(/running[\s\S]*writer on sonnet[\s\S]*script\.md/);
    await expect.poll(() => runningRow(page).count(), WAIT).toBe(1);
    expect(await runningRow(page).innerText()).toMatch(/writer on sonnet/);

    // 2. the reviewer takes over: the step changes, nothing else moves
    rmSync(attemptFile, { force: true });
    lock(REVIEWER);
    openAttempt(REVIEWER, 'reviewer');
    await expect.poll(() => nowCell(page).innerText(), WAIT).toMatch(/reviewer on sonnet[\s\S]*script-review\.md/);

    // 3. an authoritative artifact changes: without storyboard.json the board's stage is storyboard, and the strip's
    //    current cell moves there through the endpoint and the poll
    renameSync(storyboard, aside);
    await expect.poll(() => stripCurrent(page).getAttribute('title'), WAIT).toBe('storyboard: current');
    expect(await row(page).getAttribute('data-state')).toBe('producing');
    expect(await page.locator(`[data-live="${KEY}.column"]`).innerText()).toBe('In production');
    renameSync(aside, storyboard);
    await expect.poll(() => stripCurrent(page).getAttribute('title'), WAIT).toBe('packaged: current');

    // 4. the run halts: the row leaves the running list and enters the blocked list with its unblock
    rmSync(attemptFile, { force: true });
    rmSync(lockFile, { force: true });
    created.add(haltFile);
    writeHalt(run, {
      kind: 'timeout',
      stage: 'script',
      why: 'live test: the writer hung',
      unblock: { kind: 'run', text: `npm run run -- story ${TOPIC} ${STORY}` },
      at: new Date().toISOString(),
      runId: 'live-test',
      board: { stage: 'script', next: 'agent' },
    });
    await expect.poll(() => nowCell(page).innerText(), WAIT).toMatch(/halted[\s\S]*timeout/);
    await expect.poll(() => runningRow(page).count(), WAIT).toBe(0);
    await expect.poll(() => blockedItem(page).count(), WAIT).toBe(1);
    expect(await blockedItem(page).innerText()).toMatch(/the writer hung[\s\S]*npm run run -- story/);

    // no navigation, no lost state
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => (window as unknown as { __liveMarker?: number }).__liveMarker)).toBe(1);
    expect(await page.inputValue('#story-filter input[name=q]')).toBe('leap second');
    expect(await page.locator('#story-table tbody tr:not([hidden])').count()).toBe(1);
    expect(await sortedHeader.getAttribute('aria-sort')).toBe(sortBefore);
    expect(await popoverOpen()).toBe(1);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
    await page.close();
  }, 300_000);
});
