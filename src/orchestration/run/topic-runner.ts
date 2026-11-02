// The topic runner (spec §5.2, §4.6; phase 5 Task 4): the story runner's loop over `topicNext` for one approved
// proposal. Agents run under their research role's grant (extraction, collect, notes, the stories reviewer), the
// parallel ones (one extraction agent per group, one sources agent per batch of documents) at most
// `maxParallelAgents` at a time; every store write is a child CLI the runner runs (`record` serially, resumed with
// `--from` after a partial failure; `record-sources` never with `--replace-cited`); the runner keeps its markers under
// topics/<topic>/work/run/ (what was recorded, which documents were judged, the study and review rounds); a topic the
// board says cannot proceed is parked with `topics -- park`, never handed to a person for repair; `needs-person` is
// kept for a `record-sources` refusal on a cited pair and a topic without an approved proposal. The finish validates
// and commits the topic's own paths (and the proposal, the institution claim, the brand assets) on main.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, topicDir, writeJsonAtomic, sha } from '../../shared/io';
import type { ExtractionBatch } from '../../modules/evidence';
import {
  FETCHED_FILE,
  type RecordedMarker,
  type ReviewRounds,
  type StudiesRounds,
  type TopicNext,
  listsFingerprint,
  topicNext,
} from '../research';
import type { Step } from '../production';
import { guard as realGuard, snapshot as realSnapshot, type TreeSnapshot } from './guard';
import {
  type Halt,
  type JournalEntry,
  type RunHaltKind,
  TOPIC_RUN_DIR,
  appendJournal,
  nextLine,
  clearHalt,
  readJournal,
  topicRunDir,
  writeHalt,
  writeValidateLog,
} from './journal';
import { type Lock, acquire, heartbeat, release, setChild } from './lock';
import { killTree } from './proc';
import { type RoleGrant, grantFor } from './roles';
import { type RunResult, addSpend, isoWeek, runValidate, weekSpend } from './runner';
import { claimEdit, claimedBy } from '../../modules/topic-discovery';
import {
  type StepContext,
  type StepOutcome,
  outcomeFields,
  envFor,
  execStep as realExecStep,
  parseRun,
  roleOf,
  validatorFor,
} from './steps';

export interface TopicRunOptions {
  root?: string;
  ask?: typeof topicNext;
  exec?: typeof realExecStep;
  now?: () => number;
  runId?: string;
  /** `'none'` in tests; the default runs git in `root`. */
  git?: 'none' | ((args: string[]) => string);
  validate?: (env: NodeJS.ProcessEnv) => { ok: boolean; output: string };
  env?: NodeJS.ProcessEnv;
  hooks?: {
    snapshot?: () => void;
    guard?: (scope: 'agent' | 'child') => { ok: boolean; why: string; kept?: string[] };
  };
  argvOf?: StepContext['argvOf'];
}

const FORBIDDEN = /--replace-cited|--force\b/;
export const RECORDED_FILE = 'recorded.json';
export const STUDIES_ROUNDS_FILE = 'studies-rounds.json';
export const REVIEW_ROUNDS_FILE = 'review-rounds.json';
/** M3 1.4, operation ownership: what the run's child steps changed outside the topic and the proposal (the brand
 *  step's files with their sha after the step; whether `topics claim` ran), so the finish stages exactly that. */
export const TOUCHED_FILE = 'touched.json';
export interface Touched {
  claimed: boolean;
  /** Every path a step of the run wrote (the guard's diff after the step), with its sha then ('deleted' when it
   *  removed it): the only paths the finish stages. */
  paths: Record<string, string>;
  /** Paths that changed between steps (the guard's diff before a step): a person's hand, never the run's. Excluded
   *  from the commit; one the run also wrote halts the finish. */
  foreign?: string[];
}
/** M3 1.4, the initial snapshot: the paths dirty before the run first started; never staged by its finish. */
export const PRE_DIRTY_FILE = 'pre-dirty.json';

const readMarker = (dir: string): RecordedMarker =>
  readJson<RecordedMarker>(join(dir, RECORDED_FILE)) ?? { files: [], documents: [] };
const writeMarker = (dir: string, m: RecordedMarker) => writeJsonAtomic(join(dir, RECORDED_FILE), m);
/** Briefs whose output is a batch file its own check validates: on a resume the file stands for the agent's work
 *  (never a review or a proposal: the board asks for those again on purpose). */
