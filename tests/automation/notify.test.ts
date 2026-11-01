// Halt notifications, the outbox's two-phase send and the digest (phase 1 Task 2).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/automation';
import { scriptDir } from '../../src/shared/io';
import { FakeMail } from '../../src/shared/mail';
import { type Halt, runDir, writeHalt, clearHalt } from '../../src/orchestration/run/journal';
import {
  flushOutbox,
  haltKey,
  notifyHalts,
  readOutbox,
  renderHalt,
  sendTracked,
} from '../../src/orchestration/run/notify';
import { renderDigest, sendDigestIfDue } from '../../src/orchestration/run/digest';
import { isoWeek, lastSlot, readSchedule } from '../../src/orchestration/run/schedule';
import { statusOf } from '../../src/orchestration/run/status';

const a = {
  ...DEFAULTS,
  approvals: { ...DEFAULTS.approvals, from: 'automation@example.test', approverName: 'Jon' },
  notifications: { to: 'jon@example.test', digest: { weekday: 'monday', hour: 8 } },
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
};
const T = 'heat-pumps';
const S = 'decision:a';
const halt = (extra: Partial<Halt> = {}): Halt => ({
  kind: 'awaiting-person',
  stage: 'review',
  why: 'watch the draft',
  unblock: { kind: 'decide', text: 'reply OK to the draft email' },
  at: '2026-10-31T10:00:00.000Z',
  runId: 'r1',
  board: { stage: 'review', next: 'watch it' },
  ...extra,
});
const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-notify-'));
  writeFileSync(join(root, 'package.json'), '{"name":"video-knowledge"}');
  // the story folder names its story (status reads it from script.json; a folder without one is named by its slug)
  runDir(T, S, root);
  writeFileSync(join(scriptDir(T, S, root), 'script.json'), JSON.stringify({ story: S }));
  return root;
};
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const T0 = Date.parse('2026-11-02T20:00:00Z'); // Monday 12:00 Los Angeles

describe('halt notifications', () => {
  it('emails a halt once across ticks, and again when it resolves and recurs', async () => {
    const root = fresh();
    roots.push(root);
    const mail = new FakeMail();
    writeHalt(runDir(T, S, root), halt());
    expect(await notifyHalts(a, mail, root, { now: () => T0, rows: statusOf(root, () => false) })).toHaveLength(1);
    expect(await notifyHalts(a, mail, root, { now: () => T0, rows: statusOf(root, () => false) })).toHaveLength(0);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toBe(`[CoR] blocked: ${T}/${S} (awaiting-person)`);
    expect(mail.sent[0].text).toContain('reply OK to the draft email');
    clearHalt(runDir(T, S, root));
    expect(await notifyHalts(a, mail, root, { now: () => T0, rows: statusOf(root, () => false) })).toHaveLength(0);
    writeHalt(runDir(T, S, root), halt());
    expect(await notifyHalts(a, mail, root, { now: () => T0, rows: statusOf(root, () => false) })).toHaveLength(1);
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[0].messageId).not.toBe(mail.sent[1].messageId);
    expect(haltKey(T, S, halt())).toBe(haltKey(T, S, halt()));
    expect(haltKey(T, S, halt())).not.toBe(haltKey(T, S, halt({ why: 'other' })));
  });
  it('never carries a secret in the body', () => {
    const h = halt({
      why: 'MAIL_PASSWORD=hunter2hunter2 leaked into a log line',
      unblock: { kind: 'fix', text: 'edit hunter2hunter2' },
    });
    const m = renderHalt(T, S, h, a, undefined, ['hunter2hunter2']);
    expect(m.text).not.toContain('hunter2hunter2');
    expect(m.text).toContain('[redacted]');
  });
});

