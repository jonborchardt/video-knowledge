// The core's public API: what another project imports after copying core/ (the extraction boundary).
export type { Answer, Correlation, InMail, MailConfig, MailTransport, OutboxEntry, OutMail } from './types';
export { type Correlatable, type Lookup, address, correlate, inThread, ownText, questionIdsIn } from './thread';
export { type MutexOpts, withMutex } from './mutex';
export { type FakeFileState, type FakeSent, emptyFakeState, fileFakeMail, messageIdOf } from './transport';
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
