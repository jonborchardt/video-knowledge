// Public API of the evidence module. Read API for other capabilities (listed under `evidence` in tests/boundaries.json):
// loadTopic, topicNames, publicTopicNames, VAL, Topic, corpusOf, loadDatasets, dataRef, findingLabel.
export {
  VAL,
  loadTopic,
  publicTopicNames,
  topicNames,
  type ClaimView,
  type SourceClaimView,
  type SourceView,
  type SurpriseView,
  type Topic,
  type Verdict,
} from './topics';
export { corpusOf } from './corpus';
export { type DataTable, dataRef, datasetCsv, loadDatasets } from './datasets';
export {
  FINDING_LABELS,
  FINDING_TEXT,
  claimStates,
  findingLabel,
  labelCounts,
  ledgerClaims,
  type FindingLabel,
} from './finding-label';
export { verdictLabel } from './verdict-label';
