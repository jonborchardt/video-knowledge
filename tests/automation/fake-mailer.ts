// The orchestration tests' Mailer: the in-memory transport with the core's outbox bound to a test root, in process
// (the CLI path is tested in src/modules/mail/tests/send-cli.test.ts). A test keeps `mail.sent`, `mail.deliver(...)`
// and `mail.failNext` and gains `mail.sendTracked(out, kind, extra)`.
import { join } from 'node:path';
import { corMailDir } from '../../src/modules/mail/cor';
import { type MailConfig, sendTracked, skipAttempt } from '../../src/modules/mail/core';
import { type Mailer, type SendExtra, metaOf } from '../../src/orchestration/run/mailer';
import { type OutboxKind, withGuide } from '../../src/orchestration/run/notify';
import { FakeMail, type OutMail } from '../../src/shared/mail';

export class FakeMailer extends FakeMail implements Mailer {
  constructor(public root: string) {
    super();
  }
  private cfg(to: string, from: string, now?: () => number): MailConfig {
    return {
      dir: corMailDir(this.root),
      legacyOutbox: join(this.root, '.automation', 'outbox.json'),
      legacyMetaFields: ['request', 'topic', 'storyId'],
      from,
      to,
      ...(now && { now }),
    };
  }
  sendTracked(
    out: Omit<OutMail, 'messageId'>,
    kind: OutboxKind,
    extra: SendExtra = {},
  ): Promise<{ messageId: string }> {
    const meta = metaOf(extra);
    return sendTracked(this.cfg(out.to, out.from, extra.now), this, withGuide(kind, out), kind, {
      ...(meta && { meta }),
      ...(extra.messageId && { messageId: extra.messageId }),
    });
  }
  async skipAttempt(messageId: string, now?: () => number): Promise<void> {
    skipAttempt(this.cfg('', '', now), messageId);
  }
}
