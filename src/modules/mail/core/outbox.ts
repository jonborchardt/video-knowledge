// The outbox: every mail recorded with its Message-ID before the first attempt; delivery is at least once, never
// exactly once: SMTP may have accepted a copy before a crash, so a retry (same Message-ID) can deliver a duplicate,
// and a host keys any effect by what the mail is about, never by the copy. Every write runs under the one mutex with
// no network call inside. At most one live process sends an entry: the claim is taken under the mutex and is void
// once its pid is dead. `init` is the one migration of a pre-core outbox; a read never writes.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pidAlive, readJson, writeJsonAtomic } from './io';
import { withMutex } from './mutex';
import { address } from './thread';
import { messageIdOf } from './transport';
import type { MailConfig, MailTransport, OutboxEntry, OutMail, SendResult } from './types';

export const MAX_ATTEMPTS = 3;
export const RESEND_AFTER_MS = 600_000;
export const ATTACHMENT_LIMIT = 5 * 1024 * 1024;

/** A request the core refuses: nothing was written or sent. A CLI exits 2 on it. */
export class MailRefusal extends Error {
  exit = 2;
}

export const outboxPath = (dir: string): string => join(dir, 'outbox.json');
export const receivedPath = (dir: string): string => join(dir, 'received.json');
export const lockPath = (dir: string): string => join(dir, '.lock');
export const archiveDir = (dir: string): string => join(dir, 'archive');

type LegacyCfg = Pick<MailConfig, 'legacyOutbox' | 'legacyMetaFields'> & { from?: string };

/** One pre-core entry in this shape: the fields the host names move under `meta`, `from` and `lastAttemptAt` are
 *  filled, everything else stays as it is. An entry already in this shape comes back equal. */
export function normaliseLegacy(e: Record<string, unknown>, cfg: LegacyCfg): OutboxEntry {
  const out: Record<string, unknown> = { ...e };
  const meta: Record<string, string> = { ...(e.meta as Record<string, string> | undefined) };
  for (const f of cfg.legacyMetaFields ?? []) {
    if (typeof out[f] === 'string') meta[f] = out[f];
    delete out[f];
  }
  if (Object.keys(meta).length) out.meta = meta;
  out.from ??= cfg.from ?? '';
  out.lastAttemptAt ??= out.createdAt;
  return out as unknown as OutboxEntry;
}

const legacyEntries = (cfg: LegacyCfg): OutboxEntry[] | null => {
  if (!cfg.legacyOutbox || !existsSync(cfg.legacyOutbox)) return null;
  return (readJson<Record<string, unknown>[]>(cfg.legacyOutbox) ?? []).map((e) => normaliseLegacy(e, cfg));
};

/** The live entries: the outbox, or (before `init`) the legacy file through the normalisation. Never writes. */
export const readOutbox = (dir: string, cfg: LegacyCfg = {}): OutboxEntry[] =>
  readJson<OutboxEntry[]>(outboxPath(dir)) ?? legacyEntries(cfg) ?? [];

const archiveEntries = (dir: string): OutboxEntry[] => {
  if (!existsSync(archiveDir(dir))) return [];
  return readdirSync(archiveDir(dir))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .flatMap((f) => readJson<{ outbox?: OutboxEntry[] }>(join(archiveDir(dir), f))?.outbox ?? []);
};
/** Every entry `pred` accepts, live then archived (newest month first). */
export const filterOutbox = (dir: string, pred: (e: OutboxEntry) => boolean, cfg: LegacyCfg = {}): OutboxEntry[] => [
  ...readOutbox(dir, cfg).filter(pred),
  ...archiveEntries(dir).filter(pred),
];
export const findOutbox = (dir: string, pred: (e: OutboxEntry) => boolean, cfg: LegacyCfg = {}): OutboxEntry | null =>
  filterOutbox(dir, pred, cfg)[0] ?? null;

