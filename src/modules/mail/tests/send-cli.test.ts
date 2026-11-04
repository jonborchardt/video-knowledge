// `npm run mail -- init|send` as real processes sharing one fake mailbox (MAIL_FAKE), and the orchestration's way in.
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cliArgv, runCli } from '../../../shared/cli';
import { cliMailer } from '../../../orchestration/run/mailer';
import { envFor } from '../../../orchestration/run/steps';
import { emptyFakeState, readOutbox } from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const setup = (state = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'vk-mailcli-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  writeFileSync(
    join(root, 'automation.json'),
    JSON.stringify({
      approvals: { to: 'jon@example.test', from: 'bot@example.test' },
      notifications: { to: 'notes@example.test' },
    }),
  );
  const fake = join(root, 'fake.json');
  writeFileSync(fake, JSON.stringify({ ...emptyFakeState(), ...state }));
  const env = { ...process.env, MAIL_FAKE: fake, VK_NO_DOTENV: '1' } as NodeJS.ProcessEnv;
  const file = (name: string, v: unknown) => {
    const p = join(root, name);
    writeFileSync(p, JSON.stringify(v));
    return p;
  };
  const readFake = () => JSON.parse(readFileSync(fake, 'utf8'));
  const setFake = (s: object) => writeFileSync(fake, JSON.stringify({ ...readFake(), ...s }));
  return { root, env, dir: join(root, '.automation', 'mail'), file, fake: readFake, setFake };
};
const msg = { kind: 'halt', from: 'bot@example.test', to: 'jon@example.test', subject: 's', text: 'b' };
const asyncCli = (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((res) => {
    const [exe, argv] = cliArgv('mail', args);
    const c = spawn(exe, argv, { cwd, env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    c.stdout.on('data', (d) => (stdout += d));
    c.stderr.on('data', (d) => (stderr += d));
    c.on('close', (status) => res({ status, stdout, stderr }));
  });

describe('mail send', () => {
  it('records and sends; prints SENT with the id', () => {
    const s = setup();
    const f = s.file('m.json', { ...msg, meta: { topic: 't' } });
    const r = runCli('mail', ['send', '--file', f], { cwd: s.root, env: s.env });
    expect(r.status).toBe(0);
    const [e] = readOutbox(s.dir);
    expect(r.stdout).toContain(`SENT ${e.messageId}`);
    expect(e).toMatchObject({ kind: 'halt', meta: { topic: 't' } });
    expect(s.fake().sent[0].messageId).toBe(e.messageId);
  });
  it('refuses before any write: an outside recipient, an unknown kind, oversized attachments, malformed JSON', () => {
    const s = setup();
    const big = Buffer.alloc(6 * 1024 * 1024).toString('base64');
    for (const v of [
      { ...msg, to: 'stranger@example.test' },
      { ...msg, kind: 'made-up' },
      { ...msg, attachments: [{ name: 'a', contentType: 't', data: big }] },
    ]) {
      const r = runCli('mail', ['send', '--file', s.file('m.json', v)], { cwd: s.root, env: s.env });
      expect(r.status).toBe(2);
    }
    writeFileSync(join(s.root, 'bad.json'), '{');
    expect(runCli('mail', ['send', '--file', join(s.root, 'bad.json')], { cwd: s.root, env: s.env }).status).toBe(2);
    expect(existsSync(join(s.dir, 'outbox.json'))).toBe(false);
    expect(s.fake().sent).toHaveLength(0);
  });
  it('a transport failure exits 1 and leaves the entry unsent with its error', () => {
    const s = setup({ failSend: 'before' });
    const r = runCli('mail', ['send', '--file', s.file('m.json', msg)], { cwd: s.root, env: s.env });
    expect(r.status).toBe(1);
    expect(readOutbox(s.dir)[0]).toMatchObject({ sentAt: null, attempts: 1, lastError: expect.stringMatching(/smtp/) });
  });
  it('crash between recording and SMTP: unsent, and sendable with the same id', () => {
    const s = setup({ crashBeforeSend: true });
    const f = s.file('m.json', msg);
    expect(runCli('mail', ['send', '--file', f], { cwd: s.root, env: s.env }).status).toBe(137);
    const [e] = readOutbox(s.dir);
    expect(e).toMatchObject({ sentAt: null, attempts: 1, claim: expect.anything() });
    expect(s.fake().sent).toHaveLength(0);
    s.setFake({ crashBeforeSend: false });
    const r = runCli('mail', ['send', '--file', f, '--message-id', e.messageId], { cwd: s.root, env: s.env });
    expect(r.status).toBe(0);
    expect(s.fake().sent.map((m: { messageId: string }) => m.messageId)).toEqual([e.messageId]);
  });
  it('crash after SMTP accepted, before the record: the retry reuses the id and two copies exist (at least once)', () => {
    const s = setup({ crashAfterSend: true });
    const f = s.file('m.json', msg);
    expect(runCli('mail', ['send', '--file', f], { cwd: s.root, env: s.env }).status).toBe(137);
    const [e] = readOutbox(s.dir);
    expect(e.sentAt).toBeNull();
    expect(s.fake().sent).toHaveLength(1);
    s.setFake({ crashAfterSend: false });
    const r = runCli('mail', ['send', '--file', f, '--message-id', e.messageId], { cwd: s.root, env: s.env });
    expect(r.status).toBe(0);
    expect(s.fake().sent.map((m: { messageId: string }) => m.messageId)).toEqual([e.messageId, e.messageId]);
    expect(readOutbox(s.dir)[0]).toMatchObject({ attempts: 2, sentAt: expect.any(String) });
  });
  it('two processes sending one entry at once over a slow SMTP: one copy, one CLAIMED refusal', async () => {
    const s = setup({ failSend: 'before' });
    const f = s.file('m.json', msg);
    expect(runCli('mail', ['send', '--file', f], { cwd: s.root, env: s.env }).status).toBe(1);
    const [e] = readOutbox(s.dir);
    s.setFake({ sendDelayMs: 6000 });
    const rs = await Promise.all(
      [1, 2].map(() => asyncCli(['send', '--file', f, '--message-id', e.messageId], s.root, s.env)),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([0, 2]);
    expect(rs.find((r) => r.status === 2)!.stderr).toMatch(/CLAIMED by pid \d+/);
    expect(s.fake().sent).toHaveLength(1);
    expect(readOutbox(s.dir)[0]).toMatchObject({ attempts: 2, sentAt: expect.any(String) });
    expect(readOutbox(s.dir)[0].claim).toBeUndefined();
  });
  it('eight processes at once: eight entries, none lost', async () => {
    const s = setup();
    const f = s.file('m.json', msg);
    const rs = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(() => asyncCli(['send', '--file', f], s.root, s.env)));
    expect(rs.map((r) => r.status)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(new Set(readOutbox(s.dir).map((e) => e.messageId)).size).toBe(8);
    expect(s.fake().sent).toHaveLength(8);
  });
  it('--skip burns one attempt with nothing sent', () => {
    const s = setup({ failSend: 'before' });
    runCli('mail', ['send', '--file', s.file('m.json', msg)], { cwd: s.root, env: s.env });
    const [e] = readOutbox(s.dir);
    expect(runCli('mail', ['send', '--skip', '--message-id', e.messageId], { cwd: s.root, env: s.env }).status).toBe(0);
    expect(readOutbox(s.dir)[0].attempts).toBe(2);
    expect(s.fake().sent).toHaveLength(0);
  });
  it('mail not configured: exit 2', () => {
    const s = setup();
    writeFileSync(join(s.root, 'automation.json'), '{}');
    const env = { ...process.env, VK_NO_DOTENV: '1', MAIL_FAKE: '' } as NodeJS.ProcessEnv;
    const r = runCli('mail', ['send', '--file', s.file('m.json', msg)], { cwd: s.root, env });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not configured/);
  });
});

describe('mail init', () => {
  it('migrates and reports; a dry run writes nothing', () => {
    const s = setup();
    const legacy = join(s.root, '.automation', 'outbox.json');
    expect(runCli('mail', ['init', '--dry-run'], { cwd: s.root, env: s.env }).stdout).toContain('INIT empty');
    expect(existsSync(s.dir)).toBe(false);
    mkdirSync(join(s.root, '.automation'));
    copyFileSync(join(import.meta.dirname, 'fixtures', 'legacy-outbox.json'), legacy);
    const dry = runCli('mail', ['init', '--dry-run'], { cwd: s.root, env: s.env });
    expect(dry.stdout).toContain('INIT migrated 6 entries, 3 with a request');
    expect(existsSync(join(s.dir, 'outbox.json'))).toBe(false);
    expect(existsSync(legacy)).toBe(true);
    const real = runCli('mail', ['init'], { cwd: s.root, env: s.env });
    expect(real.stdout).toContain('INIT migrated 6 entries, 3 with a request');
    expect(readOutbox(s.dir)).toHaveLength(6);
    expect(runCli('mail', ['init'], { cwd: s.root, env: s.env }).stdout).toContain('INIT present');
  });
});

describe('the child environment', () => {
  it('the mail verb holds the mailbox credentials and no other secret', () => {
    const env = envFor('mail', [], {
      MAIL_PASSWORD: 'p',
      MAIL_FAKE: 'f',
      YOUTUBE_X: 'y',
      APPROVAL_SECRET: 'a',
      PATH: 'x',
    });
    expect(env).toMatchObject({ MAIL_PASSWORD: 'p', MAIL_FAKE: 'f', PATH: 'x', VK_NO_DOTENV: '1' });
    expect(env.YOUTUBE_X).toBeUndefined();
    expect(env.APPROVAL_SECRET).toBeUndefined();
  });
});

describe('cliMailer', () => {
  const out = { from: 'bot@example.test', to: 'jon@example.test', subject: 's', text: 'b' };
  it('hands the guide, the meta and the attachments to the child and deletes the temp file', async () => {
    const s = setup();
    const m = cliMailer(s.root, (cli, args) => runCli(cli, args, { cwd: s.root, env: s.env }));
    const { messageId } = await m.sendTracked(
      { ...out, attachments: [{ name: 'a.png', contentType: 'image/png', data: Buffer.from('hi') }] },
      'draft-request',
      { topic: 't', storyId: 'sid' },
    );
    const sent = s.fake().sent[0];
    expect(sent.messageId).toBe(messageId);
    expect(sent.text).toMatch(/^ACTION NEEDED/);
    expect(sent.attachments[0].data).toBe(Buffer.from('hi').toString('base64'));
    expect(readOutbox(s.dir)[0].meta).toEqual({ topic: 't', storyId: 'sid' });
    expect(readdirSync(join(s.dir, 'send'))).toEqual([]);
  });
  it('a failing child throws its last error line and leaves no temp file', async () => {
    const s = setup();
    const m = cliMailer(s.root, () => ({ status: 1, stdout: '', stderr: 'first\nsmtp: gone\n' }));
    await expect(m.sendTracked(out, 'halt')).rejects.toThrow('smtp: gone');
    expect(readdirSync(join(s.dir, 'send'))).toEqual([]);
  });
});
