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
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, topicDir, writeJsonAtomic } from '../../shared/io';
import type { ExtractionBatch } from '../../modules/evidence';
import { type RecordedMarker, type ReviewRounds, type StudiesRounds, type TopicNext, topicNext } from '../research';
import type { Step } from '../production';
import { guard as realGuard, snapshot as realSnapshot, type TreeSnapshot } from './guard';
import {
  type Halt,
  type JournalEntry,
  type RunHaltKind,
  TOPIC_RUN_DIR,
  appendJournal,
  readJournal,
  topicRunDir,
  writeHalt,
} from './journal';
import { type Lock, acquire, heartbeat, release, setChild } from './lock';
import { killTree } from './proc';
import { type RoleGrant, grantFor } from './roles';
import { type RunResult, addSpend, isoWeek, runValidate, weekSpend } from './runner';
import { type StepContext, type StepOutcome, envFor, execStep as realExecStep, parseRun, roleOf } from './steps';

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

const readMarker = (dir: string): RecordedMarker =>
  readJson<RecordedMarker>(join(dir, RECORDED_FILE)) ?? { files: [], documents: [] };
const writeMarker = (dir: string, m: RecordedMarker) => writeJsonAtomic(join(dir, RECORDED_FILE), m);
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
  const git = (args: string[]): string =>
    o.git === 'none'
      ? ''
      : o.git
        ? o.git(args)
        : execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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
  const beat = setInterval(() => heartbeat(dir, lock, now), 60_000);
  hooks.snapshot();
  let cost = 0;
  let iterations = 0;
  let stepNo = readJournal(dir).length;
  let lastKey: string | null = null;
  let attempt = 0;
  let lastNext: TopicNext = { topic, stage: 'proposal', next: '', steps: [], halt: null, done: false };
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
    const g = hooks.guard('child');
    if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
    const v = validate(envFor('validate', [], o.env ?? process.env));
    if (!v.ok)
      return halt(
        'step-failed',
        `npm run validate failed: ${v.output.trim().split('\n').slice(-5).join(' | ')}`,
        { kind: 'fix', text: `fix what validate reports, then npm run run -- topic ${topic}` },
        n,
      );
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
        git([
          'add',
          '-A',
          '--',
          ...childWritable.map((p) => p.replace(/\/\*\*$/, '')).filter((p) => existsSync(join(root, p))),
        ]);
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
    journal({ stage: n.stage, next: n.next, step: 'finish', kind: 'finish', attempt: 0 });
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'done', stage: n.stage, halt: null, iterations, costUsd: cost };
  };
  const ctxOf = (step: Step, role: ReturnType<typeof roleOf>): StepContext => {
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
      guard: (scope) => hooks.guard(scope),
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
      exit: out.exit,
      ms: out.ms,
      costUsd: out.costUsd,
      sessionId: out.sessionId ?? undefined,
      error: out.error ?? undefined,
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
      files: [...new Set([...m.files, ...files])],
      documents: [...new Set([...m.documents, ...documents])],
    });
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
          const outs: StepOutcome[] = [];
          for (let j = 0; j < group.length; j += a.runs.maxParallelAgents) {
            const slice = group.slice(j, j + a.runs.maxParallelAgents);
            for (const s of slice) {
              const b = budgetProblem();
              if (b)
                return halt(
                  'budget',
                  b,
                  { kind: 'decide', text: 'raise agents.budgetUsd or wait for the next week' },
                  n,
                );
              void s;
            }
            const results = await Promise.all(
              slice.map((s) => exec(a, s, { ...ctxOf(s, role), budgetUsd: a.agents.budgetUsd.perAgent })),
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
            }
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
        const g = hooks.guard('child');
        if (!g.ok) return halt('unexpected-edit', g.why, { kind: 'fix', text: 'the files were reverted' }, n);
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