describe('the outbox', () => {
  it('records the intent before the send and the result after; a failed send stays unsent and is resent later with the same id', async () => {
    const root = fresh();
    roots.push(root);
    const mail = new FakeMail();
    let t = T0;
    const out = { from: 'automation@example.test', to: 'jon@example.test', subject: 's', text: 'body' };
    mail.failNext = 'after'; // delivered, then the crash before the record
    await expect(sendTracked(mail, out, 'test', root, { now: () => t })).rejects.toThrow(/after/);
    const [e] = readOutbox(root);
    expect(e.sentAt).toBeNull();
    expect(e.attempts).toBe(1);
    expect(mail.sent[0].messageId).toBe(e.messageId);
    // too soon: nothing resent
    t += 5 * 60 * 1000;
    expect(
      await flushOutbox(
        mail,
        root,
        () => t,
        () => out,
      ),
    ).toEqual([]);
    // eleven minutes later: resent with the same id, then recorded
    t += 6 * 60 * 1000;
    expect(
      await flushOutbox(
        mail,
        root,
        () => t,
        () => out,
      ),
    ).toEqual([e.messageId]);
    expect(mail.sent.map((m) => m.messageId)).toEqual([e.messageId, e.messageId]);
    expect(readOutbox(root)[0].sentAt).not.toBeNull();
    expect(readOutbox(root)[0].attempts).toBe(2);
    // a sent entry is never resent
    t += 60 * 60 * 1000;
    expect(
      await flushOutbox(
        mail,
        root,
        () => t,
        () => out,
      ),
    ).toEqual([]);
    expect(mail.sent).toHaveLength(2);
  });
  it('gives up after three attempts and lists the entry for the digest', async () => {
    const root = fresh();
    roots.push(root);
    const mail = new FakeMail();
    let t = T0;
    const out = { from: 'automation@example.test', to: 'jon@example.test', subject: 'stuck', text: 'body' };
    mail.failNext = 'before';
    await expect(sendTracked(mail, out, 'test', root, { now: () => t })).rejects.toThrow();
    for (let i = 0; i < 3; i++) {
      t += 11 * 60 * 1000;
      mail.failNext = 'before';
      await flushOutbox(
        mail,
        root,
        () => t,
        () => out,
      );
    }
    expect(readOutbox(root)[0].attempts).toBe(3);
    expect(readOutbox(root)[0].sentAt).toBeNull();
    expect(mail.sent).toHaveLength(0);
    const digest = renderDigest([], { unsent: readOutbox(root) }, a);
    expect(digest.text).toContain('Mail that could not be sent');
    expect(digest.text).toContain('"stuck"');
  });
  it('a request id rides on every copy', async () => {
    const root = fresh();
    roots.push(root);
    const mail = new FakeMail();
    const out = { from: 'automation@example.test', to: 'jon@example.test', subject: 'release (req-9)', text: 'b' };
    const { messageId } = await sendTracked(mail, out, 'release-request', root, { request: 'req-9', now: () => T0 });
    expect(readOutbox(root)[0]).toMatchObject({ messageId, request: 'req-9', kind: 'release-request' });
  });
});

describe('the digest', () => {
  it('lists a blocked row with its unblock text and the queue, and sends once per slot', async () => {
    const root = fresh();
    roots.push(root);
    const mail = new FakeMail();
    writeHalt(runDir(T, S, root), halt());
    const rows = statusOf(root, () => false);
    const d = renderDigest(
      rows,
      { queue: { readyStories: 3, approvedTopics: 1, awaitingApproval: 0 }, spend: { weekUsd: 12.5, perWeekUsd: 200 } },
      a,
    );
    expect(d.text).toContain('## Blocked');
    expect(d.text).toContain('Unblock: reply OK to the draft email');
    expect(d.text).toContain('Ready stories: 3');
    expect(d.text).toContain('12.50 USD of 200 USD');
    expect(d.subject).toContain('1 blocked');
    // Monday 12:00 LA: the Monday 08:00 slot has passed
    expect(await sendDigestIfDue(a, mail, () => T0, root, rows)).toBe('2026-11-02');
    expect(await sendDigestIfDue(a, mail, () => T0 + 3600_000, root, rows)).toBeNull();
    expect(mail.sent).toHaveLength(1);
    expect(readSchedule(root).digest?.lastSlot).toBe('2026-11-02');
    // the next Monday is a new slot
    expect(await sendDigestIfDue(a, mail, () => T0 + 7 * 86400_000, root, rows)).toBe('2026-11-09');
  });
  it('local slots and ISO weeks', () => {
    const tz = 'America/Los_Angeles';
    expect(lastSlot(Date.parse('2026-11-02T15:30:00Z'), 'monday', 8, tz)).toBe('2026-10-26'); // 07:30 LA Monday: not yet
    expect(lastSlot(Date.parse('2026-11-02T15:30:00Z'), 'monday', 7, tz)).toBe('2026-11-02');
    expect(lastSlot(Date.parse('2026-11-02T14:30:00Z'), 'monday', 8, tz)).toBe('2026-10-26'); // 06:30 LA Monday: not yet
    expect(lastSlot(Date.parse('2026-11-05T12:00:00Z'), 'monday', 8, tz)).toBe('2026-11-02'); // Thursday
    expect(isoWeek(Date.parse('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeek(Date.parse('2026-11-02T00:00:00Z'))).toBe('2026-W45');
  });
});
