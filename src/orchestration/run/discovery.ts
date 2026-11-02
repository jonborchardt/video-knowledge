// Weekly topic discovery as a work-plane job (spec §5.1, §4.4, §7.1; phase 4 Task 3). On the discovery slot, for
// every institution with a channel: one discovery agent (role `discovery`, new proposal files only, validated by
// `topics -- validate --fresh` with findings fed back), then one independent review agent per new proposal in a
// fresh session (role `proposalReview`, one file, validated by `topics -- validate <slug> --review`). Then
// `topics -- batch` parks the weak and lists the strong, one email carries the batch id, `topics -- sent` records
// the Message-ID, and proposals/ is committed on main in the clone. Nothing is researched. The slot is recorded in
// schedule.json before any agent runs and the record under .automation/discovery/ grows step by step, so a crash
// resumes where it stopped and never doubles the batch or the mail; the outbox resend carries an unsent mail.
// A review that never completes halts `no-progress` for that slug alone; the rest of the batch goes out.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { commissions, isFixtureTopic } from '../../config/site';
import type { Automation } from '../../shared/automation';
import { type CliResult, runCli } from '../../shared/cli';
import { ROOT } from '../../shared/io';
import type { MailTransport } from '../../shared/mail';
import { PROPOSALS_DIR, loadProposals } from '../../modules/topic-discovery';
import type { Step } from '../production';
import { guard as realGuard, snapshot as realSnapshot, type TreeSnapshot } from './guard';
import type { Halt } from './journal';
import { acquire, release } from './lock';
import { automationDir, readOutbox, sendTracked } from './notify';
import { renderBatch } from './requests';
import { grantFor } from './roles';
import { addSpend, isoWeek, type RunResult, weekSpend } from './runner';
import { lastSlot, readSchedule, updateSchedule } from './schedule';
import { type StepOutcome, type StepContext, envFor, execStep } from './steps';

/** The usage fields of the record's agent runs, from the step outcome. */
const usageOf = (out: StepOutcome): Pick<AgentRun, 'modelRequested' | 'models' | 'turns' | 'ms'> => ({
  modelRequested: out.modelRequested,
  models: out.models,
  turns: out.turns,
  ms: out.ms,
});
import {
  type BatchRecord,
  DISCOVERY_DIR,
  type AgentRun,
  type DiscoveryRecord,
  discoveryDir,
  discoveryHaltPath,
  readDiscovery,
  writeDiscovery,
  writeDiscoveryHalt,
} from './discovery-state';

export {
  DISCOVERY_DIR,
  type DiscoveryRecord,
  type BatchRecord,
  discoveryDir,
  discoveryHalts,
  discoveryRecords,
  proposalsDigest,
  readDiscovery,
} from './discovery-state';

export const DISCOVER_BRIEF = 'src/modules/topic-discovery/briefs/discover.md';
export const PROPOSAL_REVIEW_BRIEF = 'src/modules/topic-discovery/briefs/proposal-review.md';

/** The slot the discovery belongs to: the configured weekday and hour, local to the configured timezone. */
export const discoverySlot = (a: Automation, now: number): string =>
  lastSlot(now, a.schedule.discovery.weekday, a.schedule.discovery.hour, a.schedule.timezone);

/** Due when discovery is on and the slot has not been run, or was started and not finished (a crash resumes it). */
export function discoveryDue(a: Automation, root = ROOT, now = Date.now()): boolean {
  if (!a.enabled.discovery) return false;
  const slot = discoverySlot(a, now);
  if (readSchedule(root).discovery?.lastSlot !== slot) return true;
  const rec = readDiscovery(root, slot);
  return !!rec && !rec.finishedAt && !rec.dryRun;
}

/** The institutions discovery proposes for: every commission with a channel (a handle); fixture topics belong to a
 *  commission and are never a reason to propose. */
export const discoveryInstitutions = (): string[] =>
  Object.entries(commissions)
    .filter(([, c]) => !!c.handle)
    .map(([k]) => k);

