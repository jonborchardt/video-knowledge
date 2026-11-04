// The one inbound pipeline: one cursor, each message recorded once, correlated once, when it is recorded.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type InMail,
  type MailConfig,
  FakeMail,
  acknowledge,
  archive,
  fetchInto,
  findOutbox,
  questions,
  readOutbox,
  readReceived,
  receivedPath,
  recordOutgoing,
  recordReceived,
  sendTracked,
  unmatched,
} from '../core';

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const T0 = Date.parse('2026-11-03T10:00:00Z');
const cfgOf = (over: Partial<MailConfig> = {}): MailConfig => {
  const dir = mkdtempSync(join(tmpdir(), 'vk-received-'));
  dirs.push(dir);
  return { dir, from: 'bot@example.test', to: 'me@example.test', now: () => T0, ...over };
};
const mail = (uid: number, over: Partial<InMail> = {}): InMail => ({
  uid,
  messageId: `<m${uid}@me>`,
  inReplyTo: null,
  references: [],
  from: 'Me <me@example.test>',
  subject: 'Re: x',
  text: `words ${uid}`,
  html: null,
  date: '2026-11-03T11:00:00.000Z',
  ...over,
});
const question = (cfg: MailConfig, id = 'qn-aaaaaaaaaaaa') =>
  recordOutgoing(cfg, { from: cfg.from, to: cfg.to, subject: `q ${id}`, text: 'A or B?' }, 'question', {
    id,
    text: 'A or B?',
  });

