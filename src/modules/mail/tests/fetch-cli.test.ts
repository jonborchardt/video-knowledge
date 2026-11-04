// `npm run mail -- fetch` as real processes over one fake mailbox.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cliArgv, runCli } from '../../../shared/cli';
import { emptyFakeState, readReceived } from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const setup = (state = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'vk-fetchcli-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  writeFileSync(
    join(root, 'automation.json'),
    JSON.stringify({
      approvals: { to: 'jon@example.test', from: 'bot@example.test' },
      notifications: { to: 'jon@example.test' },
    }),
  );
  const fake = join(root, 'fake.json');
  writeFileSync(fake, JSON.stringify({ ...emptyFakeState(), ...state }));
  return {
    root,
    env: { ...process.env, MAIL_FAKE: fake, VK_NO_DOTENV: '1' } as NodeJS.ProcessEnv,
    dir: join(root, '.automation', 'mail'),
    fake: () => JSON.parse(readFileSync(fake, 'utf8')),
  };
};
const inbox = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    uid: i + 1,
    messageId: `<m${i + 1}@jon>`,
    inReplyTo: null,
    references: [],
    from: 'jon@example.test',
    subject: 's',
    text: 't',
    html: null,
    date: '2026-11-03T11:00:00.000Z',
  }));
const asyncCli = (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
  new Promise<number | null>((res) => {
    const [exe, argv] = cliArgv('mail', args);
    spawn(exe, argv, { cwd, env, windowsHide: true, stdio: 'ignore' }).on('close', res);
  });

describe('mail fetch', () => {
  it('prints FETCHED with the count', () => {
    const s = setup({ inbox: inbox(3) });
    const r = runCli('mail', ['fetch'], { cwd: s.root, env: s.env });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('FETCHED 3');
    expect(runCli('mail', ['fetch'], { cwd: s.root, env: s.env }).stdout).toContain('FETCHED 0');
  });
  it('concurrent fetchers (a tick and a waiting ask): each message recorded once', async () => {
    const s = setup({ inbox: inbox(20) });
    const codes = await Promise.all([1, 2, 3, 4].map(() => asyncCli(['fetch'], s.root, s.env)));
    expect(codes).toEqual([0, 0, 0, 0]);
    const keys = readReceived(s.dir).map((r) => r.key);
    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(20);
  });
  it('an unreachable mailbox exits 1 and writes nothing', () => {
    const s = setup({ failFetch: true, inbox: inbox(1) });
    const r = runCli('mail', ['fetch'], { cwd: s.root, env: s.env });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/imap/);
    expect(readReceived(s.dir)).toEqual([]);
  });
});
