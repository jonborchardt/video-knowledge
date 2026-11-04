# The mail core

A self-contained way for a program and its agents to talk to one person by email: ask in ordinary language, keep working, read the exact reply, ask again. It records what was sent and what came back, and owns sending, receiving, concurrency, threading, correlation, retries and recovery.

It does not own what a reply means. The host owns the agent's reasoning, which channel to use, continuing the work and any authorisation. Treat a reply as words to reason about, never as permission for anything that needs a stronger check.

## Using it elsewhere

Copy this folder. It imports nothing but `node:*`, `nodemailer`, `imapflow` and `mailparser`. Then:

```ts
import { libraryTransport, mailCore } from './core';

const mail = libraryTransport({ smtpHost, smtpPort: 465, imapHost, imapPort: 993, user, password });
const core = mailCore({ dir: './mail-state', from: user, to: 'you@example.com' }, mail);

const { question, answered } = await core.ask(
  { subject: 'Deploy now?', text: 'Shall I?', about: 'job-7' },
  { timeoutMs: 3_600_000, pollMs: 60_000 },
);
if (answered) {
  doSomethingWith(question.answers![0].text);
  core.acknowledge(question.id!); // only once you have accepted it for processing
}
```

To check a copy, run `tests/standalone.test.ts` (it needs only this folder and vitest) and typecheck with `tsconfig.json` here, adjusting its `extends`.

## Configuration

`MailConfig`: `dir` (where the records live), `from`, `to` (the person: the only address a question goes to and the only sender who can answer one). Optional: `recipients` (every address a plain send may use, default `[to]`), `subjectPrefix`, `maxAttempts` (3), `resendAfterMs` (10 min), `retentionDays` (90), `attachmentLimit` (5 MiB), `keepReceived` (a received record the host still needs live), `now`, `alive`, and `legacyOutbox`, `legacyMetaFields`, `legacyCursor` for a one-time migration.

`MailTransport` is two methods: `send(mail)` and `fetchSince(uid)` returning `{ uidValidity, mails }`. `libraryTransport` implements it over SMTP and IMAP; `FakeMail` and `fileFakeMail` are for tests.

## What it guarantees

- **Recorded before sent.** Every mail has its Message-ID on disk before the first attempt.
- **At least once, not exactly once.** If a process dies after the server accepted a mail and before recording that, the retry carries the same Message-ID and a duplicate copy is possible. Key any effect by what the mail is about, never by the copy.
- **One live sender per message.** A claim taken under the lock, void once its pid is dead.
- **One inbound pipeline.** `fetch` is the only mailbox reader and holds the only cursor. Each message is recorded once, by Message-ID or by a content hash when it has none. A changed UIDVALIDITY re-reads the mailbox with no duplicate and nothing skipped.
- **Correlated once, conservatively.** The sender must be `to` (a weak check: a From header is not authentication). Then In-Reply-To, a question id in the subject, a question id in the person's own text, then the latest of References. More than one candidate in the deciding tier matches nothing and is listed by `unmatched`.
- **A timeout stops the waiter, never the question.** A later fetch records the reply; `ask({ resume })` waits again.
- **Receipt and acknowledgment are separate.** An answer is durable once recorded and stays unseen until `acknowledge`, so a caller that dies holding it loses nothing.
- **Only completed records archive.** A question answered and acknowledged, or another mail sent or out of attempts. Unanswered questions stay live at any age. Lookups and correlation span the archives.

## Files under `dir`

`outbox.json`, `received.json`, `received/<sha12>.eml` (the original messages), `archive/<YYYY-MM>.json`, `.lock/`.

## Known ceilings

- The lock is for one machine. A dead owner's pid reused by an unrelated process strands it until a person deletes `.lock/held`; the timeout error names the pid.
- The wait polls by sleeping; IMAP IDLE would suit a shorter interval.
- The `.eml` sources are never pruned.
- Nothing here resumes a program that has ended. A later run lists `questions()` and acts on what it finds.
