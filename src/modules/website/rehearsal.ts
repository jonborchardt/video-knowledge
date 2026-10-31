// The go-live rehearsal (`npm run rehearse`): it makes a story public only in a throwaway copy of the working tree
// outside the repo, and runs the real post-go-live sequence there, so the live-only tests meet realistic content
// before the first go-live. This is the one place a `published` event is written outside `npm run publish`, and it
// only ever lands in that copy.
import { existsSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../shared/io';
import { emptyLedger, type Ledger, storyOutputs } from '../publishing';
import { scriptDir, storySlug } from '../../shared/io';
import { loadStories } from '../stories';

export const REHEARSAL_VIDEO_ID = 'REHEARSAL00';

/** A ledger whose only event is a fixture go-live of the story's video. */
export function rehearsalLedger(topic: string, storyId: string, at: string): Ledger {
  const l = emptyLedger(`${topic}/${storyId}`);
  l.outputs.youtube.events.push({ at, type: 'published', by: 'rehearsal', id: REHEARSAL_VIDEO_ID });
  return l;
}

export const rehearsalDir = (topic: string, storyId: string, tmp = tmpdir()) =>
  join(tmp, 'vk-rehearsal', topic, storySlug(storyId));

/** The CLAUDE.md go-live sequence, in order (quality reuses the build it follows). */
export const rehearsalSteps = (topic: string) => [
  `npm run report -- seed ${topic}`,
  'npm run brand',
  'npm run build',
  'npm run links -- freeze',
  'npm run quality -- --no-build',
];

/** Why the story cannot be rehearsed, as one line; null when it can. */
export function rehearsalRefusal(topic: string, storyId: string, root = ROOT): string | null {
  const s = loadStories(topic, root)?.stories.find((x) => x.id === storyId);
  if (!s) return `unknown story ${topic}/${storyId}`;
  if (s.partOf) return `${storyId} is a follow-up: rehearse its first question ${s.partOf}`;
  if (storyOutputs(topic, storyId, root).video) return `${storyId} is already live`;
  if (!existsSync(join(scriptDir(topic, storyId, root), 'video', 'review', 'review.json')))
    return `${storyId} is not packaged (no video/review/review.json)`;
  return null;
}

/** Deletes a copy. Its node_modules is a junction to the real one: unlink it first so the delete never follows it. */
export function removeRehearsal(dir: string): void {
  try {
    unlinkSync(join(dir, 'node_modules'));
  } catch {
    // no junction
  }
  rmSync(dir, { recursive: true, force: true });
}
