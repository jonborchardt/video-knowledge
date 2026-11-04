// The seam between orchestration and the mailbox: orchestration decides what to send and when; the mail module sends,
// as a child process (`npm run mail -- send`), the way every write crosses a boundary here. `sendTracked` without
// `messageId` records a new entry and sends it; with `messageId` it resends the recorded entry with its id.
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type OutMail, corMailDir } from '../../modules/mail';
import { type CliResult, runCli } from '../../shared/cli';
import { ROOT } from '../../shared/io';
import { type OutboxKind, withGuide } from './notify';
import { envFor } from './steps';

export interface SendExtra {
  request?: string;
  topic?: string;
  storyId?: string;
  /** A resend of the recorded entry with this Message-ID. */
  messageId?: string;
  now?: () => number;
}

export interface Mailer {
  sendTracked(out: Omit<OutMail, 'messageId'>, kind: OutboxKind, extra?: SendExtra): Promise<{ messageId: string }>;
  /** One attempt with nothing sent: an entry nothing can re-render runs out of attempts and the digest lists it. */
  skipAttempt(messageId: string, now?: () => number): Promise<void>;
  /** New mail into the received store (the only way in); returns how many were new. */
  fetch(): Promise<number>;
}

/** This project's correlation fields as the core's opaque meta. */
export const metaOf = (extra: SendExtra): Record<string, string> | undefined => {
  const meta = Object.fromEntries(
    Object.entries({ request: extra.request, topic: extra.topic, storyId: extra.storyId }).filter(([, v]) => v),
  ) as Record<string, string>;
  return Object.keys(meta).length ? meta : undefined;
};

type Run = (cli: string, args: string[]) => Promise<CliResult> | CliResult;
const lastLine = (r: CliResult) => (r.stderr || r.stdout).trim().split('\n').at(-1) || `exit ${r.status}`;

/** The production Mailer. The message reaches the child in a temp file (attachments would not fit an argument),
 *  deleted whatever the outcome: a retry renders it again. */
export function cliMailer(
  root = ROOT,
  run: Run = (cli, args) => runCli(cli, args, { cwd: root, env: envFor(cli, args, process.env) }),
): Mailer {
  return {
    async sendTracked(out, kind, extra = {}) {
      const dir = join(corMailDir(root), 'send');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${randomUUID()}.json`);
      try {
        const body = withGuide(kind, out);
        const meta = metaOf(extra);
        writeFileSync(
          file,
          JSON.stringify({
            kind,
            ...body,
            ...(meta && { meta }),
            attachments: body.attachments?.map((a) => ({ ...a, data: a.data.toString('base64') })),
          }),
        );
        const r = await run('mail', [
          'send',
          '--file',
          file,
          ...(extra.messageId ? ['--message-id', extra.messageId] : []),
        ]);
        if (r.status !== 0) throw new Error(lastLine(r));
        const sent = /^SENT (\S+)/m.exec(r.stdout);
        if (!sent) throw new Error(`mail send printed no id: ${lastLine(r)}`);
        return { messageId: sent[1] };
      } finally {
        rmSync(file, { force: true });
      }
    },
    async skipAttempt(messageId) {
      const r = await run('mail', ['send', '--skip', '--message-id', messageId]);
      if (r.status !== 0) throw new Error(lastLine(r));
    },
    async fetch() {
      const r = await run('mail', ['fetch']);
      if (r.status !== 0) throw new Error(lastLine(r));
      return Number(/^FETCHED (\d+)/m.exec(r.stdout)?.[1] ?? 0);
    },
  };
}
