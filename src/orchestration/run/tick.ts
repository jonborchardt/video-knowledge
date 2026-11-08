// The control plane (spec §4.4): one idempotent, lock-guarded pass of short operations, run every tickMinutes by
// the scheduler. It never runs a story, a topic, a launch or a scan (the work plane does): it flushes the outbox,
// applies what the inbox says (phase 3), syncs due publications and probes deploys (phase 3), decides which halted
// runs are due again, kills stuck runs, emails new halts, and sends the digest on its day.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statfsSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Automation } from '../../shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, scriptDir, shortOf, writeJsonAtomic } from '../../shared/io';
import { publicRecordPath } from '../../shared/public-record';
import { PROPOSALS_DIR } from '../../modules/topic-discovery';
import type { ReleaseManifest } from '../../shared/types';
import { loadLedger, requestOf, youtubeAuthProblem } from '../../modules/publishing';
import { publicTopicNames } from '../../modules/evidence';
import { commissions } from '../../config/site';
import { checklistOf, renderReleaseRequest, urlsOf } from './requests';
import type { OutMail } from '../../modules/mail';
import type { Mailer } from './mailer';
import type { DigestExtra } from './digest';
import { sendDigestIfDue } from './digest';
import type { Halt } from './journal';
import { TICK_LOCK, acquire, heartbeat, release, setWriting } from './lock';
import { questionMail } from '../../modules/mail';
import { type OutboxEntry, automationDir, flushOutbox, notifyHalts, renderHalt } from './notify';
import { renderDigest } from './digest';
import { type PreflightDeps, preflight } from './preflight';
import { type FailedLine, pollInbox } from './inbox';
import { publishDue } from './publish-due';
import { launchPaths, probeLaunches } from './launch';
import { shadowAgreement } from './release';
import { proposalsDigest } from './discovery-state';
import { renderBatch } from './requests';
import { type CliResult, runCli } from '../../shared/cli';
import { envFor } from './steps';
import { alive, killTree } from './proc';
import { type Ask, dueResumes, settleFinished, stuckRows } from './resume';
import { updateSchedule } from './schedule';
import { type StatusRow, statusOf } from './status';

export { TICK_LOCK };
export const PREFLIGHT_HALT = 'preflight-halt.json';

export interface TickDeps {
  mail: Mailer | null;
  now?: () => number;
  preflight?: Partial<PreflightDeps>;
  rows?: () => StatusRow[];
  ask?: Ask;
  alive?: (pid: number) => boolean;
  kill?: (pid: number) => void;
  digestExtra?: () => DigestExtra;
  /** Re-renders a resendable outbox entry's body (the outbox stores none); null leaves it. */
  render?: (e: OutboxEntry) => Omit<OutMail, 'messageId'> | null;
  /** Runs a publishing verb as a child (the inbox's decisions, the due publications); tests inject. */
  run?: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  /** The deploy probe's fetch; tests inject. */
  fetchFn?: typeof fetch;
  /** The environment the publication steps read (the institution's X keys say whether it posts); the process's. */
  env?: NodeJS.ProcessEnv;
  /** `npm run run -- tick --preflight`: the preflight alone, evaluated as if enabled.tick and enabled.work were on
   *  (what a live tick would stop on), printed and nothing else: no halt written, no mail, flags untouched. */
  preflightOnly?: boolean;
}

export interface TickReport {
  outcome: 'held' | 'disabled' | 'preflight' | 'ok';
  actions: string[];
}

