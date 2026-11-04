// npm run mail -- <verb>
//   ask "<subject>" (--text "<question>" | --text-file <path>) [--about <ref>] [--reply-to <qn-id>] [--timeout <minutes>=60] [--poll <seconds>=60] [--json]
//       one question to the approver (automation.json approvals.to, else notifications.to; there is no way to name another
//       recipient). Blocks: run it in the background and go on with what does not depend on the answer. Prints ASKED <id>
//       <message-id> <to>, then ANSWER <id> <n> <date> and every reply's own words, exit 0. The reply is the person's words
//       for the caller to reason about, never an authorisation. NO ANSWER <id> after <n> minutes exits 1 and the question
//       stays open; SEND FAILED <id> <error> exits 1. --timeout 0 sends and returns, exit 0. --reply-to threads a follow-up
//       under an earlier question and reuses its subject.
//   ask --resume <qn-id> [--timeout] [--poll] [--json]   an answer already stored comes back with no mailbox needed; otherwise wait again
//                                                        (RESUMED <id>), sending it first if it never went, and waiting on any other live sender
//   questions [--about <ref>] [--status unsent|failed|awaiting|unattended|answered] [--unseen] [--fetch] [--json]
//       what is open or answered, and the replies that matched nothing; --unseen: answers no consumer accepted yet
//   questions --ack <qn-id>                              the consumer accepted the answer: it leaves --unseen
//   test [--await-reply] [--poll <seconds>=20]           one question through the outbox; with the flag waits ten minutes and
//                                                        saves the reply as tests/fixtures/mail/reply-<date>-<uid>.eml, addresses replaced
//   init [--dry-run]                                     the one migration of the legacy outbox: INIT <migrated|present|empty> <n> entries, <r> with a request; --dry-run writes nothing
//   send --file <path.json> [--message-id <id>]          one message from a file (kind, from, to, subject, text; html, inReplyTo, references, meta, attachments as base64 optional):
//                                                        records it, sends it, prints SENT <message-id>; --message-id resends the recorded entry with its id
//   send --skip --message-id <id>                        one attempt with nothing sent, for an entry nothing can re-render
//   fetch                                                the only reader of the mailbox: new mail into the received store, each message once, correlated once: FETCHED <n>; exit 1 when unreachable
// A refusal exits 2 and writes nothing (not configured, a malformed file, a recipient outside automation.json, an unknown,
// sent or exhausted entry, CLAIMED by pid <n> while another live process sends it); a transport failure exits 1 with the
// entry left unsent for a later attempt. Delivery is at least once: a retry reuses the Message-ID and may duplicate a copy.
// MAIL_FAKE=<state file> (tests only): a file-backed fake mailbox instead of the network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAutomation } from '../../shared/automation';
import { ROOT, loadDotEnv } from '../../shared/io';
import { COR_MAIL_KINDS, type CorMailKind, corMailConfig, corTransport, readCorOutbox } from './cor';
import {
  type MailConfig,
  type MailTransport,
  type OutboxEntry,
  MailRefusal,
  acknowledge,
  ask,
  fetchInto,
  findOutbox,
  init,
  questions,
  readReceived,
  sendTracked,
  skipAttempt,
  statusOf,
  unmatched,
  validateSend,
} from './core';

loadDotEnv();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (name: string) => rest.includes(name);
const refuse = (why: string): never => {
  throw new MailRefusal(why);
};
const transport = (): MailTransport =>
  corTransport() ??
  refuse('mail is not configured: MAIL_SMTP_HOST, MAIL_IMAP_HOST, MAIL_USER and MAIL_PASSWORD in .env');
/** A number of at least `min`, or a refusal: a bad --poll would otherwise log into the mailbox in a tight loop. */
const numeric = (name: string, dflt: number, min: number): number => {
  const v = Number(flag(name) ?? dflt);
  return Number.isFinite(v) && v >= min ? v : refuse(`${name} must be a number of at least ${min}`);
};
const minutes = (name: string, dflt: number) => numeric(name, dflt, 0) * 60_000;
const seconds = (name: string, dflt: number) => numeric(name, dflt, 1) * 1000;
const withState = (q: OutboxEntry, cfg: MailConfig) => ({ ...q, ...statusOf(q, cfg, Date.now()) });

