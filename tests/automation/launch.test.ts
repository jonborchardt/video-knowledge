// The launch job (spec §4.4, §4.5's git rows): once the release group is live and verified, today's go-live sequence
// runs in the clone as one resumable job with a progress record; a commit is never repeated and a push never forced;
// the deploy confirmation is the tick's one probe per pass, followed by the social post and the launch email.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { ROOT, readJson, toJson } from '../../src/shared/io';
import { FakeMailer } from './fake-mailer';
import { matterPathOf } from '../../src/modules/website/live';
import {
  appendEvent,
  emptyLedger,
  loadLedger,
  openOutput,
  publishPath,
  saveLedger,
} from '../../src/modules/publishing/publish';
import { readHalt, readJournal, runDir, writeHalt } from '../../src/orchestration/run/journal';
import { settleFinished } from '../../src/orchestration/run/resume';
import { readSchedule, updateSchedule } from '../../src/orchestration/run/schedule';
import {
  LAUNCH_PATHS,
  announceProblem,
  launch,
  launchJobs,
  launchLockDir,
  launchPaths,
  launchProblem,
  launches,
  probeLaunches,
  readLaunch,
  writeLaunch as writeLaunchRecord,
} from '../../src/orchestration/run/launch';
import { preflight } from '../../src/orchestration/run/preflight';
import { launchDeps, nextJob } from '../../src/orchestration/run/work';
import { cliArgv } from '../../src/shared/cli';
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

const RQ = 'rq-0000000000ab';
/** A packaged release fixture turned into a git clone of a bare origin, its video live (published, verified), or
 *  `decided`: uploaded, approved and decided ok but not public (the page goes up first, plan B). */