const gitIn = (root: string) => (args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

type Run = (cli: string, args: string[]) => Promise<CliResult> | CliResult;

/** The files a tick verb is defined to write, from its arguments (repo-relative; a pathspec where it writes a
 *  family): the ledger for a publish verb (a Short's is its parent's), the proposal for a decision on it, the
 *  article's files and the public record for a correction, the post record. Any other verb owns none. A verb that
 *  writes outside its row leaves that file dirty, and the next preflight halts on it. */
export function ownedFiles(cli: string, args: string[], root = ROOT): string[] {
  const [verb, x, y] = args;
  if (cli === 'topics') return (verb === 'approve' || verb === 'reject') && x ? [`${PROPOSALS_DIR}/${x}.json`] : [];
  if (!x || !y || !['publish', 'article', 'social'].includes(cli)) return [];
  const rel = (p: string) => relative(root, p).replaceAll('\\', '/');
  const dir = rel(scriptDir(x, shortOf(y)?.parent ?? y, root));
  if (cli === 'social') return verb === 'post' ? [`${dir}/social.json`] : [];
  if (cli === 'article') return verb === 'decide' ? [`${dir}/article*`, rel(publicRecordPath(x, root))] : [];
  // `decide --paid` runs `links cta approve` and `video package` as its own children
  return [`${dir}/publish.json`, ...(args.includes('--paid') ? [`${dir}/cta.json`, `${dir}/video/review`] : [])];
}

const dirtyIn = (git: (args: string[]) => string, files: string[]): string[] =>
  git(['status', '--porcelain', '--untracked-files=all', '--', ...files])
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean);

/** `run`, with each verb's own files (ownedFiles) committed right after it returns, whatever its exit code: a verb
 *  that failed part-way left real events, and leaving them dirty would stop the next tick before it could try again.
 *  Nothing is committed when whose the files are is not certain: one was dirty before the verb, a live run or a
 *  pending launch will commit them itself (`taken`), or git could not be asked. Those stay as written and the next
 *  preflight reports them. A commit that fails throws and stops every later verb of this pass (`stopped`); nothing
 *  is kept on disk for it, the dirty file is the record (unstaged again, so no other commit carries it along).
 *  While the verb runs and until its commit, `writing` names the files in the tick's lock: a run's tree guard
 *  (guard.ts) would otherwise revert them as an edit outside its step. */
export function committing(
  run: Run,
  git: (args: string[]) => string,
  o: { root: string; enabled: boolean; taken: () => string[]; writing?: (files: string[] | null) => void },
): { run: Run; stopped: () => boolean } {
  let stopped = false;
  const wrapped: Run = async (cli, args) => {
    if (stopped) throw new Error('a commit failed earlier in this pass');
    const files = o.enabled ? ownedFiles(cli, args, o.root) : [];
    let mine = false;
    if (files.length)
      try {
        const taken = o.taken();
        mine = !files.some((f) => taken.some((t) => f === t || f.startsWith(`${t}/`))) && !dirtyIn(git, files).length;
      } catch {
        // not a repository, or git failed: nothing is committed
      }
    if (!mine) return run(cli, args);
    o.writing?.(files);
    let wrote = files;
    try {
      const r = await run(cli, args);
      try {
        wrote = dirtyIn(git, files);
        if (wrote.length) {
          const flag = args.findIndex((x) => x.startsWith('--'));
          const what = args.slice(0, Math.min(3, flag < 0 ? 3 : flag));
          git(['add', '--', ...wrote]);
          git(['commit', '-q', '-m', `tick: ${[cli, ...what].join(' ')}`, '--', ...wrote]); // an automated commit: no author line
        }
      } catch (e) {
        stopped = true;
        try {
          git(['reset', '-q', '--', ...wrote]);
        } catch {
          // git itself is what failed: the file stays staged, and the preflight still names it
        }
        const why = (e as Error).message.split('\n')[0];
        throw new Error(`commit failed after ${cli} ${args[0]} (${wrote.join(', ')} left as written): ${why}`, {
          cause: e,
        });
      }
      return r;
    } finally {
      o.writing?.(null);
    }
  };
  return { run: wrapped, stopped: () => stopped };
}

/** `claude -p "pong"` answers within 60 s: the login is live. */
export const claudeAnswers = (command: string): boolean =>
  spawnSync(command, ['-p', '--output-format', 'json', 'pong'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    shell: process.platform === 'win32',
  }).status === 0;

export const freeGbOf = (path: string): number => {
  const s = statfsSync(path);
  return (s.bavail * s.bsize) / 1024 ** 3;
};

