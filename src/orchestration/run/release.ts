// The release loop (spec §4.4's `release` job, §5.3, §7.3): after a story is packaged, carry its release group (the
// video and each packaged Short) through the draft review by policy, the release build, the private uploads, the
// metadata push, verification, the manifest and the approval request, and halt where a person decides. It reads
// the ledger through publishing's read API and writes only through the module CLIs, dispatching on each output's
// structured step (verb and actor), never on prose. Operational state under .automation/shadow.json.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation, DraftPolicy } from '../../shared/automation';
import {
  MANIFEST_FILE,
  REVIEW_DIR,
  ROOT,
  readJson,
  scriptDir,
  shortId,
  storySlug,
  writeJsonAtomic,
} from '../../shared/io';
import type { ReleaseManifest } from '../../shared/types';
import {
  type Build,
  type OutputState,
  type OutputStep,
  type ReviewNote,
  currentBuild,
  loadLedger,
  openOutput,
  openRequest,
} from '../../modules/publishing';
import { type BoardNext, type Step, stepsOf } from '../production';
import type { Halt, RunHaltKind } from './journal';
import { automationDir } from './notify';
import type { RunResult } from './runner';
import { type ShortsContext, shortsForParent, shortsOwed, shortsPending } from './shorts';
import type { StepOutcome } from './steps';

export const SHADOW_FILE = 'shadow.json';
export const DRAFT_REVIEW_BRIEF = 'src/modules/video/briefs/draft-review.md';
export const DRAFT_REVIEW_FILE = 'video/draft-review.json';

export interface GroupOutput {
  id: string; // the ledger output id: youtube, short:<slug>
  storyId: string; // the story or Short id the CLIs take
  state: OutputState;
  step: OutputStep;
  build: Build | null; // the package on disk
}
export interface ReleaseGroup {
  main: GroupOutput;
  shorts: GroupOutput[];
  all: GroupOutput[];
}

/** The release group from the files: the main output and every Short registered in the ledger (with or without a
 *  package yet); null when the story has no package. */
export function releaseGroup(topic: string, storyId: string, root = ROOT): ReleaseGroup | null {
  const dir = scriptDir(topic, storyId, root);
  if (!currentBuild(dir)) return null;
  const main = openOutput(topic, storyId, { root });
  const one = (id: string, sid: string): GroupOutput => {
    const o = openOutput(topic, storyId, { root, output: id });
    return { id, storyId: sid, state: o.state, step: o.state.step, build: o.build };
  };
  const m = one(main.id, storyId);
  const shorts = Object.entries(main.ledger.outputs)
    .filter(([id, o]) => id.startsWith('short:') && o.kind === 'youtube-short' && o.source)
    .map(([id]) => one(id, shortId(storyId, id.slice('short:'.length))));
  return { main: m, shorts, all: [m, ...shorts] };
}

const manifestOf = (topic: string, storyId: string, root: string): ReleaseManifest | null =>
  readJson<ReleaseManifest>(join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, MANIFEST_FILE));

const automated = (o: GroupOutput) =>
  o.step.actor === 'automation' || (o.step.actor === 'youtube' && o.step.verb === 'verify');

/** Why the release loop has work on this packaged story now, or null (a person's turn, or nothing left). The work
 *  plane asks this to pick a `release` job. */
export function releasePending(
  topic: string,
  storyId: string,
  a: Automation,
  root = ROOT,
  now = new Date(),
): string | null {
  const g = releaseGroup(topic, storyId, root);
  if (!g) return null;
  if (g.main.state.live || g.main.state.status === 'scheduled') return null;
  const policy = a.review.draft;
  if (g.main.build?.status === 'draft') {
    if (policy === 'agent')
      return draftReviewed(topic, storyId, g.main.build.sha, root) ? null : 'the draft review by the agent';
    if (g.main.step.verb === 'upload' || g.main.step.verb === 'package')
      return `${g.main.id}: ${g.main.step.verb} the draft`;
    if (policy === 'shadow' && !shadowEntry(root, topic, storyId, g.main.build.sha)) return 'the shadow review';
    return null; // the person's acceptance
  }
  const auto = g.all.find(automated);
  if (auto) return `${auto.id}: ${auto.step.verb}`;
  if (g.shorts.some((s) => s.build?.status === 'draft') && policy !== 'agent') return null; // a Short's draft: the person's
  if (shortsPending(shortsOwed(topic, storyId, root))) return 'the Shorts';
  const person = g.all.every((o) => o.step.verb === 'approve' || o.step.verb === 'go-live');
  if (!person) return null;
  const m = manifestOf(topic, storyId, root);
  if (!m) return 'the release manifest';
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger || !openRequest(ledger, m.releaseSha, now)) return 'the approval request';
  return null;
}