describe('recordReceived', () => {
  it("a reply to a question appends an answer in the person's own words and names its thread", () => {
    const cfg = cfgOf();
    const q = question(cfg);
    expect(recordReceived(cfg, '1', [mail(1, { inReplyTo: q.messageId, text: 'Use B\n\n> A or B?' })])).toBe(1);
    expect(readReceived(cfg.dir)[0]).toMatchObject({ thread: q.messageId, uid: 1, uidValidity: '1' });
    expect(readOutbox(cfg.dir)[0].answers).toEqual([
      {
        messageId: '<m1@me>',
        from: 'Me <me@example.test>',
        at: '2026-11-03T11:00:00.000Z',
        recordedAt: new Date(T0).toISOString(),
        text: 'Use B',
      },
    ]);
  });
  it('a bottom-posted reply keeps the whole body rather than an empty answer', () => {
    const cfg = cfgOf();
    const q = question(cfg);
    recordReceived(cfg, '1', [mail(1, { inReplyTo: q.messageId, text: '> A or B?\nUse B' })]);
    expect(readOutbox(cfg.dir)[0].answers?.[0].text).toBe('> A or B?\nUse B');
  });
  it('the same batch twice adds nothing, and answers are not doubled', () => {
    const cfg = cfgOf();
    const q = question(cfg);
    const batch = [mail(1, { inReplyTo: q.messageId })];
    recordReceived(cfg, '1', batch);
    expect(recordReceived(cfg, '1', batch)).toBe(0);
    expect(readReceived(cfg.dir)).toHaveLength(1);
    expect(readOutbox(cfg.dir)[0].answers).toHaveLength(1);
  });
  it('a mail without a Message-ID is deduplicated by its content', () => {
    const cfg = cfgOf();
    const m = mail(1, { messageId: '' });
    recordReceived(cfg, '1', [m]);
    expect(recordReceived(cfg, '1', [{ ...m, uid: 9 }])).toBe(0);
    expect(readReceived(cfg.dir)[0].key).toMatch(/^[0-9a-f]{40}$/);
  });
  it('a stranger is recorded and answers nothing, whatever it names', () => {
    const cfg = cfgOf();
    const q = question(cfg);
    recordReceived(cfg, '1', [mail(1, { from: 'mallory@example.test', inReplyTo: q.messageId })]);
    expect(readReceived(cfg.dir)[0]).toMatchObject({ thread: null, why: 'not-from-person' });
    expect(readOutbox(cfg.dir)[0].answers).toBeUndefined();
    expect(unmatched(cfg.dir)).toEqual([]);
  });
  it('correlation is once: an unmatched mail never answers a later question', () => {
    const cfg = cfgOf();
    const early = mail(1, { subject: 'about qn-aaaaaaaaaaaa' });
    recordReceived(cfg, '1', [early]);
    expect(unmatched(cfg.dir).map((r) => r.key)).toEqual(['<m1@me>']);
    question(cfg);
    recordReceived(cfg, '2', [{ ...early, uid: 1 }]); // the mailbox was recreated and offers it again
    expect(readReceived(cfg.dir)).toHaveLength(1);
    expect(readReceived(cfg.dir)[0].thread).toBeNull();
    expect(readOutbox(cfg.dir)[0].answers).toBeUndefined();
  });
  it('an ambiguous reply matches nothing and is listed', () => {
    const cfg = cfgOf();
    question(cfg, 'qn-aaaaaaaaaaaa');
    question(cfg, 'qn-bbbbbbbbbbbb');
    recordReceived(cfg, '1', [mail(1, { subject: 'qn-aaaaaaaaaaaa or qn-bbbbbbbbbbbb' })]);
    expect(unmatched(cfg.dir)[0].why).toBe('ambiguous:qn-aaaaaaaaaaaa,qn-bbbbbbbbbbbb');
    expect(readOutbox(cfg.dir).flatMap((e) => e.answers ?? [])).toEqual([]);
  });
  it('multiple replies stay in order on the one question', () => {
    const cfg = cfgOf();
    const q = question(cfg);
    recordReceived(cfg, '1', [
      mail(1, { inReplyTo: q.messageId, text: 'Use B' }),
      mail(2, { inReplyTo: q.messageId, text: 'Actually, use A' }),
    ]);
    expect(readOutbox(cfg.dir)[0].answers?.map((x) => x.text)).toEqual(['Use B', 'Actually, use A']);
  });
  it('keeps the original source beside the record', () => {
    const cfg = cfgOf();
    recordReceived(cfg, '1', [mail(1, { raw: 'From: me\r\n\r\nthe source' })]);
    const r = readReceived(cfg.dir)[0];
    expect(r.raw).toMatch(/^received\/[0-9a-f]{12}\.eml$/);
    expect(readFileSync(join(cfg.dir, r.raw!), 'utf8')).toContain('the source');
    expect(r).not.toHaveProperty('html');
  });
  it('a reply to an entry only in the archive threads to it and says so', () => {
    const cfg = cfgOf();
    mkdirSync(join(cfg.dir, 'archive'), { recursive: true });
    writeFileSync(
      join(cfg.dir, 'archive', '2026-01.json'),
      JSON.stringify({
        outbox: [
          { messageId: '<old@bot>', kind: 'question', id: 'qn-cccccccccccc', createdAt: 'c', sentAt: 'c', attempts: 1 },
        ],
        received: [],
      }),
    );
    recordReceived(cfg, '1', [mail(1, { inReplyTo: '<old@bot>' })]);
    expect(readReceived(cfg.dir)[0]).toMatchObject({ thread: '<old@bot>', why: 'archived-thread' });
    expect(unmatched(cfg.dir).map((r) => r.key)).toEqual(['<m1@me>']);
  });
  it('a key recorded in the archive is not recorded again', () => {
    const cfg = cfgOf();
    mkdirSync(join(cfg.dir, 'archive'), { recursive: true });
    writeFileSync(
      join(cfg.dir, 'archive', '2026-01.json'),
      JSON.stringify({ outbox: [], received: [{ key: '<m1@me>' }] }),
    );
    expect(recordReceived(cfg, '1', [mail(1)])).toBe(0);
  });
});

