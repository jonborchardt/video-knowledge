// Public API of the video module: its read API only (reads, paths, pure checks and types; nothing writes). The
// renders, QA and the soundtrack are reached through `npm run video` and `npm run music` (cli.ts, cli-music.ts).
export {
  RENDER_CHECK,
  type RenderCheckSummary,
  renderCheckProblems,
  renderCheckStale,
  renderConfigSha,
} from './render-check';
export { VIDEO_FILES, videoDir } from './files';
export { loadSegment, type Segment } from './select';
export type { BuildReport } from './report';
export type { Timeline } from './types';