// ---- the shadow record (spec §7.3, §5.5) -------------------------------------------------------------------------

export interface ShadowNote {
  n: number;
  text: string;
  seconds?: number;
  scene?: string;
  sentence?: string;
}
export interface ShadowEntry {
  story: string; // <topic>/<story-id>
  build: string; // the draft's mp4 sha
  agent: { verdict: 'accept' | 'changes'; notes: ShadowNote[]; reviewer: string; session: string | null };
  person: {
    verdict: 'accept' | 'changes';
    notes?: ShadowNote[];
    marks?: { n: number; mark: 'agree' | 'disagree' }[];
  } | null;
  at: string;
  sentBack?: boolean; // the release of this build was sent back at approval after the agent accepted it
}
interface ShadowFile {
  entries: ShadowEntry[];
}
const shadowPath = (root: string) => join(automationDir(root), SHADOW_FILE);
export const readShadow = (root = ROOT): ShadowEntry[] => readJson<ShadowFile>(shadowPath(root))?.entries ?? [];
const writeShadow = (root: string, entries: ShadowEntry[]) => writeJsonAtomic(shadowPath(root), { entries });
export const shadowEntry = (root: string, topic: string, storyId: string, build: string): ShadowEntry | null =>
  readShadow(root).find((e) => e.story === `${topic}/${storyId}` && e.build === build) ?? null;
/** Adds or replaces the agent's half of an entry. */
export function recordShadowAgent(
  root: string,
  e: Omit<ShadowEntry, 'person'> & { person?: ShadowEntry['person'] },
): void {
  const entries = readShadow(root).filter((x) => !(x.story === e.story && x.build === e.build));
  writeShadow(root, [...entries, { person: null, ...e }]);
}
/** Adds the person's half (the review page's decision, or a reply's marks) to the entry of that build, if any. */
export function recordShadowPerson(
  root: string,
  story: string,
  build: string,
  person: NonNullable<ShadowEntry['person']>,
): boolean {
  const entries = readShadow(root);
  const e = entries.find((x) => x.story === story && x.build === build);
  if (!e) return false;
  e.person = { ...e.person, ...person };
  writeShadow(root, entries);
  return true;
}
/** The agreement count the digest prints and the person reads before enabling `agent` (spec §5.5). */
export function shadowAgreement(root = ROOT): {
  drafts: number;
  agreed: number;
  streak: number;
  notesAgreed: number;
  notesDisagreed: number;
  acceptedThenSentBack: number;
} {
  const both = readShadow(root).filter((e) => e.person);
  const agreed = both.filter((e) => e.agent.verdict === e.person!.verdict);
  let streak = 0;
  for (let i = both.length - 1; i >= 0; i--) {
    const e = both[i];
    const ok =
      e.agent.verdict === e.person!.verdict &&
      !(e.person!.marks ?? []).some((m) => m.mark === 'disagree') &&
      !e.sentBack;
    if (!ok) break;
    streak++;
  }
  const marks = both.flatMap((e) => e.person!.marks ?? []);
  return {
    drafts: both.length,
    agreed: agreed.length,
    streak,
    notesAgreed: marks.filter((m) => m.mark === 'agree').length,
    notesDisagreed: marks.filter((m) => m.mark === 'disagree').length,
    acceptedThenSentBack: both.filter((e) => e.agent.verdict === 'accept' && e.sentBack).length,
  };
}

