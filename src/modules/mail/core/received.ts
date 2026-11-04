// The one inbound pipeline: IMAP -> fetchInto -> received.json -> consumers. `fetchInto` is the only reader of the
// mailbox and this file holds the only cursor; a consumer reads the store and keeps its own idea of what it has
// handled. A message is recorded once (by Message-ID, or by its content when it has none) and correlated once, when
// it is recorded: a later question never claims an earlier mail, and a re-read after a mailbox is renumbered adds
// nothing. The original source is kept beside the record.
// Retention: `archive` moves completed records out by month, so no live file grows without bound. Completed means nothing
// is owed: a question answered and acknowledged, another mail sent or out of attempts; a question still unanswered, or
// answered but not yet accepted, stays live at any age. Archives stay readable: lookups and correlation span them.
// ponytail: the received/*.eml sources are never pruned; prune by age when the folder is large.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, sha, writeJsonAtomic } from './io';
import { withMutex } from './mutex';
import {
  MAX_ATTEMPTS,
  archiveDir,
  filterOutbox,
  init,
  initHeld,
  lockPath,
  outboxPath,
  readOutbox,
  receivedPath,
} from './outbox';
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
      // The outbox is written before received.json, so a crash between them leaves this answer on the question with
      // the mail still unrecorded and the cursor unmoved: the refetch comes here again and must not add it twice.
      if (live?.kind === 'question' && !live.answers?.some((a) => (a.key ?? a.messageId) === key))
        (live.answers ??= []).push({
          messageId: m.messageId,
          ...(!m.messageId && { key }),
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
    archiveHeld(cfg);
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
export const RETENTION_DAYS = 90;
const monthOf = (iso: string) => iso.slice(0, 7);

/** Under the mutex: the archive is written first, so a crash in between leaves a record in both, never in neither. */
function archiveHeld(cfg: MailConfig): { outbox: number; received: number } {
  const cutoff = (cfg.now ?? Date.now)() - (cfg.retentionDays ?? RETENTION_DAYS) * 86_400_000;
  const old = (iso: string) => Date.parse(iso) < cutoff;
  const outbox = readOutbox(cfg.dir);
  const file = readFile(cfg.dir);
  const done = (e: OutboxEntry) =>
    e.kind === 'question'
      ? !!e.answers?.length && !!e.acknowledgedAt
      : !!e.sentAt || e.attempts >= (cfg.maxAttempts ?? MAX_ATTEMPTS);
  const movedOut = outbox.filter((e) => old(e.createdAt) && done(e));
  const liveIds = new Set(outbox.filter((e) => !movedOut.includes(e)).map((e) => e.messageId));
  const movedIn = file.received.filter(
    (r) => old(r.fetchedAt) && !(r.thread && liveIds.has(r.thread)) && !(cfg.keepReceived?.(r) ?? false),
  );
  if (!movedOut.length && !movedIn.length) return { outbox: 0, received: 0 };
  mkdirSync(archiveDir(cfg.dir), { recursive: true });
  const months = new Set([...movedOut.map((e) => monthOf(e.createdAt)), ...movedIn.map((r) => monthOf(r.fetchedAt))]);
  for (const month of months) {
    const path = join(archiveDir(cfg.dir), `${month}.json`);
    const a = readJson<{ outbox: OutboxEntry[]; received: Received[] }>(path) ?? { outbox: [], received: [] };
    const ids = new Set(a.outbox.map((e) => e.messageId));
    const keys = new Set(a.received.map((r) => r.key));
    a.outbox.push(...movedOut.filter((e) => monthOf(e.createdAt) === month && !ids.has(e.messageId)));
    a.received.push(...movedIn.filter((r) => monthOf(r.fetchedAt) === month && !keys.has(r.key)));
    writeJsonAtomic(path, a);
  }
  writeJsonAtomic(
    outboxPath(cfg.dir),
    outbox.filter((e) => !movedOut.includes(e)),
  );
  writeJsonAtomic(receivedPath(cfg.dir), { ...file, received: file.received.filter((r) => !movedIn.includes(r)) });
  return { outbox: movedOut.length, received: movedIn.length };
}

/** Moves completed records older than the retention period into archive/<YYYY-MM>.json. Every fetch runs it. */
export const archive = (cfg: MailConfig): { outbox: number; received: number } =>
  withMutex(lockPath(cfg.dir), () => {
    initHeld(cfg);
    return archiveHeld(cfg);
  });

export const unmatched = (dir: string): Received[] =>
  readReceived(dir).filter(
    (r) =>
      (r.thread === null && r.why !== 'not-from-person') ||
      (r.why === 'archived-thread' && filterOutbox(dir, (e) => e.messageId === r.thread)[0]?.kind === 'question'),
  );
