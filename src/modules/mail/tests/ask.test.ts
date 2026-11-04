// `ask` and the question lifecycle, in process with a fake clock: a timeout stops the waiter, never the question;
// receipt (durable, at fetch) and acknowledgment (the consumer accepted it) are separate.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type InMail,
  type MailConfig,
  type Question,
  FakeMail,
  acknowledge,
  ask,
  correlate,
  fetchInto,
  filterOutbox,
  questions,
  readOutbox,
  statusOf,
} from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const T0 = Date.parse('2026-11-03T10:00:00Z');
const setup = (over: Partial<MailConfig> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'vk-ask-'));
  dirs.push(dir);
  const clock = { t: T0 };
  const cfg: MailConfig = {
    dir,
    from: 'bot@example.test',
    to: 'me@example.test',
    subjectPrefix: '[T]',
    now: () => clock.t,
    ...over,
  };
  const hooks: (() => void)[] = [];
  const sleep = async (ms: number) => {
    clock.t += ms;
    hooks.shift()?.();
  };
  return { cfg, clock, hooks, sleep, mail: new FakeMail() };
};
let uid = 0;
const reply = (inReplyTo: string | null, text: string, over: Partial<InMail> = {}): InMail => ({
  uid: ++uid,
  messageId: `<r${uid}@me>`,
  inReplyTo,
  references: inReplyTo ? [inReplyTo] : [],
  from: 'Me <me@example.test>',
  subject: 'Re: a question',
  text,
  html: null,
  date: new Date(T0).toISOString(),
  ...over,
});
const OPTS = { timeoutMs: 180_000, pollMs: 60_000 };
const Q = { subject: 'which one', text: 'A or B?' };

