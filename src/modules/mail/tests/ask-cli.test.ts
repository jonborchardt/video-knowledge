// `npm run mail -- ask|questions|test` as real processes over one fake mailbox: killed waiters, crashes, concurrency,
// and a two-turn conversation across processes.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { killTree } from '../../../orchestration/run/proc';
import { cliArgv, runCli } from '../../../shared/cli';
import { type FakeFileState, emptyFakeState, fileFakeMail, questions } from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const setup = (state: Partial<FakeFileState> = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'vk-askcli-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  writeFileSync(
    join(root, 'automation.json'),
    JSON.stringify({
      approvals: { to: 'jon@example.test', from: 'bot@example.test' },
      notifications: { to: 'jon@example.test' },
    }),
  );
  const fakePath = join(root, 'fake.json');
  writeFileSync(fakePath, JSON.stringify({ ...emptyFakeState(), ...state }));
  const fake = fileFakeMail(fakePath, `${fakePath}.lock`);
  const env = { ...process.env, MAIL_FAKE: fakePath, VK_NO_DOTENV: '1' } as NodeJS.ProcessEnv;
  const dir = join(root, '.automation', 'mail');
  let uid = 0;
  const answer = (inReplyTo: string, text: string) =>
    fake.deliver({
      uid: ++uid,
      messageId: `<r${uid}@jon>`,
      inReplyTo,
      references: [inReplyTo],
      from: 'Jon <jon@example.test>',
      subject: 'Re: q',
      text,
      html: null,
      date: '2026-11-03T12:00:00.000Z',
      raw: `From: jon@example.test\r\nTo: bot@example.test\r\n\r\n${text}`,
    });
  const cli = (...args: string[]) => runCli('mail', args, { cwd: root, env });
  const start = (...args: string[]) => {
    const [exe, argv] = cliArgv('mail', args);
    const c = spawn(exe, argv, { cwd: root, env, windowsHide: true });
    let stdout = '';
    c.stdout.on('data', (d) => (stdout += d));
    c.stderr.on('data', (d) => (stdout += d));
    const done = new Promise<number | null>((res) => c.on('close', res));
    return { pid: c.pid!, done, out: () => stdout };
  };
  return { root, env, dir, fake, answer, cli, start };
};
const until = async (cond: () => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
};
const sentOf = (s: ReturnType<typeof setup>) => s.fake.state().sent;
const FAST = ['--poll', '1', '--timeout', '1'];

