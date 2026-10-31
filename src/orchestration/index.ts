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
  type Step,
  stepsOf,
  type StoryRow,
  topicBoard,
  validationHaltKind,
} from './production';
// The runner's read-only view (status.ts): the admin page reads it; the runner itself (runner.ts) spawns processes
// and is never loaded into an Astro page.
export { type StatusRow, statusOf } from './run/status';