describe('fetchInto', () => {
  it('reads only after the cursor and advances it', async () => {
    const cfg = cfgOf();
    const f = new FakeMail();
    f.deliver(mail(1));
    expect(await fetchInto(cfg, f)).toBe(1);
    f.deliver(mail(2));
    expect(await fetchInto(cfg, f)).toBe(1);
    expect(await fetchInto(cfg, f)).toBe(0);
    expect(JSON.parse(readFileSync(receivedPath(cfg.dir), 'utf8'))).toMatchObject({ uidValidity: '1', lastUid: 2 });
  });
  it('a changed UIDVALIDITY re-reads from the start: no duplicate, nothing skipped, the cursor renumbered', async () => {
    const cfg = cfgOf();
    const q = question(cfg);
    const f = new FakeMail();
    f.deliver(mail(50, { inReplyTo: q.messageId }));
    await fetchInto(cfg, f);
    f.inbox = [mail(1, { messageId: '<m50@me>', inReplyTo: q.messageId }), mail(2, { messageId: '<new@me>' })];
    f.uidValidity = '777';
    expect(await fetchInto(cfg, f)).toBe(1);
    expect(readReceived(cfg.dir).map((r) => r.key)).toEqual(['<m50@me>', '<new@me>']);
    expect(readOutbox(cfg.dir)[0].answers).toHaveLength(1);
    expect(JSON.parse(readFileSync(receivedPath(cfg.dir), 'utf8'))).toMatchObject({ uidValidity: '777', lastUid: 2 });
  });
  it('a very large UIDVALIDITY survives exactly', async () => {
    const cfg = cfgOf();
    const f = new FakeMail();
    f.uidValidity = '18446744073709551557';
    f.deliver(mail(1));
    await fetchInto(cfg, f);
    expect(JSON.parse(readFileSync(receivedPath(cfg.dir), 'utf8')).uidValidity).toBe('18446744073709551557');
  });
  it('a cursor seeded from a legacy file reads only what is new and adopts the validity without a reset', async () => {
    const cfg = cfgOf();
    const cursor = join(cfg.dir, 'legacy-inbox.json');
    mkdirSync(cfg.dir, { recursive: true });
    writeFileSync(cursor, JSON.stringify({ lastUid: 41 }));
    const f = new FakeMail();
    f.uidValidity = '5';
    for (let u = 1; u <= 45; u++) f.deliver(mail(u));
    expect(await fetchInto({ ...cfg, legacyCursor: cursor }, f)).toBe(4);
    expect(readReceived(cfg.dir).map((r) => r.uid)).toEqual([42, 43, 44, 45]);
    expect(JSON.parse(readFileSync(receivedPath(cfg.dir), 'utf8'))).toMatchObject({ uidValidity: '5', lastUid: 45 });
  });
  it('an unreachable mailbox throws and changes nothing', async () => {
    const cfg = cfgOf();
    const f = new FakeMail();
    f.failNextFetch = true;
    await expect(fetchInto(cfg, f)).rejects.toThrow(/imap/);
    expect(existsSync(receivedPath(cfg.dir))).toBe(false);
  });
  it('mail sent and then answered through the whole path', async () => {
    const cfg = cfgOf();
    const f = new FakeMail();
    const { messageId } = await sendTracked(cfg, f, { from: cfg.from, to: cfg.to, subject: 's', text: 't' }, 'note');
    f.deliver(mail(1, { inReplyTo: messageId }));
    await fetchInto(cfg, f);
    expect(readReceived(cfg.dir)[0].thread).toBe(messageId);
    expect(readOutbox(cfg.dir)[0].answers).toBeUndefined(); // only a question collects answers
  });
});

