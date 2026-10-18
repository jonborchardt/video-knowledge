// The reviewer's semantic layer for story discovery: <topic>/story-review.json, written by an agent following
// scripts/briefs/stories.md after reading the candidates in <topic>/stories.json. Discovery merges it on the next run.
// Everything here is judgment the code cannot make: whether a verdict decides a sentence, whether a set of claims
// answers one question, and how to frame the question for a viewer. The file is committed and keeps runs reproducible.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './io';
import type { Judgments } from './evidence';

export type Format = 'long-form' | 'short' | 'needs-research';

export interface StoryReview {
  /** Drop the candidate with this reason (incoherent, redundant, not a story). */
  reject?: string;
  /** 0 to 1: do the claims form one argument or investigation? Below 0.5 rejects. */
  coherence?: { score: number; reason: string };
  /** The final claim list (ids), replacing the candidate's: prune tangents, add what the question needs. */
  claims?: string[];
  question?: string;
  title?: string;
  alternates?: string[];
  whyWatch?: string;
  tension?: string;
  evidenceNeeded?: string;
  premise?: string;
  arc?: Partial<Record<'hook' | 'conflict' | 'evidence' | 'resolution' | 'takeaway', string>>;
  format?: Format;
  formatWhy?: string;
  /** The premise and arc carry every qualification the audit raised, so qualified findings no longer hold the story at needs-review. */
  qualificationsAccepted?: boolean;
  /** Hold the story at needs-research for this reason, whatever the audit says (an essential gap the code cannot see). */
  research?: string;
  /** Who the script is written for; the evidence package carries it to the writer (a stated default otherwise). */
  audience?: string;
}

export interface ReviewFile {
  /** `${claim}|${stance}|${cite}` -> does that verdict decide a sentence taking that stance on the claim? */
  applicability?: Judgments;
  stories?: Record<string, StoryReview>;
}

export const reviewPath = (topic: string, root = ROOT) => join(root, topic, 'story-review.json');
export function loadReview(topic: string, root = ROOT): ReviewFile {
  const p = reviewPath(topic, root);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as ReviewFile) : {};
}