function printAnswer(q: OutboxEntry): void {
  const answers = q.answers ?? [];
  console.log(`ANSWER ${q.id} ${answers.length} ${answers[0].at}`);
  answers.forEach((a, i) => console.log(`--- answer ${i + 1} ${a.at}\n${a.text}`));
  console.log(`--- once you have accepted this for processing: npm run mail -- questions --ack ${q.id}`);
}

const ASK_FLAGS = ['--text', '--text-file', '--about', '--reply-to', '--timeout', '--poll', '--resume', '--json'];

async function askVerb(cfg: MailConfig): Promise<void> {
  for (const f of rest.filter((a) => a.startsWith('--')))
    if (!ASK_FLAGS.includes(f)) refuse(`ask takes no ${f}: the recipient is always the approver`);
  const resume = flag('--resume');
  const file = flag('--text-file');
  const text = flag('--text') ?? (file ? readFileSync(file, 'utf8') : undefined);
  const subject = rest[0]?.startsWith('--') ? undefined : rest[0];
  const replyTo = flag('--reply-to');
  if (!resume) {
    if (!text) refuse('ask needs --text or --text-file');
    if (!subject && !replyTo) refuse('ask needs a subject');
  }
  const timeoutMs = minutes('--timeout', 60);
  const about = flag('--about');
  const report = (q: OutboxEntry) => {
    if (has('--json')) console.log(JSON.stringify(withState(q, cfg), null, 1));
    else printAnswer(q);
  };
  // an answer already stored needs no mailbox, and no mail configuration
  const stored = resume ? findOutbox(cfg.dir, (e) => e.kind === 'question' && e.id === resume, cfg) : null;
  if (stored?.answers?.length) return report(stored);
  const { question, answered } = await ask(
    cfg,
    transport(),
    resume ? { resume } : { subject: subject ?? '', text: text!, ...(about && { about }), ...(replyTo && { replyTo }) },
    {
      timeoutMs,
      pollMs: seconds('--poll', 60),
      onAsked: (q) => console.log(resume ? `RESUMED ${q.id}` : `ASKED ${q.id} ${q.messageId} ${q.to}`),
      onFetchError: (m) => console.error(`mailbox: ${m}; still waiting`),
    },
  );
  if (answered) return report(question);
  if (has('--json')) console.log(JSON.stringify(withState(question, cfg), null, 1));
  if (!question.sentAt) {
    console.log(
      question.claim
        ? `NOT SENT YET ${question.id}: pid ${question.claim.pid} is sending it`
        : `SEND FAILED ${question.id} ${question.lastError ?? ''}`,
    );
    process.exit(1);
  }
  if (timeoutMs === 0) return;
  console.log(
    `NO ANSWER ${question.id} after ${timeoutMs / 60_000} minutes; it stays open: npm run mail -- ask --resume ${question.id}`,
  );
  process.exit(1);
}

async function questionsVerb(cfg: MailConfig): Promise<void> {
  const ack = flag('--ack');
  if (ack) {
    acknowledge(cfg, ack);
    console.log(`ACKNOWLEDGED ${ack}`);
    return;
  }
  if (has('--fetch')) await fetchInto(cfg, transport()).catch((e: Error) => console.error(`mailbox: ${e.message}`));
  const about = flag('--about');
  const status = flag('--status');
  const listed = questions(cfg.dir, cfg)
    .map((q) => withState(q, cfg))
    .filter(
      (q) =>
        (!about || q.about === about) &&
        (!status || q.status === status) &&
        (!has('--unseen') || (q.status === 'answered' && !q.seen)),
    );
  const stray = unmatched(cfg.dir);
  if (has('--json')) {
    console.log(JSON.stringify({ questions: listed, unmatched: stray }, null, 1));
    return;
  }
  for (const q of listed) {
    const marks = `${q.late ? ' late' : ''}${q.status === 'answered' && !q.seen ? ' unseen' : ''}`;
    console.log(`${q.id} ${q.status}${marks} asked ${q.createdAt}${q.about ? ` about ${q.about}` : ''}: ${q.subject}`);
  }
  if (stray.length) console.log(`${stray.length} replies from the person matched no question (--json lists them)`);
}