// ---- the draft review by the agent ------------------------------------------------------------------------------

export interface DraftReview {
  key: string;
  verdict: 'accept' | 'changes';
  notes: ShadowNote[];
  reviewer: string;
  session?: string;
  date: string;
}
const draftReviewPath = (topic: string, storyId: string, root: string) =>
  join(scriptDir(topic, storyId, root), DRAFT_REVIEW_FILE);
export const draftReviewOf = (topic: string, storyId: string, build: string, root: string): DraftReview | null => {
  const r = readJson<DraftReview>(draftReviewPath(topic, storyId, root));
  return r && r.key === build && (r.verdict === 'accept' || r.verdict === 'changes') && Array.isArray(r.notes)
    ? r
    : null;
};
const draftReviewed = (topic: string, storyId: string, build: string, root: string) =>
  !!draftReviewOf(topic, storyId, build, root);
/** The actor the ledger records for the agent's decision (publishing's DRAFT_REVIEW_ACTOR). */
export const draftReviewActor = (r: DraftReview, session: string | null) =>
  `automated: draft-review by ${r.reviewer.replace(/[^\w.-]/g, '-')} session ${(session ?? r.session ?? 'none').replace(/[^\w-]/g, '-')}`;

// ---- the loop ---------------------------------------------------------------------------------------------------

export interface ReleaseContext {
  root: string;
  approver: string;
  now: () => number;
  /** Runs one step (a child CLI or an agent) under the story's lock, journaled and guarded; `stage` names it. */
  run: (step: Step, stage: string) => Promise<StepOutcome | RunResult>;
  runShort: (shortStoryId: string) => Promise<RunResult>;
  halt: (kind: RunHaltKind, why: string, unblock: Halt['unblock'], extra?: { retryable?: boolean }) => RunResult;
  done: () => RunResult;
  board: () => BoardNext;
  /** Phase 2 Task 6: sends the draft or release request mail; absent until then, or without a mailbox. */
  mail?: {
    draft: (g: ReleaseGroup, shadow: ShadowEntry | null) => Promise<void>;
    release: (manifest: ReleaseManifest) => Promise<void>;
  };
  policy?: DraftPolicy; // tests override automation.json's
}

/** A step the runner turned into a halt (a guard failure, an exhausted budget): the loop ends with it. */
export const halted = (x: object): x is RunResult => 'outcome' in x;

