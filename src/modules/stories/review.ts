// The reviewer's semantic layer for story discovery: topics/<topic>/story-review.json, written by an agent following
// src/modules/stories/briefs/stories.md after reading the candidates in topics/<topic>/stories.json. Discovery merges it on the next run.
// Everything here is judgment the code cannot make: whether a verdict decides a sentence, whether a set of claims
// answers one question, and how to frame the question for a viewer. The file is committed and keeps runs reproducible.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { topicDir, ROOT } from '../../shared/io';
import type { ReviewFile } from '../../shared/types';

export { MAX_QUESTIONS, MAX_CHAIN_CLAIMS } from '../../shared/types';

export const reviewPath = (topic: string, root = ROOT) => join(topicDir(topic, root), 'story-review.json');
export function loadReview(topic: string, root = ROOT): ReviewFile {
  const p = reviewPath(topic, root);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as ReviewFile) : {};
}
