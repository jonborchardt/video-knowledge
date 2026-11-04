// The Commonwealth adapter: what this project tells the reusable core. Paths under .automation/, addresses from
// automation.json, the mail kinds it uses, the legacy outbox it migrates, the transport from .env. Nothing below
// core/ knows any of this. Pure except corTransport (which only builds the client).
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT } from '../../shared/io';
import {
  type MailConfig,
  type MailServer,
  type MailTransport,
  type OutboxEntry,
  type Received,
  fileFakeMail,
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
] as const;
export type CorMailKind = (typeof COR_MAIL_KINDS)[number];

const automation = (root: string) => join(root, '.automation');
export const corMailDir = (root = ROOT): string => join(automation(root), 'mail');
const legacy = (root: string) => ({
  legacyOutbox: join(automation(root), 'outbox.json'),
  legacyMetaFields: ['request', 'topic', 'storyId'],
});

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
