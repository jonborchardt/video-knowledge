// The control plane (spec §4.4): one idempotent, lock-guarded pass of short operations, run every tickMinutes by
// the scheduler. It never runs a story, a topic, a launch or a scan (the work plane does): it flushes the outbox,
// applies what the inbox says (phase 3), syncs due publications and probes deploys (phase 3), decides which halted
// runs are due again, kills stuck runs, emails new halts, and sends the digest on its day.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statfsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, writeJsonAtomic } from '../../shared/io';
import type { MailTransport, OutMail } from '../../shared/mail';
import type { DigestExtra } from './digest';
import { sendDigestIfDue } from './digest';
import type { Halt } from './journal';
import { acquire, heartbeat, release } from './lock';
import { type OutboxEntry, automationDir, flushOutbox, notifyHalts } from './notify';
import { type PreflightDeps, preflight } from './preflight';
import { alive, killTree } from './proc';
import { dueResumes, stuckRows } from './resume';
import { updateSchedule } from './schedule';
import { type StatusRow, statusOf } from './status';

export const TICK_LOCK = 'tick';
export const PREFLIGHT_HALT = 'preflight-halt.json';

export interface TickDeps {
  mail: MailTransport | null;
  now?: () => number;
  preflight?: Partial<PreflightDeps>;
  rows?: () => StatusRow[];
  ask?: (topic: string, storyId: string, root: string) => { stage: string; next: string };
  alive?: (pid: number) => boolean;
  kill?: (pid: number) => void;
  digestExtra?: () => DigestExtra;
  /** Re-renders a resendable outbox entry's body (the outbox stores none); null leaves it. */
  render?: (e: OutboxEntry) => Omit<OutMail, 'messageId'> | null;
}

export interface TickReport {
  outcome: 'held' | 'disabled' | 'preflight' | 'ok';
  actions: string[];
}

const gitIn = (root: string) => (args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

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

const preflightRow = (root: string, h: Halt): StatusRow => ({
  topic: 'automation',
  storyId: 'preflight',
  dir: automationDir(root),
  state: 'halted',
  since: h.at,
  step: null,
  halt: h,
  lastFinish: null,
  costUsd: 0,
});

export async function tick(a: Automation, root = ROOT, deps: TickDeps): Promise<TickReport> {
  const now = deps.now ?? Date.now;
  const actions: string[] = [];
  const dir = automationDir(root);
  const got = acquire(join(dir, TICK_LOCK), 'tick', { now, staleMinutes: a.runs.lockStaleMinutes, alive: deps.alive });
  if ('held' in got) return { outcome: 'held', actions: [`tick: another tick is running (pid ${got.held.pid})`] };
  const lock = got.lock;
  try {
    if (!a.enabled.tick) return { outcome: 'disabled', actions: ['tick: disabled'] };
    const pre = preflight(a, root, {
      git: gitIn(root),
      claude: () => claudeAnswers(a.agents.command),
      env: process.env,
      freeGb: freeGbOf,
      launches: () => [],
      ...deps.preflight,
    });
    const haltPath = join(dir, PREFLIGHT_HALT);
    if (!pre.ok) {
      const at = new Date(now()).toISOString();
      const h: Halt = {
        kind: 'preflight',
        stage: 'tick',
        why: pre.problems.join('; '),
        unblock: { kind: 'fix', text: pre.problems[0] },
        at: readJson<Halt>(haltPath)?.at ?? at,
        runId: lock.runId,
        board: { stage: 'tick', next: '' },
      };
      writeJsonAtomic(haltPath, h);
      actions.push(`preflight failed: ${h.why}`);
      if (deps.mail) {
        const sent = await notifyHalts(a, deps.mail, root, { now, rows: [preflightRow(root, h)] });
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
      const resent = await flushOutbox(deps.mail, root, now, deps.render ?? (() => null));
      if (resent.length) actions.push(`outbox: resent ${resent.length}`);
    }
    // inbox, due publications and deploy probes: phase 3
    const rows = (deps.rows ?? (() => statusOf(root, deps.alive)))();
    const due = dueResumes(a, root, { now, rows, ask: deps.ask, alive: deps.alive });
    updateSchedule(root, (s) => ({ ...s, due }));
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
      const sent = await notifyHalts(a, deps.mail, root, { now, rows: fresh });
      if (sent.length) actions.push(`emailed ${sent.length} halt${sent.length === 1 ? '' : 's'}`);
      const slot = await sendDigestIfDue(a, deps.mail, now, root, fresh, deps.digestExtra?.() ?? {});
      if (slot) actions.push(`digest sent for ${slot}`);
    }
    updateSchedule(root, (s) => ({ ...s, lastTick: new Date(now()).toISOString() }));
    return { outcome: 'ok', actions };
  } finally {
    release(join(dir, TICK_LOCK), lock);
  }
}