export interface DiscoveryDeps {
  now?: () => number;
  mail: MailTransport | null;
  env?: NodeJS.ProcessEnv;
  /** `'none'` in tests; the default runs git in `root`. */
  git?: 'none' | ((args: string[]) => string);
  institutions?: () => string[];
  onInstitution?: (key: string) => void;
  /** Told every CLI the job runs itself (the batch, the sent record). */
  onRun?: (cli: string, args: string[]) => void;
  hooks?: {
    snapshot?: () => void;
    guard?: (scope: 'agent' | 'child') => { ok: boolean; why: string; kept?: string[] };
  };
  alive?: (pid: number) => boolean;
  argvOf?: StepContext['argvOf'];
  /** A person's manual run: the agents run, the batch is printed, nothing is recorded, mailed or committed. */
  dryRun?: boolean;
}

const proposalSlugs = (root: string): string[] => {
  const dir = join(root, PROPOSALS_DIR);
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.json') && !n.endsWith('.review.json'))
        .map((n) => n.slice(0, -'.json'.length))
    : [];
};

export async function discover(
  a: Automation,
  d: DiscoveryDeps,
  root = ROOT,
): Promise<RunResult & { record: DiscoveryRecord | null }> {
  const now = d.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const lockDir = discoveryDir(root);
  const got = acquire(lockDir, 'discovery', { now, staleMinutes: a.runs.lockStaleMinutes, alive: d.alive });
  if ('held' in got)
    return { outcome: 'held', stage: 'discovery', halt: null, iterations: 0, costUsd: 0, record: null };
  try {
    return await discoverLocked(a, d, root, now, stamp);
  } finally {
    release(lockDir, got.lock);
  }
}

