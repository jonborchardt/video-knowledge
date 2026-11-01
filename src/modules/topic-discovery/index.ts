// Public API of the topic-discovery module. Read API for other capabilities (listed under `topic-discovery` in
// tests/boundaries.json): loadProposals, proposalPath, reviewPath, inspectProposal, rank, Proposed, Ranked.
export {
  PROPOSALS_DIR,
  type Existing,
  type Proposed,
  type ProposalCode,
  type Ranked,
  existingOf,
  inspectProposal,
  loadProposals,
  normalise,
  overallOf,
  proposalPath,
  rank,
  researched,
  reviewPath,
  validateProposal,
  validateReview,
  weakWhy,
} from './proposals';
export {
  type Batch,
  type BatchListed,
  type Decision,
  batchOf,
  decideProposal,
  isAutomated,
  parkProposal,
} from './decisions';
