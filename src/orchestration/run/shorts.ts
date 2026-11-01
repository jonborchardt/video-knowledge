// Shorts inside the run (spec §5.3): after the parent is packaged, the runner discovers candidates, hands the shorts
// brief to a fresh reviewer when the candidates are unreviewed, and runs a nested story run for each ready candidate,
// serially, at most MAX_SHORTS. A halted Short never stops the others; the caller decides what the parent does.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REVIEW_DIR, ROOT, scriptDir, shortId } from '../../shared/io';
import { MAX_SHORTS } from '../../shared/types';
import { loadShorts, shortsPath } from '../../modules/shorts';
import { type Step, stepsOf } from '../production';
import type { Halt } from './journal';
import { readHalt, RUN_DIR } from './journal';
import type { RunResult } from './runner';
import type { StepOutcome } from './steps';

const SHORTS_BRIEF = 'src/modules/shorts/briefs/shorts.md';

export interface ShortsOwed {
  discover: boolean; // no shorts.json yet
  review: boolean; // candidates that need the reviewer's pass and no shorts-review.json
  produce: string[]; // ready candidates (at most MAX_SHORTS) without a packaged production
  halted: { id: string; halt: Halt }[]; // among those, the ones whose last run halted
}

const packaged = (topic: string, id: string, root: string) =>
  existsSync(join(scriptDir(topic, id, root), 'video', REVIEW_DIR, 'review.json'));

/** What the parent still owes its Shorts: discovery, the reviewer's pass, or productions. */
export function shortsOwed(topic: string, storyId: string, root = ROOT): ShortsOwed {
  const file = loadShorts(topic, storyId, root);
  if (!file) return { discover: true, review: false, produce: [], halted: [] };
  const reviewFile = shortsPath(topic, storyId, root).replace(/shorts\.json$/, 'shorts-review.json');
  const review = !existsSync(reviewFile) && file.candidates.some((c) => c.readiness === 'needs-review' && !c.reviewed);
  const ready = file.candidates.filter((c) => c.readiness === 'ready' && c.slug).slice(0, MAX_SHORTS);
  const produce = ready.map((c) => shortId(storyId, c.slug!)).filter((id) => !packaged(topic, id, root));
  const halted = produce.flatMap((id) => {
    const h = readHalt(join(scriptDir(topic, id, root), RUN_DIR));
    return h ? [{ id, halt: h }] : [];
  });
  return { discover: false, review, produce, halted };
}

export const shortsPending = (o: ShortsOwed): boolean => o.discover || o.review || o.produce.length > 0;

export interface ShortsContext {
  root: string;
  /** Runs one board-style step (a child CLI or an agent) under the parent's lock and journal; a RunResult is a halt
   *  the runner wrote (a guard failure, the budget) and ends the pass. */
  run: (step: Step) => Promise<StepOutcome | RunResult>;
  /** A nested story run for one Short (the real runner by default). */
  runShort: (shortStoryId: string) => Promise<RunResult>;
}

/** Discover, review when needed, then produce each ready Short serially. Returns what was produced and what halted
 *  (with each Short's own halt, written in its run folder by its run). */
export async function shortsForParent(
  topic: string,
  storyId: string,
  c: ShortsContext,
): Promise<{ produced: string[]; halted: { id: string; halt: Halt }[]; problem: string | null; stopped?: RunResult }> {
  const none = { produced: [], halted: [] };
  const discover = await c.run({ kind: 'run', text: `npm run shorts -- discover ${topic} ${storyId}` });
  if ('outcome' in discover) return { ...none, problem: null, stopped: discover };
  if (!discover.ok) return { ...none, problem: `shorts discover failed: ${discover.error}` };
  let owed = shortsOwed(topic, storyId, c.root);
  if (owed.review) {
    const out = `topics/${topic}/scripts/${scriptDir(topic, storyId, '').split(/[\\/]/).filter(Boolean).at(-1)}/shorts-review.json`;
    const [step] = stepsOf(`agent: ${SHORTS_BRIEF} -> ${out}`, topic, storyId);
    const r = await c.run(step);
    if ('outcome' in r) return { ...none, problem: null, stopped: r };
    if (!r.ok) return { ...none, problem: `the shorts reviewer failed: ${r.error}` };
    owed = shortsOwed(topic, storyId, c.root);
  }
  const produced: string[] = [];
  const halted: { id: string; halt: Halt }[] = [];
  for (const id of owed.produce) {
    const r = await c.runShort(id);
    if (r.outcome === 'done' && packaged(topic, id, c.root)) produced.push(id);
    else if (r.halt) halted.push({ id, halt: r.halt });
    else halted.push({ id, halt: readHalt(join(scriptDir(topic, id, c.root), RUN_DIR))! });
  }
  return { produced, halted, problem: null };
}
