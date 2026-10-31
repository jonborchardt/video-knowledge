// Public API of the packaging module: the review package (video/review/) and its helpers. Reached by the CLI as
// `npm run video -- package`, which spawns cli.ts; these names are what tests/links.test.ts reads.
export {
  type DescriptionLinks,
  type ReviewPackage,
  assertWithinLimits,
  descriptionLinks,
  keywordsOf,
  renderDescription,
} from './package';
