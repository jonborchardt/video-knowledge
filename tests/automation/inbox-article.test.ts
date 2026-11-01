// Replies to an article correction request (register D10; phase 6 Task 4): OK by the approver runs `article decide
// --verdict ok` for the request's id and marks the story due for the launch job; CHANGES: records the notes on the
// request for the next writer pass; a contradicted OK asks again; a reply naming another id is ignored.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { runCli } from '../../src/shared/cli';
import { readJson, toJson } from '../../src/shared/io';
import { FakeMail, type InMail } from '../../src/shared/mail';
import { ARTICLE_FILES, type ArticleRelease, type ArticleRequest, loadArticleRequest } from '../../src/modules/article';
import { pollInbox, readInbox } from '../../src/orchestration/run/inbox';
import { sendCorrectionRequest } from '../../src/orchestration/run/requests';
import { readSchedule } from '../../src/orchestration/run/schedule';
import { type Fixture, cliRoot, syntheticProduction } from '../production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 60_000);
const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, to: 'jon@example.test', from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
};
let uid = 0;

async function staged() {
  const f = syntheticProduction('packaged', { release: true });
  fixtures.push(f);
  cliRoot(f.root);
  const env = { ...process.env, VK_NO_DOTENV: '1', APPROVAL_SECRET: 'a-test-secret-of-some-length' };
  const release = readJson<ArticleRelease>(join(f.dir, ARTICLE_FILES.release))!;
  writeFileSync(join(f.dir, ARTICLE_FILES.article), toJson(release.article));
  writeFileSync(join(f.dir, ARTICLE_FILES.review), toJson({ packageFingerprint: 'x', approved: {}, findings: [] }));
  writeFileSync(
    join(f.dir, ARTICLE_FILES.validation),
    toJson({ status: 'passed', sentences: [], issues: [], counts: {} }),
  );
  const r = runCli('article', ['request-correction', f.topic, f.story, '--by', 'automated: maintenance t1'], {
    cwd: f.root,
    env,
  });
  expect(r.status, r.stderr).toBe(0);
  const req = loadArticleRequest(f.topic, f.story, f.root)!;
  const mail = new FakeMail();
  const T0 = Date.now();
  await sendCorrectionRequest(f.topic, f.story, req, a, mail, { root: f.root, now: () => T0, env });
  const sent = mail.sent[0];
  const okRuns: string[][] = [];
  // the verb is the module's (tested there); an OK on this fixture would re-validate the demo article, so it is stubbed
  const run = (cli: string, args: string[]) =>
    cli === 'article' && args[0] === 'decide' && args.includes('ok')
      ? (okRuns.push(args), { status: 0, stdout: `${req.request}: ok`, stderr: '' })
      : runCli(cli, args, { cwd: f.root, env });
  const poll = () => pollInbox(a, mail, f.root, { now: () => T0 + 3600_000, run });
  const reply = (text: string, extra: Partial<InMail> = {}): InMail => ({
    uid: ++uid,
    messageId: `<c${uid}@jon.test>`,
    inReplyTo: sent.messageId,
    references: [sent.messageId],
    from: 'Jon <jon@example.test>',
    subject: `Re: ${sent.subject}`,
    text: `${text}\n\n> the request`,
    html: null,
    date: new Date(T0 + 1800_000).toISOString(),
    ...extra,
  });
  const request = () => readJson<ArticleRequest>(join(f.dir, ARTICLE_FILES.request))!;
  return { f, mail, req, sent, poll, reply, request, okRuns };
}

describe('pollInbox: article corrections', () => {
  it('OK by the approver decides the request ok with the message id and marks the story due', async () => {
    const s = await staged();
    expect(s.sent.subject).toContain(s.req.request);
    s.mail.deliver(s.reply('OK'));
    const r = await s.poll();
    expect(r.applied).toEqual([`${s.req.request}: correction ok`]);
    expect(s.okRuns).toHaveLength(1);
    expect(s.okRuns[0]).toEqual([
      'decide',
      s.f.topic,
      s.f.story,
      '--request',
      s.req.request,
      '--verdict',
      'ok',
      '--by',
      'Jon',
      '--via',
      `email:${s.mail.inbox[0].messageId}`,
    ]);
    expect(readSchedule(s.f.root).due).toEqual([
      expect.objectContaining({ topic: s.f.topic, storyId: s.f.story, why: 'moved' }),
    ]);
    expect(readInbox(s.f.root).handled.map((h) => h.outcome)).toEqual(['applied:correction-ok']);
  }, 120_000);

  it('CHANGES: records the notes on the request for the next writer pass; a contradicted OK asks again; another id is ignored', async () => {
    const s = await staged();
    s.mail.deliver(s.reply('CHANGES:\n- say when the survey was published\n- keep the pound figures'));
    const r = await s.poll();
    expect(r.applied).toEqual([`${s.req.request}: correction changes`]);
    expect(s.request().decided).toMatchObject({
      verdict: 'changes',
      by: 'Jon',
      notes: ['say when the survey was published', 'keep the pound figures'],
      via: { channel: 'email', messageId: s.mail.inbox[0].messageId },
    });
    expect(s.okRuns).toEqual([]);
    expect(readSchedule(s.f.root).due ?? []).toEqual([]);
    // a second staged request on another fixture: OK then a hold is a clarification, a foreign id is ignored
    const t = await staged();
    t.mail.deliver(t.reply('OK\nActually, hold off until I have read the table.'));
    t.mail.deliver(t.reply('OK', { subject: 'Re: [CoR] article correction ar-000000000000' }));
    const r2 = await t.poll();
    expect(r2.applied).toEqual([]);
    expect(r2.clarified).toEqual([t.req.request]);
    expect(t.okRuns).toEqual([]);
    expect(t.request().decided).toBeUndefined();
    const back = t.mail.sent.at(-1)!;
    expect(back.text).toMatch(/could not read your reply/);
    expect(readInbox(t.f.root).handled.map((h) => h.outcome)).toEqual([
      'clarified',
      expect.stringMatching(/^ignored:/),
    ]);
  }, 120_000);
});
