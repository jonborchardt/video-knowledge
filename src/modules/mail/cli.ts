// npm run mail -- <verb>
//   init [--dry-run]                                     the one migration of the legacy outbox: INIT <migrated|present|empty> <n> entries, <r> with a request; --dry-run writes nothing
//   send --file <path.json> [--message-id <id>]          one message from a file (kind, from, to, subject, text; html, inReplyTo, references, meta, attachments as base64 optional):
//                                                        records it, sends it, prints SENT <message-id>; --message-id resends the recorded entry with its id
//   send --skip --message-id <id>                        one attempt with nothing sent, for an entry nothing can re-render
// A refusal exits 2 and writes nothing (not configured, a malformed file, a recipient outside automation.json, an unknown,
// sent or exhausted entry, CLAIMED by pid <n> while another live process sends it); a transport failure exits 1 with the
// entry left unsent for a later attempt. Delivery is at least once: a retry reuses the Message-ID and may duplicate a copy.
// MAIL_FAKE=<state file> (tests only): a file-backed fake mailbox instead of the network.
import { readFileSync } from 'node:fs';
import { loadAutomation } from '../../shared/automation';
import { ROOT, loadDotEnv } from '../../shared/io';
import { COR_MAIL_KINDS, type CorMailKind, corMailConfig, corTransport, readCorOutbox } from './cor';
import { MailRefusal, init, sendTracked, skipAttempt, validateSend } from './core';

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

async function main(): Promise<void> {
  const cfg =
    corMailConfig(ROOT, loadAutomation(ROOT)) ??
    refuse('mail is not configured: automation.json approvals.to and notifications.to are empty');
  switch (cmd) {
    case 'init': {
      const r = init(cfg, { dryRun: has('--dry-run') });
      const requests =
        r.state === 'migrated' || r.state === 'present' ? readCorOutbox(ROOT).filter((e) => e.meta?.request).length : 0;
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
      const mail =
        corTransport() ??
        refuse('mail is not configured: MAIL_SMTP_HOST, MAIL_IMAP_HOST, MAIL_USER and MAIL_PASSWORD in .env');
      const { messageId } = await sendTracked(cfg, mail, out, kind, {
        ...(meta && { meta }),
        ...(id && { messageId: id }),
      });
      console.log(`SENT ${messageId}`);
      return;
    }
    default:
      console.error(
        readFileSync(new URL(import.meta.url), 'utf8')
          .split('\n')
          .slice(0, 8)
          .map((l) => l.replace(/^\/\/ ?/, ''))
          .join('\n'),
      );
      process.exit(1);
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(e instanceof MailRefusal ? 2 : 1);
});
