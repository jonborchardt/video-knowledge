// The launch job (spec §4.4, §4.5's git rows): once the release group is live and verified, today's go-live sequence
// runs in the clone as one resumable job with a progress record; a commit is never repeated and a push never forced;
// the deploy confirmation is the tick's one probe per pass, followed by the social post and the launch email.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { readJson, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import { matterPathOf } from '../../src/modules/website/live';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../src/modules/publishing/publish';
import { readHalt, runDir } from '../../src/orchestration/run/journal';
import {
  LAUNCH_PATHS,
  launch,
  launchJobs,
  launchLockDir,
  launchPaths,
  launchProblem,
  launches,
  probeLaunches,
  readLaunch,
} from '../../src/orchestration/run/launch';
import { preflight } from '../../src/orchestration/run/preflight';
import { notifyHalts, readOutbox } from '../../src/orchestration/run/notify';
import { statusOf } from '../../src/orchestration/run/status';
import { site } from '../../src/config/site';
import { post as postOnX, textFor } from '../../src/modules/social/social';
import { type XClient, XError } from '../../src/modules/social/x';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';
import { X_TEST_ENV } from './publish-fake-cli';

const fixtures: Fixture[] = [];
const bares: string[] = [];
afterAll(() => {
  fixtures.forEach((f) => f.cleanup());
  bares.forEach((b) => rmSync(b, { recursive: true, force: true }));
}, 120_000);
const T0 = Date.parse('2026-11-01T12:00:00Z');
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  launch: { ...DEFAULTS.launch, push: true, deployTimeoutMinutes: 40 },
};