async function discoverLocked(
  a: Automation,
  d: DiscoveryDeps,
  root: string,
  now: () => number,
  stamp: () => string,
): Promise<RunResult & { record: DiscoveryRecord | null }> {
  const slot = discoverySlot(a, now());
  const dry = !!d.dryRun;
  const record: DiscoveryRecord = (!dry && readDiscovery(root, slot)) || {
    slot,
    startedAt: stamp(),
    finishedAt: null,
    institutions: {},
    batch: null,
    emailed: false,
    costUsd: 0,
    ...(dry && { dryRun: true }),
  };
  const save = () => void (dry || writeDiscovery(root, record));
  // the slot is taken before any agent runs: a crash never starts the week's discovery twice (the record resumes it)
  if (!dry) updateSchedule(root, (s) => ({ ...s, discovery: { lastSlot: slot } }));
  save();

  const cli = (name: string, args: string[]): CliResult => {
    d.onRun?.(name, args);
    return runCli(name, args, { cwd: root, env: envFor(name, args, d.env ?? process.env) });
  };
  // the tree guard: an agent may only create proposal files (discovery) or write its one review (review); every
  // other change is reverted and the step fails
  let snap: TreeSnapshot | null = null;
  let grant = grantFor('discovery', { topic: PROPOSALS_DIR });
  const hooks = {
    snapshot: d.hooks?.snapshot ?? (() => void (snap = realSnapshot(root))),
    guard:
      d.hooks?.guard ??
      ((scope: 'agent' | 'child') => {
        if (!snap) snap = realSnapshot(root);
        const g =
          scope === 'agent'
            ? realGuard(snap, root, [...grant.writable, ...grant.derived], {
                newFilesOnly: grant.newFilesOnly,
                additiveOnly: grant.additiveOnly,
                deny: grant.deny,
              })
            : realGuard(snap, root, [`${PROPOSALS_DIR}/**`]);
        snap = realSnapshot(root);
        return {
          ok: g.ok,
          why: [...g.reverted.map((p) => `reverted ${p}`), ...g.restored.map((p) => `restored ${p}`)].join('; '),
          kept: g.kept,
        };
      }),
  };
  const logs = join(automationDir(root), DISCOVERY_DIR, 'logs');
  mkdirSync(logs, { recursive: true });
  let logNo = readdirSync(logs).length;
  const budgetHalt = (): Halt | null => {
    const week = isoWeek(new Date(now()));
    const perAgent = a.agents.budgetUsd.perAgent;
    if (weekSpend(root, week) + perAgent <= a.agents.budgetUsd.perWeek) return null;
    return {
      kind: 'budget',
      stage: 'discovery',
      why: `week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD; the next agent may cost ${perAgent}`,
      unblock: { kind: 'decide', text: 'raise agents.budgetUsd.perWeek or wait for the next week' },
      at: stamp(),
      runId: 'discovery',
      board: { stage: 'discovery', next: slot },
    };
  };
  /** One agent under its role's grant: the brief as the prompt, the validator's findings fed back by execStep. */
  const agent = async (role: 'discovery' | 'proposalReview', prompt: string, subject: string) => {
    grant = grantFor(role, role === 'discovery' ? { topic: PROPOSALS_DIR } : { topic: PROPOSALS_DIR, slug: subject });
    hooks.snapshot();
    const step: Step = { kind: 'prompt', text: prompt };
    const ctx: StepContext = {
      topic: role === 'discovery' ? PROPOSALS_DIR : subject,
      storyId: '',
      ...(role === 'proposalReview' && { slug: subject }),
      root,
      approver: 'automated: discovery',
      role,
      logPath: join(logs, `${++logNo}-${role}-${subject}.log`),
      env: d.env,
      argvOf: d.argvOf,
      guard: (scope) => hooks.guard(scope),
      budgetUsd: a.agents.budgetUsd.perAgent,
    };
    const out = await execStep(a, step, ctx);
    if (out.costUsd) addSpend(root, isoWeek(new Date(now())), out.costUsd);
    record.costUsd += out.costUsd;
    return out;
  };
  const halted = (
    kind: Halt['kind'],
    why: string,
    unblock: Halt['unblock'],
  ): RunResult & { record: DiscoveryRecord } => {
    const h: Halt = {
      kind,
      stage: 'discovery',
      why,
      unblock,
      at: stamp(),
      runId: 'discovery',
      board: { stage: 'discovery', next: slot },
    };
    if (!dry) writeDiscoveryHalt(root, 'discovery', h);
    save();
    return { outcome: 'halted', stage: 'discovery', halt: h, iterations: 0, costUsd: record.costUsd, record };
  };

  // 1. the agents, per institution with a channel
  const keys = (d.institutions ?? discoveryInstitutions)().filter((k) => !isFixtureTopic(k));
  for (const key of keys) {
    const inst = (record.institutions[key] ??= {
      session: null,
      costUsd: 0,
      ok: false,
      proposals: [],
      reviews: {},
      done: false,
    });
    if (inst.done) continue;
    d.onInstitution?.(key);
    const b = budgetHalt();
    if (b) return halted(b.kind, b.why, b.unblock);
    if (inst.session === null && !inst.error) {
      const context = cli('topics', ['context', key]);
      const before = new Set(proposalSlugs(root));
      const out = await agent(
        'discovery',
        [
          `Read ${DISCOVER_BRIEF} and follow it.`,
          `Institution: ${key}`,
          `Write: ${PROPOSALS_DIR}/<slug>.json, at most ${a.topics.proposalsPerInstitution} new files`,
          '',
          context.stdout.trim(),
        ].join('\n'),
        key,
      );
      inst.session = out.sessionId;
      inst.costUsd += out.costUsd;
      inst.ok = out.ok;
      Object.assign(inst, usageOf(out));
      inst.proposals = proposalSlugs(root).filter((s) => !before.has(s));
      if (!out.ok) {
        inst.error = out.error ?? 'the discovery agent failed';
        if (!dry)
          writeDiscoveryHalt(root, `institution:${key}`, {
            kind: 'no-progress',
            stage: 'discovery',
            why: `the discovery agent for ${key} did not finish: ${inst.error}`,
            unblock: {
              kind: 'fix',
              text: `read ${join(logs, `${logNo}-discovery-${key}.log`)}; a person may run ${DISCOVER_BRIEF} by hand for ${key} (npm run topics -- context ${key}), then npm run topics -- validate --fresh`,
            },
            at: stamp(),
            runId: 'discovery',
            board: { stage: 'discovery', next: slot },
          });
      }
      save();
    }
    // 2. an independent review per new proposal, each a fresh session
    for (const slug of inst.proposals) {
      if (inst.reviews[slug]) continue;
      const bb = budgetHalt();
      if (bb) return halted(bb.kind, bb.why, bb.unblock);
      const context = cli('topics', ['context', key]);
      const out = await agent(
        'proposalReview',
        [
          `Read ${PROPOSAL_REVIEW_BRIEF} and follow it.`,
          `Proposal: ${slug}`,
          `Write: ${PROPOSALS_DIR}/${slug}.review.json`,
          '',
          context.stdout.trim(),
        ].join('\n'),
        slug,
      );
      const reviewed = loadProposals(root).find((x) => x.proposal.slug === slug)?.review ?? null;
      const ok = out.ok && reviewed !== null;
      inst.reviews[slug] = {
        session: out.sessionId,
        costUsd: out.costUsd,
        ok,
        ...(ok ? {} : { error: out.error ?? 'no review written' }),
        ...usageOf(out),
      };
      if (!ok && !dry)
        writeDiscoveryHalt(root, slug, {
          kind: 'no-progress',
          stage: 'discovery',
          why: `the independent review of proposal ${slug} did not complete: ${inst.reviews[slug].error}`,
          unblock: {
            kind: 'fix',
            text: `read the log, then have a fresh agent run ${PROPOSAL_REVIEW_BRIEF} for ${PROPOSALS_DIR}/${slug}.json and run npm run topics -- validate ${slug} --review; or npm run topics -- park ${slug} --why "<why>"`,
          },
          at: stamp(),
          runId: 'discovery',
          board: { stage: 'discovery', next: slot },
        });
      save();
    }
    inst.done = true;
    save();
  }

  // 3. the batch: the weak parked, the strong listed under one id
  if (!record.batch) {
    const r = cli('topics', dry ? ['batch', '--dry-run'] : ['batch']);
    if (r.status !== 0)
      return halted(
        'step-failed',
        `npm run topics -- batch failed (exit ${r.status}): ${(r.stderr || r.stdout).trim().split('\n').at(-1)}`,
        {
          kind: 'fix',
          text: `npm run topics -- batch --dry-run shows the problem; fix the proposal it names`,
        },
      );
    if (dry) {
      record.batch = { id: 'dry-run', listed: [], parked: [], unreviewed: [], invalid: [] };
      record.finishedAt = stamp();
      return {
        outcome: 'done',
        stage: 'discovery',
        halt: null,
        iterations: 1,
        costUsd: record.costUsd,
        record: { ...record, batch: null },
      };
    }
    const parsed = JSON.parse(r.stdout) as BatchRecord & { listed: BatchRecord['listed'] };
    record.batch = {
      id: parsed.id,
      listed: parsed.listed.map((x) => ({ slug: x.slug, institution: x.institution, question: x.question })),
      parked: parsed.parked,
      unreviewed: parsed.unreviewed,
      invalid: parsed.invalid ?? [],
    };
    save();
  }
  // 4. one mail with the batch id; a crash between the outbox entry and the send is the outbox's to resend
  if (!record.emailed && record.batch.listed.length && d.mail) {
    const id = record.batch.id;
    const existing = readOutbox(root).find((e) => e.kind === 'batch' && e.request === id);
    const messageId = existing
      ? existing.messageId
      : (await sendTracked(d.mail, renderBatch(root, id, a), 'batch', root, { request: id, now })).messageId;
    const sent = cli('topics', ['sent', id, '--message-id', messageId]);
    if (sent.status !== 0)
      return halted('step-failed', `npm run topics -- sent failed: ${(sent.stderr || sent.stdout).trim()}`, {
        kind: 'run',
        text: `npm run topics -- sent ${id} --message-id "${messageId}"`,
      });
    record.emailed = true;
    save();
  }
  // 5. the proposals committed on main in the clone; the next launch pushes (proposals are not public pages)
  if (d.git !== 'none') {
    const git =
      d.git ??
      ((args: string[]) =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    try {
      git(['add', '-A', '--', PROPOSALS_DIR]);
      if (git(['diff', '--cached', '--name-only']).trim())
        git(['commit', '-q', '-m', `topics: the proposals of ${slot} (batch ${record.batch.id})`]);
    } catch (e) {
      return halted(
        'git',
        `git commit of ${PROPOSALS_DIR} failed: ${(e as Error).message.trim().split('\n').slice(-3).join(' | ')}`,
        {
          kind: 'fix',
          text: `commit ${PROPOSALS_DIR} in the clone by hand; the next discovery runs on the next slot`,
        },
      );
    }
  }
  record.finishedAt = stamp();
  save();
  const stale = discoveryHaltPath(root, 'discovery');
  if (existsSync(stale) && !dry) {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(stale); // the job-level halt of an earlier attempt is over
  }
  return { outcome: 'done', stage: 'discovery', halt: null, iterations: 1, costUsd: record.costUsd, record };
}

/** The real dependencies: the mailbox when configured, git in the clone, the process environment. */
export const discoveryDeps = (mail: MailTransport | null): DiscoveryDeps => ({ mail, env: process.env });
