// The core's public API: what another project imports after copying core/ (the extraction boundary).
export type { Answer, Correlation, InMail, MailConfig, MailTransport, OutboxEntry, OutMail } from './types';
export { type Correlatable, type Lookup, address, correlate, inThread, ownText, questionIdsIn } from './thread';
export { type MutexOpts, withMutex } from './mutex';
export {
  type FakeFileState,
  type FakeSent,
  type MailDeps,
  type MailServer,
  FakeMail,
  emptyFakeState,
  fileFakeMail,
  htmlToText,
  libraryTransport,
  messageIdOf,
  toInMail,
} from './transport';
export { type Received, type ReceivedFile, fetchInto, readReceived, recordReceived, unmatched } from './received';
export {
  type InitReport,
  type RecordExtra,
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
import { archiveEntries, filterOutbox, findOutbox, init, readOutbox, sendTracked, type SendExtra } from './outbox';
import { fetchInto, readReceived, unmatched } from './received';
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
    received: () => readReceived(cfg.dir),
    unmatched: () => unmatched(cfg.dir),
    findOutbox: (pred: Parameters<typeof findOutbox>[1]) => findOutbox(cfg.dir, pred),
    filterOutbox: (pred: Parameters<typeof filterOutbox>[1]) => filterOutbox(cfg.dir, pred),
    archived: () => archiveEntries(cfg.dir),
  };
}