export interface InitReport {
  state: 'migrated' | 'present' | 'empty';
  entries: number;
  byKind: Record<string, number>;
}
const reportOf = (state: InitReport['state'], es: OutboxEntry[]): InitReport => ({
  state,
  entries: es.length,
  byKind: es.reduce<Record<string, number>>((n, e) => ({ ...n, [e.kind]: (n[e.kind] ?? 0) + 1 }), {}),
});
const migratedName = (legacy: string) => join(dirname(legacy), `${basename(legacy, '.json')}.migrated.json`);

/** Under the mutex. Idempotent and crash-safe: the new outbox appears atomically, then the legacy file moves aside;
 *  a re-run after any crash converges (an existing outbox wins, a leftover legacy file just moves). */
export function initHeld(cfg: MailConfig): InitReport {
  mkdirSync(cfg.dir, { recursive: true });
  let state: InitReport['state'] = 'empty';
  if (existsSync(outboxPath(cfg.dir))) state = 'present';
  else {
    const legacy = legacyEntries(cfg);
    if (legacy) {
      writeJsonAtomic(outboxPath(cfg.dir), legacy);
      state = 'migrated';
    }
  }
  if (cfg.legacyOutbox && existsSync(cfg.legacyOutbox)) renameSync(cfg.legacyOutbox, migratedName(cfg.legacyOutbox));
  if (cfg.legacyCursor && !existsSync(receivedPath(cfg.dir))) {
    const lastUid = readJson<{ lastUid?: number }>(cfg.legacyCursor)?.lastUid;
    if (lastUid) writeJsonAtomic(receivedPath(cfg.dir), { uidValidity: null, lastUid, received: [] });
  }
  return reportOf(state, readOutbox(cfg.dir));
}

/** The explicit initialisation (every mutation runs it too). A dry run computes the same report and touches nothing. */
export function init(cfg: MailConfig, opts: { dryRun?: boolean } = {}): InitReport {
  if (opts.dryRun) {
    if (existsSync(outboxPath(cfg.dir))) return reportOf('present', readOutbox(cfg.dir));
    const legacy = legacyEntries(cfg);
    return legacy ? reportOf('migrated', legacy) : reportOf('empty', []);
  }
  return withMutex(lockPath(cfg.dir), () => initHeld(cfg));
}

/** The only writer of the outbox. `fn` runs under the mutex: synchronous, no network. */
export function mutateOutbox(cfg: MailConfig, fn: (entries: OutboxEntry[]) => OutboxEntry[]): void {
  withMutex(lockPath(cfg.dir), () => {
    initHeld(cfg);
    writeJsonAtomic(outboxPath(cfg.dir), fn(readOutbox(cfg.dir)));
  });
}

const nowOf = (cfg: MailConfig) => (cfg.now ?? Date.now)();
const iso = (cfg: MailConfig) => new Date(nowOf(cfg)).toISOString();
const maxOf = (cfg?: Pick<MailConfig, 'maxAttempts'>) => cfg?.maxAttempts ?? MAX_ATTEMPTS;
const domainOf = (from: string) => address(from).split('@')[1] || 'mail.invalid';
const recipientsOf = (cfg: MailConfig) => (cfg.recipients ?? [cfg.to]).map(address);

export interface RecordExtra {
  meta?: Record<string, string>;
  id?: string;
  about?: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  waiter?: OutboxEntry['waiter'];
}

/** The entry, before any attempt. An address outside the recipients is refused, nothing written. */
export function recordOutgoing(
  cfg: MailConfig,
  out: Omit<OutMail, 'messageId'>,
  kind: string,
  extra: RecordExtra = {},
): OutboxEntry {
  if (!recipientsOf(cfg).includes(address(out.to))) throw new MailRefusal(`${out.to} is not a recipient`);
  const messageId = messageIdOf(domainOf(out.from));
  const entry: OutboxEntry = {
    messageId,
    kind,
    subject: out.subject,
    to: out.to,
    from: out.from,
    createdAt: iso(cfg),
    sentAt: null,
    attempts: 0,
    ...extra,
  };
  mutateOutbox(cfg, (es) => [...es, entry]);
  return entry;
}