describe('ask', () => {
  it("returns the reply in the person's own words; the subject carries the prefix and the id", async () => {
    const s = setup();
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'Use B\n\n> A or B?')));
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    expect(r.answered).toBe(true);
    expect(r.question.answers?.[0].text).toBe('Use B');
    expect(r.question.subject).toBe(`[T] which one ${r.question.id}`);
    expect(r.question.id).toMatch(/^qn-[0-9a-f]{12}$/);
    expect(s.mail.sent[0]).toMatchObject({ to: 'me@example.test', from: 'bot@example.test', text: 'A or B?' });
  });
  it('receipt is not acknowledgment: an answer ask returned stays unseen until the consumer accepts it', async () => {
    const s = setup();
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'Use B')));
    const { question } = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    const stored = () => questions(s.cfg.dir)[0];
    expect(stored().acknowledgedAt).toBeUndefined();
    expect(statusOf(stored(), s.cfg, s.clock.t)).toMatchObject({ status: 'answered', seen: false });
    acknowledge(s.cfg, question.id!);
    expect(statusOf(stored(), s.cfg, s.clock.t)).toMatchObject({ status: 'answered', seen: true });
    const first = stored().acknowledgedAt;
    s.clock.t += 1000;
    acknowledge(s.cfg, question.id!); // idempotent
    expect(stored().acknowledgedAt).toBe(first);
    expect(() => acknowledge(s.cfg, 'qn-000000000000')).toThrow(/unknown question/);
  });
  it('a reply arriving between the send and the first fetch is found', async () => {
    const s = setup();
    const send = s.mail.send.bind(s.mail);
    s.mail.send = async (m) => {
      const r = await send(m);
      s.mail.deliver(reply(m.messageId, 'Quick'));
      return r;
    };
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    expect(r.answered).toBe(true);
    expect(s.clock.t).toBe(T0); // no poll was needed
  });
  it('a stranger with the id never answers; the wait runs out', async () => {
    const s = setup();
    s.hooks.push(() => {
      const q = questions(s.cfg.dir)[0];
      s.mail.deliver(reply(q.messageId, 'Use A', { from: 'mallory@example.test', subject: `Re: ${q.id}` }));
    });
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    expect(r.answered).toBe(false);
    expect(questions(s.cfg.dir)[0].answers).toBeUndefined();
  });
  it('an id in the subject answers when a client dropped the thread headers', async () => {
    const s = setup();
    s.hooks.push(() => s.mail.deliver(reply(null, 'Use B', { subject: `Re: ${questions(s.cfg.dir)[0].subject}` })));
    expect((await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep })).answered).toBe(true);
  });
  it('two questions in flight each get their own answer, delivered crossed', async () => {
    const s = setup();
    const a = ask(s.cfg, s.mail, { subject: 'first', text: 'one?' }, { ...OPTS, sleep: s.sleep });
    const b = ask(s.cfg, s.mail, { subject: 'second', text: 'two?' }, { ...OPTS, sleep: s.sleep });
    s.hooks.push(() => {
      const [qa, qb] = questions(s.cfg.dir);
      s.mail.deliver(reply(qb.messageId, 'answer two'));
      s.mail.deliver(reply(qa.messageId, 'answer one'));
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.question.answers?.[0].text).toBe('answer one');
    expect(rb.question.answers?.[0].text).toBe('answer two');
  });
  it('a timeout stops the waiter, not the question: the late reply is recorded by any fetch and shows as unseen', async () => {
    const s = setup({ alive: () => true });
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    expect(r.answered).toBe(false);
    const stored = () => questions(s.cfg.dir)[0];
    expect(statusOf(stored(), s.cfg, s.clock.t).status).toBe('unattended');
    s.clock.t += 3 * 3_600_000;
    s.mail.deliver(reply(stored().messageId, 'Sorry, B'));
    await fetchInto(s.cfg, s.mail); // the tick, or anyone
    expect(statusOf(stored(), s.cfg, s.clock.t)).toEqual({ status: 'answered', late: true, seen: false });
  });
  it('resume returns a recorded answer at once and keeps it late', async () => {
    const s = setup();
    await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    const q = questions(s.cfg.dir)[0];
    s.clock.t += 3_600_000;
    s.mail.deliver(reply(q.messageId, 'B'));
    await fetchInto(s.cfg, s.mail);
    const before = s.clock.t;
    const r = await ask(s.cfg, s.mail, { resume: q.id! }, { ...OPTS, sleep: s.sleep });
    expect(r.answered).toBe(true);
    expect(s.clock.t).toBe(before);
    expect(statusOf(questions(s.cfg.dir)[0], s.cfg, s.clock.t).late).toBe(true);
  });
  it('resume waits again when there is no answer yet, and refuses an unknown id', async () => {
    const s = setup();
    await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    const q = questions(s.cfg.dir)[0];
    s.hooks.push(() => s.mail.deliver(reply(q.messageId, 'now')));
    expect((await ask(s.cfg, s.mail, { resume: q.id! }, { ...OPTS, sleep: s.sleep })).answered).toBe(true);
    expect(s.mail.sent).toHaveLength(1); // never sent twice
    await expect(ask(s.cfg, s.mail, { resume: 'qn-000000000000' }, OPTS)).rejects.toThrow(/unknown question/);
  });
  it('multiple replies: the first is what the waiter sees first, all are kept in order, none goes elsewhere', async () => {
    const s = setup();
    s.hooks.push(() => {
      const id = s.mail.sent[0].messageId;
      s.mail.deliver(reply(id, 'Use B'));
      s.mail.deliver(reply(id, 'Actually, use A'));
    });
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    expect(r.question.answers?.map((x) => x.text)).toEqual(['Use B', 'Actually, use A']);
  });
  it('a later reply after the answer is appended, never overwrites', async () => {
    const s = setup();
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'Use B')));
    await ask(s.cfg, s.mail, Q, { ...OPTS, sleep: s.sleep });
    s.mail.deliver(reply(s.mail.sent[0].messageId, 'Actually, use A'));
    await fetchInto(s.cfg, s.mail);
    expect(questions(s.cfg.dir)[0].answers?.map((x) => x.text)).toEqual(['Use B', 'Actually, use A']);
  });
  it('a temporary IMAP failure is reported once per message and the wait goes on', async () => {
    const s = setup();
    const errors: string[] = [];
    s.mail.failNextFetch = true;
    s.hooks.push(() => {
      s.mail.failNextFetch = true;
    });
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'B')));
    const r = await ask(s.cfg, s.mail, Q, {
      ...OPTS,
      timeoutMs: 600_000,
      sleep: s.sleep,
      onFetchError: (m) => errors.push(m),
    });
    expect(r.answered).toBe(true);
    expect(errors).toHaveLength(1);
  });
  it('a temporary SMTP failure is retried on the next poll with the same id', async () => {
    const s = setup();
    s.mail.failNext = 'before';
    s.hooks.push(() => {});
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'B')));
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, timeoutMs: 600_000, sleep: s.sleep });
    expect(r.answered).toBe(true);
    expect(s.mail.sent).toHaveLength(1);
    expect(r.question.attempts).toBe(2);
  });
  it('three failed sends: failed at once, not waited on', async () => {
    const s = setup();
    const send = async () => {
      throw new Error('smtp: down');
    };
    s.mail.send = send;
    const r = await ask(s.cfg, s.mail, Q, { ...OPTS, timeoutMs: 3_600_000, sleep: s.sleep });
    expect(r.answered).toBe(false);
    expect(statusOf(r.question as Question, s.cfg, s.clock.t).status).toBe('failed');
    expect(r.question.attempts).toBe(3);
    expect(s.clock.t).toBe(T0 + 2 * 60_000);
  });
  it('timeout 0 sends once and returns', async () => {
    const s = setup();
    const r = await ask(s.cfg, s.mail, Q, { timeoutMs: 0, pollMs: 60_000, sleep: s.sleep });
    expect(r.answered).toBe(false);
    expect(s.mail.sent).toHaveLength(1);
    expect(s.clock.t).toBe(T0);
  });
  it('sends only to the configured person', async () => {
    const s = setup({ recipients: ['me@example.test', 'other@example.test'] });
    await ask(s.cfg, s.mail, Q, { timeoutMs: 0, pollMs: 1, sleep: s.sleep });
    expect(s.mail.sent[0].to).toBe('me@example.test');
  });
});