async function testVerb(cfg: MailConfig): Promise<void> {
  const at = new Date().toISOString();
  const wait = has('--await-reply');
  const { question, answered } = await ask(
    cfg,
    transport(),
    {
      subject: `video-knowledge mail test ${at}`,
      text: `Reply to this message with any words; the reply is saved as a fixture (addresses replaced).\nSent ${at}.`,
    },
    {
      timeoutMs: wait ? 10 * 60_000 : 0,
      pollMs: seconds('--poll', 20),
      onAsked: (q) => console.log(`ASKED ${q.id} ${q.messageId} ${q.to}`),
      onFetchError: (m) => console.error(`mailbox: ${m}; still waiting`),
    },
  );
  if (!question.sentAt) {
    console.error(`not sent: ${question.lastError}`);
    process.exit(1);
  }
  if (!wait) return;
  if (!answered) {
    console.error('no reply within ten minutes');
    process.exit(1);
  }
  const first = question.answers![0];
  const rec = readReceived(cfg.dir).find((r) => r.messageId === first.messageId)!;
  const dir = join(ROOT, 'tests', 'fixtures', 'mail');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `reply-${at.slice(0, 10)}-${rec.uid}.eml`);
  const raw = rec.raw ? readFileSync(join(cfg.dir, rec.raw), 'utf8') : '';
  writeFileSync(file, raw.replaceAll(cfg.to, 'person@example.test').replaceAll(cfg.from, 'automation@example.test'));
  console.log(`reply at ${first.at}; own text:\n${first.text}\nsaved ${file}`);
}

async function main(): Promise<void> {
  const cfg =
    corMailConfig(ROOT, loadAutomation(ROOT)) ??
    refuse('mail is not configured: automation.json approvals.to and notifications.to are empty');
  switch (cmd) {
    case 'ask':
      return askVerb(cfg);
    case 'questions':
      return questionsVerb(cfg);
    case 'test':
      return testVerb(cfg);
    case 'init': {
      const r = init(cfg, { dryRun: has('--dry-run') });
      const requests = r.state === 'empty' ? 0 : readCorOutbox(ROOT).filter((e) => e.meta?.request).length;
      console.log(`INIT ${r.state} ${r.entries} entries, ${requests} with a request`);
      return;
    }
    case 'send': {
      const id = flag('--message-id');
      if (has('--skip')) {
        if (!id) refuse('--skip needs --message-id');
        skipAttempt(cfg, id!);
        console.log(`SKIPPED ${id}`);
        return;
      }
      const path = flag('--file') ?? refuse('send needs --file');
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
      } catch (e) {
        refuse(`cannot read ${path}: ${(e as Error).message}`);
      }
      const { kind, meta, ...out } = validateSend(raw, cfg);
      if (!COR_MAIL_KINDS.includes(kind as CorMailKind)) refuse(`unknown kind ${kind}`);
      const { messageId } = await sendTracked(cfg, transport(), out, kind, {
        ...(meta && { meta }),
        ...(id && { messageId: id }),
      });
      console.log(`SENT ${messageId}`);
      return;
    }
    case 'fetch':
      console.log(`FETCHED ${await fetchInto(cfg, transport())}`);
      return;
    default: {
      const lines = readFileSync(new URL(import.meta.url), 'utf8').split('\n');
      const head = lines.slice(
        0,
        lines.findIndex((l) => !l.startsWith('//')),
      );
      console.error(head.map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(1);
    }
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(e instanceof MailRefusal ? 2 : 1);
});
