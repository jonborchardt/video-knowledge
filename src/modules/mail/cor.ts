// The Commonwealth adapter: what this project tells the reusable core. Paths under .automation/, addresses from
// automation.json, the mail kinds it uses, the legacy outbox it migrates, the transport from .env. Nothing below
// core/ knows any of this. Pure except corTransport (which only builds the client).
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson } from '../../shared/io';
import {
  type MailConfig,
  type MailServer,
  type MailTransport,
  type OutboxEntry,
  type Received,
  fileFakeMail,
  questions,
  statusOf,
  type QuestionState,
  type Question,
  filterOutbox,
  findOutbox,
  libraryTransport,
  readOutbox,
  readReceived,
  resendDue,
  unsentOutbox,
} from './core';

export const COR_MAIL_KINDS = [
  'halt',
  'digest',
  'draft-request',
  'release-request',
  'batch',
  'correction-request',
  'reply',
  'launch',
  'test',
  'question',
  'report',
] as const;
export type CorMailKind = (typeof COR_MAIL_KINDS)[number];

/** The first lines of every mail: what a reply to it does, so the person never answers the wrong one. */
export const COR_REPLY_GUIDES: Record<CorMailKind, string> = {
  'draft-request':
    'ACTION NEEDED. Reply OK on its own to accept this draft, or CHANGES: and one note per line. Any other first line is asked about, not applied.',
  'release-request':
    'ACTION NEEDED. Reply OK on its own (publish now), OK at <day time> (schedule, your time) or CHANGES: and one note per line; PAID OK on its own line approves the paid links. Any other first line is asked about, not applied.',
  'correction-request': 'ACTION NEEDED. Reply OK to release the correction, or CHANGES: and one note per line.',
  batch: 'ACTION NEEDED. Reply with lines like APPROVE <slug>, REJECT <slug>: <why>, APPROVE ALL or REJECT ALL: <why>.',
  halt: 'NO REPLY NEEDED. A status notice: replies to it are not read. If it asks for a decision, answer the draft or release mail it refers to.',
  digest: 'NO REPLY NEEDED. Replies to this mail are not read.',
  launch: 'NO REPLY NEEDED. Replies to this mail are not read; the Studio steps it lists are recorded by the CLI.',
  reply: 'NO REPLY NEEDED. An answer from the automation; replies to it are not read.',
  report: 'NO REPLY NEEDED. A completion report from the automation or an agent; replies to it are not read.',
  test: 'Reply with any words: this mail tests the round trip.',
  question: '', // the question is the whole mail: any words above the quote answer it
};

const automation = (root: string) => join(root, '.automation');
export const corMailDir = (root = ROOT): string => join(automation(root), 'mail');
const legacy = (root: string) => ({
  legacyOutbox: join(automation(root), 'outbox.json'),
  legacyMetaFields: ['request', 'topic', 'storyId'],
});

/** A reply threaded to a request the inbox adapter has not handled yet stays where the adapter reads it, at any age;
 *  a reply to a general question is the asking agent's, and the adapter never handles it. */
function unprocessedFormalReply(root: string, r: { key: string; thread: string | null }): boolean {
  if (!r.thread) return false;
  if (findCorOutbox((e) => e.messageId === r.thread, root)?.kind === 'question') return false;
  const handled = readJson<{ handled?: { messageId: string }[] }>(join(automation(root), 'inbox.json'))?.handled ?? [];
  return !handled.some((h) => h.messageId === r.key);
}

/** The core's configuration, or null when neither address is set: mail is not configured. */
export function corMailConfig(root: string, a: Automation, env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  const to = a.approvals.to || a.notifications.to;
  const from = a.approvals.from || env.MAIL_USER || a.notifications.to;
  if (!to || !from) return null;
  return {
    dir: corMailDir(root),
    ...legacy(root),
    legacyCursor: join(automation(root), 'inbox.json'),
    from,
    to,
    recipients: [a.approvals.to, a.notifications.to].filter(Boolean),
    subjectPrefix: '[CoR]',
    keepReceived: (r) => unprocessedFormalReply(root, r),
  };
}

/** `.env`: MAIL_SMTP_HOST, MAIL_SMTP_PORT (465), MAIL_IMAP_HOST, MAIL_IMAP_PORT (993), MAIL_USER, MAIL_PASSWORD. */
export function mailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MailServer | null {
  const smtpHost = env.MAIL_SMTP_HOST;
  const imapHost = env.MAIL_IMAP_HOST;
  const user = env.MAIL_USER;
  const password = env.MAIL_PASSWORD;
  if (!smtpHost || !imapHost || !user || !password) return null;
  return {
    smtpHost,
    smtpPort: Number(env.MAIL_SMTP_PORT) || 465,
    imapHost,
    imapPort: Number(env.MAIL_IMAP_PORT) || 993,
    user,
    password,
  };
}

/** The transport `.env` names, or the file-backed fake a test names; null when mail is not configured. */
export function corTransport(env: NodeJS.ProcessEnv = process.env): MailTransport | null {
  if (env.MAIL_FAKE) return fileFakeMail(env.MAIL_FAKE, `${env.MAIL_FAKE}.lock`);
  const c = mailConfigFromEnv(env);
  return c ? libraryTransport(c) : null;
}

// The read side for orchestration: the same entries before and after `mail init`.
export const readCorOutbox = (root = ROOT): OutboxEntry[] => readOutbox(corMailDir(root), legacy(root));
export const findCorOutbox = (pred: (e: OutboxEntry) => boolean, root = ROOT): OutboxEntry | null =>
  findOutbox(corMailDir(root), pred, legacy(root));
export const filterCorOutbox = (pred: (e: OutboxEntry) => boolean, root = ROOT): OutboxEntry[] =>
  filterOutbox(corMailDir(root), pred, legacy(root));
export const unsentCorOutbox = (root = ROOT): OutboxEntry[] => unsentOutbox(corMailDir(root), legacy(root));
export const corResendDue = (now: number, root = ROOT): OutboxEntry[] => resendDue(corMailDir(root), now, legacy(root));
export const readCorReceived = (root = ROOT): Received[] => readReceived(corMailDir(root));

/** What a person or a later session may need to act on: answers no consumer accepted yet, questions nobody is waiting
 *  on, and ones that never went. The digest and the live page show them; nothing acts on them by itself. */
export const openCorQuestions = (root = ROOT, now = Date.now()): (Question & QuestionState)[] =>
  questions(corMailDir(root), legacy(root))
    .map((q) => ({ ...q, ...statusOf(q, {}, now) }))
    .filter((q) => (q.status === 'answered' ? !q.seen : q.status !== 'awaiting' && q.status !== 'closed'));
