// The loop (spec §4.1): the board is the state machine, this is `/produce`'s loop as code. It asks the board, runs
// each step (steps.ts), asks again, and halts with one `unblock` when a person must act or a cap is hit. Resume needs
// no stored progress: the board re-derives the stage from the files; the journal only supplies attempt counts.
// Around every agent: snapshot, agent, guard, (component check), validator, guard; after every child: guard.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, scriptDir, sha, shortOf, storySlug, writeJsonAtomic } from '../../shared/io';
import { type BoardNext, boardNext, type ProductionStage, type Step, stepsOf } from '../production';
import {
  componentCheck as realComponentCheck,
  guard as realGuard,
  snapshot as realSnapshot,
  type TreeSnapshot,
  guardWhy,
} from './guard';
import {
  appendJournal,
  nextLine,
  clearHalt,
  type Halt,
  type JournalEntry,
  readJournal,
  runDir,
  type RunHaltKind,
  writeHalt,
  writeValidateLog,
} from './journal';
import { acquire, aliveLocks, heartbeat, type Lock, release, setChild } from './lock';
import { alive, killTree } from './proc';
import { grantFor } from './roles';
import {
  envFor,
  execStep as realExecStep,
  parseRun,
  roleOf,
  type StepContext,
  type StepOutcome,
  outcomeFields,
} from './steps';
import { type ReleaseContext, releaseLoop } from './release';
import { sendDraftRequest, sendReleaseRequest } from './requests';
import type { MailTransport } from '../../shared/mail';
import { type ReviewNote, currentBuild, loadLedger, noteLine, openOutput } from '../../modules/publishing';
import { parseNoteLine } from './replies';

export interface RunHooks {
  snapshot?: () => void;
  guard?: (scope: 'agent' | 'child') => { ok: boolean; why: string; kept?: string[] };
  componentCheck?: (changed: string[]) => { ok: boolean; output: string };
}

export interface RunOptions {
  approver: string;
  notes?: string;
  /** Stop at a stage; `packaged` stops before the release loop (spec §5.3), `requested` (the default) runs it. */
  until?: ProductionStage | 'requested';
  root?: string;
  ask?: (topic: string, storyId: string, root: string) => BoardNext;
  exec?: typeof realExecStep;
  now?: () => number;
  runId?: string;
  /** `'none'` in tests; the default runs git in `root`. */
  git?: 'none' | ((args: string[]) => string);
  /** `npm run validate` at the finish, given a secret-free environment; tests inject a pass. */
  validate?: (env: NodeJS.ProcessEnv) => { ok: boolean; output: string };
  env?: NodeJS.ProcessEnv;
  hooks?: RunHooks;
  /** Tests inject a fake CLI; the default is the repo's own (`cliArgv`). */
  argvOf?: StepContext['argvOf'];
  /** The nested run of one Short (the release loop's); the default is this runner to `packaged`. */
  runShort?: (shortStoryId: string) => Promise<RunResult>;
  /** The mailbox the draft and release requests go through; absent: no mail, the halts say what to do. */
  mail?: MailTransport | null;
  /** Tests inject the senders; the default composes and sends through `mail`. */
  releaseMail?: ReleaseContext['mail'];
  /** Tests override automation.json's review.draft. */
  policy?: ReleaseContext['policy'];
}

/** Under the story's run folder: the change request the last notes pass answered (its build and notes). */
export const NOTES_PASS_FILE = 'notes-pass.json';
export interface NotesPass {
  key: string; // <build>|<sha of the notes>, or notes|<sha> for a --notes-file
  build: string | null;
  notes: ReviewNote[];
  at: string;
  steps: string[];
  /** Written at the start of the pass as false and at its end as true: a resume of a failed pass reruns its agents
   *  but never `script -- send-back` again, so the writer's revision budget counts from where the pass opened. */
  done: boolean;
}

/** The change request the current build carries (the latest `changes-requested` on the main output, by anyone), or
 *  null. The ledger is the one record of a send-back; the runner reads it and never decides the verdict. */
export function pendingSendBack(
  topic: string,
  storyId: string,
  root: string,
): { key: string; build: string; notes: ReviewNote[]; by: string } | null {
  try {
    const o = openOutput(topic, storyId, { root });
    if (o.state.status !== 'changes-requested' || !o.build) return null;
    const ev = (loadLedger(topic, o.story, root)?.outputs[o.id]?.events ?? []).findLast(
      (e) => e.type === 'changes-requested' && e.build === o.build!.sha,
    );
    if (!ev) return null;
    const notes = ev.notes ?? [];
    return { key: `${o.build.sha}|${sha(JSON.stringify(notes))}`, build: o.build.sha, notes, by: ev.by };
  } catch {
    return null; // no ledger, no output, a follow-up: nothing to route
  }
}

