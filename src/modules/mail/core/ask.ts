// A question: an outbox entry with an expected reply. `ask` records it, sends it, and blocks on the one inbound
// pipeline until a reply is recorded or the caller's patience runs out. A timeout stops the waiter, never the
// question: any later fetch records the reply and `resume` waits again. Receipt and acknowledgment are separate: an
// answer is durable once recorded and stays unseen until the consumer says it accepted it (`acknowledge`), so a
// caller that dies with the answer in hand loses nothing. The module returns the person's words and never reads them.
// ponytail: the wait polls by sleeping; IMAP IDLE when a minute is too slow.
import { randomUUID } from 'node:crypto';
import { pidAlive, sha } from './io';
import {
  MAX_ATTEMPTS,
  MailRefusal,
  attemptSend,
  findOutbox,
  mutateOutbox,
  questionMail,
  readOutbox,
  recordOutgoing,
  isClosed,
} from './outbox';
import { fetchInto } from './received';
import type { MailConfig, MailTransport, OutboxEntry } from './types';

export type Question = OutboxEntry & { kind: 'question'; id: string };
export type QuestionStatus = 'unsent' | 'failed' | 'awaiting' | 'unattended' | 'answered' | 'closed';
export interface QuestionState {
  status: QuestionStatus;
  /** The first answer came after the waiter's time, or with no waiter at all. */
  late: boolean;
  /** A consumer accepted the answer. */
  seen: boolean;
}

/** Derived, never stored. */
export function statusOf(q: OutboxEntry, cfg: Pick<MailConfig, 'alive' | 'maxAttempts'>, now: number): QuestionState {
  const seen = !!q.acknowledgedAt;
  // closed as moot: whatever arrives after is kept on the entry and shown, but nothing is actionable until reopened
  if (isClosed(q)) return { status: 'closed', late: false, seen };
  const first = q.answers?.[0];
  if (first) return { status: 'answered', late: !q.waiter || first.recordedAt > q.waiter.until, seen };
  const base = { late: false, seen };
  const alive = cfg.alive ?? pidAlive;
  if (!q.sentAt) {
    // out of attempts is only final once nobody is still on the last one
    const sending = q.claim && alive(q.claim.pid);
    return { status: q.attempts >= (cfg.maxAttempts ?? MAX_ATTEMPTS) && !sending ? 'failed' : 'unsent', ...base };
  }
  const waiting = q.waiter && alive(q.waiter.pid) && now < Date.parse(q.waiter.until);
  return { status: waiting ? 'awaiting' : 'unattended', ...base };
}

export const questions = (dir: string, cfg: Pick<MailConfig, 'legacyOutbox' | 'legacyMetaFields'> = {}): Question[] =>
  readOutbox(dir, cfg).filter((e): e is Question => e.kind === 'question' && !!e.id);

const unknown = (id: string): never => {
  throw new MailRefusal(`unknown question ${id}`);
};

/** The consumer accepted the answer: it leaves the unseen list. Idempotent; the note says what the answer caused. */
export function acknowledge(cfg: MailConfig, id: string, note?: string): void {
  mutateOutbox(cfg, (es) => {
    const q = es.find((e) => e.kind === 'question' && e.id === id) ?? unknown(id);
    q.acknowledgedAt ??= new Date((cfg.now ?? Date.now)()).toISOString();
    if (note?.trim()) q.acknowledgedNote = note.trim();
    return es;
  });
}

const decision = (by: string, note: string): { by: string; note: string } => {
  if (!note.trim()) throw new MailRefusal('a close or reopen needs --note saying why');
  if (!by.trim()) throw new MailRefusal('a close or reopen names who decided it (--by)');
  return { by: by.trim(), note: note.trim() };
};
/** Closes a question nobody will answer, or whose answer no longer matters: it leaves every open list and archives
 *  as completed. Nothing is pretended answered; a reply that comes later is still recorded and shown. Idempotent. */
export function close(cfg: MailConfig, id: string, o: { by: string; note: string }): void {
  const d = decision(o.by, o.note);
  mutateOutbox(cfg, (es) => {
    const q = es.find((e) => e.kind === 'question' && e.id === id) ?? unknown(id);
    if (!isClosed(q))
      (q.history ??= []).push({ at: new Date((cfg.now ?? Date.now)()).toISOString(), action: 'close', ...d });
    return es;
  });
}
/** The explicit way back: a closed question becomes what its answers make it (answered and unseen, or open). */
export function reopen(cfg: MailConfig, id: string, o: { by: string; note: string }): void {
  const d = decision(o.by, o.note);
  mutateOutbox(cfg, (es) => {
    const q = es.find((e) => e.kind === 'question' && e.id === id) ?? unknown(id);
    if (!isClosed(q)) throw new MailRefusal(`${id} is not closed`);
    q.history!.push({ at: new Date((cfg.now ?? Date.now)()).toISOString(), action: 'reopen', ...d });
    return es;
  });
}