describe('mail ask', () => {
  it('blocks until the reply, prints it and how to accept it; the answer stays unseen until --ack', async () => {
    const s = setup();
    const a = s.start('ask', 'which one', '--text', 'A or B?', '--about', 'bnpl/1', ...FAST);
    await until(() => sentOf(s).length === 1);
    s.answer(sentOf(s)[0].messageId, 'Use B\n\n> A or B?');
    expect(await a.done).toBe(0);
    const [q] = questions(s.dir);
    expect(a.out()).toContain(`ASKED ${q.id} ${q.messageId} jon@example.test`);
    expect(a.out()).toMatch(new RegExp(`ANSWER ${q.id} 1 2026-11-03`));
    expect(a.out()).toContain('Use B');
    expect(a.out()).toContain(`npm run mail -- questions --ack ${q.id}`);
    const unseen = JSON.parse(s.cli('questions', '--unseen', '--json').stdout);
    expect(unseen.questions.map((x: { id: string }) => x.id)).toEqual([q.id]);
    expect(s.cli('questions', '--ack', q.id!).status).toBe(0);
    expect(JSON.parse(s.cli('questions', '--unseen', '--json').stdout).questions).toEqual([]);
    expect(JSON.parse(s.cli('questions', '--about', 'bnpl/1', '--json').stdout).questions[0]).toMatchObject({
      id: q.id,
      status: 'answered',
      seen: true,
    });
  });
  it('the session dies while waiting: the question and the later reply survive; a new process recovers them', async () => {
    const s = setup();
    const a = s.start('ask', 'which one', '--text', 'A or B?', '--poll', '1', '--timeout', '10');
    await until(() => sentOf(s).length === 1);
    await until(() => a.out().includes('ASKED'));
    killTree(a.pid);
    await a.done;
    const [q] = questions(s.dir);
    expect(JSON.parse(s.cli('questions', '--json').stdout).questions[0].status).toBe('unattended');
    s.answer(q.messageId, 'Use B');
    expect(s.cli('questions', '--fetch', '--unseen').stdout).toContain(q.id);
    const r = s.cli('ask', '--resume', q.id!, '--timeout', '1');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Use B');
    expect(sentOf(s)).toHaveLength(1);
  });
  it('a crash between recording and SMTP: listed unsent, and resume sends it with the same id', async () => {
    const s = setup({ crashBeforeSend: true });
    expect(s.cli('ask', 'q', '--text', 't', ...FAST).status).toBe(137);
    const [q] = questions(s.dir);
    expect(q.sentAt).toBeNull();
    s.fake.update((st) => {
      st.crashBeforeSend = false;
    });
    expect(JSON.parse(s.cli('questions', '--status', 'unsent', '--json').stdout).questions).toHaveLength(1);
    const a = s.start('ask', '--resume', q.id!, ...FAST);
    await until(() => sentOf(s).length === 1);
    expect(sentOf(s)[0].messageId).toBe(q.messageId);
    s.answer(q.messageId, 'B');
    expect(await a.done).toBe(0);
  });
  it('no reply in time: NO ANSWER, exit 1, the question still open; a late reply is picked up later', async () => {
    const s = setup();
    const r = s.cli('ask', 'q', '--text', 't', '--timeout', '0.02', '--poll', '1');
    expect(r.status).toBe(1);
    const [q] = questions(s.dir);
    expect(r.stdout).toContain(`NO ANSWER ${q.id}`);
    s.answer(q.messageId, 'late');
    expect(s.cli('fetch').status).toBe(0);
    expect(JSON.parse(s.cli('questions', '--json').stdout).questions[0]).toMatchObject({
      status: 'answered',
      late: true,
      seen: false,
    });
  });
  it('two processes asking at once: both recorded, each with its own answer', async () => {
    const s = setup();
    const a = s.start('ask', 'first', '--text', 'one?', ...FAST);
    const b = s.start('ask', 'second', '--text', 'two?', ...FAST);
    await until(() => sentOf(s).length === 2);
    const byText = (t: string) => sentOf(s).find((m) => m.text === t)!.messageId;
    s.answer(byText('two?'), 'answer two');
    s.answer(byText('one?'), 'answer one');
    expect(await Promise.all([a.done, b.done])).toEqual([0, 0]);
    expect(a.out()).toContain('answer one');
    expect(a.out()).not.toContain('answer two');
    expect(b.out()).toContain('answer two');
    expect(b.out()).not.toContain('answer one');
    expect(questions(s.dir)).toHaveLength(2);
  });
  it('a waiting ask and a separate fetcher share the store: no reply is lost to whichever fetched first', async () => {
    const s = setup();
    const a = s.start('ask', 'q', '--text', 't', '--poll', '2', '--timeout', '1');
    await until(() => sentOf(s).length === 1);
    s.answer(sentOf(s)[0].messageId, 'seen by the tick first');
    expect(s.cli('fetch').stdout).toMatch(/FETCHED [01]/); // whichever fetched first
    expect(await a.done).toBe(0);
    expect(a.out()).toContain('seen by the tick first');
  });
  it('the two-turn conversation across processes', async () => {
    const s = setup();
    const a = s.start('ask', 'the video', '--text', 'What do you think?', '--about', 'bnpl/1', ...FAST);
    await until(() => sentOf(s).length === 1);
    s.answer(sentOf(s)[0].messageId, 'The opening is boring.');
    expect(await a.done).toBe(0);
    const [first] = questions(s.dir);
    const b = s.start('ask', 'the video', '--text', 'Revised. Better?', '--reply-to', first.id!, ...FAST);
    await until(() => sentOf(s).length === 2);
    expect(sentOf(s)[1].inReplyTo).toBe(first.messageId);
    s.answer(sentOf(s)[1].messageId, 'Much better.');
    expect(await b.done).toBe(0);
    const listed = JSON.parse(s.cli('questions', '--about', 'bnpl/1', '--json').stdout).questions;
    expect(listed.map((q: { answers: { text: string }[] }) => q.answers[0].text)).toEqual([
      'The opening is boring.',
      'Much better.',
    ]);
  });
  it('refuses without a question and without configuration, writing nothing', () => {
    const s = setup();
    expect(s.cli('ask', 'q').status).toBe(2);
    expect(s.cli('ask').status).toBe(2);
    expect(s.cli('ask', '--resume', 'qn-000000000000').status).toBe(2);
    expect(s.cli('questions', '--ack', 'qn-000000000000').status).toBe(2);
    writeFileSync(join(s.root, 'automation.json'), '{}');
    expect(s.cli('ask', 'q', '--text', 't').status).toBe(2);
    expect(existsSync(join(s.dir, 'outbox.json'))).toBe(false);
  });
  it.each([
    ['--poll', '0'],
    ['--poll', 'abc'],
    ['--timeout', 'abc'],
    ['--timeout', '-5'],
    ['--timeout', 'Infinity'],
  ])('refuses %s %s before anything is sent: a bad poll would hammer the mailbox', (name, value) => {
    const s = setup();
    const r = s.cli('ask', 'q', '--text', 't', name, value);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(name);
    expect(sentOf(s)).toHaveLength(0);
    expect(existsSync(join(s.dir, 'outbox.json'))).toBe(false);
  });
  it('has no way to name a recipient', () => {
    const s = setup();
    expect(s.cli('ask', 'q', '--text', 't', '--to', 'stranger@example.test', '--timeout', '0').status).toBe(2);
    expect(sentOf(s)).toHaveLength(0);
  });
  it('reads the question from a file', () => {
    const s = setup();
    const f = join(s.root, 'q.txt');
    writeFileSync(f, 'A long question from a file?');
    expect(s.cli('ask', 'q', '--text-file', f, '--timeout', '0').status).toBe(0);
    expect(sentOf(s)[0].text).toBe('A long question from a file?');
  });
});

