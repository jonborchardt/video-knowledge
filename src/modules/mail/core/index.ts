// The core's public API: what another project imports after copying core/ (the extraction boundary).
export type { Answer, Correlation, InMail, MailConfig, MailTransport, OutboxEntry, OutMail } from './types';
export { address, correlate, ownText, questionIdsIn, sanitizedSource } from './thread';
export { withMutex } from './mutex';
export {
  type FakeFileState,
  type MailServer,
  FakeMail,
  emptyFakeState,
  fileFakeMail,
  htmlToText,
  libraryTransport,
  messageIdOf,
} from './transport';
export { type Received, RETENTION_DAYS, archive, fetchInto, readReceived, recordReceived, unmatched } from './received';
export {
  type SendExtra,
  MailRefusal,
  attemptSend,
  filterOutbox,
  findOutbox,
  init,
  lockPath,
  mutateOutbox,
  normaliseLegacy,
  outboxPath,
  questionMail,
  readOutbox,
  receivedPath,
  recordOutgoing,
  resendDue,
  sendTracked,
  skipAttempt,
  unsentOutbox,
  validateSend,
} from './outbox';
export {
  type AskInput,
  type AskOpts,
  type Question,
  type QuestionState,
  type QuestionStatus,
  acknowledge,
  ask,
  questions,
  statusOf,
} from './ask';
import { type AskInput, type AskOpts, acknowledge, ask, questions, statusOf } from './ask';
import { findOutbox, init, readOutbox, sendTracked, type SendExtra } from './outbox';
import { archive, fetchInto, unmatched } from './received';
import type { MailConfig, MailTransport, OutMail } from './types';

/** The core bound to one configuration and one transport: all another project needs. */
export function mailCore(cfg: MailConfig, mail: MailTransport) {
  return {
    init: (opts?: { dryRun?: boolean }) => init(cfg, opts),
    send: (out: Omit<OutMail, 'messageId'>, kind: string, extra?: SendExtra) =>
      sendTracked(cfg, mail, out, kind, extra),
    fetch: () => fetchInto(cfg, mail),
    ask: (input: AskInput | { resume: string }, opts: AskOpts) => ask(cfg, mail, input, opts),
    acknowledge: (id: string) => acknowledge(cfg, id),
    questions: () => questions(cfg.dir).map((q) => ({ ...q, ...statusOf(q, cfg, (cfg.now ?? Date.now)()) })),
    outbox: () => readOutbox(cfg.dir),
    unmatched: () => unmatched(cfg.dir),
    findOutbox: (pred: Parameters<typeof findOutbox>[1]) => findOutbox(cfg.dir, pred),
    archive: () => archive(cfg),
  };
}