const cmd = (cli: string, args: string[]): Step => ({
  kind: 'run',
  text: `npm run ${cli} -- ${args.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(' ')}`,
});
const q = (s: string) => s.replace(/"/g, "'");

export async function releaseLoop(
  topic: string,
  storyId: string,
  a: Automation,
  c: ReleaseContext,
): Promise<RunResult> {
  const policy = c.policy ?? a.review.draft;
  const root = c.root;
  let lastKey = '';
  let attempt = 0;
  // a retryable condition (YouTube processing, a retryable API failure) is attempted once per run: still there, the
  // loop halts retryable and the tick's backoff brings it back (never a no-progress halt, spec §10)
  const attempted = new Set<string>();
  const verbStep = (o: GroupOutput): Step =>
    o.step.verb === 'package'
      ? cmd('video', ['package', topic, o.storyId])
      : cmd('publish', [o.step.verb, topic, o.storyId, '--by', c.approver]);
  const resume = { kind: 'run' as const, text: `npm run run -- story ${topic} ${storyId}` };
  for (let i = 0; i < a.runs.loopCap; i++) {
    const g = releaseGroup(topic, storyId, root);
    if (!g)
      return c.halt('step-failed', 'no review package on disk', {
        kind: 'fix',
        text: `npm run video -- package ${topic} ${storyId}`,
      });
    if (g.main.state.live || g.main.state.status === 'scheduled') return c.done();
    // no progress: the same picture of the group three times in a row
    const key = JSON.stringify(g.all.map((o) => [o.id, o.step.verb, o.step.actor, o.build?.sha, o.state.status]));
    attempt = key === lastKey ? attempt + 1 : 1;
    lastKey = key;
    if (attempt > a.runs.noProgressAttempts)
      return c.halt(
        'no-progress',
        `the release group did not move after ${attempt - 1} attempts: ${g.main.state.next}`,
        {
          kind: 'fix',
          text: `read the run folder of ${topic} ${storyId}`,
        },
      );

    // 1. a failure on any output: retryable and the automation's → tried once more, then a retryable halt (the tick
    //    resumes it by backoff); else a person's
    const failed = g.all.find((o) => o.step.failed);
    if (failed) {
      const f = failed.step.failed!;
      const key = `${failed.id}|${failed.step.verb}`;
      if (f.retryable && automated(failed) && failed.step.actor === 'automation' && !attempted.has(key)) {
        attempted.add(key);
        const out = await c.run(verbStep(failed), 'release');
        if (halted(out)) return out;
        continue;
      }
      if (f.retryable)
        return c.halt('step-failed', `${failed.id}: ${f.step} failed: ${f.error}`, resume, { retryable: true });
      return c.halt('awaiting-person', `${failed.id}: ${f.step} failed: ${f.error}`, {
        kind: 'decide',
        text: failed.state.next,
      });
    }

    // 2. the draft: by policy
    const drafts = g.all.filter((o) => o.build?.status === 'draft');
    if (drafts.length) {
      const r = await draftPass(topic, storyId, a, c, g, drafts, policy);
      if (r) return r;
      continue;
    }

    // 3. the automation's steps, the main output first, then each Short
    const auto = g.all.find(automated);
    if (auto) {
      const key = `${auto.id}|${auto.step.verb}|youtube`;
      if (auto.step.actor === 'youtube') {
        if (attempted.has(key))
          return c.halt(
            'step-failed',
            `${auto.id}: YouTube is still processing ${auto.state.id ?? ''}; verify again later`,
            resume,
            { retryable: true },
          );
        attempted.add(key);
      }
      const step = verbStep(auto);
      const out = await c.run(step, 'release');
      if (halted(out)) return out;
      if (!out.ok && out.exit !== 2 && out.error === 'timeout')
        return c.halt('timeout', `${step.text}: timed out`, resume);
      continue; // the ledger says what happened: a failure shows as the step's failed overlay next pass
    }

    // 4. a person's send-back on a release build, or a draft acceptance pending on a Short
    const sendBack = g.all.find((o) => o.step.verb === 'send-back');
    if (sendBack)
      return c.halt('awaiting-person', `${sendBack.id} was sent back with notes`, {
        kind: 'decide',
        text: sendBack.state.next,
      });

    // 5. the Shorts, before the request binds the group
    const owed = shortsOwed(topic, storyId, root);
    if (shortsPending(owed)) {
      const r = await shortsPass(topic, storyId, c, owed.halted);
      if (r) return r;
      continue;
    }

    // 6. everything is the person's approve or go-live: the manifest, then the request, then the halt
    const person = g.all.every((o) => o.step.verb === 'approve' || o.step.verb === 'go-live');
    if (!person) {
      const odd = g.all.find((o) => !(o.step.verb === 'approve' || o.step.verb === 'go-live'))!;
      return c.halt('awaiting-person', `${odd.id} is ${odd.state.status}`, { kind: 'decide', text: odd.state.next });
    }
    const wrote = await c.run(cmd('packaging', ['manifest', topic, storyId]), 'release');
    if (halted(wrote)) return wrote;
    if (!wrote.ok)
      return c.halt('step-failed', `the release manifest could not be written: ${wrote.error}`, {
        kind: 'fix',
        text: `npm run packaging -- manifest ${topic} ${storyId}`,
      });
    const manifest = manifestOf(topic, storyId, root);
    if (!manifest)
      return c.halt('step-failed', 'no release manifest after packaging wrote it', {
        kind: 'fix',
        text: `npm run packaging -- manifest ${topic} ${storyId}`,
      });
    const ledger = loadLedger(topic, storyId, root);
    const open = ledger && openRequest(ledger, manifest.releaseSha, new Date(c.now()));
    if (!open) {
      const req = await c.run(
        cmd('publish', ['request', topic, storyId, '--channel', 'email', '--by', c.approver]),
        'release',
      );
      if (halted(req)) return req;
      if (!req.ok) {
        if (req.exit === 2) continue; // a refusal: the next pass reads what the ledger says is missing
        return c.halt('step-failed', `publish request failed: ${req.error}`, {
          kind: 'fix',
          text: `npm run publish -- request ${topic} ${storyId} --channel email`,
        });
      }
    }
    const l2 = loadLedger(topic, storyId, root);
    const now = l2 && openRequest(l2, manifest.releaseSha, new Date(c.now()));
    if (!now) continue;
    if (c.mail) await c.mail.release(manifest);
    return c.halt(
      'awaiting-person',
      `the release of ${topic} ${storyId} (${manifest.sequence.join(', ')}) awaits approval: request ${now.request}`,
      {
        kind: 'decide',
        text: `reply OK, OK at <when> or CHANGES: to the release email (${now.request}), or approve each output on the review page`,
      },
    );
  }
  return c.halt('cap', `${a.runs.loopCap} release loop iterations`, {
    kind: 'run',
    text: `npm run run -- story ${topic} ${storyId}`,
  });
}

/** The draft step by policy: under `person` and `shadow`, upload it and wait for the person (the shadow agent judges
 *  beside them, its verdict recorded and nothing else); under `agent`, the Shorts first, then the agent judges every
 *  draft output and the loop runs `final` on an accept or records the send-back on `changes`. Null: the loop goes on. */
async function draftPass(
  topic: string,
  storyId: string,
  a: Automation,
  c: ReleaseContext,
  g: ReleaseGroup,
  drafts: GroupOutput[],
  policy: DraftPolicy,
): Promise<RunResult | null> {
  const root = c.root;
  if (policy !== 'agent') {
    const main = drafts.find((o) => o.id === g.main.id) ?? drafts[0];
    if (main.step.verb === 'package' || main.step.verb === 'upload') {
      const r = await c.run(
        main.step.verb === 'package'
          ? cmd('video', ['package', topic, main.storyId])
          : cmd('publish', ['upload', topic, main.storyId, '--by', c.approver]),
        'release',
      );
      return halted(r) ? r : null;
    }
    let shadow = policy === 'shadow' ? shadowEntry(root, topic, main.storyId, main.build!.sha) : null;
    if (policy === 'shadow' && !shadow) {
      const r = await reviewDraft(topic, main.storyId, main.build!.sha, c);
      if (typeof r === 'string')
        return c.halt('step-failed', r, { kind: 'fix', text: `read the draft-review agent's session` });
      if (halted(r)) return r;
      shadow = {
        story: `${topic}/${main.storyId}`,
        build: main.build!.sha,
        agent: { verdict: r.review.verdict, notes: r.review.notes, reviewer: r.review.reviewer, session: r.session },
        person: null,
        at: new Date(c.now()).toISOString(),
      };
      recordShadowAgent(root, shadow);
    }
    if (c.mail) await c.mail.draft(g, shadow);
    const url = main.state.url ?? '(not uploaded)';
    return c.halt('awaiting-person', `the draft build ${main.build!.sha} of ${main.id} is uploaded for review`, {
      kind: 'decide',
      text: `watch ${url} with video/review/checklist.md; accept it on the review page (npm run video -- final ${topic} ${main.storyId} --approved-by "<name>") or reply OK to the draft email`,
    });
  }
  // agent: the Shorts first, so one package is reviewed
  const owed = shortsOwed(topic, storyId, root);
  if (shortsPending(owed)) {
    const r = await shortsPass(topic, storyId, c, owed.halted);
    return r;
  }
  const rounds = a.review.draftReviewRounds;
  for (const o of drafts) {
    const build = o.build!.sha;
    let review = draftReviewOf(topic, o.storyId, build, root);
    let session: string | null = null;
    if (!review) {
      const r = await reviewDraft(topic, o.storyId, build, c);
      if (typeof r === 'string')
        return c.halt('step-failed', r, { kind: 'fix', text: `read the draft-review agent's session` });
      if (halted(r)) return r;
      review = r.review;
      session = r.session;
    }
    const actor = draftReviewActor(review!, session);
    if (review!.verdict === 'accept') {
      const fin = await c.run(cmd('video', ['final', topic, o.storyId, '--approved-by', actor]), 'release');
      if (halted(fin)) return fin;
      if (!fin.ok)
        return c.halt(
          fin.error === 'timeout' ? 'timeout' : 'step-failed',
          `video final failed for ${o.id}: ${fin.error}`,
          { kind: 'run', text: `npm run run -- story ${topic} ${storyId}` },
        );
      return null;
    }
    const args = ['request-changes', topic, o.storyId, '--by', actor];
    for (const n of review!.notes) {
      args.push('--note', q(n.text));
      if (n.seconds !== undefined) args.push('--at', String(n.seconds));
      if (n.scene) args.push('--scene', n.scene);
      if (n.sentence) args.push('--sentence', n.sentence);
    }
    const rc = await c.run(cmd('publish', args), 'release');
    if (halted(rc)) return rc;
    // the notes pass (phase 3 routes each note to its artifact); until then, and past the rounds, a person's
    const notes: ReviewNote[] = review!.notes.map((n) => ({
      text: n.text,
      seconds: n.seconds,
      scene: n.scene,
      sentence: n.sentence,
    }));
    void rounds;
    return c.halt(
      'awaiting-person',
      `the draft-review agent sent ${o.id} back: ${notes.map((n) => n.text).join('; ')}`,
      {
        kind: 'decide',
        text: `send it back with the reviewer's notes: /produce ${topic} ${o.storyId}`,
      },
    );
  }
  return null;
}

/** One draft-review agent on an output's draft: the brief as a prompt step, then the file it wrote. */
async function reviewDraft(
  topic: string,
  storyId: string,
  build: string,
  c: ReleaseContext,
): Promise<{ review: DraftReview; session: string | null } | string | RunResult> {
  const out = `topics/${topic}/scripts/${storySlug(storyId.split('/')[0])}${storyId.includes('/shorts/') ? `/shorts/${storyId.split('/').at(-1)}` : ''}/${DRAFT_REVIEW_FILE}`;
  const [step] = stepsOf(`agent: ${DRAFT_REVIEW_BRIEF} -> ${out}`, topic, storyId);
  const r = await c.run(step, 'release');
  if (halted(r)) return r;
  if (!r.ok) return `the draft-review agent failed: ${r.error}`;
  const review = draftReviewOf(topic, storyId, build, c.root);
  if (!review) return `the draft-review agent wrote no valid ${DRAFT_REVIEW_FILE} for build ${build}`;
  return { review, session: r.sessionId };
}

/** The Shorts pass: produce what is owed; a halted Short halts the parent with that Short's own unblock. */
async function shortsPass(
  topic: string,
  storyId: string,
  c: ReleaseContext,
  alreadyHalted: { id: string; halt: Halt }[],
): Promise<RunResult | null> {
  const sc: ShortsContext = { root: c.root, run: (s) => c.run(s, 'shorts'), runShort: c.runShort };
  const r = await shortsForParent(topic, storyId, sc);
  if (r.problem)
    return c.halt('step-failed', r.problem, { kind: 'fix', text: `npm run shorts -- discover ${topic} ${storyId}` });
  const halted = r.halted.length ? r.halted : alreadyHalted;
  if (halted.length) {
    const h = halted[0];
    const retryable = ['timeout', 'lock-stale'].includes(h.halt.kind);
    return c.halt(
      retryable ? 'step-failed' : 'awaiting-person',
      `Short ${h.id} halted ${h.halt.kind}: ${h.halt.why}`,
      h.halt.unblock,
      retryable ? { retryable: true } : undefined,
    );
  }
  return null;
}

export const packagedShort = (topic: string, id: string, root = ROOT) =>
  existsSync(join(scriptDir(topic, id, root), 'video', REVIEW_DIR, 'review.json'));
