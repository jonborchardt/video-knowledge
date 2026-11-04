// The one migration: explicit, under the mutex, idempotent, crash-safe, and a normalisation (never a plain copy):
// the fields the host names move under meta, Message-IDs and everything else stay.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type MailConfig,
  FakeMail,
  correlate,
  filterOutbox,
  findOutbox,
  init,
  normaliseLegacy,
  readOutbox,
  sendTracked,
} from '../core';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'legacy-outbox.json');
const legacyEntries = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>[];
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const setup = () => {
  const root = mkdtempSync(join(tmpdir(), 'vk-init-'));
  dirs.push(root);
  const legacy = join(root, 'outbox.json');
  copyFileSync(FIXTURE, legacy);
  const cfg: MailConfig = {
    dir: join(root, 'mail'),
    legacyOutbox: legacy,
    legacyMetaFields: ['request', 'topic', 'storyId'],
    from: 'bot@example.test',
    to: 'jon@example.test',
  };
  return { root, legacy, cfg, migrated: join(root, 'outbox.migrated.json'), outbox: join(root, 'mail', 'outbox.json') };
};
const RQ = 'rq-0123456789ab';

describe('init', () => {
  it('normalises every legacy entry: ids and state unchanged, the named fields under meta', () => {
    const { cfg, legacy, migrated } = setup();
    const r = init(cfg);
    expect(r).toMatchObject({ state: 'migrated', entries: 6, byKind: { 'release-request': 1, halt: 1 } });
    const after = readOutbox(cfg.dir);
    expect(after.map((e) => e.messageId)).toEqual(legacyEntries.map((e) => e.messageId));
    expect(after.map((e) => [e.createdAt, e.sentAt, e.attempts, e.subject, e.to])).toEqual(
      legacyEntries.map((e) => [e.createdAt, e.sentAt, e.attempts, e.subject, e.to]),
    );
    const rr = after[0] as unknown as Record<string, unknown>;
    expect(rr.meta).toEqual({ request: RQ, topic: 'heat-pumps', storyId: 'decision:a' });
    for (const k of ['request', 'topic', 'storyId']) expect(rr[k]).toBeUndefined();
    expect(after[0].from).toBe('bot@example.test');
    expect(after[4].meta).toBeUndefined(); // a halt carried none
    expect(existsSync(legacy)).toBe(false);
    expect(existsSync(migrated)).toBe(true);
  });
  it('a pending request is found by id, a reply threads to it, and a clarification keeps its origin fields', () => {
    const { cfg } = setup();
    init(cfg);
    const found = findOutbox(cfg.dir, (e) => e.kind === 'release-request' && e.meta?.request === RQ);
    expect(found?.messageId).toBe('<11111111-aaaa@commonwealthofreason.com>');
    const reply = {
      from: 'Jon <jon@example.test>',
      inReplyTo: found!.messageId,
      references: [],
      subject: 'Re',
      text: 'OK',
    };
    expect(correlate(reply, (p) => filterOutbox(cfg.dir, p), cfg.to)).toEqual({ thread: found!.messageId });
    const clar = findOutbox(cfg.dir, (e) => e.kind === 'reply')!;
    expect(clar.meta).toEqual(found!.meta);
  });
  it('is idempotent', () => {
    const { cfg, outbox } = setup();
    init(cfg);
    const bytes = readFileSync(outbox, 'utf8');
    expect(init(cfg).state).toBe('present');
    expect(readFileSync(outbox, 'utf8')).toBe(bytes);
  });
  it('a dry run reports the same and touches nothing', () => {
    const { cfg, legacy, outbox } = setup();
    const before = readFileSync(legacy, 'utf8');
    expect(init(cfg, { dryRun: true })).toMatchObject({ state: 'migrated', entries: 6 });
    expect(readFileSync(legacy, 'utf8')).toBe(before);
    expect(existsSync(outbox)).toBe(false);
    expect(existsSync(cfg.dir)).toBe(false);
  });
  it('crash after the new outbox was written, before the legacy file moved: the re-run converges', () => {
    const { cfg, legacy, migrated, outbox } = setup();
    mkdirSync(cfg.dir);
    writeFileSync(outbox, JSON.stringify(legacyEntries.map((e) => normaliseLegacy(e, cfg))));
    const bytes = readFileSync(outbox, 'utf8');
    expect(init(cfg).state).toBe('present');
    expect(readFileSync(outbox, 'utf8')).toBe(bytes);
    expect(existsSync(legacy)).toBe(false);
    expect(existsSync(migrated)).toBe(true);
  });
  it('crash mid-write: a leftover temp file changes nothing; the re-run migrates', () => {
    const { cfg, outbox } = setup();
    mkdirSync(cfg.dir);
    writeFileSync(`${outbox}.tmp`, '[{"truncated');
    expect(init(cfg).state).toBe('migrated');
    expect(readOutbox(cfg.dir)).toHaveLength(6);
  });
  it('before init a reader sees the normalised legacy entries, and the legacy file is untouched', () => {
    const { cfg, legacy } = setup();
    const before = readFileSync(legacy, 'utf8');
    expect(readOutbox(cfg.dir, cfg)[0].meta?.request).toBe(RQ);
    expect(readFileSync(legacy, 'utf8')).toBe(before);
    expect(existsSync(cfg.dir)).toBe(false);
  });
  it('the first mutation migrates, and no in-flight entry is lost', async () => {
    const { cfg } = setup();
    await sendTracked(cfg, new FakeMail(), { from: cfg.from, to: cfg.to, subject: 's', text: 't' }, 'note');
    expect(readOutbox(cfg.dir)).toHaveLength(7);
    expect(readOutbox(cfg.dir)[4]).toMatchObject({ sentAt: null, attempts: 2 });
  });
  it('seeds the received cursor once from the legacy cursor file', () => {
    const { root, cfg } = setup();
    const cursor = join(root, 'inbox.json');
    writeFileSync(cursor, JSON.stringify({ lastUid: 41, handled: [] }));
    const c = { ...cfg, legacyCursor: cursor };
    init(c);
    const received = join(cfg.dir, 'received.json');
    expect(JSON.parse(readFileSync(received, 'utf8'))).toEqual({ uidValidity: null, lastUid: 41, received: [] });
    writeFileSync(cursor, JSON.stringify({ lastUid: 99 }));
    init(c);
    expect(JSON.parse(readFileSync(received, 'utf8')).lastUid).toBe(41);
  });
  it('nothing to migrate: empty', () => {
    const { cfg, legacy } = setup();
    rmSync(legacy);
    expect(init(cfg)).toMatchObject({ state: 'empty', entries: 0 });
  });
  it('a host that names no legacy fields keeps them where they are', () => {
    const e = { messageId: '<x>', kind: 'k', request: 'r', createdAt: 'c', sentAt: null, attempts: 1 };
    expect(normaliseLegacy(e, { from: 'f' })).toMatchObject({ request: 'r', from: 'f' });
  });
});
