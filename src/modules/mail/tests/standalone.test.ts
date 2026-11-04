// The extraction boundary, exercised: the core used as another project would use it, through its public index alone,
// with its own configuration and a fake transport. This file imports nothing from the Commonwealth (the core typecheck,
// src/modules/mail/core/tsconfig.json, compiles it with the core and nothing else).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type InMail, type MailConfig, FakeMail, mailCore } from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const DAY = 86_400_000;
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mailcore-'));
  dirs.push(dir);
  const clock = { t: Date.parse('2030-01-15T10:00:00Z') };
  const cfg: MailConfig = {
    dir,
    from: 'bot@elsewhere.example',
    to: 'owner@elsewhere.example',
    subjectPrefix: '[Other]',
    now: () => clock.t,
  };
  const mail = new FakeMail();
  return { clock, cfg, mail, core: mailCore(cfg, mail) };
};
let uid = 0;
const reply = (inReplyTo: string, text: string): InMail => ({
  uid: ++uid,
  messageId: `<reply${uid}@elsewhere.example>`,
  inReplyTo,
  references: [inReplyTo],
  from: 'Owner <owner@elsewhere.example>',
  subject: 'Re: a question',
  text,
  html: null,
  date: '2030-01-15T11:00:00.000Z',
});
const NOW = { timeoutMs: 0, pollMs: 1 };

describe('the core on its own', () => {
  it('a two-turn conversation, with recovery and duplicate fetches, retained then archived', async () => {
    const { clock, cfg, mail, core } = setup();
    expect(core.init().state).toBe('empty');

    const first = await core.ask({ subject: 'deploy now?', text: 'Shall I?', about: 'job-7' }, NOW);
    expect(first.answered).toBe(false);
    expect(first.question.subject).toBe(`[Other] deploy now? ${first.question.id}`);
    mail.deliver(reply(first.question.messageId, 'Not yet.\n\n> Shall I?'));
    expect(await core.fetch()).toBe(1);
    expect(await core.fetch()).toBe(0); // a duplicate fetch adds nothing

    // a later process recovers the answer it never waited for
    const recovered = await core.ask({ resume: first.question.id! }, { timeoutMs: 60_000, pollMs: 1 });
    expect(recovered.answered).toBe(true);
    expect(recovered.question.answers?.[0].text).toBe('Not yet.');
    expect(core.questions()[0]).toMatchObject({ status: 'answered', seen: false });
    core.acknowledge(first.question.id!);

    const second = await core.ask({ subject: '', text: 'And now?', replyTo: first.question.id! }, NOW);
    expect(mail.sent[1].inReplyTo).toBe(first.question.messageId);
    mail.deliver(reply(second.question.messageId, 'Go.'));
    await core.fetch();
    const answered = core.questions();
    expect(answered.map((q) => q.answers?.[0].text)).toEqual(['Not yet.', 'Go.']);
    expect(answered.every((q) => q.about === 'job-7')).toBe(true);
    core.acknowledge(second.question.id!);

    clock.t += 100 * DAY;
    expect(core.archive()).toEqual({ outbox: 2, received: 2 });
    expect(core.questions()).toEqual([]);
    expect(readdirSync(join(cfg.dir, 'archive'))).toEqual(['2030-01.json']);
    expect(core.findOutbox((e) => e.id === first.question.id)?.answers?.[0].text).toBe('Not yet.');
  });
  it("a plain tracked mail with the host's own kind and metadata", async () => {
    const { cfg, mail, core } = setup();
    const { messageId } = await core.send(
      { from: cfg.from, to: cfg.to, subject: 'notice', text: 'hello' },
      'whatever-this-host-calls-it',
      { meta: { order: '42' } },
    );
    expect(mail.sent[0].messageId).toBe(messageId);
    expect(core.outbox()[0]).toMatchObject({ kind: 'whatever-this-host-calls-it', meta: { order: '42' } });
  });
  it('the core sources name no host', () => {
    const coreDir = join(import.meta.dirname, '..', 'core');
    const hostWords =
      /automation\.json|approvals\.|notifications\.to|storyId|\btopic\b|commonwealth|\bCoR\b|release-request/i;
    const found = readdirSync(coreDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => hostWords.test(readFileSync(join(coreDir, f), 'utf8')));
    expect(found).toEqual([]);
  });
});
