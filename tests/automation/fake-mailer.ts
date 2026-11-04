// The orchestration tests' Mailer: the in-memory transport with the outbox bound to a test root, so a test keeps
// `mail.sent`, `mail.deliver(...)` and `mail.failNext` and gains `mail.sendTracked(out, kind, extra)`.
import type { Mailer, SendExtra } from '../../src/orchestration/run/mailer';
import { type OutboxKind, resendRecorded, sendTracked } from '../../src/orchestration/run/notify';
import { FakeMail, type OutMail } from '../../src/shared/mail';

export class FakeMailer extends FakeMail implements Mailer {
  constructor(public root: string) {
    super();
  }
  sendTracked(
    out: Omit<OutMail, 'messageId'>,
    kind: OutboxKind,
    extra: SendExtra = {},
  ): Promise<{ messageId: string }> {
    return extra.messageId
      ? resendRecorded(this, this.root, kind, extra.messageId, out, extra.now)
      : sendTracked(this, out, kind, this.root, extra);
  }
}