/** Where each note goes (spec §7.3, the produce skill's notes pass): a note placed on a sentence, or on nothing, is
 *  the script writer's (wording, cuts, order; the pass opens with `script -- send-back`); a note placed on a scene
 *  only is the video fix's (the render, a graphic), checked by `video check`. The board takes over from there: a
 *  changed script asks for its re-review, storyboard and lock, a changed render.json for a new render. */
export function notesPassSteps(
  topic: string,
  storyId: string,
  notes: ReviewNote[],
): { steps: Step[]; notes: string }[] {
  const script = notes.filter((n) => n.sentence || !n.scene);
  const scene = notes.filter((n) => !n.sentence && n.scene);
  const lines = (ns: ReviewNote[]) => ns.map((n) => `- ${noteLine(n)}`).join('\n');
  const out: { steps: Step[]; notes: string }[] = [];
  if (script.length)
    out.push({
      steps: [
        { kind: 'run', text: `npm run script -- send-back ${topic} ${storyId}` },
        ...stepsOf(
          `agent: src/modules/script/briefs/script.md (notes) -> ${scriptRel(topic, storyId)}/script.json`,
          topic,
          storyId,
        ),
      ],
      notes: lines(script),
    });
  if (scene.length)
    out.push({
      steps: stepsOf(
        `agent: src/modules/video/briefs/video-fix.md, then npm run video -- check ${topic} ${storyId}`,
        topic,
        storyId,
      ),
      notes: lines(scene),
    });
  return out;
}
const scriptRel = (topic: string, storyId: string) =>
  scriptDir(topic, storyId, '/r').slice('/r/'.length).replaceAll('\\', '/');
/** A --notes-file's lines as placed notes (`[m:ss sc20 s31] text`, a list bullet allowed). */
export const notesFromText = (text: string): ReviewNote[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseNoteLine);

export interface RunResult {
  outcome: 'done' | 'halted' | 'held';
  stage: string;
  halt: Halt | null;
  iterations: number;
  costUsd: number;
  /** The release loop asks the runner to produce again (a draft the agent sent back): never a run's final result. */
  restart?: true;
}

const PERSON_HALTS = new Set(['revision-limit', 'story-left', 'no-institution', 'published']);
/** What no phase 0 child writes: the store, the documents and the public record stay protected in the child scope
 *  too (a planted component could run inside a validator; layer 1 already denies agents these paths). */
const CHILD_DENY = [
  'topics/*/store/**',
  'topics/*/sources/**',
  'topics/*/public-record.json',
  'topics/*/applicability.json',
  'topics/*/report.json',
];
const RETRYABLE_VERBS = new Set(['render', 'spike', 'narrate', 'qa', 'frames']);
const FORBIDDEN = /--replace-cited|--force\b/;
export const AUTOMATION_DIR = '.automation';

/** ISO week, `YYYY-Www`, the key of the weekly spend. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

interface BudgetFile {
  weeks: Record<string, number>;
}
const budgetPath = (root: string) => join(root, AUTOMATION_DIR, 'budget.json');
export const weekSpend = (root: string, week: string): number =>
  readJson<BudgetFile>(budgetPath(root))?.weeks[week] ?? 0;
export function addSpend(root: string, week: string, usd: number): void {
  const f = readJson<BudgetFile>(budgetPath(root)) ?? { weeks: {} };
  f.weeks[week] = (f.weeks[week] ?? 0) + usd;
  mkdirSync(join(root, AUTOMATION_DIR), { recursive: true });
  writeJsonAtomic(budgetPath(root), f);
}

/** Cost journaled for this story since its last finish (a resumed run keeps spending the same run budget). */
export const runSpend = (entries: JournalEntry[]): number => {
  let sum = 0;
  for (const e of entries) {
    if (e.kind === 'finish') sum = 0;
    else sum += e.costUsd ?? 0;
  }
  return sum;
};
const sinceFinish = (entries: JournalEntry[]): JournalEntry[] => {
  const i = entries.map((e) => e.kind).lastIndexOf('finish');
  return entries.slice(i + 1);
};
const scenesOf = (text: string): string[] => /Scenes: ([\w,]+)/.exec(text)?.[1].split(',') ?? [];

