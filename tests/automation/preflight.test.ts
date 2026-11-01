// The tick's preflight (phase 1 Task 4): the clone, a clean tree on main except a launch job's own paths, a Claude
// that answers, the mailbox, free disk, the watcher for discovery.
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
const a = { ...DEFAULTS, enabled: { ...DEFAULTS.enabled, tick: true } };

describe('preflight', () => {
  it('passes a clean clone on main with mail, disk and a live Claude', () => {
    expect(preflight(a, 'F:/clone', ok)).toEqual({ ok: true, problems: [] });
  });
  it('refuses a checkout that is not the configured clone', () => {
    const r = preflight({ ...a, clone: 'F:/github/video-knowledge-auto' }, 'F:/github/video-knowledge', ok);
    expect(r.problems).toEqual([expect.stringMatching(/names the clone/)]);
    expect(preflight({ ...a, clone: 'F:/x/' }, 'F:/x', ok).ok).toBe(true);
  });
  it('a dirty tree fails unless a launch record owns every dirty path', () => {
    const dirty = {
      ...ok,
      git: (args: string[]) =>
        args[0] === 'status' ? ' M topics/heat-pumps/report.json\n?? public/og/x.jpg\n' : 'main\n',
    };
    expect(preflight(a, 'r', dirty).problems).toEqual([
      expect.stringMatching(/dirty: topics\/heat-pumps\/report.json, public\/og\/x.jpg/),
    ]);
    expect(preflight(a, 'r', { ...dirty, launches: () => [{ paths: ['topics/heat-pumps', 'public'] }] }).ok).toBe(true);
    expect(preflight(a, 'r', { ...dirty, launches: () => [{ paths: ['topics/heat-pumps'] }] }).problems[0]).toMatch(
      /public\/og/,
    );
  });
  it('the branch, Claude, mail, disk and the watcher each name their problem', () => {
    expect(preflight(a, 'r', { ...ok, git: (x) => (x[0] === 'status' ? '' : 'feat/x\n') }).problems).toEqual([
      expect.stringMatching(/on feat\/x, not main/),
    ]);
    expect(preflight(a, 'r', { ...ok, claude: () => false }).problems).toEqual([
      expect.stringMatching(/claude -p did not answer/),
    ]);
    expect(preflight(a, 'r', { ...ok, env: {} }).problems).toEqual([expect.stringMatching(/mail is not configured/)]);
    expect(preflight({ ...a, enabled: { ...a.enabled, tick: false } }, 'r', { ...ok, env: {} }).ok).toBe(true);
    expect(preflight(a, 'r', { ...ok, freeGb: () => 3.2 }).problems).toEqual([
      expect.stringMatching(/3.2 GB free .* need 20/),
    ]);
    expect(
      preflight({ ...a, enabled: { ...a.enabled, discovery: true } }, 'r', { ...ok, watcherDir: () => null }).problems,
    ).toEqual([expect.stringMatching(/watcher checkout is missing/)]);
    expect(preflight(a, 'r', { ...ok, watcherDir: () => null }).ok).toBe(true);
  });
});
