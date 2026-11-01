// The tick's preflight (phase 1 Task 4): the clone, a clean tree on main except the paths a launch job or a live
// story run owns, a Claude that answers, the mailbox and its recipient, free disk, the watcher for discovery. The
// problem sentences are stable (the halt's key hashes them); the specifics travel as details.
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { type PreflightDeps, preflight } from '../../src/orchestration/run/preflight';

const ok: PreflightDeps = {
  git: (args) => (args[0] === 'status' ? '' : 'main\n'),
  claude: () => true,
  env: { MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' },
  freeGb: () => 100,
  launches: () => [],
  tmpDir: 'C:/tmp',
  watcherDir: () => '/w',
};
const a = {
  ...DEFAULTS,
  enabled: { ...DEFAULTS.enabled, tick: true },
  notifications: { ...DEFAULTS.notifications, to: 'jon@example.test' },
};

describe('preflight', () => {
  it('passes a clean clone on main with mail, disk and a live Claude', () => {
    expect(preflight(a, 'F:/clone', ok)).toEqual({ ok: true, problems: [], details: [] });
  });
  it('refuses a checkout that is not the configured clone', () => {
    const r = preflight({ ...a, clone: 'F:/github/video-knowledge-auto' }, 'F:/github/video-knowledge', ok);
    expect(r.problems).toEqual(['this checkout is not the automation clone']);
    expect(r.details[0]).toMatch(/names the clone/);
    expect(preflight({ ...a, clone: 'F:/x/' }, 'F:/x', ok).ok).toBe(true);
  });
  it('a dirty tree fails unless a launch record owns every dirty path; the sentence is stable, the paths are details', () => {
    const dirty = {
      ...ok,
      git: (args: string[]) =>
        args[0] === 'status' ? ' M topics/heat-pumps/report.json\n?? public/og/x.jpg\n' : 'main\n',
    };
    expect(preflight(a, 'r', dirty).problems).toEqual(['the clone is dirty']);
    expect(preflight(a, 'r', dirty).details).toEqual([
      expect.stringMatching(/dirty: topics\/heat-pumps\/report.json, public\/og\/x.jpg/),
    ]);
    expect(preflight(a, 'r', { ...dirty, launches: () => [{ paths: ['topics/heat-pumps', 'public'] }] }).ok).toBe(true);
    expect(preflight(a, 'r', { ...dirty, launches: () => [{ paths: ['topics/heat-pumps'] }] }).details[0]).toMatch(
      /public\/og/,
    );
  });
  it('a story with a live run owns its folder and the shared folders a graphics agent writes', () => {
    // the runner commits only at its finish: during a run the tree is dirty for the whole render
    const dirty = {
      ...ok,
      git: (args: string[]) =>
        args[0] === 'status'
          ? '?? topics/heat-pumps/scripts/decision-a/script.json\n M src/modules/video/remotion/scenes/index.ts\n?? music/x/\n'
          : 'main\n',
    };
    expect(preflight(a, 'r', dirty).ok).toBe(false);
    expect(preflight(a, 'r', { ...dirty, running: () => ['topics/heat-pumps/scripts/decision-a'] }).ok).toBe(true);
    const other = {
      ...dirty,
      git: (x: string[]) => (x[0] === 'status' ? '?? topics/organic-food/scripts/b/script.json\n' : 'main\n'),
    };
    expect(preflight(a, 'r', { ...other, running: () => ['topics/heat-pumps/scripts/decision-a'] }).ok).toBe(false);
  });
  it('the branch, Claude, mail, the recipient, disk and the watcher each name their problem', () => {
    expect(preflight(a, 'r', { ...ok, git: (x) => (x[0] === 'status' ? '' : 'feat/x\n') }).problems).toEqual([
      'the clone is not on main',
    ]);
    expect(preflight(a, 'r', { ...ok, claude: () => false }).problems).toEqual([
      expect.stringMatching(/claude -p did not answer/),
    ]);
    expect(preflight(a, 'r', { ...ok, env: {} }).problems).toEqual([expect.stringMatching(/mail is not configured/)]);
    expect(preflight({ ...a, enabled: { ...a.enabled, tick: false } }, 'r', { ...ok, env: {} }).ok).toBe(true);
    expect(preflight({ ...a, notifications: { ...a.notifications, to: '' } }, 'r', ok).problems).toEqual([
      expect.stringMatching(/notifications.to is empty/),
    ]);
    expect(preflight(a, 'r', { ...ok, freeGb: () => 3.2 }).problems).toEqual([
      'free disk below 20 GB on the drive of C:/tmp',
    ]);
    expect(preflight(a, 'r', { ...ok, freeGb: () => 3.2 }).details).toEqual(['3.2 GB free; renders need 20']);
    expect(
      preflight({ ...a, enabled: { ...a.enabled, discovery: true } }, 'r', { ...ok, watcherDir: () => null }).problems,
    ).toEqual([expect.stringMatching(/watcher checkout is missing/)]);
    expect(preflight(a, 'r', { ...ok, watcherDir: () => null }).ok).toBe(true);
  });
  it('with the work plane on, every commission with a claimed public topic needs a usable YouTube token', () => {
    const work = { ...a, enabled: { ...a.enabled, work: true } };
    const channels = () => [
      { key: 'spending', problem: null },
      { key: 'public-health', problem: 'no refresh token: run npm run publish -- auth --commission public-health' },
    ];
    const r = preflight(work, 'r', { ...ok, channels });
    expect(r.problems).toEqual(['a commission has no YouTube token']);
    expect(r.details).toEqual([expect.stringMatching(/public-health: no refresh token/)]);
    expect(preflight(a, 'r', { ...ok, channels }).ok).toBe(true); // the work plane off: uploads never run
    expect(preflight(work, 'r', { ...ok, channels: () => [{ key: 'spending', problem: null }] }).ok).toBe(true);
  });
});
