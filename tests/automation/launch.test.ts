// The launch job (spec §4.4, §4.5's git rows): once the release group is live and verified, today's go-live sequence
// runs in the clone as one resumable job with a progress record; a commit is never repeated and a push never forced;
// the deploy confirmation is the tick's one probe per pass, followed by the social post and the launch email.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { readJson, toJson } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import { matterPathOf } from '../../src/modules/website/live';
import { appendEvent, emptyLedger, loadLedger, publishPath, saveLedger } from '../../src/modules/publishing/publish';
import { readHalt, runDir } from '../../src/orchestration/run/journal';
import {
  LAUNCH_PATHS,
  launch,
  launchJobs,
  launchPaths,
  launches,
  probeLaunches,
  readLaunch,
} from '../../src/orchestration/run/launch';
import { preflight } from '../../src/orchestration/run/preflight';
import { readOutbox } from '../../src/orchestration/run/notify';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
const bares: string[] = [];
afterAll(() => {
  fixtures.forEach((f) => f.cleanup());
  bares.forEach((b) => rmSync(b, { recursive: true, force: true }));
});
const T0 = Date.parse('2026-11-01T12:00:00Z');
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true },
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  launch: { ...DEFAULTS.launch, push: true, deployTimeoutMinutes: 40 },
};

/** A packaged release fixture turned into a git clone of a bare origin, its video live (published, verified). */
function clone(opts: { live?: boolean } = {}) {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
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
      if (cli === 'links' && args[0] === 'freeze')
        writeFileSync(join(f.root, 'public-urls.json'), toJson([matterPathOf(f.topic, f.story, f.root), '/']));
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

describe('launch', () => {
  it('refuses a story whose video is not live, and lists no launch job for it', async () => {
    const c = clone({ live: false });
    const r = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(r.outcome).toBe('halted');
    expect(r.halt?.why).toMatch(/not launchable: no publish.json/);
    expect(c.ran).toEqual([]);
    expect(launchJobs(a, c.f.root)).toEqual([]);
  });

  it('runs the sequence once, commits the story and the site outputs on main, pushes once, and fills the record', async () => {
    const c = clone();
    expect(launchJobs(a, c.f.root)).toEqual([
      { kind: 'launch', topic: c.f.topic, storyId: c.f.story, why: 'launch: the release group is live' },
    ]);
    const before = c.commits();
    const r = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(r.outcome).toBe('done');
    expect(c.ran).toEqual([`report seed ${c.f.topic}`, 'brand', 'build', 'links freeze']);
    const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
    expect(Object.keys(rec.steps).sort()).toEqual(['branded', 'built', 'frozen', 'pulled', 'seeded', 'validated']);
    expect(rec.committed).toMatch(/^[0-9a-f]{40}$/);
    expect(rec.pushed).toBe(rec.committed);
    expect(c.commits()).toBe(String(Number(before) + 1));
    expect(c.originHead()).toBe(rec.committed);
    expect(c.git('log', '-1', '--format=%s')).toContain(`release(${c.f.topic}): ${c.f.story} is live`);
    expect(c.git('status', '--porcelain')).toMatch(/brand-out.txt/); // outside the launch's paths: left alone
    expect(c.git('show', '--stat', '--format=', 'HEAD')).toContain('public-urls.json');
    expect(launchJobs(a, c.f.root)).toEqual([]); // launched: nothing left for the work plane
    // a second job finds everything done and repeats nothing
    const again = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    expect(again.outcome).toBe('done');
    expect(c.ran).toHaveLength(4);
    expect(c.commits()).toBe(String(Number(before) + 1));
  });

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
  });

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
  });

  it('the probe: a stale page posts and emails nothing; the live page records liveAt, the post (not configured) and one launch email', async () => {
    const c = clone();
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMail();
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
    expect(readOutbox(c.f.root).at(-1)).toMatchObject({ kind: 'launch', topic: c.f.topic, storyId: c.f.story });
    // nothing more on a later tick
    const a3 = await probeLaunches(a, c.f.root, { now: () => T0 + 180_000, run, mail, fetchFn });
    expect(a3).toEqual([]);
    expect(mail.sent).toHaveLength(1);
    expect(launches(c.f.root)).toHaveLength(1);
  });

  it('a stale page past the deploy timeout halts deploy-timeout and posts nothing', async () => {
    const c = clone();
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMail();
    const fetchFn = (async () => new Response('soon', { status: 200 })) as unknown as typeof fetch;
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
    expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('deploy-timeout');
  });
});
