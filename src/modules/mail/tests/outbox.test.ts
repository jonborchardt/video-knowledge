// The outbox: recorded before the first attempt, a stable Message-ID, at most one live sender, at least once.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type MailConfig,
  FakeMail,
  attemptSend,
  filterOutbox,
  findOutbox,
  mutateOutbox,
  questionMail,
  readOutbox,
  recordOutgoing,
  resendDue,
  sendTracked,
  skipAttempt,
  unsentOutbox,
  validateSend,
} from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const T0 = Date.parse('2026-11-03T10:00:00Z');
const cfgOf = (over: Partial<MailConfig> = {}): MailConfig => {
  const dir = mkdtempSync(join(tmpdir(), 'vk-outbox-'));
  dirs.push(dir);
  return { dir, from: 'bot@example.test', to: 'me@example.test', now: () => T0, ...over };
};
const out = { from: 'bot@example.test', to: 'me@example.test', subject: 's', text: 'b' };

describe('sending', () => {
  it('records the entry before the first attempt; a failure before SMTP leaves it unsent with the error', async () => {
    const cfg = cfgOf();
    const mail = new FakeMail();
    mail.failNext = 'before';
    await expect(sendTracked(cfg, mail, out, 'note')).rejects.toThrow(/before the send/);
    const [e] = readOutbox(cfg.dir);
    expect(e).toMatchObject({ kind: 'note', sentAt: null, attempts: 1 });
    expect(e.lastError).toMatch(/before the send/);
    expect(e.claim).toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });
  it('at least once: delivered, then a lost record: the resend reuses the id and a duplicate copy is possible', async () => {
    const cfg = cfgOf();
    const mail = new FakeMail();
    mail.failNext = 'after';
    await expect(sendTracked(cfg, mail, out, 'note')).rejects.toThrow(/after the send/);
    const [e] = readOutbox(cfg.dir);
    expect(await attemptSend(cfg, mail, e.messageId, out)).toBe('sent');
    expect(mail.sent.map((m) => m.messageId)).toEqual([e.messageId, e.messageId]);
    expect(readOutbox(cfg.dir)[0]).toMatchObject({ attempts: 2, sentAt: expect.any(String) });
    expect(readOutbox(cfg.dir)[0].lastError).toBeUndefined();
  });
  it('keeps the caller meta opaque', async () => {
    const cfg = cfgOf();
    await sendTracked(cfg, new FakeMail(), out, 'note', { meta: { anything: 'x' } });
    expect(readOutbox(cfg.dir)[0].meta).toEqual({ anything: 'x' });
  });
  it('refuses an address outside the recipients and writes nothing', () => {
    const cfg = cfgOf();
    expect(() => recordOutgoing(cfg, { ...out, to: 'stranger@example.test' }, 'note')).toThrow(/not a recipient/);
    expect(readOutbox(cfg.dir)).toEqual([]);
  });
  it('refuses an unknown id, a sent entry and an exhausted one', async () => {
    const cfg = cfgOf();
    const mail = new FakeMail();
    await expect(attemptSend(cfg, mail, '<nope@x>', out)).rejects.toThrow(/unknown/);
    const { messageId } = await sendTracked(cfg, mail, out, 'note');
    await expect(sendTracked(cfg, mail, out, 'note', { messageId })).rejects.toThrow(/already sent/);
    const e = recordOutgoing(cfg, out, 'note');
    for (let i = 0; i < 3; i++) skipAttempt(cfg, e.messageId);
    await expect(sendTracked(cfg, mail, out, 'note', { messageId: e.messageId })).rejects.toThrow(/out of attempts/);
    expect(unsentOutbox(cfg.dir).map((x) => x.messageId)).toEqual([e.messageId]);
  });
});

describe('attemptSend under concurrency', () => {
  it('answers what another process already did instead of throwing, and sends nothing', async () => {
    const cfg = cfgOf();
    const mail = new FakeMail();
    const { messageId } = await sendTracked(cfg, mail, out, 'note');
    expect(await attemptSend(cfg, mail, messageId, out)).toBe('already-sent');
    const e = recordOutgoing(cfg, out, 'note');
    for (let i = 0; i < 3; i++) skipAttempt(cfg, e.messageId);
    expect(await attemptSend(cfg, mail, e.messageId, out)).toBe('exhausted');
    expect(mail.sent).toHaveLength(1);
  });
  it('a live sender on the last attempt is claimed, not exhausted', async () => {
    const cfg = cfgOf({ alive: () => true });
    const mail = new FakeMail();
    const e = recordOutgoing(cfg, out, 'note');
    mutateOutbox(cfg, (es) => es.map((x) => ({ ...x, attempts: 3, claim: { pid: 424242, token: 't', at: 'c' } })));
    expect(await attemptSend(cfg, mail, e.messageId, out)).toBe('claimed');
    expect(mail.sent).toHaveLength(0);
  });
  it('an answered question is not resent: the reply proves it arrived', () => {
    const cfg = cfgOf();
    const e = recordOutgoing(cfg, out, 'question', { id: 'qn-aaaaaaaaaaaa', text: 'q' });
    mutateOutbox(cfg, (es) =>
      es.map((x) => ({ ...x, answers: [{ messageId: '<r@x>', from: 'f', at: 'a', recordedAt: 'a', text: 'B' }] })),
    );
    expect(e.sentAt).toBeNull();
    expect(resendDue(cfg.dir, T0 + 3_600_000, cfg)).toEqual([]);
  });
});

