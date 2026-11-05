// The mail transport (core/transport.ts) with injected clients: nothing reaches the network.
// The corpus under tests/fixtures/mail/ is pending (phase 1 Task 1 Step 5: the person's real replies from each client
// they use); until then two synthesised messages stand in, covering multipart/alternative with quoted-printable and an
// HTML-only base64 reply.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';
import { redact } from '../../../shared/redact';
import { type MailServer, FakeMail, htmlToText, libraryTransport, messageIdOf } from '../core';
import { mailConfigFromEnv } from '../cor';

const CORPUS = join(ROOT, 'tests', 'fixtures', 'mail');
const config: MailServer = {
  smtpHost: 'smtp.example.test',
  smtpPort: 465,
  imapHost: 'imap.example.test',
  imapPort: 993,
  user: 'automation@example.test',
  password: 'hunter2hunter2',
};

const fakeSmtp = () => {
  const calls: Record<string, unknown>[] = [];
  const createTransport = ((opts: unknown) => {
    calls.push({ transport: opts });
    return { sendMail: async (m: Record<string, unknown>) => (calls.push(m), { messageId: m.messageId }) };
  }) as never;
  return { calls, createTransport };
};

const fakeImap = (files: string[]) => {
  const log: string[] = [];
  class ImapFlow {
    constructor(opts: { host: string }) {
      log.push(`new ${opts.host}`);
    }
    async connect() {
      log.push('connect');
    }
    async getMailboxLock(name: string) {
      log.push(`lock ${name}`);
      return { release: () => log.push('release') };
    }
    async *fetch(range: { uid: string }) {
      log.push(`fetch ${range.uid}`);
      const first = Number(range.uid.split(':')[0]);
      // the server yields the last message even when the range starts past it, as IMAP's `n:*` does
      const uids = files.map((_, i) => i + 11);
      for (const [i, f] of files.entries())
        if (uids[i] >= first || i === files.length - 1) yield { uid: uids[i], source: readFileSync(join(CORPUS, f)) };
    }
    async logout() {
      log.push('logout');
    }
  }
  return { log, ImapFlow: ImapFlow as never };
};

