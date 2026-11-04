// Public API of the mail module: the only file other capabilities may import, and only the names listed under
// `mail` in tests/boundaries.json readApi (read-only, side-effect free). The sends and fetches are CLI verbs.
export {
  type Correlatable,
  type Correlation,
  type InMail,
  type MailTransport,
  type OutMail,
  type OutboxEntry,
  type Received,
  address,
  correlate,
  inThread,
  ownText,
  questionIdsIn,
  questionMail,
} from './core';
export {
  type CorMailKind,
  corMailDir,
  corResendDue,
  filterCorOutbox,
  findCorOutbox,
  mailConfigFromEnv,
  readCorOutbox,
  readCorReceived,
  unsentCorOutbox,
} from './cor';