describe('a conversation', () => {
  it('two turns on one work item: threaded, each answered by its own reply, both recorded', async () => {
    const s = setup();
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[0].messageId, 'The opening is boring. Fix it.')));
    const first = await ask(s.cfg, s.mail, { ...Q, about: 'bnpl/story-1' }, { ...OPTS, sleep: s.sleep });
    s.hooks.push(() => s.mail.deliver(reply(s.mail.sent[1].messageId, 'Much better. Go ahead.')));
    const second = await ask(
      s.cfg,
      s.mail,
      { subject: 'ignored in a thread', text: 'Revised. Does this address it?', replyTo: first.question.id },
      { ...OPTS, sleep: s.sleep },
    );
    expect(s.mail.sent[1]).toMatchObject({
      inReplyTo: first.question.messageId,
      references: [first.question.messageId],
      subject: `Re: ${first.question.subject}`,
    });
    expect(second.question.about).toBe('bnpl/story-1'); // inherited
    const qs = questions(s.cfg.dir);
    expect(qs.map((q) => q.answers?.map((a) => a.text))).toEqual([
      ['The opening is boring. Fix it.'],
      ['Much better. Go ahead.'],
    ]);
    expect(qs.every((q) => q.about === 'bnpl/story-1')).toBe(true);
  });
  it('a third turn carries the whole chain in References', async () => {
    const s = setup();
    const a = await ask(s.cfg, s.mail, Q, { timeoutMs: 0, pollMs: 1 });
    const b = await ask(s.cfg, s.mail, { ...Q, replyTo: a.question.id }, { timeoutMs: 0, pollMs: 1 });
    await ask(s.cfg, s.mail, { ...Q, replyTo: b.question.id }, { timeoutMs: 0, pollMs: 1 });
    expect(s.mail.sent[2].references).toEqual([a.question.messageId, b.question.messageId]);
    expect(s.mail.sent[2].subject).toBe(`Re: ${a.question.subject}`);
  });
  it('a follow-up reuses the parent id in its subject, so an id-only reply is ambiguous, never the parent by default', async () => {
    const s = setup();
    const a = await ask(s.cfg, s.mail, Q, { timeoutMs: 0, pollMs: 1 });
    await ask(s.cfg, s.mail, { ...Q, replyTo: a.question.id }, { timeoutMs: 0, pollMs: 1 });
    const r = correlate(
      reply(null, 'B', { subject: `Re: ${a.question.subject}` }),
      (p) => filterOutbox(s.cfg.dir, p),
      s.cfg.to,
    );
    expect(r.thread).toBeNull();
    expect(r.why).toMatch(/^ambiguous:/);
  });
  it('a follow-up to an unknown question is refused and nothing is sent', async () => {
    const s = setup();
    await expect(ask(s.cfg, s.mail, { ...Q, replyTo: 'qn-000000000000' }, OPTS)).rejects.toThrow(/unknown question/);
    expect(s.mail.sent).toHaveLength(0);
    expect(readOutbox(s.cfg.dir)).toEqual([]);
  });
});

describe('statusOf', () => {
  const base = {
    messageId: '<q@x>',
    kind: 'question' as const,
    id: 'qn-aaaaaaaaaaaa',
    subject: 's',
    to: 't',
    from: 'f',
    createdAt: new Date(T0).toISOString(),
    sentAt: new Date(T0).toISOString(),
    attempts: 1,
  };
  const cfg = (alive: boolean): MailConfig => ({ dir: 'x', from: 'f', to: 't', alive: () => alive });
  const until = new Date(T0 + 1000).toISOString();
  it.each<[string, Partial<Question>, boolean, string]>([
    ['never attempted', { sentAt: null, attempts: 0 }, true, 'unsent'],
    ['attempts left', { sentAt: null, attempts: 2 }, true, 'unsent'],
    ['out of attempts', { sentAt: null, attempts: 3 }, true, 'failed'],
    ['a live waiter in time', { waiter: { pid: 1, until } }, true, 'awaiting'],
    ['a dead waiter', { waiter: { pid: 1, until } }, false, 'unattended'],
    ['no waiter', {}, true, 'unattended'],
  ])('%s', (_n, over, alive, status) => {
    expect(statusOf({ ...base, ...over } as Question, cfg(alive), T0).status).toBe(status);
  });
  it('a waiter past its time is unattended, a live pid notwithstanding', () => {
    const q = { ...base, waiter: { pid: 1, until } } as Question;
    expect(statusOf(q, cfg(true), T0 + 2000).status).toBe('unattended');
  });
});