function clone(opts: { live?: boolean; fixture?: boolean; decided?: boolean } = {}) {
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
  if (opts.live !== false || opts.decided) {
    let l = loadLedger(f.topic, f.story, f.root) ?? emptyLedger(`${f.topic}/${f.story}`);
    const build = readJson<{ mp4Sha: string }>(join(f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
    const via = { channel: 'email' as const, request: RQ };
    // the composed metadata as sent: a decided video is approved only while nothing is behind
    const metadata = openOutput(f.topic, f.story, { root: f.root }).metadata?.sha ?? 'm';
    l = appendEvent(l, 'youtube', {
      at: '2026-10-31T00:00:00Z',
      type: 'uploaded',
      by: 'automation',
      build,
      buildStatus: 'release',
      metadata,
      id: 'vid00000000',
      visibility: 'private',
    }).ledger;
    if (opts.decided)
      // a request needs a passing read-back since the upload (requestProblem), so a decided ledger carries one
      l = appendEvent(l, 'youtube', {
        at: '2026-10-31T00:01:00Z',
        type: 'verified',
        by: 'automation',
        id: 'vid00000000',
        result: 'passed',
        checks: [{ name: 'visibility', result: 'pass' }],
      }).ledger;
    l = appendEvent(l, 'youtube', { at: '2026-10-31T01:00:00Z', type: 'approved', by: 'Jon', build, via }).ledger;
    if (opts.decided) {
      l = appendEvent(l, 'youtube', {
        at: '2026-10-31T01:00:01Z',
        type: 'decided',
        by: 'Jon',
        request: RQ,
        verdict: 'ok',
        via,
      }).ledger;
    } else {
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
    }
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

  it('an uploaded Short that is not live yet (approved, or behind on its parent link) holds the announcement, not the launch', async () => {
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
    expect(launchProblem(c.f.topic, c.f.story, c.f.root)).toBeNull();
    expect(announceProblem(c.f.topic, c.f.story, c.f.root)).toMatch(/short:one is .*not live yet/);
    expect(launchJobs(a, c.f.root)).toHaveLength(1);
    await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
    const mail = new FakeMailer(c.f.root);
    const r = await probeLaunches(a, c.f.root, { now: () => T0, run: c.deps().run, mail, fetchFn: livePage });
    expect(r.join('\n')).toMatch(/short:one is .*not live yet; the post and the mail wait/);
    expect(mail.sent).toEqual([]);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.liveAt).toBeTruthy();
  }, 120_000);

  describe('the page before the video (plan B): a decided release launches, the probe goes live', () => {
    const published = (f: { topic: string; story: string; root: string }, at = '2026-11-01T12:30:00Z') => {
      let l = loadLedger(f.topic, f.story, f.root)!;
      l = appendEvent(l, 'youtube', { at, type: 'published', by: 'Jon', id: 'vid00000000' }).ledger;
      l = appendEvent(l, 'youtube', {
        at: '2026-11-01T12:31:00Z',
        type: 'verified',
        by: 'automated: tick',
        id: 'vid00000000',
        result: 'passed',
        checks: [{ name: 'visibility', result: 'pass' }],
      }).ledger;
      saveLedger(publishPath(f.topic, f.story, f.root), l);
    };

    it('an approved, decided-ok story is launchable before it is live; one with a later changes-requested is not', async () => {
      const c = clone({ decided: true });
      expect(launchProblem(c.f.topic, c.f.story, c.f.root)).toBeNull();
      expect(launchJobs(a, c.f.root)).toEqual([
        { kind: 'launch', topic: c.f.topic, storyId: c.f.story, why: 'launch: the release is decided' },
      ]);
      const r = await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      expect(r.outcome).toBe('done');
      expect(c.git('log', '-1', '--format=%s')).toContain(`release(${c.f.topic}): ${c.f.story} is releasing`);
      // withdrawn: the latest decision on the build is a change request
      const d = clone({ decided: true });
      const build = readJson<{ mp4Sha: string }>(join(d.f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
      saveLedger(
        publishPath(d.f.topic, d.f.story, d.f.root),
        appendEvent(loadLedger(d.f.topic, d.f.story, d.f.root)!, 'youtube', {
          at: '2026-10-31T02:00:00Z',
          type: 'changes-requested',
          by: 'Jon',
          build,
          notes: [{ text: 'not yet' }],
        }).ledger,
      );
      expect(launchProblem(d.f.topic, d.f.story, d.f.root)).toMatch(/not live \(changes-requested\)/);
      expect(launchJobs(a, d.f.root)).toEqual([]);
    }, 120_000);

    it('a request halt older than the decision is settled, so the launch can start; one written after it stands', () => {
      const c = clone({ decided: true });
      const dir = runDir(c.f.topic, c.f.story, c.f.root);
      const halt = (at: string) => ({
        kind: 'awaiting-person' as const,
        stage: 'packaged',
        why: `the release awaits approval: request ${RQ}`,
        unblock: { kind: 'decide' as const, text: 'reply OK' },
        at,
        runId: 'r',
        board: { stage: 'packaged', next: 'approve' },
      });
      writeHalt(dir, halt('2026-10-31T00:30:00.000Z'));
      expect(launchJobs(a, c.f.root)).toEqual([]); // a person's halt blocks the launch until it is settled
      expect(settleFinished(c.f.root, { by: 'automated: test' })).toEqual([`${c.f.topic}/${c.f.story}`]);
      expect(readHalt(dir)).toBeNull();
      expect(readJournal(dir).at(-1)!.error).toMatch(/decided ok/);
      expect(launchJobs(a, c.f.root)).toHaveLength(1);
      writeHalt(dir, halt('2026-10-31T02:00:00.000Z'));
      expect(settleFinished(c.f.root, { by: 'automated: test' })).toEqual([]);
      // the article pass's halt asks about something else: the decision does not settle it
      writeHalt(dir, { ...halt('2026-10-31T00:30:00.000Z'), stage: 'article', why: 'the correction still fails' });
      expect(settleFinished(c.f.root, { by: 'automated: test' })).toEqual([]);
      expect(readHalt(dir)?.stage).toBe('article');
    }, 120_000);

    it('a finished launch older than a new decision on the same upload is stale: the launch runs again', async () => {
      const c = clone({ decided: true });
      expect((await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root)).outcome).toBe('done');
      expect(launchJobs(a, c.f.root)).toEqual([]);
      // withdrawn, then approved and decided again under a new request (a changed article, the same video)
      const build = readJson<{ mp4Sha: string }>(join(c.f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
      const via = { channel: 'email' as const, request: 'rq-0000000000cd' };
      let l = loadLedger(c.f.topic, c.f.story, c.f.root)!;
      for (const e of [
        { at: '2026-11-01T13:00:00Z', type: 'changes-requested' as const, build, notes: [{ text: 'the article' }] },
        { at: '2026-11-01T14:00:00Z', type: 'approved' as const, build, via },
        { at: '2026-11-01T14:00:01Z', type: 'decided' as const, request: via.request, verdict: 'ok' as const, via },
      ])
        l = appendEvent(l, 'youtube', { by: 'Jon', ...e }).ledger;
      saveLedger(publishPath(c.f.topic, c.f.story, c.f.root), l);
      expect(launchJobs(a, c.f.root)).toHaveLength(1);
      unlinkSync(join(c.f.root, 'brand-out.txt')); // the fake brand's file outside the launch paths: a clean clone
      const before = c.commits();
      const r = await launch(c.f.topic, c.f.story, a, c.deps({ now: () => T0 + 3 * 3600_000 }), c.f.root);
      expect(r.outcome).toBe('done');
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.startedAt).toBe(new Date(T0 + 3 * 3600_000).toISOString());
      expect(c.ran.filter((x) => x === 'build')).toHaveLength(2);
      expect(Number(c.commits())).toBe(Number(before) + 1);
      expect(launchJobs(a, c.f.root)).toEqual([]);
    }, 120_000);

    it('a video the person unpublished is never taken live again by the probe (the decision is spent)', async () => {
      const c = clone({ decided: true });
      await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      published(c.f);
      let l = loadLedger(c.f.topic, c.f.story, c.f.root)!;
      l = appendEvent(l, 'youtube', {
        at: '2026-11-01T13:00:00Z',
        type: 'unpublished',
        by: 'Jon',
        id: 'vid00000000',
        note: 'taken down',
      }).ledger;
      saveLedger(publishPath(c.f.topic, c.f.story, c.f.root), l);
      const verbs: string[] = [];
      const run = (cli: string, args: string[]) => {
        verbs.push([cli, ...args].join(' '));
        return { status: 0, stdout: '', stderr: '' };
      };
      const mail = new FakeMailer(c.f.root);
      const r = await probeLaunches(a, c.f.root, { now: () => T0 + 60_000, run, mail, fetchFn: livePage });
      expect(verbs.filter((v) => v.includes('go-live'))).toEqual([]);
      expect(r.join('\n')).toMatch(/waits for a decision/);
      expect(mail.sent).toEqual([]);
    }, 120_000);

    it('a new decision after the page went up: the probe waits for the rebuilt page instead of going live on the old one', async () => {
      const c = clone({ decided: true });
      await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      const build = readJson<{ mp4Sha: string }>(join(c.f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
      const via = { channel: 'email' as const, request: 'rq-0000000000cd' };
      let l = loadLedger(c.f.topic, c.f.story, c.f.root)!;
      for (const e of [
        { at: '2026-11-01T13:00:00Z', type: 'changes-requested' as const, build, notes: [{ text: 'the article' }] },
        { at: '2026-11-01T14:00:00Z', type: 'approved' as const, build, via },
        { at: '2026-11-01T14:00:01Z', type: 'decided' as const, request: via.request, verdict: 'ok' as const, via },
      ])
        l = appendEvent(l, 'youtube', { by: 'Jon', ...e }).ledger;
      saveLedger(publishPath(c.f.topic, c.f.story, c.f.root), l);
      const verbs: string[] = [];
      const run = (cli: string, args: string[]) => {
        verbs.push([cli, ...args].join(' '));
        return { status: 0, stdout: '', stderr: '' };
      };
      const mail = new FakeMailer(c.f.root);
      // the tick's probe runs before the work plane's fresh launch: the old page carries the same id
      const r = await probeLaunches(a, c.f.root, { now: () => T0 + 3 * 3600_000, run, mail, fetchFn: livePage });
      expect(verbs).toEqual([]);
      expect(r.join('\n')).toMatch(/new decision/);
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.halt ?? null).toBeNull();
      expect(launchJobs(a, c.f.root)).toHaveLength(1);
    }, 120_000);

    it('a go-live that fails finally, or is refused, halts once and is not run again; a hand go-live clears the halt', async () => {
      const c = clone({ decided: true });
      await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      const mail = new FakeMailer(c.f.root);
      const verbs: string[] = [];
      let refuse = true;
      const run = (cli: string, args: string[]) => {
        verbs.push([cli, ...args].join(' '));
        return refuse && args[0] === 'go-live'
          ? { status: 2, stdout: '', stderr: 'refused: youtube is drawn with an older kit\n' }
          : { status: 0, stdout: '', stderr: '' };
      };
      // refused (exit 2, no failed event): a person's at once
      const r1 = await probeLaunches(a, c.f.root, { now: () => T0 + 60_000, run, mail, fetchFn: livePage });
      expect(verbs.filter((v) => v.includes('go-live'))).toHaveLength(1);
      expect(r1.join('\n')).toMatch(/go-live \(2\)/);
      const rec = readLaunch(c.f.topic, c.f.story, c.f.root)!;
      expect(rec.halt?.kind).toBe('step-failed');
      expect(rec.halt?.why).toMatch(/older kit/);
      expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))?.kind).toBe('step-failed');
      // the next ticks run nothing more
      await probeLaunches(a, c.f.root, { now: () => T0 + 120_000, run, mail, fetchFn: livePage });
      expect(verbs.filter((v) => v.includes('go-live'))).toHaveLength(1);
      expect(launchJobs(a, c.f.root)).toEqual([]);
      // a new decision on the same upload makes that halt moot: the launch runs again and clears it
      const build1 = readJson<{ mp4Sha: string }>(join(c.f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
      const via1 = { channel: 'email' as const, request: 'rq-0000000000ef' };
      let l1 = loadLedger(c.f.topic, c.f.story, c.f.root)!;
      for (const e of [
        { at: '2026-11-01T13:00:00Z', type: 'changes-requested' as const, build: build1, notes: [{ text: 'kit' }] },
        { at: '2026-11-01T14:00:00Z', type: 'approved' as const, build: build1, via: via1 },
        {
          at: '2026-11-01T14:00:01Z',
          type: 'decided' as const,
          request: via1.request,
          verdict: 'ok' as const,
          via: via1,
        },
      ])
        l1 = appendEvent(l1, 'youtube', { by: 'Jon', ...e }).ledger;
      saveLedger(publishPath(c.f.topic, c.f.story, c.f.root), l1);
      expect(launchJobs(a, c.f.root)).toHaveLength(1);
      unlinkSync(join(c.f.root, 'brand-out.txt'));
      const again = await launch(c.f.topic, c.f.story, a, c.deps({ now: () => T0 + 3 * 3600_000 }), c.f.root);
      expect(again.outcome).toBe('done');
      expect(readHalt(runDir(c.f.topic, c.f.story, c.f.root))).toBeNull();
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.halt ?? null).toBeNull();
      // a final failure recorded by the verb (YouTube kept it private) is the same: halted once, never retried
      const d = clone({ decided: true });
      await launch(d.f.topic, d.f.story, a, d.deps(), d.f.root);
      saveLedger(
        publishPath(d.f.topic, d.f.story, d.f.root),
        appendEvent(loadLedger(d.f.topic, d.f.story, d.f.root)!, 'youtube', {
          at: '2026-11-01T12:10:00Z',
          type: 'failed',
          by: 'Jon',
          id: 'vid00000000',
          step: 'go-live',
          error: 'YouTube kept vid00000000 private',
          retryable: false,
        }).ledger,
      );
      const verbs2: string[] = [];
      const run2 = (cli: string, args: string[]) => {
        verbs2.push([cli, ...args].join(' '));
        return { status: 0, stdout: '', stderr: '' };
      };
      await probeLaunches(a, d.f.root, { now: () => T0 + 60_000, run: run2, mail, fetchFn: livePage });
      await probeLaunches(a, d.f.root, { now: () => T0 + 120_000, run: run2, mail, fetchFn: livePage });
      expect(verbs2.filter((v) => v.includes('go-live'))).toEqual([]);
      expect(readLaunch(d.f.topic, d.f.story, d.f.root)!.halt?.kind).toBe('step-failed');
      expect(readLaunch(d.f.topic, d.f.story, d.f.root)!.halt?.why).toMatch(/kept vid00000000 private/);
      // the person fixes it and goes live by hand: the halt clears and the launch goes on to the announcement
      published(d.f);
      refuse = false;
      const r3 = await probeLaunches(a, d.f.root, { now: () => T0 + 180_000, run: run2, mail, fetchFn: livePage });
      expect(readLaunch(d.f.topic, d.f.story, d.f.root)!.halt ?? null).toBeNull();
      expect(readHalt(runDir(d.f.topic, d.f.story, d.f.root))).toBeNull();
      expect(r3.join('\n')).not.toMatch(/go-live/);
      expect(mail.sent).toHaveLength(1);
    }, 120_000);

    it('a read-back the state owes (a description pushed after the decision) runs before the go-live', async () => {
      const c = clone({ decided: true });
      await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      // decide --paid pushed a new description: sent, not verified since
      saveLedger(
        publishPath(c.f.topic, c.f.story, c.f.root),
        appendEvent(loadLedger(c.f.topic, c.f.story, c.f.root)!, 'youtube', {
          at: '2026-11-01T12:05:00Z',
          type: 'updated',
          by: 'Jon',
          id: 'vid00000000',
          metadata: openOutput(c.f.topic, c.f.story, { root: c.f.root }).metadata!.sha, // composed: nothing behind
          fields: ['description'],
        }).ledger,
      );
      const verbs: string[] = [];
      const run = (cli: string, args: string[]) => {
        verbs.push([cli, ...args].join(' '));
        return { status: 0, stdout: '', stderr: '' };
      };
      const r = await probeLaunches(a, c.f.root, {
        now: () => T0 + 60_000,
        run,
        mail: new FakeMailer(c.f.root),
        fetchFn: livePage,
      });
      expect(r.join('\n')).toMatch(/the go-live waits/);
      expect(verbs).toEqual([`publish verify ${c.f.topic} ${c.f.story} --by automated: tick`]);
    }, 120_000);

    it('the probe confirming the page runs go-live under the decision, then verify; the post and the mail wait for the live, verified video', async () => {
      const c = clone({ decided: true });
      await launch(c.f.topic, c.f.story, a, c.deps(), c.f.root);
      const mail = new FakeMailer(c.f.root);
      const verbs: string[] = [];
      const run = (cli: string, args: string[]) => {
        verbs.push([cli, ...args].join(' '));
        return { status: 0, stdout: '', stderr: '' };
      };
      const stale = (async () => new Response('soon', { status: 200 })) as unknown as typeof fetch;
      const a1 = await probeLaunches(a, c.f.root, { now: () => T0 + 60_000, run, mail, fetchFn: stale });
      expect(a1.join('\n')).toMatch(/not live yet/);
      expect(verbs).toEqual([]);
      const a2 = await probeLaunches(a, c.f.root, { now: () => T0 + 120_000, run, mail, fetchFn: livePage });
      expect(a2.join('\n')).toMatch(/live at/);
      expect(verbs).toEqual([`publish go-live ${c.f.topic} ${c.f.story} --by Jon --via tick:${RQ}`]);
      // the fake verb changed nothing: the ledger still says approved, so nothing is announced yet
      expect(a2.join('\n')).toMatch(/go-live/);
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.liveAt).toBeTruthy();
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.emailed).toBe(false);
      expect(mail.sent).toEqual([]);
      // the video published and read back (what the real verbs leave): the announcement follows once
      published(c.f);
      const a3 = await probeLaunches(a, c.f.root, { now: () => T0 + 180_000, run, mail, fetchFn: livePage });
      expect(a3.join('\n')).not.toMatch(/go-live/);
      expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.posted).toBe('not-configured');
      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0].text).toContain('https://www.youtube.com/watch?v=vid00000000');
      const a4 = await probeLaunches(a, c.f.root, { now: () => T0 + 240_000, run, mail, fetchFn: livePage });
      expect(a4).toEqual([]);
      expect(mail.sent).toHaveLength(1);
    }, 120_000);
  });

  it('a verification from before the publish does not clear the launch; the same findings read back after it do', () => {
    const c = clone({ live: false });
    const { f } = c;
    const build = readJson<{ mp4Sha: string }>(join(f.dir, 'video', 'review', 'review.json'))!.mp4Sha;
    const verified = (at: string): Parameters<typeof appendEvent>[2] => ({
      at,
      type: 'verified',
      by: 'automation',
      id: 'vid00000000',
      build,
      metadata: 'm',
      result: 'passed',
      checks: [{ name: 'privacy', result: 'pass' }],
    });
    let l = emptyLedger(`${f.topic}/${f.story}`);
    const add = (e: Parameters<typeof appendEvent>[2]) => {
      l = appendEvent(l, 'youtube', e).ledger;
      saveLedger(publishPath(f.topic, f.story, f.root), l);
    };
    add({
      at: '2026-10-31T00:00:00Z',
      type: 'uploaded',
      by: 'automation',
      build,
      buildStatus: 'release',
      metadata: 'm',
      id: 'vid00000000',
      visibility: 'private',
    });
    add(verified('2026-10-31T00:01:00Z'));
    add({ at: '2026-10-31T01:00:00Z', type: 'approved', by: 'Jon', build });
    add({ at: '2026-11-01T00:00:00Z', type: 'published', by: 'Jon', id: 'vid00000000' });
    expect(launchProblem(f.topic, f.story, f.root)).toMatch(/not verified since/);
    add(verified('2026-11-01T00:01:00Z'));
    expect(launchProblem(f.topic, f.story, f.root)).toBeNull();
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

  describe('a release that already went live', () => {
    const approvalHalt = (at: string, kind: 'awaiting-person' | 'needs-person' = 'awaiting-person') => ({
      kind,
      stage: 'packaged',
      why: 'the release awaits approval: request rq-old',
      unblock: { kind: 'decide' as const, text: 'reply OK' },
      at,
      runId: 'r',
      board: { stage: 'packaged', next: 'approve' },
    });
    const BEFORE = '2026-10-31T12:00:00.000Z'; // the fixture publishes at 2026-11-01T00:00:00Z
    const AFTER = '2026-11-01T06:00:00.000Z';

    it('settles a request for approval older than the publication: the journal keeps it, its resume goes', () => {
      const c = clone();
      const { f } = c;
      const dir = runDir(f.topic, f.story, f.root);
      writeHalt(dir, approvalHalt(BEFORE));
      updateSchedule(f.root, (s) => ({
        ...s,
        due: [
          { topic: f.topic, storyId: f.story, why: 'moved', at: BEFORE },
          { topic: 'other', storyId: 'x', why: 'moved', at: BEFORE },
        ],
      }));
      expect(settleFinished(f.root, { by: 'automated: test' })).toEqual([`${f.topic}/${f.story}`]);
      expect(readHalt(dir)).toBeNull();
      const line = readJournal(dir).at(-1)!;
      expect(line.step).toBe('settle');
      expect(line.error).toMatch(/automated: test/);
      expect(line.error).toMatch(/awaiting-person/);
      expect(line.error).toContain('request rq-old');
      expect(line.error).toContain(BEFORE);
      expect(readSchedule(f.root).due).toEqual([{ topic: 'other', storyId: 'x', why: 'moved', at: BEFORE }]);
      expect(settleFinished(f.root, { by: 'automated: test' })).toEqual([]);
    }, 120_000);

    it('leaves a halt written after the publication, any other kind, and a story not live', () => {
      const c = clone();
      const { f } = c;
      const dir = runDir(f.topic, f.story, f.root);
      writeHalt(dir, approvalHalt(AFTER));
      expect(settleFinished(f.root, { by: 'automated: test' })).toEqual([]);
      writeHalt(dir, approvalHalt(BEFORE, 'needs-person'));
      expect(settleFinished(f.root, { by: 'automated: test' })).toEqual([]);
      expect(readHalt(dir)?.kind).toBe('needs-person');
      const d = clone({ live: false });
      const gone = runDir(d.f.topic, d.f.story, d.f.root);
      writeHalt(gone, approvalHalt(BEFORE));
      expect(settleFinished(d.f.root, { by: 'automated: test' })).toEqual([]);
      expect(readHalt(gone)?.kind).toBe('awaiting-person');
    }, 120_000);

    it('an output taken down again is not live: its halt stands and its resume runs', () => {
      const c = clone();
      const { f } = c;
      const p = publishPath(f.topic, f.story, f.root);
      saveLedger(
        p,
        appendEvent(loadLedger(f.topic, f.story, f.root)!, 'youtube', {
          at: '2026-11-01T01:00:00Z',
          type: 'unpublished',
          by: 'Jon',
          id: 'vid00000000',
          note: 'taken down',
        }).ledger,
      );
      const dir = runDir(f.topic, f.story, f.root);
      writeHalt(dir, approvalHalt(BEFORE));
      expect(
        settleFinished(f.root, {
          by: 'automated: test',
          ask: () => ({ stage: 's', next: 'n', halt: { kind: 'published' } }),
        }),
      ).toEqual([]);
      expect(readHalt(dir)?.kind).toBe('awaiting-person');
      updateSchedule(f.root, (s) => ({ ...s, due: [{ topic: f.topic, storyId: f.story, why: 'moved', at: BEFORE }] }));
      expect(nextJob(a, f.root, { launches: () => [], releases: () => [] })?.kind).toBe('resume');
    }, 120_000);

    it('a queued resume of a story with no ledger or production is still selected, not a crash', () => {
      const c = clone();
      updateSchedule(c.f.root, (s) => ({
        ...s,
        due: [{ topic: c.f.topic, storyId: 'decision:no-such-story', why: 'backoff', at: BEFORE }],
      }));
      expect(nextJob(a, c.f.root, { launches: () => [], releases: () => [] })?.storyId).toBe('decision:no-such-story');
    }, 120_000);

    it('the work plane never selects a queued resume of a live story', () => {
      const c = clone();
      const { f } = c;
      updateSchedule(f.root, (s) => ({ ...s, due: [{ topic: f.topic, storyId: f.story, why: 'moved', at: BEFORE }] }));
      expect(nextJob(a, f.root, { launches: () => [], releases: () => [] })).toBeNull();
    }, 120_000);

    it('probe answers for one launch: another stays untouched, and a second probe mails nothing', async () => {
      const c = clone();
      const { f } = c;
      const r = await launch(f.topic, f.story, a, c.deps(), f.root);
      expect(r.outcome).toBe('done');
      writeLaunchRecord(f.root, { ...readLaunch(f.topic, f.story, f.root)!, storyId: 'decision:other' });
      const mail = new FakeMailer(f.root);
      const only = { topic: f.topic, storyId: f.story };
      await probeLaunches(a, f.root, { now: () => T0, run: c.deps().run, mail, fetchFn: livePage, only });
      expect(readLaunch(f.topic, f.story, f.root)!.liveAt).toBeTruthy();
      expect(readLaunch(f.topic, f.story, f.root)!.emailed).toBe(true);
      expect(readLaunch(f.topic, 'decision:other', f.root)!.liveAt).toBeNull();
      expect(mail.sent).toHaveLength(1);
      await probeLaunches(a, f.root, { now: () => T0, run: c.deps().run, mail, fetchFn: livePage, only });
      expect(mail.sent).toHaveLength(1);
    }, 120_000);
  });

  it('every step of the launch dispatches through the real runner; the build really builds the site', async () => {
    for (const cli of ['report', 'brand', 'build', 'links']) expect(() => cliArgv(cli, [])).not.toThrow();
    const c = clone();
    const { root } = c.f;
    // a real, tiny Astro project in the clone: the job's own runner runs the repo's astro against it
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'astro.config.mjs'), 'export default {};\n');
    writeFileSync(join(root, 'src', 'pages', 'index.astro'), '<h1>built by the launch</h1>\n');
    writeFileSync(join(root, '.git', 'info', 'exclude'), 'node_modules\ndist\n.astro\n');
    const link = join(root, 'node_modules');
    symlinkSync(join(ROOT, 'node_modules'), link, 'junction');
    try {
      c.git('add', 'astro.config.mjs', 'src');
      c.git('commit', '-q', '-m', 'the site');
      c.git('push', '-q', 'origin', 'main');
      const fake = c.deps().run;
      const real = launchDeps(root).run;
      const r = await launch(
        c.f.topic,
        c.f.story,
        a,
        c.deps({ run: (cli: string, args: string[]) => (cli === 'build' ? real(cli, args) : fake(cli, args)) }),
        root,
      );
      expect(r.halt?.why).toBeUndefined();
      expect(r.outcome).toBe('done');
      expect(readFileSync(join(root, 'dist', 'index.html'), 'utf8')).toContain('built by the launch');
      expect(readLaunch(c.f.topic, c.f.story, root)!.steps.built).toBeTruthy();
    } finally {
      unlinkSync(link); // the link only, never what it points at
      expect(existsSync(join(ROOT, 'node_modules'))).toBe(true);
    }
  }, 180_000);

  it('a step that cannot even start halts git with its reason and pushes nothing', async () => {
    const c = clone();
    const head = c.originHead();
    const fake = c.deps().run;
    const r = await launch(
      c.f.topic,
      c.f.story,
      a,
      c.deps({
        run: (cli: string, args: string[]) => {
          if (cli === 'build') throw new Error('package.json has no CLI script build');
          return fake(cli, args);
        },
      }),
      c.f.root,
    );
    expect(r.outcome).toBe('halted');
    expect(r.halt?.kind).toBe('git');
    expect(r.halt?.why).toMatch(/npm run build .*no CLI script build/);
    expect(c.originHead()).toBe(head);
    expect(readLaunch(c.f.topic, c.f.story, c.f.root)!.steps.built).toBeUndefined();
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