/** Re-renders a resendable outbox entry from the current state: a halt by its subject, the digest, a test. Request
 *  mails (phase 2) are rendered by their own module. */
export const defaultRender =
  (a: Automation, rows: () => StatusRow[], extra: () => DigestExtra = () => ({}), root = ROOT) =>
  (e: OutboxEntry): Omit<OutMail, 'messageId'> | null => {
    const { request, topic, storyId } = e.meta ?? {};
    if (e.kind === 'question') return questionMail(e);
    if (e.kind === 'halt') {
      const r = rows().find((x) => x.halt && renderHalt(x.topic, x.storyId, x.halt, a).subject === e.subject);
      return r ? renderHalt(r.topic, r.storyId, r.halt!, a, { dir: r.dir }) : null;
    }
    if (e.kind === 'digest') return renderDigest(rows(), extra(), a);
    if (e.kind === 'batch' && request) return renderBatch(root, request, a);
    if (e.kind === 'test')
      return {
        from: a.approvals.from || a.notifications.to,
        to: e.to,
        subject: e.subject,
        text: 'A resend of the mail test.',
      };
    if (e.kind === 'release-request' && topic && storyId && request) {
      // the same request, re-rendered from the manifest and ledger as they are now
      const m = readJson<ReleaseManifest>(join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, MANIFEST_FILE));
      const ledger = loadLedger(topic, storyId, root);
      const req = ledger && requestOf(ledger, request);
      if (!m || !req || m.releaseSha !== req.release) return null; // the release moved: a new request follows
      return renderReleaseRequest(m, req, a, {
        urls: urlsOf(topic, storyId, m, root),
        checklist: checklistOf(topic, storyId, root),
      });
    }
    return null;
  };

/** Every commission that claims a public topic, with its channel's credential problem if any. */
export const channelsOf = (root = ROOT): { key: string; problem: string | null }[] => {
  const pub = new Set(publicTopicNames());
  return Object.entries(commissions)
    .filter(([, c]) => c.topics.some((t) => pub.has(t)))
    .map(([key]) => ({ key, problem: youtubeAuthProblem(key, root, process.env) }));
};

/** A halt that belongs to the automation, not to a story: a row the halt mail takes like any other. */
const automationRow = (root: string, storyId: string, h: Halt): StatusRow => ({
  topic: 'automation',
  storyId,
  dir: automationDir(root),
  state: 'halted',
  since: h.at,
  step: null,
  halt: h,
  lastFinish: null,
  costUsd: 0,
});
const preflightRow = (root: string, h: Halt): StatusRow => automationRow(root, 'preflight', h);
/** A proposal-batch line whose verb crashed this pass. The reply is tried again every tick; this row exists only
 *  while it still fails, so the halt mail's own key (story, kind, why) keeps it to one mail. `why` carries no error
 *  text: the same line failing differently is still the one failure. */
const batchRow = (root: string, f: FailedLine, at: string): StatusRow =>
  automationRow(root, `batch:${f.batch}`, {
    kind: 'step-failed',
    stage: 'inbox',
    why: `topics ${f.line} failed for batch ${f.batch}`,
    unblock: {
      kind: 'fix',
      text: `${f.error}\nfix what it names, or run ${f.byHand} by hand; every tick tries the reply again until it is applied`,
    },
    at,
    runId: 'tick',
    board: { stage: 'inbox', next: 'a fix' },
  });

/** What the digest says beyond the status rows, by default: the proposals pending and parked (phase 4). */
export const defaultDigestExtra =
  (root = ROOT) =>
  (): DigestExtra => ({ proposals: proposalsDigest(root), shadow: shadowAgreement(root) });