describe('the per-message claim', () => {
  const claimed = (cfg: MailConfig) => {
    const e = recordOutgoing(cfg, out, 'note');
    mutateOutbox(cfg, (es) =>
      es.map((x) =>
        x.messageId === e.messageId ? { ...x, claim: { pid: 424242, token: 't', at: new Date(T0).toISOString() } } : x,
      ),
    );
    return e;
  };
  it('a live claimant blocks a second sender: no copy, attempts unchanged', async () => {
    const cfg = cfgOf({ alive: () => true });
    const mail = new FakeMail();
    const e = claimed(cfg);
    expect(await attemptSend(cfg, mail, e.messageId, out)).toBe('claimed');
    expect(mail.sent).toHaveLength(0);
    expect(readOutbox(cfg.dir)[0].attempts).toBe(0);
    expect(resendDue(cfg.dir, T0 + 3_600_000, cfg)).toEqual([]);
  });
  it('a dead claimant is void: the entry is sent with the same Message-ID and the claim cleared', async () => {
    const cfg = cfgOf({ alive: () => false });
    const mail = new FakeMail();
    const e = claimed(cfg);
    expect(await attemptSend(cfg, mail, e.messageId, out)).toBe('sent');
    expect(mail.sent[0].messageId).toBe(e.messageId);
    expect(readOutbox(cfg.dir)[0].claim).toBeUndefined();
    expect(readOutbox(cfg.dir)[0].sentAt).not.toBeNull();
  });
  it('holds no lock during the network call: the outbox can change while a send is in flight', async () => {
    const cfg = cfgOf();
    const mail = new FakeMail();
    const send = mail.send.bind(mail);
    mail.send = async (m) => {
      recordOutgoing(cfg, { ...out, subject: 'other' }, 'note'); // would time out if the send held the mutex
      expect(readOutbox(cfg.dir)[0].claim?.pid).toBe(process.pid);
      return send(m);
    };
    await sendTracked(cfg, mail, out, 'note');
    expect(readOutbox(cfg.dir)).toHaveLength(2);
    expect(readOutbox(cfg.dir)[0].claim).toBeUndefined();
  });
});

describe('due and lookup', () => {
  it('resendDue goes by the last attempt, not by creation', async () => {
    let t = T0;
    const cfg = cfgOf({ now: () => t });
    const mail = new FakeMail();
    mail.failNext = 'before';
    await sendTracked(cfg, mail, out, 'note').catch(() => {});
    expect(resendDue(cfg.dir, t + 5 * 60_000, cfg)).toEqual([]);
    t += 11 * 60_000;
    skipAttempt(cfg, readOutbox(cfg.dir)[0].messageId);
    expect(resendDue(cfg.dir, t + 5 * 60_000, cfg)).toEqual([]);
    expect(resendDue(cfg.dir, t + 11 * 60_000, cfg)).toHaveLength(1);
  });
  it('findOutbox and filterOutbox read the archive too', async () => {
    const cfg = cfgOf();
    await sendTracked(cfg, new FakeMail(), out, 'note');
    mkdirSync(join(cfg.dir, 'archive'));
    writeFileSync(
      join(cfg.dir, 'archive', '2026-01.json'),
      JSON.stringify({
        outbox: [{ ...out, messageId: '<old@x>', kind: 'note', createdAt: 'c', sentAt: 'c', attempts: 1 }],
        received: [],
      }),
    );
    expect(findOutbox(cfg.dir, (e) => e.messageId === '<old@x>')?.messageId).toBe('<old@x>');
    expect(filterOutbox(cfg.dir, (e) => e.kind === 'note')).toHaveLength(2);
    expect(readOutbox(cfg.dir)).toHaveLength(1);
  });
  it('questionMail resends a question from its own fields', () => {
    const e = recordOutgoing(cfgOf(), out, 'question', { text: 'A or B?', references: ['<r@x>'], inReplyTo: '<r@x>' });
    expect(questionMail(e)).toEqual({
      from: out.from,
      to: out.to,
      subject: out.subject,
      text: 'A or B?',
      inReplyTo: '<r@x>',
      references: ['<r@x>'],
    });
  });
});

describe('validateSend', () => {
  const ok = { kind: 'note', ...out };
  it('accepts a valid message and decodes attachments', () => {
    const v = validateSend(
      { ...ok, attachments: [{ name: 'a.png', contentType: 'image/png', data: 'aGk=' }], meta: { k: 'v' } },
      cfgOf(),
    );
    expect(v.attachments?.[0].data.toString()).toBe('hi');
    expect(v.meta).toEqual({ k: 'v' });
  });
  it.each([
    ['a non-object', 'x', /an object/],
    ['no kind', { ...out }, /kind/],
    ['an outside recipient', { ...ok, to: 'stranger@example.test' }, /not a recipient/],
    ['an empty subject', { ...ok, subject: '' }, /subject/],
    ['no text', { ...ok, text: '' }, /text/],
    ['references not strings', { ...ok, references: [1] }, /references/],
    ['meta not strings', { ...ok, meta: { a: 1 } }, /meta/],
    ['a bad attachment', { ...ok, attachments: [{ name: 'a' }] }, /attachment/],
    ['oversized attachments', { ...ok, attachments: [{ name: 'a', contentType: 't', data: 'aGVsbG8=' }] }, /limit/],
  ])('refuses %s', (_n, v, re) => {
    expect(() => validateSend(v, cfgOf({ attachmentLimit: 3 }))).toThrow(re);
  });
});
