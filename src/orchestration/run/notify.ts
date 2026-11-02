// Notifications (Milestone 2, spec §4.5's email row, §10, §11): every new halt is emailed once per key; every mail the
// automation sends goes through the outbox, which records the intent (with the Message-ID it will carry) before the
// send and the result after. Delivery is at least once, never exactly once: a resend carries the same id, and a
// duplicate copy of any mail is harmless because its effect (a decision, a halt read) is keyed by the request or the
// halt, not by the copy. Operational state only, under .automation/ (gitignored).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, sha, writeJsonAtomic } from '../../shared/io';
import { type MailTransport, type OutMail, messageIdOf, redact } from '../../shared/mail';
import type { Halt } from './journal';
import { AUTOMATION_DIR } from './runner';
import { type StatusRow, statusOf } from './status';

export { AUTOMATION_DIR };
export const OUTBOX_FILE = 'outbox.json';
export const NOTIFIED_FILE = 'notified.json';
export const RESEND_AFTER_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

export type OutboxKind =
  | 'halt'
  | 'digest'
  | 'draft-request'
  | 'release-request'
  | 'batch'
  | 'correction-request'
  | 'reply'
  | 'launch'
  | 'test';

export interface OutboxEntry {
  messageId: string;
  kind: OutboxKind;
  subject: string;
  to: string;
  request?: string;
  topic?: string;
  storyId?: string;
  createdAt: string;
  sentAt: string | null;
  attempts: number;
}

export const automationDir = (root = ROOT): string => {
  const d = join(root, AUTOMATION_DIR);
  mkdirSync(d, { recursive: true });
  return d;
};
export const readOutbox = (root = ROOT): OutboxEntry[] =>
  readJson<OutboxEntry[]>(join(automationDir(root), OUTBOX_FILE)) ?? [];
const writeOutbox = (root: string, entries: OutboxEntry[]) =>
  writeJsonAtomic(join(automationDir(root), OUTBOX_FILE), entries);

const domainOf = (from: string): string => from.split('@')[1]?.replace(/>$/, '') || 'commonwealthofreason.com';

/** Two-phase send: the entry (with its Message-ID) is on disk before the first attempt; `sentAt` follows the send. A
 *  crash in between leaves an unsent entry that flushOutbox resends with the same id. */
export async function sendTracked(
  mail: MailTransport,
  out: Omit<OutMail, 'messageId'>,
  kind: OutboxKind,
  root = ROOT,
  extra: { request?: string; topic?: string; storyId?: string; now?: () => number } = {},
): Promise<{ messageId: string }> {
  const now = extra.now ?? Date.now;
  const messageId = messageIdOf(domainOf(out.from));
  const entry: OutboxEntry = {
    messageId,
    kind,
    subject: out.subject,
    to: out.to,
    ...(extra.request && { request: extra.request }),
    ...(extra.topic && { topic: extra.topic }),
    ...(extra.storyId && { storyId: extra.storyId }),
    createdAt: new Date(now()).toISOString(),
    sentAt: null,
    attempts: 1,
  };
  writeOutbox(root, [...readOutbox(root), entry]);
  await mail.send({ ...out, messageId });
  writeOutbox(
    root,
    readOutbox(root).map((e) => (e.messageId === messageId ? { ...e, sentAt: new Date(now()).toISOString() } : e)),
  );
  return { messageId };
}

/** Resend every entry without `sentAt` older than ten minutes, with its recorded id, at most three attempts; the
 *  caller re-renders the body (the outbox stores none). Returns the ids resent. */
export async function flushOutbox(
  mail: MailTransport,
  root = ROOT,
  now: () => number = Date.now,
  render: (e: OutboxEntry) => Omit<OutMail, 'messageId'> | null,
): Promise<string[]> {
  const resent: string[] = [];
  for (const e of readOutbox(root)) {
    if (e.sentAt || e.attempts >= MAX_ATTEMPTS) continue;
    if (now() - Date.parse(e.createdAt) < RESEND_AFTER_MS) continue;
    writeOutbox(
      root,
      readOutbox(root).map((x) => (x.messageId === e.messageId ? { ...x, attempts: x.attempts + 1 } : x)),
    );
    const body = render(e);
    if (!body) continue; // nothing to resend it from: it runs out of attempts and the digest lists it
    try {
      await mail.send({ ...body, messageId: e.messageId });
    } catch {
      continue; // the next tick tries again, up to the cap
    }
    writeOutbox(
      root,
      readOutbox(root).map((x) => (x.messageId === e.messageId ? { ...x, sentAt: new Date(now()).toISOString() } : x)),
    );
    resent.push(e.messageId);
  }
  return resent;
}