/** One attempt: takes the claim and counts the attempt under the mutex, sends outside it, records the outcome under
 *  it. Anything but 'sent' means nothing was sent because of what another process did or is doing: 'claimed' a live
 *  sender holds it, 'already-sent' one finished, 'exhausted' none has attempts left. A claim whose pid is dead is void. */
export async function attemptSend(
  cfg: MailConfig,
  mail: MailTransport,
  messageId: string,
  out: Omit<OutMail, 'messageId'>,
): Promise<'sent' | 'claimed' | 'already-sent' | 'exhausted'> {
  const alive = cfg.alive ?? pidAlive;
  const token = randomUUID();
  let outcome: 'claimed' | 'already-sent' | 'exhausted' | null = null;
  mutateOutbox(cfg, (es) => {
    const e = es.find((x) => x.messageId === messageId);
    if (!e) throw new MailRefusal(`unknown message ${messageId}`);
    if (e.sentAt) outcome = 'already-sent';
    else if (e.claim && alive(e.claim.pid)) outcome = 'claimed';
    else if (e.attempts >= maxOf(cfg)) outcome = 'exhausted';
    if (outcome) return es;
    e.claim = { pid: process.pid, token, at: iso(cfg) };
    e.attempts += 1;
    e.lastAttemptAt = iso(cfg);
    return es;
  });
  if (outcome) return outcome;
  const settle = (fn: (e: OutboxEntry) => void) =>
    mutateOutbox(cfg, (es) => {
      const e = es.find((x) => x.messageId === messageId);
      if (e) {
        fn(e);
        if (e.claim?.token === token) delete e.claim;
      }
      return es;
    });
  let r: SendResult;
  try {
    r = await mail.send({ ...out, messageId });
  } catch (err) {
    settle((e) => {
      e.lastError = (err as Error).message;
    });
    throw err;
  }
  // one recipient per message (validateSend): accepted means that address accepted and nothing rejected
  const to = address(out.to);
  const smtp = {
    ...(r.response !== undefined && { response: r.response.slice(0, 200) }),
    accepted: (r.accepted ?? [to]).map(address),
    rejected: (r.rejected ?? []).map(address),
  };
  if (!smtp.accepted.includes(to) || smtp.rejected.length) {
    const why = `rejected by the server: ${r.response ?? smtp.rejected.join(', ')}`;
    settle((e) => {
      e.lastError = why;
      e.smtp = smtp;
    });
    throw new Error(why);
  }
  settle((e) => {
    e.sentAt = iso(cfg);
    delete e.lastError;
    e.smtp = smtp;
  });
  return 'sent';
}

export interface SendExtra extends RecordExtra {
  /** A resend of this recorded entry. */
  messageId?: string;
}
/** Record and attempt; with `extra.messageId`, attempt the recorded entry. Another live sender is a refusal here. */
export async function sendTracked(
  cfg: MailConfig,
  mail: MailTransport,
  out: Omit<OutMail, 'messageId'>,
  kind: string,
  extra: SendExtra = {},
): Promise<{ messageId: string }> {
  const { messageId: resend, ...record } = extra;
  const messageId = resend ?? recordOutgoing(cfg, out, kind, record).messageId;
  const outcome = await attemptSend(cfg, mail, messageId, out);
  if (outcome === 'claimed') {
    const pid = readOutbox(cfg.dir).find((e) => e.messageId === messageId)?.claim?.pid;
    throw new MailRefusal(`CLAIMED by pid ${pid}: ${messageId} is being sent`);
  }
  if (outcome === 'already-sent') throw new MailRefusal(`${messageId} is already sent`);
  if (outcome === 'exhausted') throw new MailRefusal(`${messageId} is out of attempts`);
  return { messageId };
}

/** An attempt with nothing to send (the host cannot re-render the body): the entry runs out of attempts and is listed. */
export function skipAttempt(cfg: MailConfig, messageId: string, why = 'nothing to send it from'): void {
  mutateOutbox(cfg, (es) => {
    const e = es.find((x) => x.messageId === messageId);
    if (!e) throw new MailRefusal(`unknown message ${messageId}`);
    e.attempts += 1;
    e.lastAttemptAt = iso(cfg);
    e.lastError = why;
    return es;
  });
}