export async function runStory(topic: string, storyId: string, a: Automation, o: RunOptions): Promise<RunResult> {
  const root = o.root ?? ROOT;
  const ask = o.ask ?? boardNext;
  const exec = o.exec ?? realExecStep;
  const now = o.now ?? Date.now;
  const dir = runDir(topic, storyId, root);
  const storyRel = scriptDir(topic, storyId, root)
    .slice(root.length + 1)
    .replaceAll('\\', '/');
  const acquired = acquire(dir, `story ${topic} ${storyId}`, { now });
  if ('held' in acquired) return { outcome: 'held', stage: '', halt: null, iterations: 0, costUsd: 0 };
  const lock: Lock = acquired.lock;
  const runId = o.runId ?? lock.runId;
  const stamp = () => new Date(now()).toISOString();
  const journal = (e: Omit<JournalEntry, 'at' | 'runId'>) => appendJournal(dir, { at: stamp(), runId, ...e });
  const git = (args: string[]): string =>
    o.git === 'none'
      ? ''
      : o.git
        ? o.git(args)
        : execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const validate = o.validate ?? ((env) => runValidate(root, env));
  let snap: TreeSnapshot | null = null;
  const hooks: Required<RunHooks> = {
    snapshot: o.hooks?.snapshot ?? (() => void (snap = realSnapshot(root))),
    guard:
      o.hooks?.guard ??
      ((scope): { ok: boolean; why: string; kept: string[] } => {
        if (!snap) snap = realSnapshot(root);
        // an agent may touch its role's exact files; a child CLI writes derived artifacts anywhere in the topic and
        // nowhere else (the machinery stays protected; a planted package.json is caught by name)
        const g =
          scope === 'agent'
            ? realGuard(snap, root, [...currentGrant.writable, ...currentGrant.derived], {
                newFilesOnly: currentGrant.newFilesOnly,
                additiveOnly: currentGrant.additiveOnly,
                deny: currentGrant.deny,
              })
            : realGuard(snap, root, [`topics/${topic}/**`], { deny: CHILD_DENY });
        snap = realSnapshot(root);
        return {
          ok: g.ok,
          why: guardWhy(g),
          kept: g.kept,
        };
      }),
    componentCheck: o.hooks?.componentCheck ?? ((changed) => realComponentCheck(root, changed)),
  };
  let currentGrant = grantFor('writer', { topic, storyId });

  // a dead run's child (an agent or a render) may still be running: Windows children outlive a killed parent
  let killed = '';
  if (acquired.tookOver?.childPid && alive(acquired.tookOver.childPid)) {
    killTree(acquired.tookOver.childPid);
    killed = `; killed child ${acquired.tookOver.childPid} (${acquired.tookOver.childStep ?? 'step'})`;
  }
  const existing = readJournal(dir);
  if (existing.length || acquired.tookOver)
    journal({
      stage: '',
      next: '',
      step: 'resume',
      kind: 'resume',
      attempt: 0,
      error: acquired.tookOver
        ? `took over ${acquired.tookOver.runId} (pid ${acquired.tookOver.pid})${killed}`
        : undefined,
    });
  const beat = setInterval(() => heartbeat(dir, lock, now), 60_000);
  hooks.snapshot(); // before the first step, so the first child is guarded too
  let cost = 0;
  let iterations = 0;
  let stepNo = readJournal(dir).length;
  let lastKey: string | null = null;
  let attempt = 0;

  const halt = (
    kind: RunHaltKind,
    why: string,
    unblock: Halt['unblock'],
    board: BoardNext,
    extra: { retryable?: boolean } = {},
  ): RunResult => {
    const h: Halt = {
      kind,
      stage: board.stage,
      why,
      unblock,
      at: stamp(),
      runId,
      board: { stage: board.stage, next: board.next },
      ...(extra.retryable && { retryable: true }),
    };
    writeHalt(dir, h);
    journal({ stage: board.stage, next: board.next, step: kind, kind: 'halt', attempt, error: why });
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'halted', stage: board.stage, halt: h, iterations, costUsd: cost };
  };
  /** The production's end: the tree guarded, validated, reported and committed, the `finish` journal line; a halt
   *  result when any of those fail, else null. `finish` closes the run after it; the release loop runs between. */
  const settle = (board: BoardNext): RunResult | null => {
    const g = hooks.guard('child');
    if (!g.ok)
      return halt(
        'unexpected-edit',
        g.why,
        { kind: 'fix', text: 'read the run folder; a file outside the run was changed and reverted' },
        board,
      );
    const v = validate(envFor('validate', [], o.env ?? process.env));
    if (!v.ok) {
      const log = writeValidateLog(dir, v.output);
      return halt(
        'step-failed',
        `npm run validate failed: ${v.output.trim().split('\n').slice(-5).join(' | ')}`,
        { kind: 'fix', text: `read ${log}; fix what validate reports, then npm run run -- story again` },
        board,
      );
    }
    writeRunReport(topic, storyId, root, dir, readJournal(dir));
    const problem = o.git === 'none' ? null : commit(git, a, topic, storyId, storyRel, board.stage);
    if (problem)
      return halt(
        'git',
        problem,
        {
          kind: 'fix',
          text: `the files stand uncommitted in ${storyRel}; commit them by hand or fix git and run again`,
        },
        board,
      );
    journal({ stage: board.stage, next: board.next, step: 'finish', kind: 'finish', attempt: 0, costUsd: 0 });
    return null;
  };
  const close = (board: BoardNext): RunResult => {
    clearHalt(dir);
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'done', stage: board.stage, halt: null, iterations, costUsd: cost };
  };
  const finish = (board: BoardNext): RunResult => settle(board) ?? close(board);
  /** What the release loop added (the ledger, the Shorts, the manifest): committed on the loop's way out. */
  const commitRelease = (board: BoardNext): RunResult | null => {
    const problem = o.git === 'none' ? null : commit(git, a, topic, storyId, storyRel, 'release');
    return problem
      ? halt(
          'git',
          problem,
          { kind: 'fix', text: `the files stand uncommitted in ${storyRel}; commit them by hand or fix git` },
          board,
        )
      : null;
  };

  let lastBoard: BoardNext = {
    topic,
    story: storyId,
    stage: 'package',
    next: '',
    steps: [],
    halt: null,
    done: false,
  };
  /** One step of the release loop under this run's lock: the same child or agent execution, journal, guard and
   *  per-agent budget as a board step; a guard failure or an exhausted budget comes back as the halt itself. */
  let passNotes: string | undefined; // the notes pass's notes, handed to its steps
  const runOne = async (step: Step, n: BoardNext): Promise<StepOutcome | RunResult> => {
    const role = roleOf(step);
    currentGrant = grantFor(role, { topic, storyId });
    const logPath = join(dir, 'steps', `${++stepNo}.log`);
    mkdirSync(join(dir, 'steps'), { recursive: true });
    const ctx: StepContext = {
      topic,
      storyId,
      root,
      approver: o.approver,
      notes: passNotes ?? o.notes,
      role,
      logPath,
      env: o.env,
      argvOf: o.argvOf,
      otherLocksAlive: () => aliveLocks(root).some((d) => d !== dir),
      guard: (scope) => hooks.guard(scope),
      componentCheck: (kept) => hooks.componentCheck(kept),
      onSpawn: (pid) => setChild(dir, lock, pid, step.text.split('\n')[0].slice(0, 120)),
    };
    if (step.kind === 'prompt') {
      const week = isoWeek(new Date(now()));
      const spentRun = runSpend(readJournal(dir));
      const perAgent = a.agents.budgetUsd.perAgent;
      if (
        spentRun + perAgent > a.agents.budgetUsd.perRun ||
        weekSpend(root, week) + perAgent > a.agents.budgetUsd.perWeek
      )
        return halt(
          'budget',
          `run ${spentRun.toFixed(2)} of ${a.agents.budgetUsd.perRun} USD, week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD; the next agent may cost ${perAgent}`,
          { kind: 'decide', text: 'raise agents.budgetUsd or wait for the next week' },
          n,
        );
      ctx.budgetUsd = perAgent;
      ctx.attempts = { dir, line: nextLine(dir), runId }; // the journal line below is the next one
    }
    const out = await exec(a, step, ctx);
    setChild(dir, lock, null);
    cost += out.costUsd;
    if (out.costUsd) addSpend(root, isoWeek(new Date(now())), out.costUsd);
    journal({
      stage: n.stage,
      next: n.next,
      step: step.text.split('\n')[0].slice(0, 200),
      kind: step.kind,
      attempt: 1,
      ...outcomeFields(out),
    });
    if (out.guardFailed)
      return halt(
        'unexpected-edit',
        `${out.error}${out.sessionId ? ` (session ${out.sessionId})` : ''}`,
        {
          kind: 'fix',
          text: `the files were reverted; read the agent's session${out.sessionId ? ` ${out.sessionId}` : ''}`,
        },
        n,
      );
    if (step.kind === 'run') {
      const g = hooks.guard('child');
      if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
    }
    return out;
  };
  const releaseContext = (n: BoardNext): ReleaseContext => ({
    root,
    approver: o.approver,
    now,
    run: (step, stage) => runOne(step, { ...n, stage: stage as BoardNext['stage'], next: step.text }),
    runShort:
      o.runShort ??
      ((sid) =>
        runStory(topic, sid, a, {
          ...o,
          until: 'packaged',
          runId: undefined,
          git: 'none', // the parent's finish commits the topic, Shorts included
          validate: () => ({ ok: true, output: '' }), // once, at the parent's finish
          notes: undefined,
        })),
    halt: (kind, why, unblock, extra) => halt(kind, why, unblock, n, extra),
    done: () => ({ outcome: 'done', stage: n.stage, halt: null, iterations, costUsd: cost }),
    board: () => ask(topic, storyId, root),
    mail:
      o.releaseMail ??
      (o.mail
        ? {
            draft: async (d, shadow) =>
              void (await sendDraftRequest(
                topic,
                d.storyId,
                d.build?.sha ?? '',
                d.state.url ?? '',
                shadow,
                a,
                o.mail!,
                {
                  root,
                  now,
                  env: o.env,
                },
              )),
            release: async (m) =>
              void (await sendReleaseRequest(topic, storyId, m, a, o.mail!, { root, now, env: o.env })),
          }
        : undefined),
    policy: o.policy,
  });
  // the notes pass: a change request on the current build, or the notes given by hand, routed once per request
  const notesPass = async (): Promise<RunResult | null> => {
    const marker = readJson<NotesPass>(join(dir, NOTES_PASS_FILE));
    const pending = pendingSendBack(topic, storyId, root);
    const handNotes = o.notes?.trim() ? notesFromText(o.notes) : [];
    const want =
      pending ??
      (handNotes.length ? { key: `notes|${sha(JSON.stringify(handNotes))}`, build: null, notes: handNotes } : null);
    if (!want || (marker?.key === want.key && marker.done)) return null;
    const reopened = marker?.key === want.key; // the same pass, interrupted: its send-back already opened the budget
    const routes = notesPassSteps(topic, storyId, want.notes);
    const n: BoardNext = { ...ask(topic, storyId, root), stage: 'packaged', next: 'notes pass' };
    const done: string[] = [];
    if (!reopened)
      writeJsonAtomic(join(dir, NOTES_PASS_FILE), {
        key: want.key,
        build: want.build,
        notes: want.notes,
        at: stamp(),
        steps: [],
        done: false,
      } satisfies NotesPass);
    try {
      for (const route of routes) {
        passNotes = route.notes; // the route's notes go to the route's steps and to nothing after the pass
        for (const step of route.steps) {
          if (reopened && /^npm run script -- send-back /.test(step.text)) continue;
          const out = await runOne(step, { ...n, next: step.text });
          if ('outcome' in out) return out;
          done.push(step.text.split('\n')[0]);
          if (!out.ok)
            return halt(
              out.error === 'timeout' ? 'timeout' : 'step-failed',
              `notes pass: ${step.text.split('\n')[0]}: ${out.error}`,
              { kind: 'run', text: `npm run run -- story ${topic} ${storyId}` },
              n,
            );
        }
      }
    } finally {
      passNotes = undefined;
    }
    writeJsonAtomic(join(dir, NOTES_PASS_FILE), {
      key: want.key,
      build: want.build,
      notes: want.notes,
      at: stamp(),
      steps: done,
      done: true,
    } satisfies NotesPass);
    return null;
  };
  try {
    for (; iterations < a.runs.loopCap; iterations++) {
      const routed = await notesPass();
      if (routed) return routed;
      const n = ask(topic, storyId, root);
      lastBoard = n;
      if (n.done || (o.until && n.stage === o.until)) {
        // packaged, nothing to produce: the release loop carries the group to the approval request (spec §5.3)
        if (
          n.done &&
          n.stage === 'packaged' &&
          !n.halt &&
          o.until !== 'packaged' &&
          currentBuild(scriptDir(topic, storyId, root))
        ) {
          // the production is settled (validated, committed) before anything leaves the machine
          const settled = settle(n);
          if (settled) return settled;
          // a Short resumed by its own id releases as part of its parent's group, never as a group of its own
          const rr = await releaseLoop(topic, shortOf(storyId)?.parent ?? storyId, a, releaseContext(n));
          const committed = commitRelease(n);
          if (committed) return committed;
          if (rr.outcome === 'halted') return rr;
          if (rr.restart) {
            // the draft-review agent sent the build back: the notes pass, then the board again; a send-back the pass
            // already answered means the pass changed nothing, and a person decides rather than the loop spinning
            const pend = pendingSendBack(topic, storyId, root);
            const marker = readJson<NotesPass>(join(dir, NOTES_PASS_FILE));
            if (pend && marker?.key === pend.key && marker.done)
              return halt(
                'awaiting-person',
                `the notes pass changed nothing: the draft-review agent sent build ${pend.build} back again with the same notes (${pend.notes.map((x) => x.text).join('; ')})`,
                {
                  kind: 'decide',
                  text: `read video/draft-review.json and send it back with your own notes: /produce ${topic} ${storyId}`,
                },
                n,
              );
            continue;
          }
          return close(n);
        }
        return finish(n);
      }
      if (n.halt?.kind === 'look-stale' && n.stage === 'packaged') return finish(n);
      if (n.next.startsWith('stop:') || (n.halt && PERSON_HALTS.has(n.halt.kind)))
        return halt('awaiting-person', n.halt?.why ?? n.next, { kind: 'decide', text: n.next }, n);
      const key = `${n.stage}|${n.next}`;
      if (key === lastKey) attempt++;
      else {
        lastKey = key;
        attempt = 1;
      }
      if (attempt > a.runs.noProgressAttempts) {
        const last = readJournal(dir)
          .filter((e) => e.error)
          .at(-1);
        return halt(
          'no-progress',
          `the board still says "${n.next}" after ${attempt - 1} attempts${last?.error ? `; last: ${last.error}` : ''}`,
          { kind: 'fix', text: `read ${dir}` },
          n,
        );
      }

      for (const step of n.steps) {
        // the clearance note stepsOf appends ("public release is blocked: ...") is information, not a person's step
        if (step.kind === 'do' && /^Public release is blocked:/.test(step.text)) continue;
        if (step.kind === 'do') return halt('awaiting-person', step.text, { kind: 'decide', text: step.text }, n);
        // a forbidden flag is judged on the command the board asks for, never on diagnostic output
        const forbidden =
          step.kind === 'run' ? parseRun(step.text, o.approver)?.args.find((x) => FORBIDDEN.test(x)) : undefined;
        if (forbidden)
          return halt(
            'forbidden-flag',
            `the board asked for ${forbidden}: ${step.text}`,
            { kind: 'fix', text: 'a person runs that flag by hand, never the runner' },
            n,
          );
        const role = roleOf(step);
        currentGrant = grantFor(role, { topic, storyId });
        const logPath = join(dir, 'steps', `${++stepNo}.log`);
        mkdirSync(join(dir, 'steps'), { recursive: true });
        const ctx: StepContext = {
          topic,
          storyId,
          root,
          approver: o.approver,
          notes: passNotes ?? o.notes,
          role,
          logPath,
          env: o.env,
          argvOf: o.argvOf,
          otherLocksAlive: () => aliveLocks(root).some((d) => d !== dir),
          guard: (scope) => hooks.guard(scope),
          componentCheck: (kept) => hooks.componentCheck(kept),
          onSpawn: (pid) => setChild(dir, lock, pid, step.text.split('\n')[0].slice(0, 120)),
        };
        const verb = /^npm run \S+ -- (\S+)/.exec(step.text)?.[1] ?? '';
        if (step.kind === 'prompt') {
          // caps and budget before anything is spent
          const since = sinceFinish(readJournal(dir));
          if (/graphics\.md/.test(step.text))
            for (const sc of scenesOf(step.text)) {
              const used = since.filter(
                (e) => e.kind === 'prompt' && /graphics\.md/.test(e.step) && scenesOf(e.step).includes(sc),
              ).length;
              if (used >= a.runs.graphicsRevisions)
                return halt(
                  'cap',
                  `scene ${sc}: ${used} graphics revisions`,
                  { kind: 'decide', text: 'draw the scene another way or raise runs.graphicsRevisions' },
                  n,
                );
            }
          if (/video-fix\.md/.test(step.text)) {
            const used = since.filter((e) => e.kind === 'prompt' && /video-fix\.md/.test(e.step)).length;
            if (used >= a.runs.qaFixes)
              return halt(
                'cap',
                `${used} QA fixes`,
                { kind: 'decide', text: 'fix the render by hand or raise runs.qaFixes' },
                n,
              );
          }
          const week = isoWeek(new Date(now()));
          const spentRun = runSpend(readJournal(dir));
          const perAgent = a.agents.budgetUsd.perAgent;
          if (
            spentRun + perAgent > a.agents.budgetUsd.perRun ||
            weekSpend(root, week) + perAgent > a.agents.budgetUsd.perWeek
          )
            return halt(
              'budget',
              `run ${spentRun.toFixed(2)} of ${a.agents.budgetUsd.perRun} USD, week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD; the next agent may cost ${perAgent}`,
              { kind: 'decide', text: 'raise agents.budgetUsd or wait for the next week' },
              n,
            );
          ctx.budgetUsd = perAgent; // the tree was snapshotted at the start and after every guard since
          ctx.attempts = { dir, line: nextLine(dir), runId }; // the journal line below is the next one
        }
        let out: StepOutcome;
        let tries = 0;
        for (;;) {
          tries++;
          out = await exec(a, step, ctx);
          setChild(dir, lock, null);
          cost += out.costUsd;
          if (out.costUsd) addSpend(root, isoWeek(new Date(now())), out.costUsd);
          journal({
            stage: n.stage,
            next: n.next,
            step:
              step.text.split('\n')[0].slice(0, 200) +
              (scenesOf(step.text).length ? ` Scenes: ${scenesOf(step.text).join(',')}` : ''),
            kind: step.kind,
            attempt: tries,
            ...outcomeFields(out),
          });
          if (
            step.kind === 'run' &&
            !out.ok &&
            out.exit !== 2 &&
            RETRYABLE_VERBS.has(verb) &&
            tries < a.runs.timeoutsPerStep
          )
            continue;
          break;
        }
        if (out.guardFailed)
          return halt(
            'unexpected-edit',
            `${out.error}${out.sessionId ? ` (session ${out.sessionId})` : ''}`,
            {
              kind: 'fix',
              text: `the files were reverted; read the agent's session${out.sessionId ? ` ${out.sessionId}` : ''}`,
            },
            n,
          );
        if (step.kind === 'run') {
          const g = hooks.guard('child');
          if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
          if (!out.ok) {
            if (out.exit === 2) break; // a refusal: usually a stale step; ask the board again
            if (RETRYABLE_VERBS.has(verb) || out.error === 'timeout')
              return halt(
                out.error === 'timeout' ? 'timeout' : 'step-failed',
                `${step.text}: ${out.error}`,
                { kind: 'run', text: `npm run run -- story ${topic} ${storyId}` },
                n,
              );
            return halt('step-failed', `${step.text}: ${out.error}`, { kind: 'fix', text: `read ${logPath}` }, n);
          }
        }
      }
    }
    const n = ask(topic, storyId, root);
    return halt(
      'cap',
      `${a.runs.loopCap} loop iterations`,
      { kind: 'run', text: `npm run run -- story ${topic} ${storyId}` },
      n,
    );
  } catch (e) {
    // an exception (the board, a parse, a spawn) is a recorded failure with an unblock, never a bare crash
    const msg = (e as Error).message ?? String(e);
    return halt(
      'step-failed',
      `the runner failed: ${msg}`,
      { kind: 'fix', text: `read ${dir}; fix the cause and run the same command` },
      lastBoard,
    );
  } finally {
    clearInterval(beat);
  }
}