/** A packaged release fixture turned into a git clone of a bare origin, its video live (published, verified). */
function clone(opts: { live?: boolean; fixture?: boolean } = {}) {
  const f0 = syntheticProduction('packaged', { release: true });
  fixtures.push(f0);
  cliRoot(f0.root);
  // a fixture story: the synthetic production moved under the fixture topic, with its fresh run id and an earlier
  // run's upload in the history (what the launch mail lists as superseded)
  if (opts.fixture) renameSync(join(f0.root, 'topics', f0.topic), join(f0.root, 'topics', 'test-fixture'));
  const f = opts.fixture ? { ...f0, topic: 'test-fixture', dir: f0.dir.replace(f0.topic, 'test-fixture') } : f0;
  if (opts.fixture) {
    mkdirSync(join(f.dir, 'run'), { recursive: true });
    writeFileSync(join(f.dir, 'run', 'fresh.json'), toJson({ runId: '20261101-1200-abcd', at: 'x', previous: null }));
    const old = join(f.root, 'topics', 'test-fixture', 'history', '20261031-0900-old1', 'scripts', 'x');
    mkdirSync(old, { recursive: true });
    writeFileSync(
      join(old, 'publish.json'),
      toJson({
        video: `test-fixture/${f.story}`,
        outputs: {
          youtube: {
            kind: 'youtube-video',
            metadata: {},
            events: [
              {
                at: '2026-10-31T09:00:00Z',
                type: 'uploaded',
                by: 'a',
                build: 'b',
                id: 'vid0000old1',
                visibility: 'private',
              },
            ],
          },
        },
      }),
    );
  }
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(join(f.root, '.gitignore'), '.automation/\ntopics/*/scripts/*/run/\nyoutube-fake.json\n');
  git('init', '-q'); // git 2.15: no -b; the branch is named by the checkout
  git('checkout', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  const bare = mkdtempSync(join(tmpdir(), 'vk-origin-'));
  bares.push(bare);
  execFileSync('git', ['init', '-q', '--bare', bare]);
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: bare });
  git('remote', 'add', 'origin', bare);
  git('push', '-q', '-u', 'origin', 'main');
  if (opts.live !== false) {
    let l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
    const build = readJson<{ mp4Sha: string }>(join(f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
    l = appendEvent(l, 'youtube', {
      at: '2026-10-31T00:00:00Z',
      type: 'uploaded',
      by: 'automation',
      build,
      buildStatus: 'release',
      metadata: 'm',
      id: 'vid00000000',
      visibility: 'private',
    }).ledger;
    l = appendEvent(l, 'youtube', { at: '2026-10-31T01:00:00Z', type: 'approved', by: 'Jon', build }).ledger;
    l = appendEvent(l, 'youtube', {
      at: '2026-11-01T00:00:00Z',
      type: 'published',
      by: 'Jon',
      id: 'vid00000000',
    }).ledger;
    l = appendEvent(l, 'youtube', {
      at: '2026-11-01T00:01:00Z',
      type: 'verified',
      by: 'automation',
      id: 'vid00000000',
      result: 'passed',
      checks: [{ name: 'visibility', result: 'pass' }],
    }).ledger;
    saveLedger(publishPath(f.topic, f.story, f.root), l);
  }
  const ran: string[] = [];
  const deps = (extra: Partial<Parameters<typeof launch>[3]> = {}) => ({
    now: () => T0,
    git: (args: string[]) => git(...args),
    run: (cli: string, args: string[]) => {
      ran.push([cli, ...args].join(' '));
      // the production build pages no fixture story, so its freeze never lists the fixture path
      if (cli === 'links' && args[0] === 'freeze')
        writeFileSync(
          join(f.root, 'public-urls.json'),
          toJson(opts.fixture ? ['/'] : [matterPathOf(f.topic, f.story, f.root), '/']),
        );
      if (cli === 'brand') writeFileSync(join(f.root, 'brand-out.txt'), 'x'); // outside the launch paths: never added
      return { status: 0, stdout: '', stderr: '' };
    },
    validate: () => ({ ok: true, output: '' }),
    ...extra,
  });
  const originHead = () => execFileSync('git', ['rev-parse', 'main'], { cwd: bare, encoding: 'utf8' }).trim();
  const commits = () => git('rev-list', '--count', 'main').trim();
  return { f, git, bare, ran, deps, originHead, commits };
}

/** A page that carries the video: the deploy is live. */
const livePage = (async () => new Response('embed/vid00000000', { status: 200 })) as unknown as typeof fetch;
/** `npm run social -- post` in process over a fake X: the module writes social.json (the outcome the probe reads);
 *  what the CLI prints is irrelevant to it. */
const socialRun =
  (c: { f: { topic: string; story: string; root: string } }, client: XClient, calls: string[]) =>
  async (cli: string, args: string[]) => {
    calls.push([cli, ...args].join(' '));
    const t = textFor(c.f.topic, c.f.story, 'youtube', site.disclosure, c.f.root)!;
    const r = await postOnX(c.f.topic, c.f.story, 'youtube', X_TEST_ENV.X_SPENDING_HANDLE, t, { client }, c.f.root);
    return { status: r.status === 'posted' ? 0 : 1, stdout: 'whatever the CLI prints\n', stderr: '' };
  };

describe('launch', () => {
  it('refuses a story whose video is not live, and lists no launch job for it (criterion 9)', async () => {
    const c = clone({ live: false });
    const r = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(r.outcome).toBe('halted');
    expect(r.halt?.why).toMatch(/not launchable: no publish.json/);
    expect(c.ran).toEqual([]);
    expect(launchJobs(a, c.f.root)).toEqual([]);
  }, 120_000);

  it('an uploaded Short that is not live yet (approved, or behind on its parent link) blocks the launch', async () => {
    const c = clone();
    const l = loadLedger(c.f.topic, c.f.story, c.f.root)!;
    l.outputs['short:one'] = { kind: 'youtube-short', derivedFrom: 'youtube', metadata: {}, events: [] };
    saveLedger(
      publishPath(c.f.topic, c.f.story, c.f.root),
      appendEvent(l, 'short:one', {
        at: '2026-11-01T02:00:00Z',
        type: 'uploaded',
        by: 'automation',
        build: 'shortsha',
        buildStatus: 'release',
        metadata: 'm',
        id: 'vid00000001',
        visibility: 'private',
      }).ledger,
    );
    expect(launchProblem(c.f.topic, c.f.story, c.f.root)).toMatch(/short:one is .*not live yet/);
    expect(launchJobs(a, c.f.root)).toEqual([]);
  }, 120_000);

  it('two launches of one story at once: the second is held; a live run of another story in the topic blocks the launch', async () => {
    const c = clone();
    let release: () => void = () => undefined;
    const slow = c.deps({
      run: (cli: string, args: string[]) => {
        c.ran.push([cli, ...args].join(' '));
        if (cli === 'links') writeFileSync(join(c.f.root, 'public-urls.json'), toJson(['/']));
        return { status: 0, stdout: '', stderr: '' };
      },
      validate: () => ({ ok: true, output: '' }),
    });
    const first = (async () => {
      await new Promise<void>((r) => (release = r));
      return launch(c.f.topic, c.f.story, a, slow, c.f.root);
    })();
    // the first holds the lock from its start; take it by hand to stand in for its slow build
    const { acquire: take, release: give } = await import('../../src/orchestration/run/lock');
    const got = take(launchLockDir(c.f.topic, c.f.story, c.f.root), 'launch', {});
    expect('lock' in got).toBe(true);
    const second = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(second.outcome).toBe('held');
    expect(c.ran).toEqual([]);
    expect(launchJobs(a, c.f.root)).toEqual([]); // a held launch is not offered to another instance
    if ('lock' in got) give(launchLockDir(c.f.topic, c.f.story, c.f.root), got.lock);
    release();
    expect((await first).outcome).toBe('done');
    // another story of the topic with a live run: the launch waits
    const d = clone();
    const other = runDir(d.f.topic, 'decision:other', d.f.root);
    writeFileSync(join(other, '..', 'script.json'), '{}'); // a story folder is one with a script
    const { acquire: hold } = await import('../../src/orchestration/run/lock');
    const held = hold(other, 'story', { pid: process.pid });
    expect('lock' in held).toBe(true);
    expect(launchProblem(d.f.topic, d.f.story, d.f.root)).toMatch(/decision-other.*live run/);
    expect(launchJobs(a, d.f.root)).toEqual([]);
  }, 120_000);

  it('runs the sequence once, commits the story and the site outputs on main, pushes once, and fills the record', async () => {
    const c = clone();
    // another story's in-flight artifact in the same topic is never staged by this story's launch
    const other = join(c.f.root, 'topics', c.f.topic, 'scripts', 'decision-other');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'script.json'), '{"draft":true}\n');
    expect(launchJobs(a, c.f.root)).toEqual([
      { kind: 'launch', topic: c.f.topic, storyId: c.f.story, why: 'launch: the release group is live' },
    ]);
    const before = c.commits();
    // the clone is dirty with the story's own files first (a modified report: the porcelain line starts with a space)
    writeFileSync(join(c.f.root, 'topics', c.f.topic, 'report.json'), '{"changed":true}\n');
    expect(c.git('status', '--porcelain').startsWith(' M topics/')).toBe(true);
    const r = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(r.halt?.why).toBeUndefined();
    expect(r.outcome).toBe('done');
    expect(c.ran).toEqual([`report seed ${c.f.topic}`, 'brand', 'build', 'links freeze']);
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(Object.keys(rec.steps).sort()).toEqual(['branded', 'built', 'frozen', 'pulled', 'seeded', 'validated']);
    expect(rec.committed).toMatch(/^[0-9a-f]{40}$/);
    expect(rec.pushed).toBe(rec.committed);
    expect(c.commits()).toBe(String(Number(before) + 1));
    expect(c.originHead()).toBe(rec.committed);
    expect(c.git('log', '-1', '--format=%s')).toContain(`release(${c.f.topic}): ${c.f.story} is live`);
    expect(c.git('log', '-1', '--format=%B')).not.toMatch(/Co-Authored-By/); // an automated commit names no co-author
    expect(c.git('status', '--porcelain')).toMatch(/brand-out.txt/); // outside the launch's paths: left alone
    expect(c.git('status', '--porcelain')).toMatch(/decision-other\//); // the other story's: left alone (untracked)
    expect(c.git('show', '--stat', '--format=', 'HEAD')).toContain('public-urls.json');
    expect(c.git('show', '--stat', '--format=', 'HEAD')).toContain('report.json');
    expect(launchJobs(a, c.f.root)).toEqual([]); // launched: nothing left for the work plane
    // a second job finds everything done and repeats nothing
    const again = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(again.outcome).toBe('done');
    expect(c.ran).toHaveLength(4);
    expect(c.commits()).toBe(String(Number(before) + 1));
  }, 120_000);

  it('killed after the commit and before the push record: the resumed job pushes that commit once and commits nothing new (criterion 13)', async () => {
    const c = clone();
    const before = c.commits();
    let crash = true;
    const deps = c.deps({
      git: (args: string[]) => {
        if (crash && args[0] === 'push') throw new Error('killed before the push');
        return c.git(...args);
      },
    });
    const r = await launch(c.f.topic, c.f.story, a, deps, c.f.root);
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('git');
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(rec.committed).toMatch(/^[0-9a-f]{40}$/);
    expect(rec.pushed).toBeNull();
    expect(rec.halt?.kind).toBe('git');
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('git'); // the board and the halt mail see it
    expect(launchJobs(a, c.f.root)).toEqual([]); // halted: a person's, not the work plane's
    crash = false;
    const r2 = await launch(c.f.topic, c.f.story, a, deps, c.f.root);
    expect(r2.outcome).toBe('done');
    expect(c.ran).toHaveLength(4); // the sequence ran once
    expect(c.commits()).toBe(String(Number(before) + 1));
    expect(c.originHead()).toBe(rec.committed);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.pushed).toBe(rec.committed);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.halt).toBeNull();
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))).toBeNull();
  }, 120_000);

  it('a failing validate halts git with the last lines and pushes nothing; the preflight accepts the dirty paths the record owns', async () => {
    const c = clone();
    const head = c.originHead();
    const r = await launch(
      c.f.topic,
      c.f.story,
      a,
      c.deps({ validate: () => ({ ok: false, output: 'lint\n\nsrc/x.ts:1:1 unused\nRESULT: FAILED' }) }),
      c.f.root,
    );
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('git');
    expect(r.halt?.why).toMatch(/npm run validate failed: .*src\/x.ts:1:1 unused/);
    expect(c.originHead()).toBe(head);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.committed).toBeNull();
    // the tree is dirty with the launch's outputs while the record has no commit: the preflight lets them stand
    expect(launchPaths(c.f.root)).toEqual([{ paths: LAUNCH_PATHS(c.f.topic) }]);
    const pre = {
      claude: () => true,
      env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
      freeGb: () => 100,
      launches: () => launchPaths(c.f.root),
    };
    const dirty = (lines: string) => ({ ...pre, git: (args: string[]) => (args[0] === 'status' ? lines : 'main\n') });
    expect(preflight(a, c.f.root, dirty(` M topics/${c.f.topic}/report.json\n?? public-urls.json\n`)).ok).toBe(true);
    expect(preflight(a, c.f.root, dirty(' M src/x.ts\n')).problems).toEqual(['the clone is dirty']);
  }, 120_000);

  it('the probe: a stale page posts and emails nothing; the live page records liveAt, the post (not configured) and one launch email', async () => {
    const c = clone();
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMailer(c.f.root);
    const path = matterPathOf(c.f.topic, c.f.story, c.f.root)!;
    const url = `https://commonwealthofreason.com${path}`;
    let page = '<html>soon</html>';
    const fetchFn = (async (u: string | URL | Request) =>
      String(u) === url
        ? new Response(page, { status: 200 })
        : new Response('', { status: 404 })) as unknown as typeof fetch;
    const posts: string[] = [];
    const run = (cli: string, args: string[]) => {
      posts.push([cli, ...args].join(' '));
      return { status: 0, stdout: 'not configured: spending has no x handle or keys\n', stderr: '' };
    };
    const a1 = await probeLaunches(a, c.f.root, { now: () => T0 + 60_000, run, mail, fetchFn });
    expect(a1.join('\n')).toMatch(/not live yet \(probe 1\)/);
    expect(mail.sent).toEqual([]);
    expect(posts).toEqual([]);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.probes).toBe(1);
    page = `<iframe src="https://www.youtube-nocookie.com/embed/vid00000000"></iframe>`;
    const a2 = await probeLaunches(a, c.f.root, { now: () => T0 + 120_000, run, mail, fetchFn });
    expect(a2.join('\n')).toMatch(/live at/);
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(rec.liveAt).toBe(new Date(T0 + 120_000).toISOString());
    expect(rec.posted).toBe('not-configured');
    expect(rec.emailed).toBe(true);
    expect(posts).toEqual([]); // social is off by default: no post is attempted
    expect(mail.sent).toHaveLength(1);
    const m = mail.sent[0];
    expect(m.to).toBe('jon@example.test');
    expect(m.subject).toMatch(/live/);
    expect(m.text).toContain(url);
    expect(m.text).toContain('https://www.youtube.com/watch?v=vid00000000');
    expect(m.text).toMatch(/X: not configured/);
    expect(m.text).toMatch(/end screen/i);
    expect(m.text).toContain('npm run publish -- updated');
    expect(readOutbox(c.f.root).at(-1)).toMatchObject({
      kind: 'launch',
      meta: { topic: c.f.topic, storyId: c.f.story },
    });
    // nothing more on a later tick
    const a3 = await probeLaunches(a, c.f.root, { now: () => T0 + 180_000, run, mail, fetchFn });
    expect(a3).toEqual([]);
    expect(mail.sent).toHaveLength(1);
    expect(launches(c.f.root)).toHaveLength(1);
  }, 120_000);

  it('with social on: the outcome is the social record, not the CLI text; a retryable failure is tried again next tick before the mail; a final failure halts', async () => {
    const c = clone();
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMailer(c.f.root);
    const social = { ...a, enabled: { ...a.enabled, social: true } };
    const answers: (() => { id: string; url: string })[] = [
      () => {
        throw new XError('X 503: down', 503, true);
      },
      () => ({ id: '1', url: 'https://x.com/i/status/1' }),
    ];
    const calls: string[] = [];
    const run = socialRun(c, { post: async () => answers.shift()!(), recent: async () => [] }, calls);
    const a1 = await probeLaunches(social, c.f.root, {
      now: () => T0 + 60_000,
      run,
      mail,
      fetchFn: livePage,
      env: X_TEST_ENV,
    });
    expect(a1.join('\n')).toMatch(/post pending \(attempt 1\)/);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.posted).toBeNull();
    expect(mail.sent).toEqual([]); // the mail waits for the post to settle
    const a2 = await probeLaunches(social, c.f.root, {
      now: () => T0 + 120_000,
      run,
      mail,
      fetchFn: livePage,
      env: X_TEST_ENV,
    });
    expect(a2.join('\n')).toMatch(/post true/);
    expect(calls).toEqual([`social post ${c.f.topic} ${c.f.story}`, `social post ${c.f.topic} ${c.f.story}`]);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.posted).toBe(true);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].text).toMatch(/X: posted: https:\/\/x\.com\/i\/status\/1/);
    // a final failure on another launch: the halt, the mail still sent (it says so)
    const d = clone();
    await launch(d.f.topic, d.f.story, a, d.deps(), d.f.root);
    const m2 = new FakeMailer(d.f.root);
    const acts = await probeLaunches(social, d.f.root, {
      now: () => T0 + 60_000,
      run: socialRun(
        d,
        {
          post: async () => {
            throw new XError('X 401: bad keys', 401, false);
          },
          recent: async () => [],
        },
        [],
      ),
      mail: m2,
      fetchFn: livePage,
      env: X_TEST_ENV,
    });
    expect(acts.join('\n')).toMatch(/post false/);
    expect(readLaunch(d.f.topic, d.f.story, d.f.root)!.posted).toBe(false);
    expect(readLaunch(d.f.topic, d.f.story, d.f.root)!.halt?.kind).toBe('step-failed');
    expect(readHalt(runDir(d.f.topic, d.f.story, d.f.root))?.why).toMatch(/X 401/);
    expect(m2.sent).toHaveLength(1);
    expect(m2.sent[0].text).toMatch(/X: the post failed/);
  }, 120_000);

  it('with social on: a CLI that prints POSTED but recorded nothing is not believed; a post failing retryably every tick halts after three attempts; no keys is not configured and the CLI never runs', async () => {
    const social = { ...a, enabled: { ...a.enabled, social: true } };
    const e = clone();
    await launch(e.f.topic, e.f.story, a, e.deps(), e.f.root);
    const m3 = new FakeMailer(e.f.root);
    const acts3 = await probeLaunches(social, e.f.root, {
      now: () => T0 + 60_000,
      run: () => ({ status: 0, stdout: 'RESULT: POSTED https://x.com/i/status/9\n', stderr: '' }),
      mail: m3,
      fetchFn: livePage,
      env: X_TEST_ENV,
    });
    expect(acts3.join('\n')).toMatch(/post pending \(attempt 1\)/);
    expect(readLaunch(e.f.topic, e.f.story, e.f.root)!.posted).toBeNull();
    expect(m3.sent).toEqual([]);
    // the same launch, the module now failing retryably on every call: three attempts, then the halt and the mail
    const calls: string[] = [];
    const run = socialRun(
      e,
      {
        post: async () => {
          throw new XError('X 503: down', 503, true);
        },
        recent: async () => [],
      },
      calls,
    );
    for (let i = 2; i <= 3; i++) {
      const acts = await probeLaunches(social, e.f.root, {
        now: () => T0 + i * 60_000,
        run,
        mail: m3,
        fetchFn: livePage,
        env: X_TEST_ENV,
      });
      expect(acts.join('\n'), `attempt ${i}`).toMatch(i < 3 ? /post pending \(attempt 2\)/ : /post false/);
    }
    expect(calls).toHaveLength(2);
    const rec = readLaunch(e.f.topic, e.f.story, e.f.root)!;
    expect(rec.posted).toBe(false);
    expect(rec.postAttempts).toBe(3);
    expect(rec.halt?.kind).toBe('step-failed');
    expect(readHalt(runDir(e.f.topic, e.f.story, e.f.root))?.why).toMatch(/3 attempts.*X 503/);
    expect(m3.sent).toHaveLength(1);
    expect(m3.sent[0].text).toMatch(/X: the post failed/);
    const a4 = await probeLaunches(social, e.f.root, {
      now: () => T0 + 240_000,
      run,
      mail: m3,
      fetchFn: livePage,
      env: X_TEST_ENV,
    });
    expect(a4).toEqual([]); // finished: nothing more
    expect(calls).toHaveLength(2);
    // without the institution's keys the CLI is never run
    const f = clone();
    await launch(f.f.topic, f.f.story, a, f.deps(), f.f.root);
    const calls4: string[] = [];
    await probeLaunches(social, f.f.root, {
      now: () => T0 + 60_000,
      run: (cli: string) => {
        calls4.push(cli);
        return { status: 0, stdout: '', stderr: '' };
      },
      mail: new FakeMailer(f.f.root),
      fetchFn: livePage,
      env: {},
    });
    expect(calls4).toEqual([]);
    expect(readLaunch(f.f.topic, f.f.story, f.f.root)!.posted).toBe('not-configured');
  }, 120_000);

  it('a fixture launch pushes main and then fixture/<run id>, once each across a crash; its two probes; its mail names the preview, the branch and the superseded uploads', async () => {
    const c = clone({ fixture: true });
    expect(c.f.topic).toBe('test-fixture');
    const pushes: string[] = [];
    let crash = true;
    const deps = c.deps({
      git: (args: string[]) => {
        if (args[0] === 'push') {
          pushes.push(args.join(' '));
          if (crash && pushes.length === 2) throw new Error('killed before the branch push');
        }
        return c.git(...args);
      },
    });
    const r = await launch(c.f.topic, c.f.story, a, deps, c.f.root);
    expect(r.outcome).toBe('halted');
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(rec.pushed).toBe(rec.committed);
    expect(rec.fixtureBranch).toBeUndefined();
    crash = false;
    const r2 = await launch(c.f.topic, c.f.story, a, deps, c.f.root);
    expect(r2.outcome).toBe('done');
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.fixtureBranch).toBe('fixture/20261101-1200-abcd');
    expect(pushes.filter((p) => p.endsWith('refs/heads/main'))).toHaveLength(1);
    expect(pushes.filter((p) => p.includes('refs/heads/fixture/20261101-1200-abcd'))).toHaveLength(2); // the crashed one, then the push
    expect(c.originHead()).toBe(rec.committed);
    expect(
      execFileSync('git', ['rev-parse', 'fixture/20261101-1200-abcd'], { cwd: c.bare, encoding: 'utf8' }).trim(),
    ).toBe(rec.committed);
    // the probes: negative on the production host, positive on the preview host (the branch's URL)
    const path = matterPathOf(c.f.topic, c.f.story, c.f.root)!;
    const production = `https://commonwealthofreason.com${path}`;
    const preview = `https://fixture-20261101-1200-abcd.vk.pages.dev${path}`;
    const pages: Record<string, string> = {};
    const fetchFn = (async (u: string | URL | Request) =>
      pages[String(u)] !== undefined
        ? new Response(pages[String(u)], { status: 200 })
        : new Response('', { status: 404 })) as unknown as typeof fetch;
    const mail = new FakeMailer(c.f.root);
    const fx = { ...a, launch: { ...a.launch, fixturePreviewUrl: 'https://{branch}.vk.pages.dev' } };
    const run = () => ({ status: 0, stdout: 'not configured\n', stderr: '' });
    const a1 = await probeLaunches(fx, c.f.root, { now: () => T0 + 60_000, run, mail, fetchFn });
    expect(a1.join('\n')).toMatch(/not live yet/);
    pages[production] = 'the fixture page, on the production site by mistake';
    pages[preview] = 'embed/vid00000000';
    const a2 = await probeLaunches(fx, c.f.root, { now: () => T0 + 120_000, run, mail, fetchFn });
    expect(a2.join('\n')).toMatch(/on the production site/);
    expect(mail.sent).toEqual([]);
    delete pages[production];
    const a3 = await probeLaunches(fx, c.f.root, { now: () => T0 + 180_000, run, mail, fetchFn });
    expect(a3.join('\n')).toMatch(/live at https:\/\/fixture-20261101-1200-abcd\.vk\.pages\.dev/);
    expect(mail.sent).toHaveLength(1);
    const m = mail.sent[0].text;
    expect(m).toContain(preview);
    expect(m).toContain('git push origin --delete fixture/20261101-1200-abcd');
    expect(m).toMatch(/superseded/i);
    expect(m).toContain('vid0000old1'); // an earlier run's upload, listed with the Studio step that deletes it
    expect(m).toMatch(/private again/);
    expect(m).toMatch(/publish -- unpublished/); // the verb that records a change back to private (never `updated`)
    // without a preview URL the positive probe is the local fallback, reported as such
    const d = clone({ fixture: true });
    await launch(d.f.topic, d.f.story, a, d.deps(), d.f.root);
    const m2 = new FakeMailer(d.f.root);
    const a4 = await probeLaunches(a, d.f.root, {
      now: () => T0 + 60_000,
      run,
      mail: m2,
      fetchFn: (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
    });
    expect(a4.join('\n')).toMatch(/local fallback/);
    expect(m2.sent).toHaveLength(1);
    expect(m2.sent[0].text).toMatch(/FIXTURE_SITE=1/);
  }, 120_000);

  it('a stale page past the deploy timeout halts deploy-timeout once (one halt key across ticks, one mail) and posts nothing', async () => {
    const c = clone();
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMailer(c.f.root);
    let answer = { body: 'soon', status: 200 };
    const fetchFn = (async () => new Response(answer.body, { status: answer.status })) as unknown as typeof fetch;
    const posts: string[] = [];
    const run = (cli: string, args: string[]) => {
      posts.push([cli, ...args].join(' '));
      return { status: 0, stdout: '', stderr: '' };
    };
    const late = T0 + 41 * 60_000;
    const acts = await probeLaunches({ ...a, enabled: { ...a.enabled, social: true } }, c.f.root, {
      now: () => late,
      run,
      mail,
      fetchFn,
    });
    expect(acts.join('\n')).toMatch(/deploy-timeout/);
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(rec.halt?.kind).toBe('deploy-timeout');
    expect(rec.liveAt).toBeNull();
    expect(posts).toEqual([]);
    expect(mail.sent).toEqual([]);
    const h1 = readHalt(runDir(c.f.topic, c.f.story, c.f.root))!;
    expect(h1.kind).toBe('deploy-timeout');
    expect(h1.unblock.text).toMatch(/does not carry the video/); // the probe's reason, where it changes nothing
    // the next tick, the host answering differently: the same halt (its key and date), so one mail across the ticks
    answer = { body: '', status: 503 };
    const again = await probeLaunches(a, c.f.root, { now: () => late + 60_000, run, mail, fetchFn });
    expect(again.join('\n')).toMatch(/deploy-timeout/);
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))).toEqual(h1);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.probes).toBe(2);
    const rows = () => statusOf(c.f.root, () => false);
    expect(await notifyHalts(a, mail, c.f.root, { now: () => late, rows: rows() })).toHaveLength(1);
    expect(await notifyHalts(a, mail, c.f.root, { now: () => late + 60_000, rows: rows() })).toHaveLength(0);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toMatch(/deploy-timeout/);
  }, 120_000);
});
