// Public API of the packaging module: the review package (video/review/) and its helpers. Reached by the CLI as
// `npm run video -- package`, which spawns cli.ts; nothing else of the module is imported from outside.
export { MAX_CUE_LINE, renderSrt } from './captions';
export {
  type DescriptionLinks,
  type ReviewPackage,
  REVIEW_FILES,
  assertWithinLimits,
  buildReviewPackage,
  descriptionLinks,
  keywordsOf,
  renderDescription,
} from './package';