describe('mail questions', () => {
  it('lists statuses in text and shows unmatched replies', () => {
    const s = setup();
    s.cli('ask', 'first', '--text', 't', '--timeout', '0');
    s.fake.deliver({
      uid: 90,
      messageId: '<stray@jon>',
      inReplyTo: null,
      references: [],
      from: 'jon@example.test',
      subject: 'nothing',
      text: 'hello',
      html: null,
      date: '2026-11-03T12:00:00.000Z',
    });
    const r = s.cli('questions', '--fetch');
    expect(r.stdout).toMatch(/qn-[0-9a-f]{12} unattended/);
    expect(r.stdout).toContain('1 replies from the person matched no question');
    expect(JSON.parse(s.cli('questions', '--json').stdout).unmatched[0].messageId).toBe('<stray@jon>');
    expect(JSON.parse(s.cli('questions', '--status', 'answered', '--json').stdout).questions).toEqual([]);
  });
  it('--fetch still lists when the mailbox is down', () => {
    const s = setup({ failFetch: true });
    const r = s.cli('questions', '--fetch');
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/imap/);
  });
});

describe('mail test', () => {
  it('sends one question through the outbox', () => {
    const s = setup();
    const r = s.cli('test');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('ASKED');
    expect(sentOf(s)[0].subject).toContain('video-knowledge mail test');
  });
  it('--await-reply saves the reply source with the addresses replaced', async () => {
    const s = setup();
    const a = s.start('test', '--await-reply', '--poll', '1');
    await until(() => sentOf(s).length === 1);
    s.answer(sentOf(s)[0].messageId, 'any words');
    expect(await a.done).toBe(0);
    const saved = /saved (.+\.eml)/.exec(a.out())![1].trim();
    const body = readFileSync(saved, 'utf8');
    expect(body).toContain('any words');
    expect(body).not.toContain('jon@example.test');
    expect(body).toContain('person@example.test');
  });
});
