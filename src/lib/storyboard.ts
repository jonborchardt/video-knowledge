// Kept at this path until the video section: src/video/types.ts and kinds.ts import these types from here and are
// fingerprint-hashed, so their import lines never change. Nothing else imports this file.
export { VISUALS, CHART_TYPES, UNITS } from '../shared/types';
export type {
  VisualCategory,
  ChartType,
  Unit,
  ChartPoint,
  ChartSpec,
  ScenePlan,
  AssetKind,
  Asset,
  StoryboardPlan,
  SentenceTiming,
  Scene,
  Storyboard,
} from '../shared/types';
