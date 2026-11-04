// The one inbound pipeline: IMAP -> fetchInto -> received.json -> consumers. `fetchInto` is the only reader of the
// mailbox and this file holds the only cursor; a consumer reads the store and keeps its own idea of what it has
// handled. A message is recorded once (by Message-ID, or by its content when it has none) and correlated once, when
// it is recorded: a later question never claims an earlier mail, and a re-read after a mailbox is renumbered adds
// nothing. The original source is kept beside the record.
// ponytail: received.json is one JSON document; `archive` keeps it bounded by moving completed records out by month.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, sha, writeJsonAtomic } from './io';
import { withMutex } from './mutex';
import { archiveDir, filterOutbox, init, initHeld, lockPath, outboxPath, readOutbox, receivedPath } from './outbox';
import { correlate, ownText } from './thread';
import type { Correlation, InMail, MailConfig, MailTransport, OutboxEntry } from './types';

export interface Received extends Omit<InMail, 'html' | 'raw'> {
  uidValidity: string;
  /** The Message-ID, or a hash of the content when the mail has none. */
  key: string;
  fetchedAt: string;
  /** The source, relative to the mail directory. */
  raw: string | null;
  thread: string | null;
  why?: Correlation['why'];
}
export interface ReceivedFile {
  uidValidity: string | null;
  lastUid: number;
  received: Received[];
}
const readFile = (dir: string): ReceivedFile =>
  readJson<ReceivedFile>(receivedPath(dir)) ?? { uidValidity: null, lastUid: 0, received: [] };
export const readReceived = (dir: string): Received[] => readFile(dir).received;

const keyOf = (m: InMail) => m.messageId || sha(`${m.from}\n${m.date}\n${m.subject}\n${m.text}`);
const archivedKeys = (dir: string): string[] =>
  existsSync(archiveDir(dir))
    ? readdirSync(archiveDir(dir)).flatMap(
        (f) => readJson<{ received?: { key: string }[] }>(join(archiveDir(dir), f))?.received?.map((r) => r.key) ?? [],
      )
    : [];

/** Records a fetched batch under the mutex; returns how many were new. Keeps the cursor: a changed UIDVALIDITY
 *  renumbers it to this batch; an unknown one (a seeded cursor) is adopted as it is. */
export function recordReceived(cfg: MailConfig, uidValidity: string, mails: InMail[]): number {
  return withMutex(lockPath(cfg.dir), () => {
    initHeld(cfg);
    const file = readFile(cfg.dir);
    const outbox = readOutbox(cfg.dir);
    const at = new Date((cfg.now ?? Date.now)()).toISOString();
    const seen = new Set([...file.received.map((r) => r.key), ...archivedKeys(cfg.dir)]);
    const lookup = (pred: (e: OutboxEntry) => boolean) => [
      ...outbox.filter(pred),
      ...filterOutbox(cfg.dir, pred).filter((e) => !outbox.some((l) => l.messageId === e.messageId)),
    ];
    let added = 0;
    for (const m of mails) {
      const key = keyOf(m);
      if (seen.has(key)) continue;
      seen.add(key);
      let raw: string | null = null;
      if (m.raw !== undefined) {
        mkdirSync(join(cfg.dir, 'received'), { recursive: true });
        raw = `received/${sha(key).slice(0, 12)}.eml`;
        writeFileSync(join(cfg.dir, raw), m.raw);
      }
      const c = correlate(m, lookup, cfg.to);
      const live = c.thread ? outbox.find((e) => e.messageId === c.thread) : undefined;
      file.received.push({
        uid: m.uid,
        messageId: m.messageId,
        inReplyTo: m.inReplyTo,
        references: m.references,
        from: m.from,
        subject: m.subject,
        text: m.text,
        date: m.date,
        uidValidity,
        key,
        fetchedAt: at,
        raw,
        thread: c.thread,
        ...(c.why && { why: c.why }),
        ...(c.thread && !live && { why: 'archived-thread' as const }),
      });
      if (live?.kind === 'question')
        (live.answers ??= []).push({
          messageId: m.messageId,
          from: m.from,
          at: m.date,
          recordedAt: at,
          text: ownText(m.text) || m.text.trim(),
        });
      added += 1;
    }
    const top = mails.reduce((n, m) => Math.max(n, m.uid), 0);
    const renumbered = file.uidValidity !== null && file.uidValidity !== uidValidity;
    file.lastUid = renumbered ? top : Math.max(file.lastUid, top);
    file.uidValidity = uidValidity;
    if (added) writeJsonAtomic(outboxPath(cfg.dir), outbox);
    writeJsonAtomic(receivedPath(cfg.dir), file);
    return added;
  });
}

/** One fetch: the cursor read, the network outside the lock, the batch recorded under it. */
export async function fetchInto(cfg: MailConfig, mail: MailTransport): Promise<number> {
  if (!existsSync(receivedPath(cfg.dir)) && cfg.legacyCursor) init(cfg);
  const file = readFile(cfg.dir);
  let got = await mail.fetchSince(file.lastUid);
  if (file.uidValidity !== null && file.uidValidity !== got.uidValidity) got = await mail.fetchSince(0);
  return recordReceived(cfg, got.uidValidity, got.mails);
}

/** Replies from the person nothing could take: no thread, ambiguous, or to a question already archived. */
export const unmatched = (dir: string): Received[] =>
  readReceived(dir).filter(
    (r) =>
      (r.thread === null && r.why !== 'not-from-person') ||
      (r.why === 'archived-thread' && filterOutbox(dir, (e) => e.messageId === r.thread)[0]?.kind === 'question'),
  );
