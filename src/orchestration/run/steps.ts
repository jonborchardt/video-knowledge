// One board step, executed: a `run` step is a module CLI as a timed child with only its verb's secrets (spec §4.6,
// layer 3); a `prompt` step is a budgeted agent (agent.ts) followed by the brief's validator, run by the runner,
// whose findings go back to the same session for a bounded number of rounds; a `do` step is a person's.
import { spawn as nodeSpawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentRole, Automation } from '../../shared/automation';
import { cliArgv } from '../../shared/cli';
import type { Step } from '../production';
import { type AgentResult, type ModelUsage, runAgent, UNATTENDED } from './agent';
import { type AttemptRecord, writeAttempt } from './journal';
import { killTree } from './proc';
import type { Subject } from './roles';

export interface StepOutcome {
  kind: Step['kind'];
  ok: boolean;
  exit: number | null;
  ms: number;
  costUsd: number;
  sessionId: string | null;
  error: string | null;
  log: string;
  pid?: number;
  /** The tree guard (Task 6) refused the agent's changes: the halt is unexpected-edit, not no-progress. */
  guardFailed?: boolean;
  rounds?: number;
  /** The agent's final reply (a notes agent's output is its reply). */
  text?: string;
  /** M3: the usage over every attempt of a prompt step (the alias asked for, every model used with summed tokens and
   *  cost, summed turns and api time, whether any attempt overshot its cap); absent on a run step. */
  modelRequested?: string;
  models?: ModelUsage[];
  turns?: number;
  apiMs?: number;
  overCap?: boolean;
}

/** The journal fields of a step's outcome (spread into the runner's journal line): the exit, time, cost, session and
 *  error of every step, and a prompt step's usage. */
export function outcomeFields(out: StepOutcome) {
  const usage =
    out.kind === 'prompt' && out.modelRequested !== undefined
      ? {
          modelRequested: out.modelRequested,
          models: out.models,
          turns: out.turns,
          apiMs: out.apiMs,
          rounds: out.rounds,
          overCap: out.overCap,
        }
      : {};
  return {
    exit: out.exit,
    ms: out.ms,
    costUsd: out.costUsd,
    sessionId: out.sessionId ?? undefined,
    error: out.error ?? undefined,
    ...usage,
  };
}

/** Per-model usage summed across attempts (one entry per model version; nothing is attributed across models). */
export function sumModels(lists: ModelUsage[][]): ModelUsage[] {
  const by = new Map<string, ModelUsage>();
  for (const m of lists.flat()) {
    const cur = by.get(m.model);
    if (!cur) by.set(m.model, { ...m, tokens: { ...m.tokens } });
    else {
      cur.costUsd += m.costUsd;
      cur.tokens.input += m.tokens.input;
      cur.tokens.output += m.tokens.output;
      cur.tokens.cacheRead += m.tokens.cacheRead;
      cur.tokens.cacheCreate += m.tokens.cacheCreate;
    }
  }
  return [...by.values()];
}

/** `npm run <cli> -- <args>` → the cli and its args, with `<approver>` filled in; anything else null. */
export function parseRun(text: string, approver: string): { cli: string; args: string[] } | null {
  const m = /^npm run ([a-z-]+)(?: -- (.*))?$/.exec(text.trim());
  if (!m) return null;
  const args: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const t of (m[2] ?? '').matchAll(re)) args.push((t[1] ?? t[2] ?? t[3]).replace('<approver>', approver));
  return { cli: m[1], args };
}

export function timeoutFor(a: Automation, cli: string, args: string[]): number {
  const t = a.runs.stepTimeoutMinutes;
  return (t[args[0]] ?? t[cli] ?? t.default ?? 30) * 60_000;
}

const SECRET_KEY = /^(MAIL_|X_|AZURE_|YOUTUBE_|APPROVAL_|OPENAI_|ANTHROPIC_)/;
const FAMILY: Record<string, RegExp | undefined> = {
  publish: /^(YOUTUBE_|APPROVAL_)/,
  social: /^X_/,
  topics: /^APPROVAL_/, // the batch id
  article: /^APPROVAL_/, // the correction request id
};

/** The environment a child CLI gets: every secret family removed, then one family back by verb (`publish` →
 *  YouTube and the approval secret, `social` → X; no video verb: `final` narrates through a worker); every verb is told not to load .env itself (VK_NO_DOTENV), so a
 *  child holds exactly the keys the runner handed it and a process that loads agent code holds none. */