/** The working tree's content as one git tree hash (tracked and untracked, .gitignore respected): what validate
 *  judges. Null when git cannot say (no repo, a broken index). */
export function treeFingerprint(root: string): string | null {
  const tmp = join(tmpdir(), `vk-index-${process.pid}-${Date.now()}`);
  try {
    copyFileSync(join(root, '.git', 'index'), tmp);
    const env = { ...process.env, GIT_INDEX_FILE: tmp };
    execFileSync('git', ['add', '-A', '--', '.', `:(exclude)${AUTOMATION_DIR}`], { cwd: root, env, stdio: 'ignore' });
    return execFileSync('git', ['write-tree'], { cwd: root, env, encoding: 'utf8' }).trim();
  } catch {
    return null;
  } finally {
    rmSync(tmp, { force: true });
  }
}
export const VALIDATE_MARKER = '.automation/validate-ok.json'; // the tree that last passed, so a resume that changed nothing skips the suite

/** `npm run validate` in a secret-free environment: the suite imports the renderer tree, which carries agent code.
 *  Skipped, as a pass, when the tree is byte for byte the one that passed last (`VALIDATE_MARKER`): a resume into
 *  the same halt re-validates nothing new. `run` is the suite itself; tests inject one. */
export function runValidate(
  root: string,
  env: NodeJS.ProcessEnv,
  run: () => { ok: boolean; output: string } = () => npmValidate(root, env),
): { ok: boolean; output: string } {
  const marker = join(root, VALIDATE_MARKER);
  const tree = treeFingerprint(root);
  const last = readJson<{ tree: string; at: string }>(marker);
  if (tree && last?.tree === tree)
    return { ok: true, output: `validate skipped: the tree is the one that passed at ${last.at}` };
  const r = run();
  if (r.ok && tree) {
    mkdirSync(join(root, AUTOMATION_DIR), { recursive: true });
    writeJsonAtomic(marker, { tree, at: new Date().toISOString() });
  }
  return r;
}
function npmValidate(root: string, env: NodeJS.ProcessEnv): { ok: boolean; output: string } {
  try {
    const out = execFileSync('npm', ['run', 'validate'], {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout: 60 * 60_000,
    });
    return { ok: true, output: out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: (err.stdout ?? '') + (err.stderr ?? '') || err.message };
  }
}

