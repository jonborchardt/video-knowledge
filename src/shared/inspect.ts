/** What a module says about its own artifacts for one story: never a workflow decision (the board maps it). */
export type InspectStatus = 'missing' | 'invalid' | 'stale' | 'ready';
export interface Inspection {
  status: InspectStatus;
  findings: string[]; // plain sentences a person can act on
  output?: string; // repo-relative path of the artifact inspected, when it exists
}