export function envFor(cli: string, args: string[], env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keep = FAMILY[cli]; // the Azure key never: `video final` narrates through a worker that loads .env itself
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === 'VK_AGENT' || k === 'VK_WRITABLE' || k === 'VK_SHELL') continue;
    // the runner's own runtime (tsx's tsconfig path, node options) is not the child's: a child is `npm run <verb>`
    // with its own tsx, and a test it spawns in a temp cwd broke on a tsconfig path relative to the repo
    if (k === 'NODE_OPTIONS' || k.startsWith('TSX_')) continue;
    if (!SECRET_KEY.test(k) || keep?.test(k)) out[k] = v;
  }
  out.VK_NO_DOTENV = '1'; // the child never reloads .env: it holds exactly the keys above, handed by the runner
  return out;
}

const briefOf = (s: Step): string | null => /briefs\/([\w-]+\.md)/.exec(s.text)?.[1] ?? null;

export function roleOf(step: Step): AgentRole {
  const b = briefOf(step) ?? '';
  if (
    [
      'script-review.md',
      'article-review.md',
      'visual-review.md',
      'stories.md',
      'shorts-review.md',
      'shorts.md',
    ].includes(b)
  )
    return 'reviewer';
  if (['graphics.md', 'video-fix.md'].includes(b)) return 'graphics';
  if (['extract.md', 'sources.md', 'merge.md', 'evidence.md'].includes(b)) return 'extraction';
  if (['collect.md', 'studies.md', 'new-sources.md'].includes(b)) return 'collect';
  if (b === 'discover.md') return 'discovery';
  if (b === 'proposal-review.md') return 'proposalReview';
  if (b === 'draft-review.md') return 'draftReview';
  if (b === 'revision-note.md') return 'notes';
  if (!b && /^Find studies/.test(step.text)) return 'collect';
  return 'writer';
}

/** The deterministic check the brief used to run itself, now the runner's; null when the brief has none. */
export function validatorFor(step: Step, topic: string, storyId: string): { cli: string; args: string[] } | null {
  if (step.kind !== 'prompt') return null;
  switch (briefOf(step)) {
    case 'script.md':
    case 'script-review.md':
      return { cli: 'script', args: ['validate', topic, storyId] };
    case 'storyboard.md':
      return { cli: 'script', args: ['storyboard', topic, storyId] };
    case 'article.md':
    case 'article-review.md':
      return { cli: 'article', args: ['validate', topic, storyId] };
    case 'stories.md':
      return { cli: 'stories', args: ['discover', topic] };
    case 'shorts.md':
      return { cli: 'shorts', args: ['discover', topic, storyId] };
    case 'graphics.md':
    case 'visual-review.md':
    case 'video-fix.md':
      return { cli: 'video', args: ['check', topic, storyId] };
    case 'discover.md': // the new proposals (no review yet), whatever slugs the agent chose
      return { cli: 'topics', args: ['validate', '--fresh'] };
    case 'collect.md':
      return { cli: 'evidence', args: ['lists', topic] };
    case 'extract.md': {
      const out = /^Write: (\S+)$/m.exec(step.text)?.[1];
      return out ? { cli: 'evidence', args: ['check-batch', topic, out] } : null;
    }
    case 'merge.md':
      return { cli: 'evidence', args: ['check-merges', topic] };
    case 'sources.md':
    case 'new-sources.md': {
      const out = /^Write: (\S+)$/m.exec(step.text)?.[1];
      return out ? { cli: 'evidence', args: ['check-verdicts', out] } : null;
    }
    case 'proposal-review.md': // `topic` carries the proposal's slug for this role
      return { cli: 'topics', args: ['validate', topic, '--review'] };
    default:
      return null;
  }
}

/** The tree guard as the runner wires it: `agent` scope after an agent turn (the role's exact files), `child` scope
 *  after a child CLI (the topic's folder: a CLI writes derived artifacts there and nowhere else). */
export interface GuardHook {
  (scope: 'agent' | 'child'): { ok: boolean; why: string; kept?: string[] };
}

export interface StepContext {
  topic: string;
  storyId: string;
  /** A proposal's slug (the proposal-review role's one file). */
  slug?: string;
  root: string;
  approver: string;
  notes?: string;
  role: AgentRole;
  logPath: string;
  env?: NodeJS.ProcessEnv;
  spawn?: typeof nodeSpawn;
  /** The executable and argv for `npm run <cli> -- <args>` (tests inject a fake step). */
  argvOf?: (cli: string, args: string[]) => [string, string[]];
  timeoutMs?: number;
  tmpDir?: string;
  otherLocksAlive?: () => boolean;
  /** Runs after every agent turn and after the validator child (the tree guard, wired by the runner); a failure ends
   *  the step. */
  guard?: GuardHook;
  /** Runs on a graphics agent's kept components after a passing guard and before the validator could load them. */
  componentCheck?: (kept: string[]) => { ok: boolean; output: string };
  budgetUsd?: number;
  /** Told the pid of every child or agent as it spawns (the lock records it so a takeover can kill it). */
  onSpawn?: (pid: number) => void;
  /** Where a prompt step records its attempts: the run folder and the journal line the runner will write for the
   *  step (`nextLine(dir)`; a parallel slice gets consecutive lines). Without it nothing is recorded. */
  attempts?: { dir: string; line: number; runId?: string };
}

