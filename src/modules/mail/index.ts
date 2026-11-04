// Public API of the mail module: the only file other capabilities may import, and only the names listed under
// `mail` in tests/boundaries.json readApi (read-only, side-effect free). The sends and fetches are CLI verbs.
export {
  type Correlatable,
  type Correlation,
  type InMail,
  type MailTransport,
  type OutMail,
  address,
  correlate,
  inThread,
  ownText,
  questionIdsIn,
} from './core';