/** Never sent and out of attempts: what a host lists for a person. */
export const unsentOutbox = (dir: string, cfg: LegacyCfg & Pick<MailConfig, 'maxAttempts'> = {}): OutboxEntry[] =>
  readOutbox(dir, cfg).filter((e) => !e.sentAt && e.attempts >= maxOf(cfg));

/** A question closed as moot: its last history entry is a close. */
export const isClosed = (e: OutboxEntry): boolean => e.history?.at(-1)?.action === 'close';

/** Unsent, unanswered, attempts left, no live sender, and quiet for the resend interval. */
export const resendDue = (
  dir: string,
  now: number,
  cfg: LegacyCfg & Pick<MailConfig, 'maxAttempts' | 'resendAfterMs' | 'alive'> = {},
): OutboxEntry[] => {
  const alive = cfg.alive ?? pidAlive;
  return readOutbox(dir, cfg).filter(
    (e) =>
      !e.sentAt &&
      !e.answers?.length && // the reply proves it arrived, whatever the record says
      e.attempts < maxOf(cfg) &&
      !(e.claim && alive(e.claim.pid)) &&
      now - Date.parse(e.lastAttemptAt ?? e.createdAt) >= (cfg.resendAfterMs ?? RESEND_AFTER_MS),
  );
};

/** A question carries its own body, so anything can resend it. */
export const questionMail = (e: OutboxEntry): Omit<OutMail, 'messageId'> => ({
  from: e.from,
  to: e.to,
  subject: e.subject,
  text: e.text ?? '',
  ...(e.inReplyTo && { inReplyTo: e.inReplyTo }),
  ...(e.references && { references: e.references }),
});

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const refuse = (why: string): never => {
  throw new MailRefusal(`invalid message: ${why}`);
};
/** A message from outside the process (a file), checked whole before any state changes. */
export function validateSend(
  v: unknown,
  cfg: MailConfig,
): Omit<OutMail, 'messageId'> & { kind: string; meta?: Record<string, string> } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return refuse('not an object');
  const m = v as Record<string, unknown>;
  for (const f of ['kind', 'from', 'to', 'subject', 'text'])
    if (typeof m[f] !== 'string' || !m[f]) refuse(`${f} must be a non-empty string`);
  const to = m.to as string;
  if (!recipientsOf(cfg).includes(address(to))) refuse(`${to} is not a recipient`);
  if (m.html !== undefined && typeof m.html !== 'string') refuse('html must be a string');
  if (m.inReplyTo !== undefined && typeof m.inReplyTo !== 'string') refuse('inReplyTo must be a string');
  if (m.references !== undefined && !isStrings(m.references)) refuse('references must be strings');
  if (m.meta !== undefined) {
    if (typeof m.meta !== 'object' || m.meta === null || !isStrings(Object.values(m.meta)))
      refuse('meta must map to strings');
  }
  const raw = (m.attachments ?? []) as { name?: unknown; contentType?: unknown; data?: unknown }[];
  if (!Array.isArray(raw)) refuse('attachments must be a list');
  const attachments = raw.map((a) => {
    if (typeof a?.name !== 'string' || typeof a.contentType !== 'string' || typeof a.data !== 'string')
      return refuse('each attachment needs a name, a contentType and base64 data');
    return { name: a.name, contentType: a.contentType, data: Buffer.from(a.data, 'base64') };
  });
  const size = attachments.reduce((n, a) => n + a.data.length, 0);
  if (size > (cfg.attachmentLimit ?? ATTACHMENT_LIMIT)) refuse(`attachments of ${size} bytes are over the limit`);
  return {
    kind: m.kind as string,
    from: m.from as string,
    to,
    subject: m.subject as string,
    text: m.text as string,
    ...(m.html !== undefined && { html: m.html as string }),
    ...(m.inReplyTo !== undefined && { inReplyTo: m.inReplyTo as string }),
    ...(m.references !== undefined && { references: m.references as string[] }),
    ...(m.meta !== undefined && { meta: m.meta as Record<string, string> }),
    ...(attachments.length && { attachments }),
  };
}
