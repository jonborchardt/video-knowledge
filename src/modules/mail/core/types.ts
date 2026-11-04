// The core's contracts. Everything the core needs to know about its host arrives through MailConfig and a
// MailTransport; nothing here names a project, a workflow or a configuration file.

export interface MailConfig {
  /** Where the records live: outbox.json, received.json, received/*.eml, archive/, send/, lock/. */
  dir: string;
  /** A pre-core outbox file to migrate once (its entries normalised into this shape). */
  legacyOutbox?: string;
  /** Top-level fields of a pre-core entry that move under `meta`. */
  legacyMetaFields?: string[];
  /** A JSON file with `lastUid`: seeds the received cursor once, so an upgrade does not re-read the mailbox. */
  legacyCursor?: string;
  from: string;
  /** The person: the only address a question goes to and the only sender whose mail answers one. */
  to: string;
  /** Every address the core may send to (default: [to]). */
  recipients?: string[];
  /** Prepended to a question's subject (default: none). */
  subjectPrefix?: string;
  maxAttempts?: number; // 3
  resendAfterMs?: number; // 10 min
  retentionDays?: number; // 90
  /** A received record the host still needs live, whatever its age (a reply it has not processed yet). */
  keepReceived?: (r: { key: string; thread: string | null }) => boolean;
  attachmentLimit?: number; // 5 MiB
  now?: () => number;
  alive?: (pid: number) => boolean;
}

export interface OutMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
  messageId: string;
  attachments?: { name: string; contentType: string; data: Buffer }[];
}

export interface InMail {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: string;
  subject: string;
  text: string;
  html: string | null;
  date: string;
  raw?: string;
}

export interface MailTransport {
  send(m: OutMail): Promise<{ messageId: string }>;
  /** Everything after `sinceUid` in the mailbox, with the mailbox's UIDVALIDITY as a decimal string. */
  fetchSince(sinceUid: number): Promise<{ uidValidity: string; mails: InMail[] }>;
}

export interface Answer {
  messageId: string;
  from: string;
  at: string; // the mail's date
  recordedAt: string;
  text: string; // the person's own words
}

export interface OutboxEntry {
  messageId: string;
  kind: string;
  subject: string;
  to: string;
  from: string;
  createdAt: string;
  sentAt: string | null;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  /** The caller's correlation fields (a request id, a topic, a story), opaque to the core. */
  meta?: Record<string, string>;
  // kind 'question'
  id?: string;
  about?: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  waiter?: { pid: number; until: string };
  answers?: Answer[];
  acknowledgedAt?: string;
  /** The process sending this entry now; void when its pid is dead. */
  claim?: { pid: number; token: string; at: string };
}

export type Correlation =
  | { thread: string; why?: undefined }
  | { thread: null; why: 'not-from-person' | 'no-thread' | `ambiguous:${string}` | 'archived-thread' };