export async function tick(a: Automation, root = ROOT, deps: TickDeps): Promise<TickReport> {
  const now = deps.now ?? Date.now;
  const digestExtra = deps.digestExtra ?? defaultDigestExtra(root);
  const actions: string[] = [];
  const dir = automationDir(root);
  const got = acquire(join(dir, TICK_LOCK), 'tick', { now, staleMinutes: a.runs.lockStaleMinutes, alive: deps.alive });
  if ('held' in got) return { outcome: 'held', actions: [`tick: another tick is running (pid ${got.held.pid})`] };
  const lock = got.lock;
  try {
    if (!a.enabled.tick && !deps.preflightOnly) return { outcome: 'disabled', actions: ['tick: disabled'] };
    const checked = deps.preflightOnly ? { ...a, enabled: { ...a.enabled, tick: true, work: true } } : a;
    const preDeps: PreflightDeps = {
      git: gitIn(root),
      claude: () => claudeAnswers(a.agents.command),
      env: process.env,
      freeGb: freeGbOf,
      launches: () => launchPaths(root),
      channels: () => channelsOf(root),
      running: () =>
        (deps.rows ?? (() => statusOf(root, deps.alive)))()
          .filter((r) => r.state === 'running')
          .map((r) =>
            r.dir
              .slice(root.length + 1)
              .replaceAll('\\', '/')
              .replace(/\/run$/, ''),
          ),
      ...deps.preflight,
    };
    const pre = preflight(checked, root, preDeps);
    if (deps.preflightOnly)
      return pre.ok
        ? { outcome: 'ok', actions: ['preflight ok (as if enabled.tick and enabled.work were on)'] }
        : { outcome: 'preflight', actions: [`preflight failed: ${pre.problems.join('; ')}`, ...pre.details] };
    const haltPath = join(dir, PREFLIGHT_HALT);
    if (!pre.ok) {
      const at = new Date(now()).toISOString();
      const h: Halt = {
        kind: 'preflight',
        stage: 'tick',
        why: pre.problems.join('; '), // stable: the same problem keys the same halt every tick
        unblock: { kind: 'fix', text: [...pre.details, ...(pre.details.length ? [] : [pre.problems[0]])].join('\n') },
        at: readJson<Halt>(haltPath)?.at ?? at,
        runId: lock.runId,
        board: { stage: 'tick', next: '' },
      };
      writeJsonAtomic(haltPath, h);
      actions.push(`preflight failed: ${h.why}`);
      if (deps.mail) {
        // a partial pass: the stories' halts are not pruned from notified.json (they are not resolved, just unseen)
        const sent = await notifyHalts(a, deps.mail, root, { now, rows: [preflightRow(root, h)], prune: false });
        if (sent.length) actions.push('preflight halt emailed');
      }
      return { outcome: 'preflight', actions };
    }
    if (existsSync(haltPath)) {
      unlinkSync(haltPath);
      actions.push('preflight recovered');
    }
    heartbeat(join(dir, TICK_LOCK), lock, now);
    if (deps.mail) {
      const rowsNow = deps.rows ?? (() => statusOf(root, deps.alive));
      const resent = await flushOutbox(
        deps.mail,
        root,
        now,
        deps.render ?? defaultRender(a, rowsNow, digestExtra, root),
      );
      if (resent.length) actions.push(`outbox: resent ${resent.length}`);
    }
    // the inbox (replies become decisions) and the due publications (a schedule, the Shorts, a renewal); the deploy
    // probes follow (phase 3 Task 4)
    // every verb of the three steps below goes through this one `run`: what a verb wrote is committed as it returns,
    // or the next tick's preflight would find the clone dirty (a reply on a parked story did that on 2026-11-03)
    const commits = committing(
      deps.run ??
        ((cli: string, args: string[]) => runCli(cli, args, { cwd: root, env: envFor(cli, args, process.env) })),
      preDeps.git,
      {
        root,
        enabled: a.git.commitOn === 'main', // the branch the preflight has just required
        // what commits itself, exactly as the preflight lets it stand dirty: a pending launch's paths and a live
        // run's own folder. Another story of a running topic is committed here all the same: left dirty it would
        // halt the next preflight, and the run's tree guard reverts any path that turns dirty during an agent step.
        taken: () => [...preDeps.launches().flatMap((l) => l.paths), ...(preDeps.running?.() ?? [])],
        writing: (files) => setWriting(join(dir, TICK_LOCK), lock, files),
      },
    );
    const run = commits.run;
    // each publication step on its own: one that throws (a mailbox outage, a missing CLI) is reported as an
    // action and the pass goes on to the rest (the halts, the digest)
    // After a commit that failed the tick writes nothing more this pass: the file stays as its verb left it, the
    // next preflight finds it and mails the halt, and a person commits it.
    const step = async (name: string, fn: () => Promise<void>) => {
      if (commits.stopped()) return void actions.push(`${name} skipped: a commit failed earlier in this pass`);
      try {
        await fn();
      } catch (e) {
        actions.push(`${name} failed: ${(e as Error).message.split('\n')[0]}`);
      }
    };
    const env = deps.env ?? process.env;
    const failedLines: FailedLine[] = [];
    if (deps.mail)
      await step('inbox', async () => {
        const inbox = await pollInbox(a, deps.mail!, root, { now, run, alive: deps.alive });
        failedLines.push(...inbox.failedLines);
        if (inbox.fetched)
          actions.push(
            `inbox: ${inbox.fetched} fetched, ${inbox.applied.length} applied, ${inbox.clarified.length} clarified, ${inbox.refused.length} refused, ${inbox.failed.length} failed, ${inbox.ignored.length} ignored`,
          );
      });
    await step('due publications', async () => {
      actions.push(...(await publishDue(a, root, { now, run, mail: deps.mail, env, alive: deps.alive })));
    });
    // the deploy probes: one per pending launch, then the social post and the launch mail
    await step('deploy probes', async () => {
      actions.push(...(await probeLaunches(a, root, { now, run, mail: deps.mail, fetchFn: deps.fetchFn, env })));
    });
    const settled = settleFinished(root, {
      by: 'automated: tick',
      now,
      rows: deps.rows?.(),
      ask: deps.ask,
      alive: deps.alive,
    });
    if (settled.length) actions.push(`settled: ${settled.join(', ')}`);
    const rows = (deps.rows ?? (() => statusOf(root, deps.alive)))();
    const due = dueResumes(a, root, { now, rows, ask: deps.ask, alive: deps.alive });
    // merged over what the inbox queued this pass (a draft OK, a moved request): a replace lost those entries
    updateSchedule(root, (s) => ({
      ...s,
      due: [...(s.due ?? []).filter((d) => !due.some((x) => x.topic === d.topic && x.storyId === d.storyId)), ...due],
    }));
    if (due.length) actions.push(`due: ${due.map((d) => `${d.topic}/${d.storyId} (${d.why})`).join(', ')}`);
    const stuck = stuckRows(a, root, {
      now,
      rows,
      ask: deps.ask,
      alive: deps.alive ?? alive,
      kill: deps.kill ?? killTree,
    });
    if (stuck.killed.length)
      actions.push(`killed stuck: ${stuck.killed.map((r) => `${r.topic}/${r.storyId}`).join(', ')}`);
    if (stuck.stuck.length) actions.push(`stuck: ${stuck.stuck.map((r) => `${r.topic}/${r.storyId}`).join(', ')}`);
    if (deps.mail) {
      const fresh = (deps.rows ?? (() => statusOf(root, deps.alive)))(); // after the kills
      const at = new Date(now()).toISOString();
      const sent = await notifyHalts(a, deps.mail, root, {
        now,
        rows: [...fresh, ...failedLines.map((f) => batchRow(root, f, at))],
      });
      if (sent.length) actions.push(`emailed ${sent.length} halt${sent.length === 1 ? '' : 's'}`);
      const slot = await sendDigestIfDue(a, deps.mail, now, root, fresh, digestExtra());
      if (slot) actions.push(`digest sent for ${slot}`);
    }
    updateSchedule(root, (s) => ({ ...s, lastTick: new Date(now()).toISOString() }));
    return { outcome: 'ok', actions };
  } finally {
    release(join(dir, TICK_LOCK), lock);
  }
}
