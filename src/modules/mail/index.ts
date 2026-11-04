// Public API of the mail module: the only file other capabilities may import, and only the names listed under
// `mail` in tests/boundaries.json readApi (read-only, side-effect free). The sends and fetches are CLI verbs.
export {
  type InMail,
  type OutMail,
  type OutboxEntry,
  type Question,
  type QuestionState,
  address,
  ownText,
  questionMail,
} from './core';
export {
  type CorMailKind,
  corMailDir,
  corResendDue,
  filterCorOutbox,
  mailConfigFromEnv,
  openCorQuestions,
  readCorOutbox,
  readCorReceived,
  unsentCorOutbox,
} from './cor';