/** Entries that were never sent after their attempts ran out: the digest lists them. */
export const unsentOutbox = (root = ROOT): OutboxEntry[] =>
  readOutbox(root).filter((e) => !e.sentAt && e.attempts >= MAX_ATTEMPTS);

export const haltKey = (topic: string, storyId: string, h: Pick<Halt, 'kind' | 'why'>): string =>
  sha(`${topic}\n${storyId}\n${h.kind}\n${h.why}`).slice(0, 12);

/** The secrets a mail body must never carry: every value of a secret family in the environment. */
export const secretsOf = (env: NodeJS.ProcessEnv = process.env): string[] =>
  Object.entries(env)
    .filter(([k]) => /^(MAIL_|X_|AZURE_|YOUTUBE_|APPROVAL_|OPENAI_|ANTHROPIC_)/.test(k))
    .map(([, v]) => v ?? '')
    .filter((v) => v.length >= 4);

export function renderHalt(
  topic: string,
  storyId: string,
  h: Halt,
  a: Automation,
  row?: Pick<StatusRow, 'dir'> & { sessionId?: string | null },
  secrets: string[] = secretsOf(),
): Omit<OutMail, 'messageId'> {
  const clean = (s: string) => redact(s, secrets);
  const unblock =
    h.unblock.kind === 'run' || h.unblock.kind === 'fix'
      ? ['```', clean(h.unblock.text), '```']
      : [clean(h.unblock.text)];
  const lines = [
    `${topic} / ${storyId} is blocked at ${h.stage}: ${h.kind}.`,
    '',
    clean(h.why),
    '',
    `It holds the ${h.stage} column until this is done:`,
    ...unblock,
    '',
    ...(row?.dir ? [`Run folder: ${row.dir}`] : []),
    ...(row?.sessionId ? [`Last agent session: ${row.sessionId}`] : []),
    `Halted at ${h.at} (run ${h.runId}; the board said ${h.board.stage}: ${clean(h.board.next)}).`,
  ];
  return {
    from: a.approvals.from || a.notifications.to,
    to: a.notifications.to,
    subject: `[CoR] blocked: ${topic}/${storyId} (${h.kind})`,
    text: lines.join('\n'),
  };
}

interface Notified {
  [key: string]: { at: string; topic: string; storyId: string; kind: string };
}
const notifiedPath = (root: string) => join(automationDir(root), NOTIFIED_FILE);

/** Email every halt whose key is new; forget keys whose halt is gone so a recurrence is emailed again. */
export async function notifyHalts(
  a: Automation,
  mail: MailTransport,
  root = ROOT,
  opts: {
    now?: () => number;
    rows?: StatusRow[];
    secrets?: string[];
    sessionOf?: (r: StatusRow) => string | null;
    /** false on a partial pass (a failed preflight): keys of halts not in `rows` are kept, not treated as resolved. */
    prune?: boolean;
  } = {},
): Promise<string[]> {
  const now = opts.now ?? Date.now;
  const rows = opts.rows ?? statusOf(root);
  const notified: Notified = readJson<Notified>(notifiedPath(root)) ?? {};
  const current = new Set<string>();
  const sent: string[] = [];
  for (const r of rows) {
    if (!r.halt || r.halt.retryable) continue; // a retryable halt resumes by itself; retries-spent is emailed
    const key = haltKey(r.topic, r.storyId, r.halt);
    current.add(key);
    if (notified[key]) continue;
    try {
      await sendTracked(
        mail,
        renderHalt(r.topic, r.storyId, r.halt, a, { dir: r.dir, sessionId: opts.sessionOf?.(r) ?? null }, opts.secrets),
        'halt',
        root,
        { now },
      );
    } catch {
      // the outbox entry exists with its id: flushOutbox resends it; a second copy with a new id is never made
    }
    notified[key] = { at: new Date(now()).toISOString(), topic: r.topic, storyId: r.storyId, kind: r.halt.kind };
    writeJsonAtomic(notifiedPath(root), notified); // per halt: a crash between two sends loses no key
    sent.push(key);
  }
  if (opts.prune !== false) for (const key of Object.keys(notified)) if (!current.has(key)) delete notified[key];
  writeJsonAtomic(notifiedPath(root), notified);
  return sent;
}