function commit(
  git: (args: string[]) => string,
  a: Automation,
  topic: string,
  storyId: string,
  storyRel: string,
  stage: string,
): string | null {
  try {
    if (a.git.commitOn === 'produce-branch') {
      const branch = `produce/${topic}-${storySlug(storyId)}`;
      try {
        git(['checkout', '-q', branch]);
      } catch {
        git(['checkout', '-q', '-b', branch]);
      }
    } else {
      const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      if (branch !== 'main')
        return `git.commitOn is main but the checkout is on ${branch}: the runner never commits to another branch`;
    }
    git([
      'add',
      '-A',
      '--',
      `topics/${topic}`,
      'src/modules/video/bespoke',
      'src/modules/video/remotion/scenes',
      'music',
    ]);
    const staged = git(['diff', '--cached', '--name-only']).trim();
    if (!staged) return null;
    git([
      'commit',
      '-q',
      '-m',
      `produce(${topic}): ${storyId} ${stage}\n\n${storyRel}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`,
    ]);
    return null;
  } catch (e) {
    return `git failed: ${(e as Error).message.split('\n')[0]}`;
  }
}

function writeRunReport(topic: string, storyId: string, root: string, dir: string, entries: JournalEntry[]): void {
  const since = sinceFinish(entries);
  const reviewDir = join(scriptDir(topic, storyId, root), 'video', 'review');
  mkdirSync(reviewDir, { recursive: true });
  const prompts = since.filter((e) => e.kind === 'prompt');
  const runs = since.filter((e) => e.kind === 'run');
  const lines = [
    `# Run report: ${topic} ${storyId}`,
    '',
    `Unattended run (npm run run -- story), ${since[0]?.at ?? ''} to ${since.at(-1)?.at ?? ''}; journal in ${dir}.`,
    '',
    '## Agents',
    ...prompts.map(
      (e) =>
        `- ${e.step} (session ${e.sessionId ?? '?'}, ${(e.costUsd ?? 0).toFixed(2)} USD${e.error ? `, ${e.error}` : ''})`,
    ),
    '',
    '## Commands',
    ...runs.map(
      (e) => `- ${e.step} (exit ${e.exit}, ${Math.round((e.ms ?? 0) / 1000)} s${e.error ? `, ${e.error}` : ''})`,
    ),
    '',
    '## Guard events and halts',
    ...since.filter((e) => e.kind === 'halt' || e.kind === 'guard').map((e) => `- ${e.step}: ${e.error ?? ''}`),
    '',
    `Total agent cost: ${since.reduce((s, e) => s + (e.costUsd ?? 0), 0).toFixed(2)} USD.`,
    '',
  ];
  writeFileSync(join(reviewDir, 'run-report.md'), lines.join('\n'));
}