describe('config and helpers', () => {
  it('reads the mailbox from .env with the TLS defaults, null when anything is missing', () => {
    expect(mailConfigFromEnv({})).toBeNull();
    expect(mailConfigFromEnv({ MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u' })).toBeNull();
    expect(mailConfigFromEnv({ MAIL_SMTP_HOST: 'a', MAIL_IMAP_HOST: 'b', MAIL_USER: 'u', MAIL_PASSWORD: 'p' })).toEqual(
      { smtpHost: 'a', smtpPort: 465, imapHost: 'b', imapPort: 993, user: 'u', password: 'p' },
    );
    expect(
      mailConfigFromEnv({
        MAIL_SMTP_HOST: 'a',
        MAIL_SMTP_PORT: '587',
        MAIL_IMAP_HOST: 'b',
        MAIL_USER: 'u',
        MAIL_PASSWORD: 'p',
      })?.smtpPort,
    ).toBe(587);
  });
  it("generates a message id in the caller's domain and redacts secrets", () => {
    expect(messageIdOf('example.test')).toMatch(/^<[0-9a-f-]{36}@example\.test>$/);
    expect(messageIdOf('x')).not.toBe(messageIdOf('x'));
    expect(redact('key=abc1 and abc1 again', ['abc1', undefined, 'no'])).toBe('key=[redacted] and [redacted] again');
    expect(redact('short=abc', ['abc'])).toBe('short=abc'); // a three-character secret would redact too much
  });
  it('strips an html reply to its visible text', () => {
    expect(htmlToText('<div>OK at <b>Thursday</b> 15:00</div><div><br></div><blockquote>old</blockquote>')).toBe(
      'OK at Thursday 15:00\n\nold',
    );
  });
});

describe('libraryTransport', () => {
  it('passes the id, the thread headers and an attachment through to nodemailer unchanged', async () => {
    const smtp = fakeSmtp();
    const t = libraryTransport(config, { createTransport: smtp.createTransport });
    const r = await t.send({
      from: 'a@example.test',
      to: 'b@example.test',
      subject: 's',
      text: 'body',
      html: '<p>body</p>',
      messageId: '<id1@example.test>',
      inReplyTo: '<id0@example.test>',
      references: ['<id0@example.test>', '<idx@example.test>'],
      attachments: [{ name: 'a.png', contentType: 'image/png', data: Buffer.from('png') }],
    });
    expect(r.messageId).toBe('<id1@example.test>');
    const sent = smtp.calls[1];
    expect(sent.messageId).toBe('<id1@example.test>');
    expect(sent.inReplyTo).toBe('<id0@example.test>');
    expect(sent.references).toBe('<id0@example.test> <idx@example.test>');
    expect(sent.attachments).toEqual([{ filename: 'a.png', contentType: 'image/png', content: Buffer.from('png') }]);
    expect((smtp.calls[0].transport as { secure: boolean; port: number }).secure).toBe(true);
  });
  it('fetches every message above the uid, parses each into InMail, and logs out', async () => {
    const files = readdirSync(CORPUS)
      .filter((f) => f.endsWith('.eml'))
      .sort();
    expect(files.length).toBeGreaterThanOrEqual(2);
    const imap = fakeImap(files);
    const t = libraryTransport(config, { ImapFlow: imap.ImapFlow });
    const { uidValidity, mails: all } = await t.fetchSince(10);
    expect(typeof uidValidity).toBe('string');
    expect(all.map((m) => m.uid)).toEqual(files.map((_, i) => i + 11));
    expect(imap.log).toEqual(['new imap.example.test', 'connect', 'lock INBOX', 'fetch 11:*', 'release', 'logout']);
    const qp = all.find((m) => m.subject.includes('multipart'))!;
    expect(qp.text).toContain('OK, looks good');
    expect(qp.text).toContain('café'); // quoted-printable decoded
    expect(qp.inReplyTo).toBe('<req-1@commonwealthofreason.com>');
    expect(qp.references).toEqual(['<req-1@commonwealthofreason.com>']);
    expect(qp.from).toBe('jon@example.test');
    const html = all.find((m) => m.subject.includes('html-only'))!;
    expect(html.html).toContain('<div');
    expect(html.text).toContain('OK at Thursday 15:00'); // base64 html stripped to text
    expect(html.date).toMatch(/^2026-/);
    // the last message is yielded even when the range starts past it: it is not returned twice or below the uid
    expect((await t.fetchSince(100)).mails).toEqual([]);
  });
});

describe('FakeMail', () => {
  it('records sends, delivers by uid, and can fail before or after a copy went out', async () => {
    const f = new FakeMail();
    await f.send({ from: 'a', to: 'b', subject: 's', text: 't', messageId: '<1@x>' });
    expect(f.sent.map((m) => m.messageId)).toEqual(['<1@x>']);
    f.failNext = 'before';
    await expect(f.send({ from: 'a', to: 'b', subject: 's', text: 't', messageId: '<2@x>' })).rejects.toThrow(/before/);
    expect(f.sent).toHaveLength(1);
    f.failNext = 'after';
    await expect(f.send({ from: 'a', to: 'b', subject: 's', text: 't', messageId: '<3@x>' })).rejects.toThrow(/after/);
    expect(f.sent.map((m) => m.messageId)).toEqual(['<1@x>', '<3@x>']);
    f.deliver({
      uid: 5,
      messageId: '<r@x>',
      inReplyTo: '<1@x>',
      references: [],
      from: 'b',
      subject: 'Re',
      text: 'OK',
      html: null,
      date: '',
    });
    expect((await f.fetchSince(4)).mails.map((m) => m.uid)).toEqual([5]);
    expect((await f.fetchSince(5)).mails).toEqual([]);
  });
});

describe('the server verdict', () => {
  it('send returns what nodemailer reported: accepted, rejected and the response line', async () => {
    const createTransport = (() => ({
      sendMail: async (m: { messageId: string }) => ({
        messageId: m.messageId,
        accepted: ['jon@example.test'],
        rejected: [],
        response: '250 2.0.0 OK 1762300000 abc.123 - gsmtp',
      }),
    })) as never;
    const r = await libraryTransport(config, { createTransport }).send({
      from: 'automation@example.test',
      to: 'jon@example.test',
      subject: 's',
      text: 't',
      messageId: '<m@x>',
    });
    expect(r).toEqual({
      messageId: '<m@x>',
      accepted: ['jon@example.test'],
      rejected: [],
      response: '250 2.0.0 OK 1762300000 abc.123 - gsmtp',
    });
  });
});
