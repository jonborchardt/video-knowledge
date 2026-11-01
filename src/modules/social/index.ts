// Public API of the social module: the only file other capabilities (the board, the site) may import.
export {
  type Post,
  type SocialFile,
  accountFor,
  inspectPosts,
  loadSocial,
  post,
  postProblem,
  socialPath,
  textFor,
} from './social';
export { type XClient, type XCreds, XError, credsFor, xClient } from './x';
