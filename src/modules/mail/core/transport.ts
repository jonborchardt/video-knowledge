// Transports the core ships with. This task: Message-ID generation and the file-backed fake that lets real processes
// share one fake mailbox in tests (MAIL_FAKE=<state file>). Task 4 moves the nodemailer/imapflow implementation and
// the in-memory FakeMail here from src/shared/mail.ts.
import { randomUUID } from 'node:crypto';
import { readJson, sleepSync, writeJsonAtomic } from './io';
import { withMutex } from './mutex';
import type { InMail, MailTransport, OutMail } from './types';

export const messageIdOf = (domain: string): string => `<${randomUUID()}@${domain}>`;

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
