// The orchestrator's one door: what the admin pages, the components, the board CLI and the tests read from the board.
export {
  type ArticleState,
  board,
  boardNext,
  type Check,
  checkDecisions,
  type Column,
  COLUMNS,
  columnOf,
  HALT_KINDS,
  type Health,
  mainState,
  type OutputView,
  PRODUCTION_STAGES,
  productionOf,
  runPromptOf,
  sendBackPromptOf,
  shortColumnOf,
  type ShortRow,
  stoppedOf,
  type Step,
  stepsOf,
  type StoryRow,
  topicBoard,
  validationHaltKind,
} from './production';
// The runner's read-only view (status.ts): the admin page reads it; the runner itself (runner.ts) spawns processes
// and is never loaded into an Astro page.
export {
  RESEARCH_STAGES,
  type ResearchStage,
  type TopicNext,
  type RecordedMarker,
  type StudiesRounds,
  type ReviewRounds,
  topicNext,
} from './research';
export { type StatusRow, statusOf } from './run/status';
export { type AutomationView, automationView } from './run/view';
// M3: the live view (what runs now, the owner's list, the activity, the readiness table), read by the admin page and
// its /admin/live.json endpoint; nothing in it writes.
export {
  type Activity,
  type LiveAgent,
  type LiveHalt,
  type LiveJobs,
  type LiveRow,
  type LiveView,
  type OwnerItem,
  liveView,
} from './run/live';
export { INTEGRATIONS, type Integration, type ReadinessRow, readinessView } from './run/readiness';
export { type Estimate, type WeekRollup, estimate, rollups } from './run/usage';