describe('retention', () => {
  const DAY = 86_400_000;
  const clocked = (over: Partial<MailConfig> = {}) => {
    const c = { t: T0 };
    return { c, cfg: cfgOf({ now: () => c.t, ...over }) };
  };
  const answered = (cfg: MailConfig, id: string, ack: boolean) => {
    const q = question(cfg, id);
    recordReceived(cfg, '1', [mail(++uidNext, { inReplyTo: q.messageId, text: 'B' })]);
    if (ack) acknowledge(cfg, id);
    return q;
  };
  let uidNext = 100;
  const months = (cfg: MailConfig) => readdirSync(join(cfg.dir, 'archive'));

  it('moves a completed question and its reply to the month it was asked; lookups still find it', () => {
    const { c, cfg } = clocked();
    const q = answered(cfg, 'qn-aaaaaaaaaaaa', true);
    c.t += 100 * DAY;
    expect(archive(cfg)).toEqual({ outbox: 1, received: 1 });
    expect(months(cfg)).toEqual(['2026-11.json']);
    expect(questions(cfg.dir)).toEqual([]);
    expect(readReceived(cfg.dir)).toEqual([]);
    expect(findOutbox(cfg.dir, (e) => e.id === 'qn-aaaaaaaaaaaa')?.messageId).toBe(q.messageId);
  });
  it('an unanswered question stays live at any age, sent or not', () => {
    const { c, cfg } = clocked();
    question(cfg, 'qn-aaaaaaaaaaaa');
    c.t += 200 * DAY;
    expect(archive(cfg)).toEqual({ outbox: 0, received: 0 });
    expect(questions(cfg.dir).map((q) => q.id)).toEqual(['qn-aaaaaaaaaaaa']);
  });
  it('an answer no consumer accepted stays live, and its reply with it', () => {
    const { c, cfg } = clocked();
    answered(cfg, 'qn-aaaaaaaaaaaa', false);
    c.t += 200 * DAY;
    expect(archive(cfg)).toEqual({ outbox: 0, received: 0 });
    expect(readReceived(cfg.dir)).toHaveLength(1);
  });
  it('nothing young moves', () => {
    const { c, cfg } = clocked();
    answered(cfg, 'qn-aaaaaaaaaaaa', true);
    c.t += 10 * DAY;
    expect(archive(cfg)).toEqual({ outbox: 0, received: 0 });
  });
  it('a sent mail moves; an unsent one with attempts left does not', async () => {
    const { c, cfg } = clocked();
    const f = new FakeMail();
    await sendTracked(cfg, f, { from: cfg.from, to: cfg.to, subject: 's', text: 't' }, 'note');
    recordOutgoing(cfg, { from: cfg.from, to: cfg.to, subject: 'pending', text: 't' }, 'note');
    c.t += 100 * DAY;
    expect(archive(cfg).outbox).toBe(1);
    expect(readOutbox(cfg.dir).map((e) => e.subject)).toEqual(['pending']);
  });
  it('a reply the host has not processed stays reachable, whatever its age or its request', async () => {
    const seen = new Set<string>();
    const { c, cfg } = clocked({ keepReceived: (r) => !!r.thread && !seen.has(r.key) });
    const f = new FakeMail();
    const { messageId } = await sendTracked(
      cfg,
      f,
      { from: cfg.from, to: cfg.to, subject: 'req', text: 't' },
      'request',
    );
    recordReceived(cfg, '1', [mail(1, { inReplyTo: messageId })]);
    c.t += 200 * DAY;
    expect(archive(cfg)).toEqual({ outbox: 1, received: 0 });
    expect(readReceived(cfg.dir).map((r) => r.key)).toEqual(['<m1@me>']);
    expect(findOutbox(cfg.dir, (e) => e.messageId === messageId)).not.toBeNull();
    seen.add('<m1@me>');
    expect(archive(cfg).received).toBe(1);
  });
  it('a late reply to an archived request threads to it; a late reply to an archived question is listed', () => {
    const { c, cfg } = clocked();
    const q = answered(cfg, 'qn-aaaaaaaaaaaa', true);
    c.t += 100 * DAY;
    archive(cfg);
    recordReceived(cfg, '1', [mail(500, { inReplyTo: q.messageId, text: 'one more thing' })]);
    const r = readReceived(cfg.dir)[0];
    expect(r).toMatchObject({ thread: q.messageId, why: 'archived-thread' });
    expect(unmatched(cfg.dir).map((x) => x.key)).toEqual([r.key]);
  });
  it('a crash between the archive write and the live write: the re-run does not duplicate', () => {
    const { c, cfg } = clocked();
    answered(cfg, 'qn-aaaaaaaaaaaa', true);
    const outbox = readFileSync(join(cfg.dir, 'outbox.json'), 'utf8');
    c.t += 100 * DAY;
    archive(cfg);
    writeFileSync(join(cfg.dir, 'outbox.json'), outbox); // as if the live rewrite never happened
    expect(archive(cfg).outbox).toBe(1);
    const a = JSON.parse(readFileSync(join(cfg.dir, 'archive', '2026-11.json'), 'utf8'));
    expect(a.outbox).toHaveLength(1);
    expect(readOutbox(cfg.dir)).toEqual([]);
  });
  it('every fetch runs retention', async () => {
    const { c, cfg } = clocked();
    answered(cfg, 'qn-aaaaaaaaaaaa', true);
    c.t += 100 * DAY;
    await fetchInto(cfg, new FakeMail());
    expect(questions(cfg.dir)).toEqual([]);
  });
});