const RENDER_VERBS = new Set(['render', 'spike', 'final']);
export function cleanRenderTemp(dir = tmpdir()): string[] {
  const gone: string[] = [];
  if (!existsSync(dir)) return gone;
  for (const name of readdirSync(dir))
    if (/^(remotion-webpack-bundle-|react-motion-render)/.test(name)) {
      rmSync(join(dir, name), { recursive: true, force: true });
      gone.push(name);
    }
  return gone;
}

interface ChildResult {
  exit: number | null;
  ms: number;
  pid: number;
  timedOut: boolean;
  tail: string;
}

function runChild(
  exe: string,
  argv: string[],
  o: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    logPath: string;
    timeoutMs: number;
    spawn?: typeof nodeSpawn;
    onSpawn?: (pid: number) => void;
  },
): Promise<ChildResult> {
  const spawn = o.spawn ?? nodeSpawn;
  const t0 = Date.now();
  const fd = openSync(o.logPath, 'a');
  let tail = '';
  return new Promise((resolve) => {
    const child = spawn(exe, argv, {
      cwd: o.cwd,
      env: o.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    let timedOut = false;
    if (child.pid) o.onSpawn?.(child.pid);
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, o.timeoutMs);
    const onData = (d: Buffer) => {
      writeSync(fd, d);
      tail = (tail + d.toString()).slice(-4000);
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    const done = (exit: number | null) => {
      clearTimeout(timer);
      closeSync(fd);
      resolve({ exit, ms: Date.now() - t0, pid: child.pid ?? -1, timedOut, tail });
    };
    child.on('error', (e) => {
      tail += `\n${e.message}`;
      done(null);
    });
    child.on('close', (code) => done(code));
  });
}

const lastResult = (tail: string): string | null =>
  tail
    .trim()
    .split('\n')
    .findLast((l) => l.startsWith('RESULT:'))
    ?.trim() ?? null;

export async function execStep(a: Automation, s: Step, ctx: StepContext): Promise<StepOutcome> {
  const base = { kind: s.kind, costUsd: 0, sessionId: null, log: ctx.logPath };
  if (s.kind === 'do') return { ...base, ok: false, exit: null, ms: 0, error: `a person's step: ${s.text}` };
  if (s.kind === 'run') {
    const r = parseRun(s.text, ctx.approver);
    if (!r) return { ...base, ok: false, exit: null, ms: 0, error: `not a command: ${s.text}` };
    if (RENDER_VERBS.has(r.args[0]) && !(ctx.otherLocksAlive?.() ?? false)) cleanRenderTemp(ctx.tmpDir);
    const [exe, argv] = (ctx.argvOf ?? cliArgv)(r.cli, r.args);
    const c = await runChild(exe, argv, {
      cwd: ctx.root,
      env: envFor(r.cli, r.args, ctx.env),
      logPath: ctx.logPath,
      timeoutMs: ctx.timeoutMs ?? timeoutFor(a, r.cli, r.args),
      spawn: ctx.spawn,
      onSpawn: ctx.onSpawn,
    });
    const result = lastResult(c.tail);
    const ok = !c.timedOut && c.exit === 0 && (result === null || result.startsWith('RESULT: PASSED'));
    const error = c.timedOut
      ? 'timeout'
      : ok
        ? null
        : (result ?? `exit ${c.exit}: ${c.tail.trim().split('\n').slice(-3).join(' | ')}`);
    return { ...base, ok, exit: c.exit, ms: c.ms, error, pid: c.pid };
  }
  // prompt: the agent, the guard, the validator, and the findings back to the same session
  const subject: Subject = { topic: ctx.topic, storyId: ctx.storyId, ...(ctx.slug && { slug: ctx.slug }) };
  const validator = validatorFor(s, ctx.topic, ctx.storyId);
  let prompt = ctx.notes ? `${s.text}\n\nNotes:\n${ctx.notes}` : s.text;
  let resume: string | undefined;
  let cost = 0;
  let ms = 0;
  let last: AgentResult | null = null;
  const results: AgentResult[] = [];
  const budgetUsd = ctx.budgetUsd ?? a.agents.budgetUsd.perAgent;
  const stepLine = s.text.split('\n')[0].slice(0, 200);
  /** The usage over every attempt so far, spread into each outcome below. */
  const usage = () => ({
    modelRequested: a.agents.models[ctx.role],
    models: sumModels(results.map((r) => r.models)),
    turns: results.reduce((n, r) => n + (r.turns ?? 0), 0),
    apiMs: results.reduce((n, r) => n + (r.apiMs ?? 0), 0),
    overCap: results.some((r) => r.overCap),
  });
  for (let round = 0; round <= a.runs.validationRounds; round++) {
    const open: AttemptRecord = {
      line: ctx.attempts?.line ?? 0,
      round: round + 1,
      ...(ctx.attempts?.runId && { runId: ctx.attempts.runId }),
      at: new Date().toISOString(),
      finishedAt: null,
      step: stepLine,
      role: ctx.role,
      modelRequested: a.agents.models[ctx.role],
      models: [],
      effort: a.agents.effort,
      turns: null,
      costUsd: 0,
      budgetUsd,
      overCap: false,
      ms: 0,
      apiMs: null,
      exit: null,
      isError: false,
      subtype: null,
      stopReason: null,
      errors: [],
      denials: [],
      sessionId: resume ?? null,
      resumedFrom: resume ?? null,
    };
    const record = (r: AttemptRecord) => ctx.attempts && writeAttempt(ctx.attempts.dir, r);
    last = await runAgent(
      a,
      {
        role: ctx.role,
        subject,
        prompt,
        cwd: ctx.root,
        budgetUsd,
        timeoutMs: ctx.timeoutMs ?? a.runs.agentTimeoutMinutes * 60_000,
        appendSystem: UNATTENDED,
        resume,
      },
      {
        env: ctx.env,
        spawn: ctx.spawn,
        onSpawn: (pid) => {
          record({ ...open, pid });
          ctx.onSpawn?.(pid);
        },
      },
    );
    results.push(last);
    record({
      ...open,
      finishedAt: new Date().toISOString(),
      models: last.models,
      turns: last.turns,
      costUsd: last.costUsd,
      overCap: last.overCap,
      ms: last.ms,
      apiMs: last.apiMs,
      exit: last.exit,
      isError: last.isError,
      subtype: last.subtype,
      stopReason: last.stopReason,
      errors: last.ok ? last.errors : [...last.errors, ...(last.error ? [last.error] : [])],
      denials: last.denials.map((d) => d.tool),
      sessionId: last.sessionId,
    });
    cost += last.costUsd;
    ms += last.ms;
    resume = last.sessionId ?? undefined;
    /** This round's outcome: everything the round knows, then what differs. */
    const result = (
      ok: boolean,
      exit: number | null,
      error: string | null,
      extra: Partial<StepOutcome> = {},
    ): StepOutcome => ({
      ...base,
      ...usage(),
      ok,
      exit,
      ms,
      costUsd: cost,
      sessionId: last?.sessionId ?? null,
      error,
      rounds: round + 1,
      ...extra,
    });
    const guarded = (why: string) => result(false, last?.exit ?? null, why, { guardFailed: true });
    const g = ctx.guard?.('agent') ?? { ok: true, why: '', kept: [] };
    if (!g.ok) return guarded(g.why);
    if (ctx.role === 'graphics' && ctx.componentCheck) {
      const components = (g.kept ?? []).filter((p) => /\.(tsx|ts)$/.test(p) && p.startsWith('src/'));
      if (components.length) {
        const c = ctx.componentCheck(components);
        if (!c.ok) return guarded(`component check failed: ${c.output}`);
      }
    }
    if (!last.ok) return result(false, last.exit, last.error ?? 'agent failed', { text: last.text });
    if (!validator) return result(true, last.exit, null, { text: last.text });
    const [exe, argv] = (ctx.argvOf ?? cliArgv)(validator.cli, validator.args);
    const v = await runChild(exe, argv, {
      cwd: ctx.root,
      env: envFor(validator.cli, validator.args, ctx.env),
      logPath: ctx.logPath,
      timeoutMs: timeoutFor(a, validator.cli, validator.args),
      spawn: ctx.spawn,
      onSpawn: ctx.onSpawn,
    });
    ms += v.ms;
    const after = ctx.guard?.('child') ?? { ok: true, why: '' };
    if (!after.ok) return guarded(after.why);
    const findings = v.tail.trim().split('\n').slice(-40).join('\n');
    if (v.exit === 0 && !v.timedOut) return result(true, v.exit, null, { text: last.text });
    if (round === a.runs.validationRounds || !resume)
      return result(false, v.exit, `validator ${validator.cli} ${validator.args[0]} failed: ${findings}`);
    prompt = `The validator (npm run ${validator.cli} -- ${validator.args.join(' ')}) reports:\n${findings}\n\nFix the file you wrote and stop.`;
  }
  return {
    ...base,
    ...usage(),
    ok: false,
    exit: last?.exit ?? null,
    ms,
    costUsd: cost,
    sessionId: last?.sessionId ?? null,
    error: 'no rounds',
  };
}
