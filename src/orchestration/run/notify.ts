// Notifications (Milestone 2, spec §4.5's email row, §10, §11): every new halt is emailed once per key; every mail the
// automation sends goes through the outbox, which records the intent (with the Message-ID it will carry) before the
// send and the result after. Delivery is at least once, never exactly once: a resend carries the same id, and a
// duplicate copy of any mail is harmless because its effect (a decision, a halt read) is keyed by the request or the
// halt, not by the copy. Operational state only, under .automation/ (gitignored).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, sha, writeJsonAtomic } from '../../shared/io';
import {
  type CorMailKind,
  type OutMail,
  type OutboxEntry,
  corResendDue,
  readCorOutbox,
  unsentCorOutbox,
} from '../../modules/mail';
import { redact } from '../../shared/redact';
import type { Mailer } from './mailer';
import type { Halt } from './journal';
import { AUTOMATION_DIR } from './runner';
import { type StatusRow, statusOf } from './status';

export { AUTOMATION_DIR };
export const NOTIFIED_FILE = 'notified.json';

export type OutboxKind = CorMailKind;
export type { OutboxEntry };

export const automationDir = (root = ROOT): string => {
  const d = join(root, AUTOMATION_DIR);
  mkdirSync(d, { recursive: true });
  return d;
};
export const readOutbox = (root = ROOT): OutboxEntry[] => readCorOutbox(root);

/** The first lines of every mail: what a reply to it does, so the person never answers the wrong one. */
export const REPLY_GUIDE: Record<OutboxKind, string> = {
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
  test: 'Reply with any words: this mail tests the round trip.',
  question: '', // the question is the whole mail: any words above the quote answer it
};
/** The mail with its reply guide first. */
export const withGuide = (kind: OutboxKind, out: Omit<OutMail, 'messageId'>): Omit<OutMail, 'messageId'> =>
  REPLY_GUIDE[kind] ? { ...out, text: `${REPLY_GUIDE[kind]}\n\n${out.text}` } : out;

/** Resend every entry that is due (unsent, attempts left, no live sender, quiet for ten minutes), with its recorded
 *  id; the caller re-renders the body (only a question stores one). Returns the ids resent. */
export async function flushOutbox(
  mail: Mailer,
  root = ROOT,
  now: () => number = Date.now,
  render: (e: OutboxEntry) => Omit<OutMail, 'messageId'> | null,
): Promise<string[]> {
  const resent: string[] = [];
  for (const e of corResendDue(now(), root)) {
    const body = render(e);
    try {
      if (!body) {
        await mail.skipAttempt(e.messageId, now); // nothing to resend it from: it runs out of attempts, the digest lists it
        continue;
      }
      await mail.sendTracked(body, e.kind as OutboxKind, { messageId: e.messageId, now });
    } catch {
      continue; // the next tick tries again, up to the cap
    }
    resent.push(e.messageId);
  }
  return resent;
}

/** Entries that were never sent after their attempts ran out: the digest lists them. */
export const unsentOutbox = (root = ROOT): OutboxEntry[] => unsentCorOutbox(root);

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
  mail: Mailer,
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
      await mail.sendTracked(
        renderHalt(r.topic, r.storyId, r.halt, a, { dir: r.dir, sessionId: opts.sessionOf?.(r) ?? null }, opts.secrets),
        'halt',
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
