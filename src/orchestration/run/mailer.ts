// The seam between orchestration and the mailbox (the mail module plan, Task 1): orchestration sends and fetches only
// through a Mailer, so the implementation can change (today an in-process transport over the outbox in notify.ts; from
// Task 3 the mail module's CLI as a child) without the callers moving. `sendTracked` without `messageId` records a new
// outbox entry and sends it; with `messageId` it resends a recorded entry with its id (the outbox's flush step).
import { ROOT } from '../../shared/io';
import type { InMail, MailTransport, OutMail } from '../../shared/mail';
import { type OutboxKind, resendRecorded, sendTracked } from './notify';

export interface SendExtra {
  request?: string;
  topic?: string;
  storyId?: string;
  /** A resend of the recorded entry with this Message-ID (attempts are the caller's; the id is reused). */
  messageId?: string;
  now?: () => number;
}

export interface Mailer {
  sendTracked(out: Omit<OutMail, 'messageId'>, kind: OutboxKind, extra?: SendExtra): Promise<{ messageId: string }>;
  fetchSince(sinceUid: number): Promise<{ uidValidity: string; mails: InMail[] }>;
}

/** Today's implementation: the transport in process, the outbox in `.automation/outbox.json`. */
export function transportMailer(mail: MailTransport, root = ROOT): Mailer {
  return {
    sendTracked: (out, kind, extra = {}) =>
      extra.messageId
        ? resendRecorded(mail, root, kind, extra.messageId, out, extra.now)
        : sendTracked(mail, out, kind, root, extra),
    fetchSince: (sinceUid) => mail.fetchSince(sinceUid),
  };
}