export interface AskInput {
  subject: string;
  text: string;
  /** The caller's work item, free text; a follow-up inherits it. */
  about?: string;
  /** A question id: this one continues its thread and reuses its subject (mail clients thread by subject too). */
  replyTo?: string;
}
export interface AskOpts {
  timeoutMs: number;
  pollMs: number;
  sleep?: (ms: number) => Promise<void>;
  pid?: number;
  onAsked?: (q: OutboxEntry) => void;
  /** Once per distinct message: the wait goes on through a mailbox outage. */
  onFetchError?: (message: string) => void;
}

const byId = (dir: string, id: string) => findOutbox(dir, (e) => e.kind === 'question' && e.id === id);

function record(cfg: MailConfig, input: AskInput, waiter: OutboxEntry['waiter']): OutboxEntry {
  const parent = input.replyTo ? (byId(cfg.dir, input.replyTo) ?? unknown(input.replyTo)) : null;
  const id = `qn-${sha(randomUUID()).slice(0, 12)}`;
  const prefix = cfg.subjectPrefix ? `${cfg.subjectPrefix} ` : '';
  const subject = parent ? `Re: ${parent.subject.replace(/^Re:\s*/i, '')}` : `${prefix}${input.subject} ${id}`;
  const about = input.about ?? parent?.about;
  return recordOutgoing(cfg, { from: cfg.from, to: cfg.to, subject, text: input.text }, 'question', {
    id,
    text: input.text,
    waiter,
    ...(about && { about }),
    ...(parent && {
      inReplyTo: parent.messageId,
      references: [...(parent.references ?? []), parent.messageId],
    }),
  });
}

/** Sends the question if it still needs sending and waits on the store. `answered: false` means the wait ended (the
 *  time ran out, or the send failed for good: see `statusOf`), never that the question is over. */
export async function ask(
  cfg: MailConfig,
  mail: MailTransport,
  input: AskInput | { resume: string },
  opts: AskOpts,
): Promise<{ question: OutboxEntry; answered: boolean }> {
  const now = cfg.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const until = now() + opts.timeoutMs;
  const waiter = { pid: opts.pid ?? process.pid, until: new Date(until).toISOString() };
  let messageId: string;
  if ('resume' in input) {
    const found = byId(cfg.dir, input.resume) ?? unknown(input.resume);
    if (found.answers?.length) return { question: found, answered: true }; // keeps its original waiter: still late
    mutateOutbox(cfg, (es) => es.map((e) => (e.messageId === found.messageId ? { ...e, waiter } : e)));
    messageId = found.messageId;
    opts.onAsked?.(found);
  } else {
    const q = record(cfg, input, waiter);
    messageId = q.messageId;
    opts.onAsked?.(q);
  }
  const current = () => readOutbox(cfg.dir).find((e) => e.messageId === messageId)!;
  const reported = new Set<string>();
  for (;;) {
    // durable state first: an answer already stored needs neither the mail server nor a working mailbox
    const q = current();
    if (q.answers?.length) return { question: q, answered: true };
    if (!q.sentAt && q.attempts < (cfg.maxAttempts ?? MAX_ATTEMPTS)) {
      // Whatever this answers (another live sender, one that just finished) the next read of the entry shows, and a
      // transport failure is recorded on it: the wait goes on, and the next poll tries again with the same id.
      await attemptSend(cfg, mail, messageId, questionMail(q)).catch(() => {});
    }
    if (statusOf(current(), cfg, now()).status === 'failed') return { question: current(), answered: false };
    if (opts.timeoutMs === 0) return { question: current(), answered: false };
    try {
      await fetchInto(cfg, mail);
    } catch (e) {
      const m = (e as Error).message;
      if (!reported.has(m)) opts.onFetchError?.(m);
      reported.add(m);
    }
    if (current().answers?.length) return { question: current(), answered: true };
    if (now() >= until) return { question: current(), answered: false };
    await sleep(opts.pollMs);
  }
}