const CHECKPOINT_BRIEFS = new Set(['extract.md', 'merge.md', 'sources.md', 'new-sources.md']);
const docsOf = (text: string): string[] =>
  (/^Documents: (.+)$/m.exec(text)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const countDocs = (topic: string, root: string): number => {
  const d = join(topicDir(topic, root), 'sources');
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.txt')).length : 0;
};
const spendOf = (entries: JournalEntry[]): number => entries.reduce((s, e) => s + (e.costUsd ?? 0), 0);

export async function runTopic(topic: string, a: Automation, o: TopicRunOptions = {}): Promise<RunResult> {
  const root = o.root ?? ROOT;
  const ask = o.ask ?? topicNext;
  const exec = o.exec ?? realExecStep;
  const now = o.now ?? Date.now;
  const dir = topicRunDir(topic, root);
  const acquired = acquire(dir, `topic ${topic}`, { now });
  if ('held' in acquired) return { outcome: 'held', stage: '', halt: null, iterations: 0, costUsd: 0 };
  const lock: Lock = acquired.lock;
  const runId = o.runId ?? lock.runId;
  const stamp = () => new Date(now()).toISOString();
  const journal = (e: Omit<JournalEntry, 'at' | 'runId'>) => appendJournal(dir, { at: stamp(), runId, ...e });
  const git = (args: string[], input?: string): string =>
    o.git === 'none'
      ? ''
      : o.git
        ? o.git(args)
        : execFileSync('git', args, {
            cwd: root,
            encoding: 'utf8',
            stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
            input,
          });
  /** Every dirty path (tracked changes and untracked files), posix. */
  const dirtyPaths = (): string[] =>
    git(['status', '--porcelain', '--untracked-files=all', '-z'])
      .split('\0')
      .filter((e) => e.length >= 4)
      .map((e) => e.slice(3).replaceAll('\\', '/'));
  const ownedAlways = (p: string) =>
    p.startsWith(`topics/${topic}/`) || p === `proposals/${topic}.json` || p === `proposals/${topic}.review.json`;
  const readTouched = (): Touched =>
    readJson<Touched>(join(dir, TOUCHED_FILE)) ?? { claimed: false, paths: {}, foreign: [] };
  const shaOf = (p: string) => (existsSync(join(root, p)) ? sha(readFileSync(join(root, p))) : 'deleted');
  /** Records what a step wrote (the guard's diff right after it names the paths), with the sha it left. */
  const noteTouched = (kept: string[] | undefined) => {
    if (!kept?.length) return;
    const t = readTouched();
    for (const p of kept) {
      if (p === 'src/config/site.ts') t.claimed = true;
      else t.paths[p] = shaOf(p);
    }
    writeJsonAtomic(join(dir, TOUCHED_FILE), t);
  };
  /** Records what changed between steps (the guard's diff right before a step): not the run's, a person's. */
  const noteForeign = (kept: string[] | undefined) => {
    if (!kept?.length) return;
    const t = readTouched();
    t.foreign = [...new Set([...(t.foreign ?? []), ...kept])];
    writeJsonAtomic(join(dir, TOUCHED_FILE), t);
  };
  /** The guard after a step, in either scope, with what it kept recorded as the step's. */
  const guarded = (scope: 'agent' | 'child') => {
    const g = hooks.guard(scope);
    noteTouched(g.kept);
    return g;
  };
  const childGuard = () => guarded('child');
  const validate = o.validate ?? ((env) => runValidate(root, env));
  let snap: TreeSnapshot | null = null;
  let currentGrant: RoleGrant = grantFor('extraction', { topic });
  // the child scope: a research CLI writes anywhere in the topic (the store included: record and record-sources are
  // its writers here), the proposal, the institution claim and the brand assets; the machinery stays protected by
  // the guard's own by-name rule
  const childWritable = [
    `topics/${topic}/**`,
    `proposals/${topic}.json`,
    `proposals/${topic}.review.json`,
    'src/config/site.ts',
    'brand/**',
    'public/commissions/**',
  ];
  // the topic's own files are untracked until the finish commit: the snapshot holds their content, so an agent's
  // overwrite of a store file is restored, not deleted
  const hold = [`topics/${topic}/**`];
  const hooks = {
    snapshot: o.hooks?.snapshot ?? (() => void (snap = realSnapshot(root, { hold }))),
    guard:
      o.hooks?.guard ??
      ((scope: 'agent' | 'child') => {
        if (!snap) snap = realSnapshot(root, { hold });
        const g =
          scope === 'agent'
            ? realGuard(snap, root, [...currentGrant.writable, ...currentGrant.derived], {
                newFilesOnly: currentGrant.newFilesOnly,
                additiveOnly: currentGrant.additiveOnly,
                deny: currentGrant.deny,
              })
            : realGuard(snap, root, childWritable);
        snap = realSnapshot(root, { hold });
        return {
          ok: g.ok,
          why: [
            ...g.reverted.map((p) => `reverted ${p}`),
            ...g.restored.map((p) => `restored ${p}`),
            ...g.reported.map((p) => `changed outside the repo: ${p}`),
          ].join('; '),
          kept: g.kept,
        };
      }),
  };
  if (o.git !== 'none' && !existsSync(join(dir, PRE_DIRTY_FILE)))
    writeJsonAtomic(join(dir, PRE_DIRTY_FILE), { paths: dirtyPaths() });
  if (acquired.tookOver?.childPid) killTree(acquired.tookOver.childPid);
  if (readJournal(dir).length || acquired.tookOver)
    journal({
      stage: '',
      next: '',
      step: 'resume',
      kind: 'resume',
      attempt: 0,
      error: acquired.tookOver ? `took over ${acquired.tookOver.runId}` : undefined,
    });
  clearHalt(dir); // a resume asks the board anew; the halt returns if the cause is still there
  const beat = setInterval(() => heartbeat(dir, lock, now), 60_000);
  hooks.snapshot();
  let cost = 0;
  let iterations = 0;
  let stepNo = readJournal(dir).length;
  let lastKey: string | null = null;
  let attempt = 0;
  let lastNext: TopicNext = { topic, stage: 'proposal', next: '', steps: [], halt: null, done: false };
  let preLeft: string[] = [];
  let handLeft: string[] = [];
  const approver = `automated: topic run ${runId}`;

  const halt = (kind: RunHaltKind, why: string, unblock: Halt['unblock'], n: TopicNext): RunResult => {
    const h: Halt = { kind, stage: n.stage, why, unblock, at: stamp(), runId, board: { stage: n.stage, next: n.next } };
    writeHalt(dir, h);
    journal({ stage: n.stage, next: n.next, step: kind, kind: 'halt', attempt, error: why });
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'halted', stage: n.stage, halt: h, iterations, costUsd: cost };
  };
  const finish = (n: TopicNext): RunResult => {
    // whatever changed since the last step's guard is not the run's
    const g = hooks.guard('child');
    noteForeign(g.kept);
    if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
    const v = validate(envFor('validate', [], o.env ?? process.env));
    if (!v.ok) {
      const log = writeValidateLog(dir, v.output);
      return halt(
        'step-failed',
        `npm run validate failed: ${v.output.trim().split('\n').slice(-5).join(' | ')}`,
        { kind: 'fix', text: `read ${log}; fix what validate reports, then npm run run -- topic ${topic}` },
        n,
      );
    }
    if (o.git !== 'none') {
      try {
        if (a.git.commitOn === 'main') {
          const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
          if (branch !== 'main')
            return halt(
              'git',
              `git.commitOn is main but the checkout is on ${branch}`,
              { kind: 'fix', text: 'check out main in the clone' },
              n,
            );
        }
        // operation ownership and the initial snapshot: the topic's and the proposal's paths that were not dirty
        // before the run; the brand step's own files, only if nobody touched them since; the claim's own line of
        // site.ts (never a person's hunk). A person's concurrent edit to an owned path is refused, nothing staged.
        const pre = new Set(readJson<{ paths: string[] }>(join(dir, PRE_DIRTY_FILE))?.paths ?? []);
        const dirty = dirtyPaths();
        const touched = readTouched();
        const byHand = new Set(touched.foreign ?? []);
        // a path the run wrote that a person also changed (between steps, or after the step wrote it) cannot be
        // separated: the finish halts, stages nothing, and the person's edit stays on disk
        const moved = Object.entries(touched.paths)
          .filter(([p, was]) => byHand.has(p) || shaOf(p) !== was)
          .map(([p]) => p);
        if (moved.length)
          return halt(
            'git',
            `edited by hand during the run, after the run wrote them: ${moved.join(', ')}`,
            {
              kind: 'fix',
              text: `separate your edit from the run's (commit or stash it), then npm run run -- topic ${topic}`,
            },
            n,
          );
        // a person's staging is never the run's: an index that already holds changes is refused, left as it is
        const foreign = git(['diff', '--cached', '--name-only']).trim();
        if (foreign)
          return halt(
            'git',
            `the index already holds staged changes that are not the run's: ${foreign.split('\n').join(', ')}`,
            { kind: 'fix', text: `commit or unstage them (git reset), then npm run run -- topic ${topic}` },
            n,
          );
        // only what the run's own steps wrote, and of that nothing a person had dirty before the run
        const stage = Object.keys(touched.paths).filter((p) => dirty.includes(p) && !pre.has(p));
        // in batches: a large topic's first commit names thousands of files, past Windows' command-line limit
        for (let i = 0; i < stage.length; i += 50) git(['add', '-A', '--', ...stage.slice(i, i + 50)]);
        if (touched.claimed) stageClaim();
        preLeft = dirty.filter(
          (p) => pre.has(p) && (ownedAlways(p) || p in touched.paths || p === 'src/config/site.ts'),
        );
        handLeft = dirty.filter((p) => byHand.has(p) && !pre.has(p));
        if (git(['diff', '--cached', '--name-only']).trim())
          git([
            'commit',
            '-q',
            '-m',
            `research(${topic}): ${n.stage}\n\nproposals/${topic}.json\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`,
          ]);
      } catch (e) {
        return halt(
          'git',
          `git failed: ${(e as Error).message.split('\n')[0]}`,
          { kind: 'fix', text: 'commit the topic by hand in the clone' },
          n,
        );
      }
    }
    // the snapshot files belong to this run: the next run of the topic starts from its own tree
    for (const f of [PRE_DIRTY_FILE, TOUCHED_FILE]) rmSync(join(dir, f), { force: true });
    journal({
      stage: n.stage,
      next: n.next,
      step: 'finish',
      kind: 'finish',
      attempt: 0,
      error:
        preLeft.length || handLeft.length
          ? [
              ...(preLeft.length ? [`not staged (dirty before the run): ${preLeft.join(', ')}`] : []),
              ...(handLeft.length ? [`not staged (edited by hand during the run): ${handLeft.join(', ')}`] : []),
            ].join('; ')
          : undefined,
    });
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'done', stage: n.stage, halt: null, iterations, costUsd: cost };
  };
  /** Stages the claim's own change to site.ts: HEAD's text with the claim applied, as a blob in the index, so a
   *  person's other hunk in the working file is never committed by the run. A site.ts not in HEAD is staged whole. */
  function stageClaim() {
    const site = 'src/config/site.ts';
    const working = readFileSync(join(root, site), 'utf8');
    const commission = claimedBy(working, topic);
    if (!commission) return;
    let head: string | null;
    try {
      head = git(['show', `HEAD:${site}`]);
    } catch {
      head = null;
    }
    if (head === null) {
      git(['add', '--', site]);
      return;
    }
    const r = claimEdit(head, commission, topic);
    if ('problem' in r || !r.changed) return;
    const blob = git(['hash-object', '-w', '--stdin'], r.source).trim();
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${site}`]);
  }
  const ctxOf = (step: Step, role: ReturnType<typeof roleOf>): StepContext => {
    // what changed since the last guard is a person's: noted as foreign before the step can be blamed for it
    noteForeign(hooks.guard('child').kept);
    const logPath = join(dir, 'steps', `${++stepNo}.log`);
    mkdirSync(join(dir, 'steps'), { recursive: true });
    return {
      topic,
      storyId: '',
      root,
      approver,
      role,
      logPath,
      env: o.env,
      argvOf: o.argvOf,
      guard: (scope) => guarded(scope),
      onSpawn: (pid) => setChild(dir, lock, pid, step.text.split('\n')[0].slice(0, 120)),
    };
  };
  const budgetProblem = (): string | null => {
    const week = isoWeek(new Date(now()));
    const spent = spendOf(readJournal(dir));
    const perAgent = a.agents.budgetUsd.perAgent;
    if (spent + perAgent > a.agents.budgetUsd.perTopic || weekSpend(root, week) + perAgent > a.agents.budgetUsd.perWeek)
      return `topic ${spent.toFixed(2)} of ${a.agents.budgetUsd.perTopic} USD, week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD; the next agent may cost ${perAgent}`;
    return null;
  };
  const record = (n: TopicNext, step: Step, out: StepOutcome, tries: number) =>
    journal({
      stage: n.stage,
      next: n.next,
      step: step.text.split('\n')[0].slice(0, 200),
      kind: step.kind,
      attempt: tries,
      ...outcomeFields(out),
    });
  /** `npm run record` with a resume: a partial failure (the log names the recorded sources) is retried from the next
   *  source of the batch file, up to timeoutsPerStep tries. */
  const runRecord = async (n: TopicNext, step: Step): Promise<StepOutcome> => {
    const parsed = parseRun(step.text, approver)!;
    const file = parsed.args[1];
    const batches = readJson<ExtractionBatch[]>(join(root, file)) ?? [];
    let text = step.text;
    let out!: StepOutcome;
    for (let tries = 1; tries <= a.runs.timeoutsPerStep; tries++) {
      const ctx = ctxOf({ kind: 'run', text }, 'extraction');
      out = await exec(a, { kind: 'run', text }, ctx);
      setChild(dir, lock, null);
      record(n, { kind: 'run', text }, out, tries);
      childGuard(); // this try's writes are the run's, before the next try's guard could read them as a person's
      if (out.ok || out.exit === 2) break;
      const log = existsSync(ctx.logPath) ? readFileSync(ctx.logPath, 'utf8') : '';
      const done = [...log.matchAll(/^(\S+): \d+ claims, \d+ new$/gm)].map((m) => m[1]);
      const last = done.at(-1);
      const i = last ? batches.findIndex((b) => b.video === last) : -1;
      const nextVideo = i >= 0 ? batches[i + 1]?.video : undefined;
      if (!nextVideo) break; // nothing recorded, or everything was: the plain retry is below
      text = `${step.text.replace(/ --from \S+$/, '')} --from ${nextVideo}`;
    }
    return out;
  };
  const markRecorded = (files: string[], documents: string[] = []) => {
    const m = readMarker(dir);
    writeMarker(dir, {
      ...m,
      files: [...new Set([...m.files, ...files])],
      documents: [...new Set([...m.documents, ...documents])],
    });
  };
  /** The sources of the groups extraction agents read: extracted, whatever they found (never grouped again). */
  const markExtracted = (steps: Step[]) => {
    const ids = steps.flatMap((s) => {
      const g = /^Group: (\d+)$/m.exec(s.text)?.[1];
      const file = g && join(topicDir(topic, root), 'work', `grp${g}.txt`);
      return file && existsSync(file)
        ? readFileSync(file, 'utf8')
            .split('\n')
            .map((l) => l.split('\t')[0].trim())
            .filter(Boolean)
        : [];
    });
    if (!ids.length) return;
    const m = readMarker(dir);
    writeMarker(dir, { ...m, extracted: [...new Set([...(m.extracted ?? []), ...ids])] });
  };

  try {
    for (; iterations < a.runs.loopCap; iterations++) {
      const n = ask(topic, root, { a });
      lastNext = n;
      if (n.done) return finish(n);
      if (n.halt)
        return halt(
          'needs-person',
          n.halt.why,
          {
            kind: 'decide',
            text:
              n.halt.kind === 'no-institution'
                ? `npm run topics -- claim ${topic} <commission> --force --by "<name>"`
                : `npm run topics -- approve ${topic} --by "<name>"`,
          },
          n,
        );
      if (n.park) {
        // the thresholds or the reviewer decided: parked with the reason, a digest line, no email, the run ends done
        const step: Step = {
          kind: 'run',
          text: `npm run topics -- park ${topic} --why "${n.park.why.replace(/"/g, "'")}" --by "${approver}"`,
        };
        const out = await exec(a, step, ctxOf(step, 'extraction'));
        setChild(dir, lock, null);
        record(n, step, out, 1);
        childGuard();
        if (!out.ok) return halt('step-failed', `${step.text}: ${out.error}`, { kind: 'run', text: step.text }, n);
        continue;
      }
      const key = `${n.stage}|${n.next}`;
      attempt = key === lastKey ? attempt + 1 : 1;
      lastKey = key;
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
      const docsBefore = countDocs(topic, root);
      for (let i = 0; i < n.steps.length; i++) {
        const step = n.steps[i];
        if (step.kind === 'do') return halt('needs-person', step.text, { kind: 'decide', text: step.text }, n);
        if (step.kind === 'prompt') {
          // consecutive prompts of one brief run in parallel, at most maxParallelAgents at a time
          const brief = /briefs\/([\w-]+\.md)/.exec(step.text)?.[1];
          const group: Step[] = [step];
          while (
            i + 1 < n.steps.length &&
            n.steps[i + 1].kind === 'prompt' &&
            /briefs\/([\w-]+\.md)/.exec(n.steps[i + 1].text)?.[1] === brief
          )
            group.push(n.steps[++i]);
          const role = roleOf(step);
          currentGrant = grantFor(role, { topic });
          // a checkpoint: a step whose output file is on disk and passes the brief's validator was finished before
          // an interruption; it is not paid for again (the merge agent cost 5 USD per resume before this)
          const pending: Step[] = [];
          const skipped: Step[] = [];
          for (const s of group) {
            const outFile = /^Write: (\S+)$/m.exec(s.text)?.[1];
            const v = CHECKPOINT_BRIEFS.has(brief ?? '') ? validatorFor(s, topic, '') : null;
            if (!outFile || !v || !existsSync(join(root, outFile))) {
              pending.push(s);
              continue;
            }
            const check: Step = { kind: 'run', text: `npm run ${v.cli} -- ${v.args.join(' ')}` };
            const out = await exec(a, check, ctxOf(check, role));
            record(n, check, out, 1);
            childGuard();
            if (out.ok) skipped.push(s);
            else pending.push(s);
          }
          const outs: StepOutcome[] = [];
          for (let j = 0; j < pending.length; j += a.runs.maxParallelAgents) {
            const slice = pending.slice(j, j + a.runs.maxParallelAgents);
            const b = budgetProblem();
            if (b)
              return halt('budget', b, { kind: 'decide', text: 'raise agents.budgetUsd or wait for the next week' }, n);
            // the slice's journal lines are written in order right after it: agent k records under line base + k
            const base = nextLine(dir);
            const results = await Promise.all(
              slice.map((s, k) =>
                exec(a, s, {
                  ...ctxOf(s, role),
                  budgetUsd: a.agents.budgetUsd.perAgent,
                  attempts: { dir, line: base + k, runId },
                }),
              ),
            );
            setChild(dir, lock, null);
            results.forEach((out, k) => {
              cost += out.costUsd;
              if (out.costUsd) addSpend(root, isoWeek(new Date(now())), out.costUsd);
              record(n, slice[k], out, 1);
            });
            outs.push(...results);
          }
          const guarded = outs.find((x) => x.guardFailed);
          if (guarded)
            return halt(
              'unexpected-edit',
              `${guarded.error}${guarded.sessionId ? ` (session ${guarded.sessionId})` : ''}`,
              { kind: 'fix', text: `the files were reverted; read the agent's session` },
              n,
            );
          const failed = outs.find((x) => !x.ok);
          if (brief === 'extract.md') markExtracted([...skipped, ...pending.filter((_, k) => outs[k]?.ok)]);
          if (brief === 'studies.md') {
            const r = readJson<StudiesRounds>(join(dir, STUDIES_ROUNDS_FILE)) ?? { rounds: [] };
            r.rounds.push({ at: stamp(), added: countDocs(topic, root) - docsBefore });
            writeJsonAtomic(join(dir, STUDIES_ROUNDS_FILE), r);
          }
          if (brief === 'stories.md') {
            const r = readJson<ReviewRounds>(join(dir, REVIEW_ROUNDS_FILE)) ?? { rounds: 0 };
            writeJsonAtomic(join(dir, REVIEW_ROUNDS_FILE), { rounds: r.rounds + 1 });
          }
          if (brief === 'revision-note.md' && outs[0]?.ok) {
            // the notes are the agent's reply: one `report -- note` per line (register D9)
            for (const line of (outs[0].text ?? '').split('\n')) {
              const m = /^(\S+\/\S+):\s+(.+)$/.exec(line.trim());
              if (!m) continue;
              const s: Step = {
                kind: 'run',
                text: `npm run report -- note ${topic} ${m[1]} "${m[2].replace(/"/g, "'")}"`,
              };
              const out = await exec(a, s, ctxOf(s, 'notes'));
              record(n, s, out, 1);
              childGuard();
            }
          }
          if (failed && brief === 'merge.md' && /check-merges failed/.test(failed.error ?? '')) {
            // the runner's last resort (spec 5.2): the collisions the merge agent left open after its rounds are
            // merged into the existing claims they collide with, and the stage goes on to merge-claims and record
            const s: Step = { kind: 'run', text: `npm run evidence -- collide ${topic} --resolve` };
            const out = await exec(a, s, ctxOf(s, role));
            record(n, s, out, 1);
            const g = childGuard();
            if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
            if (out.ok) continue;
            return halt('step-failed', `${s.text}: ${out.error}`, { kind: 'fix', text: `read ${dir}/steps` }, n);
          }
          if (failed && brief !== 'studies.md' && brief !== 'revision-note.md')
            return halt(
              'step-failed',
              `${step.text.split('\n')[0]}: ${failed.error}`,
              { kind: 'fix', text: `read ${dir}/steps` },
              n,
            );
          continue;
        }
        // a child CLI
        const parsed = parseRun(step.text, approver);
        if (!parsed) return halt('step-failed', `not a command: ${step.text}`, { kind: 'fix', text: `read ${dir}` }, n);
        const forbidden = parsed.args.find((x) => FORBIDDEN.test(x));
        if (forbidden)
          return halt(
            'forbidden-flag',
            `the board asked for ${forbidden}: ${step.text}`,
            { kind: 'fix', text: 'a person runs that flag by hand, never the runner' },
            n,
          );
        const verb = `${parsed.cli} ${parsed.args[0] ?? ''}`.trim();
        let out: StepOutcome;
        if (parsed.cli === 'record') out = await runRecord(n, step);
        else {
          out = await exec(a, step, ctxOf(step, 'extraction'));
          setChild(dir, lock, null);
          record(n, step, out, 1);
        }
        const g = childGuard();
        if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
        // a fetch exits 2 when some listed videos have no captions (recorded and skipped): the lists count as fetched
        // once the last list of the stage ran either way
        const isFetch = parsed.cli === 'watcher' && parsed.args[0] === 'fetch';
        const lastFetch =
          isFetch && !n.steps.slice(i + 1).some((s) => s.kind === 'run' && /watcher -- fetch/.test(s.text));
        if (lastFetch && (out.ok || out.exit === 2))
          writeJsonAtomic(join(dir, FETCHED_FILE), { lists: listsFingerprint(topic, root) });
        if (out.ok) {
          if (parsed.cli === 'record') markRecorded([parsed.args[1].replace(`topics/${topic}/`, '')]);
          if (parsed.cli === 'record-sources') {
            const docs = n.steps
              .filter((s) => s.kind === 'prompt' && /sources\.md/.test(s.text))
              .flatMap((s) => docsOf(s.text));
            markRecorded(
              parsed.args.slice(1).map((f) => f.replace(`topics/${topic}/`, '')),
              docs,
            );
          }
          continue;
        }
        if (out.exit === 2) {
          if (parsed.cli === 'record-sources')
            return halt(
              'needs-person',
              `${step.text}: ${out.error}`,
              {
                kind: 'decide',
                text: `a new verdict would replace one a script cites: run it by hand with --replace-cited if that is right, or edit the sv file`,
              },
              n,
            );
          if (parsed.cli === 'watcher' && parsed.args[0] === 'fetch') continue; // videos without captions: recorded and skipped
          break; // a refusal: ask the board again
        }
        if (out.error === 'timeout')
          return halt('timeout', `${step.text}: timed out`, { kind: 'run', text: `npm run run -- topic ${topic}` }, n);
        return halt('step-failed', `${verb}: ${out.error}`, { kind: 'fix', text: `read ${dir}/steps` }, n);
      }
    }
    return halt(
      'cap',
      `${a.runs.loopCap} loop iterations`,
      { kind: 'run', text: `npm run run -- topic ${topic}` },
      lastNext,
    );
  } catch (e) {
    return halt(
      'step-failed',
      `the topic runner failed: ${(e as Error).message ?? String(e)}`,
      { kind: 'fix', text: `read ${dir}; fix the cause and run the same command` },
      lastNext,
    );
  } finally {
    clearInterval(beat);
  }
}

/** The research jobs the work plane may start: an approved proposal not yet researched, with no live run and no halt. */
export const topicRunFolder = (topic: string, root = ROOT) => join(topicDir(topic, root), 'work', TOPIC_RUN_DIR);
