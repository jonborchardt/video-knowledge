// The transports the core ships with: the real one over nodemailer (SMTP), imapflow (IMAP) and mailparser (MIME), the
// in-memory FakeMail, and the file-backed fake that lets real processes share one mailbox in tests. Infrastructure
// only: no retries, no policy. The caller generates every Message-ID (the outbox needs a stable id before the first
// attempt); quoting and any reply grammar are not this file's.
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { type ParsedMail, simpleParser } from 'mailparser';
import { readJson, sleepSync, writeJsonAtomic } from './io';
import { withMutex } from './mutex';
import type { InMail, MailTransport, OutMail } from './types';

export const messageIdOf = (domain: string): string => `<${randomUUID()}@${domain}>`;

/** The mail server's connection details. */
export interface MailServer {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  user: string;
  password: string;
}
export interface MailDeps {
  createTransport?: typeof nodemailer.createTransport;
  ImapFlow?: typeof ImapFlow;
  simpleParser?: typeof simpleParser;
}

export function libraryTransport(c: MailServer, deps: MailDeps = {}): MailTransport {
  const create = deps.createTransport ?? nodemailer.createTransport;
  const Imap = deps.ImapFlow ?? ImapFlow;
  const parse = deps.simpleParser ?? simpleParser;
  return {
    async send(m) {
      const t = create({ host: c.smtpHost, port: c.smtpPort, secure: true, auth: { user: c.user, pass: c.password } });
      const r = await t.sendMail({
        from: m.from,
        to: m.to,
        subject: m.subject,
        text: m.text,
        ...(m.html !== undefined && { html: m.html }),
        messageId: m.messageId,
        ...(m.inReplyTo && { inReplyTo: m.inReplyTo }),
        ...(m.references?.length && { references: m.references.join(' ') }),
        ...(m.attachments?.length && {
          attachments: m.attachments.map((a) => ({ filename: a.name, contentType: a.contentType, content: a.data })),
        }),
      });
      return { messageId: r.messageId || m.messageId };
    },
    async fetchSince(sinceUid) {
      const client = new Imap({
        host: c.imapHost,
        port: c.imapPort,
        secure: true,
        auth: { user: c.user, pass: c.password },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const out: InMail[] = [];
      const mb = client.mailbox;
      const uidValidity = mb && typeof mb === 'object' && 'uidValidity' in mb ? String(mb.uidValidity) : '0';
      try {
        for await (const msg of client.fetch({ uid: `${sinceUid + 1}:*` }, { uid: true, source: true })) {
          if (msg.uid <= sinceUid || !msg.source) continue; // `n:*` yields the last message even below n
          out.push({ ...toInMail(msg.uid, await parse(msg.source)), raw: msg.source.toString('utf8') });
        }
      } finally {
        lock.release();
        await client.logout();
      }
      return { uidValidity, mails: out.sort((a, b) => a.uid - b.uid) };
    },
  };
}

export function toInMail(uid: number, p: ParsedMail): InMail {
  const refs = p.references === undefined ? [] : Array.isArray(p.references) ? p.references : [p.references];
  const html = typeof p.html === 'string' ? p.html : null;
  const text = (p.text ?? '').trim();
  return {
    uid,
    messageId: p.messageId ?? '',
    inReplyTo: p.inReplyTo ?? null,
    references: refs,
    from: p.from?.value[0]?.address ?? p.from?.text ?? '',
    subject: p.subject ?? '',
    text: text || (html ? htmlToText(html) : ''),
    html,
    date: p.date?.toISOString() ?? '',
  };
}

/** The visible text of an HTML-only reply: block ends become line breaks, tags go, common entities decode. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** An in-memory transport for tests: what was sent, what the inbox holds, delivered by uid. `failNext` makes the next
 *  send throw before the copy is recorded ('before') or after it was (the crash after delivery, 'after'). */
export class FakeMail implements MailTransport {
  sent: OutMail[] = [];
  inbox: InMail[] = [];
  failNext: 'before' | 'after' | null = null;
  uidValidity = '1';
  failNextFetch = false;
  async send(m: OutMail): Promise<{ messageId: string }> {
    const fail = this.failNext;
    this.failNext = null;
    if (fail === 'before') throw new Error('smtp: connection lost before the send');
    this.sent.push({ ...m });
    if (fail === 'after') throw new Error('smtp: connection lost after the send');
    return { messageId: m.messageId };
  }
  async fetchSince(sinceUid: number): Promise<{ uidValidity: string; mails: InMail[] }> {
    if (this.failNextFetch) {
      this.failNextFetch = false;
      throw new Error('imap: connection refused');
    }
    return {
      uidValidity: this.uidValidity,
      mails: this.inbox.filter((m) => m.uid > sinceUid).sort((a, b) => a.uid - b.uid),
    };
  }
  deliver(m: InMail): void {
    this.inbox.push(m);
  }
}

/** A sent copy as the state file keeps it: attachments as base64. */
export type FakeSent = Omit<OutMail, 'attachments'> & {
  attachments?: { name: string; contentType: string; data: string }[];
};
export interface FakeFileState {
  uidValidity: string;
  sent: FakeSent[];
  inbox: InMail[];
  failSend: 'before' | 'after' | null;
  failFetch: boolean;
  /** process.exit(137) after the copy is recorded: the sender crashed between SMTP and its own record. */
  crashAfterSend: boolean;
  /** process.exit(137) before any copy: the caller crashed between recording and sending. */
  crashBeforeSend: boolean;
  /** A slow SMTP: the send sleeps this long before recording the copy (outside any lock). */
  sendDelayMs: number;
}
export const emptyFakeState = (): FakeFileState => ({
  uidValidity: '1',
  sent: [],
  inbox: [],
  failSend: null,
  failFetch: false,
  crashAfterSend: false,
  crashBeforeSend: false,
  sendDelayMs: 0,
});

/** The fake mailbox over a JSON file, every change under `lockDir`'s mutex, so several processes share it. */
export function fileFakeMail(
  statePath: string,
  lockDir: string,
): MailTransport & { deliver(m: InMail): void; state(): FakeFileState; update(fn: (s: FakeFileState) => void): void } {
  const read = (): FakeFileState => readJson<FakeFileState>(statePath) ?? emptyFakeState();
  const update = (fn: (s: FakeFileState) => void) =>
    withMutex(lockDir, () => {
      const s = read();
      fn(s);
      writeJsonAtomic(statePath, s);
    });
  return {
    async send(m) {
      const before = read();
      if (before.crashBeforeSend) process.exit(137);
      if (before.failSend === 'before') {
        update((s) => {
          s.failSend = null;
        });
        throw new Error('smtp: connection lost before the send');
      }
      if (before.sendDelayMs) sleepSync(before.sendDelayMs);
      let after: FakeFileState['failSend'] = null;
      let crash = false;
      update((s) => {
        s.sent.push({
          ...m,
          attachments: m.attachments?.map((a) => ({
            name: a.name,
            contentType: a.contentType,
            data: a.data.toString('base64'),
          })),
        });
        after = s.failSend;
        crash = s.crashAfterSend;
        s.failSend = null;
      });
      if (crash) process.exit(137);
      if (after === 'after') throw new Error('smtp: connection lost after the send');
      return { messageId: m.messageId };
    },
    async fetchSince(sinceUid) {
      const s = read();
      if (s.failFetch) throw new Error('imap: connection refused');
      return {
        uidValidity: s.uidValidity,
        mails: s.inbox.filter((m) => m.uid > sinceUid).sort((a, b) => a.uid - b.uid),
      };
    },
    deliver: (m) =>
      update((s) => {
        s.inbox.push(m);
      }),
    state: read,
    update,
  };
}
