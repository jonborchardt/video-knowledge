// The maintenance scan as a work-plane job (spec §2 Maintenance, §10; phase 6 Task 2): for one public topic whose
// scan is due, a `new-sources.md` agent (role `collect`: search and fetch-doc only) saves new documents and judges
// them into `work/sv_scan-<date>.json`; the runner records the verdicts (never `--replace-cited`: a refusal is
// `needs-person`), records the scan, regenerates the report, drafts a note per revised finding through the notes
// agent, rediscovers the stories, commits, then runs the article pass (article-work.ts) and names every live video
// whose script cites a revised claim with a `needs-person` halt (the video is never rebuilt). The lock is the topic
// run's (`topics/<topic>/work/run/`), so a scan and a research run never overlap. A scan that records nothing is
// journaled, not a halt.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isFixtureTopic } from '../../config/site';
import type { Automation } from '../../shared/automation';
import { ROOT, readJson, scriptDir, topicDir, writeJsonAtomic } from '../../shared/io';
import type { MailTransport } from '../../shared/mail';
import type { PublicRecord, Script } from '../../shared/types';
import { loadMaintenance, publicTopicNames, scanDue } from '../../modules/evidence';
import { storyOutputs } from '../../modules/publishing';
import type { Step } from '../production';
import { type ArticleWorkDeps, articleWork } from './article-work';
import { guard as realGuard, snapshot as realSnapshot, type TreeSnapshot, guardWhy } from './guard';
import {
  type Halt,
  type JournalEntry,
  appendJournal,
  nextLine,
  readHalt,
  runDir,
  topicRunDir,
  writeHalt,
  writeValidateLog,
  readJournal,
} from './journal';
import { type Lock, acquire, heartbeat, release, setChild } from './lock';
import { type RoleGrant, grantFor } from './roles';
import { type RunResult, addSpend, isoWeek, runValidate, weekSpend, runSpend } from './runner';
import { type StepContext, type StepOutcome, envFor, execStep as realExecStep, outcomeFields } from './steps';
import type { Job } from './work';

export const NEW_SOURCES_BRIEF = 'src/modules/evidence/briefs/new-sources.md';
export const REVISION_NOTE_BRIEF = 'src/modules/evidence/briefs/revision-note.md';
/** Under the topic's run folder while a scan is open: what the agent found and whether it was recorded, so a
 *  resume carries the first attempt's work through the steps that follow instead of asking an agent again. */
export const SCAN_FILE = 'scan.json';
interface ScanMarker {
  date: string;
  svFile: string;
  found: number;
  recorded: boolean;
  at: string;
}

export interface MaintainDeps {
  now?: () => number;
  mail: MailTransport | null;
  env?: NodeJS.ProcessEnv;
  git?: 'none' | ((args: string[]) => string);
  validate?: (env: NodeJS.ProcessEnv) => { ok: boolean; output: string };
  exec?: typeof realExecStep;
  argvOf?: StepContext['argvOf'];
  hooks?: {
    snapshot?: () => void;
    guard?: (scope: 'agent' | 'child') => { ok: boolean; why: string; kept?: string[] };
  };
  /** The article pass; the default is article-work.ts's. */
  articles?: (topic: string, a: Automation, d: ArticleWorkDeps) => Promise<{ actions: string[]; halted: string[] }>;
  runId?: string;
}

/** The scan jobs the work plane may start: one at a time, the public topic whose scan is oldest and due, with no
 *  live run or halt in its run folder. */
export function scanJobs(a: Automation, root = ROOT, now = Date.now(), topics = publicTopicNames()): Job[] {
  if (!a.enabled.maintenance) return [];
  const due = topics
    .filter((t) => !isFixtureTopic(t) && existsSync(join(topicDir(t, root), 'report.json')))
    .filter((t) => scanDue(loadMaintenance(t, root), a.schedule.maintenance.everyDays, new Date(now)))
    .filter((t) => !existsSync(join(topicDir(t, root), 'work', 'run', 'halt.json')))
    .sort((x, y) => (loadMaintenance(x, root)?.lastScan ?? '').localeCompare(loadMaintenance(y, root)?.lastScan ?? ''));
  return due.length
    ? [
        {
          kind: 'scan',
          topic: due[0],
          why: `maintenance scan: last ${loadMaintenance(due[0], root)?.lastScan ?? 'never'}`,
        },
      ]
    : [];
}

const countDocs = (topic: string, root: string): number => {
  const d = join(topicDir(topic, root), 'sources');
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.txt')).length : 0;
};

export async function maintain(
  topic: string,
  a: Automation,
  d: MaintainDeps,
  root = ROOT,
): Promise<RunResult & { actions: string[] }> {
  const now = d.now ?? Date.now;
  const exec = d.exec ?? realExecStep;
  const dir = topicRunDir(topic, root);
  const acquired = acquire(dir, `scan ${topic}`, { now });
  if ('held' in acquired) return { outcome: 'held', stage: 'scan', halt: null, iterations: 0, costUsd: 0, actions: [] };
  const lock: Lock = acquired.lock;
  const runId = d.runId ?? lock.runId;
  const stamp = () => new Date(now()).toISOString();
  const date = stamp().slice(0, 10);
  const actions: string[] = [];
  const journal = (e: Omit<JournalEntry, 'at' | 'runId'>) => appendJournal(dir, { at: stamp(), runId, ...e });
  const git = (args: string[]): string =>
    d.git === 'none'
      ? ''
      : d.git
        ? d.git(args)
        : execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let snap: TreeSnapshot | null = null;
  let grant: RoleGrant = grantFor('collect', { topic });
  const hold = [`topics/${topic}/**`];
  const childWritable = [`topics/${topic}/**`];
  const hooks = {
    snapshot: d.hooks?.snapshot ?? (() => void (snap = realSnapshot(root, { hold }))),
    guard:
      d.hooks?.guard ??
      ((scope: 'agent' | 'child') => {
        if (!snap) snap = realSnapshot(root, { hold });
        const g =
          scope === 'agent'
            ? realGuard(snap, root, [...grant.writable, ...grant.derived], {
                newFilesOnly: grant.newFilesOnly,
                additiveOnly: grant.additiveOnly,
              })
            : realGuard(snap, root, childWritable);
        snap = realSnapshot(root, { hold });
        return {
          ok: g.ok,
          why: guardWhy(g),
          kept: g.kept,
        };
      }),
  };
  const beat = setInterval(() => heartbeat(dir, lock, now), 60_000);
  hooks.snapshot();
  let cost = 0;
  let stepNo = 0;
  const stage = 'scan';
  const halt = (kind: Halt['kind'], why: string, unblock: Halt['unblock']): RunResult & { actions: string[] } => {
    const h: Halt = { kind, stage, why, unblock, at: stamp(), runId, board: { stage, next: `scan ${topic}` } };
    writeHalt(dir, h);
    journal({ stage, next: '', step: kind, kind: 'halt', attempt: 1, error: why });
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'halted', stage, halt: h, iterations: 1, costUsd: cost, actions };
  };
  const ctxOf = (step: Step, role: StepContext['role']): StepContext => {
    mkdirSync(join(dir, 'steps'), { recursive: true });
    return {
      topic,
      storyId: '',
      root,
      approver: `automated: maintenance ${runId}`,
      role,
      logPath: join(dir, 'steps', `scan-${date}-${++stepNo}.log`),
      env: d.env,
      argvOf: d.argvOf,
      guard: (scope) => hooks.guard(scope),
      onSpawn: (pid) => setChild(dir, lock, pid, step.text.split('\n')[0].slice(0, 120)),
      budgetUsd: a.agents.budgetUsd.perAgent,
    };
  };
  const record = (step: Step, out: StepOutcome) =>
    journal({
      stage,
      next: '',
      step: step.text.split('\n')[0].slice(0, 200),
      kind: step.kind,
      attempt: 1,
      ...outcomeFields(out),
    });
  const agent = async (brief: string, lines: string[], role: StepContext['role']): Promise<StepOutcome> => {
    // M3 1.5: the scan's own spend since its start (the journal since the last finish, a resumed scan included)
    // against perRun, and the week against perWeek, before each agent (the figures in the error, halted as budget)
    const week = isoWeek(new Date(now()));
    const perAgent = a.agents.budgetUsd.perAgent;
    const spentRun = runSpend(readJournal(dir));
    if (
      spentRun + perAgent > a.agents.budgetUsd.perRun ||
      weekSpend(root, week) + perAgent > a.agents.budgetUsd.perWeek
    )
      return {
        kind: 'prompt',
        ok: false,
        exit: null,
        ms: 0,
        costUsd: 0,
        sessionId: null,
        error: `budget: scan ${spentRun.toFixed(2)} of ${a.agents.budgetUsd.perRun} USD, week ${weekSpend(root, week).toFixed(2)} of ${a.agents.budgetUsd.perWeek} USD; the next agent may cost ${perAgent}`,
        log: '',
      };
    grant = grantFor(role, { topic });
    const step: Step = {
      kind: 'prompt',
      text: [`Read ${brief} and follow it.`, `Topic: ${topic}`, ...lines].join('\n'),
    };
    const out = await exec(a, step, { ...ctxOf(step, role), attempts: { dir, line: nextLine(dir), runId } });
    setChild(dir, lock, null);
    cost += out.costUsd;
    if (out.costUsd) addSpend(root, week, out.costUsd);
    record(step, out);
    return out;
  };
  const child = async (text: string): Promise<StepOutcome> => {
    const step: Step = { kind: 'run', text };
    const out = await exec(a, step, ctxOf(step, 'collect'));
    setChild(dir, lock, null);
    record(step, out);
    const g = hooks.guard('child');
    if (!g.ok) return { ...out, ok: false, guardFailed: true, error: g.why };
    return out;
  };

  try {
    // 1. the scan agent (or, on a resume, the scan an earlier attempt made: its marker carries the agent's result
    //    through the steps that follow, so a halt after the record never loses the report, notes or article pass)
    const markerPath = join(dir, SCAN_FILE);
    const resumed = readJson<ScanMarker>(markerPath);
    const docsBefore = countDocs(topic, root);
    const last = loadMaintenance(topic, root)?.lastScan ?? 'never';
    const svFile = resumed?.svFile ?? `topics/${topic}/work/sv_scan-${date}.json`;
    let found = resumed?.found ?? 0;
    let scanSession: string | null = null;
    if (!resumed) {
      const scan = await agent(NEW_SOURCES_BRIEF, [`Last scan: ${last}`, `Write: ${svFile}`], 'collect');
      if (scan.guardFailed)
        return halt('unexpected-edit', scan.error ?? 'the scan agent edited outside its files', {
          kind: 'fix',
          text: `read ${dir}`,
        });
      if (!scan.ok)
        return halt(
          /^budget/.test(scan.error ?? '') ? 'budget' : 'step-failed',
          `the scan agent of ${topic} did not finish: ${scan.error}`,
          { kind: 'run', text: `npm run run -- maintain ${topic}` },
        );
      found = countDocs(topic, root) - docsBefore;
      scanSession = scan.sessionId;
      writeJsonAtomic(markerPath, { date, svFile, found, recorded: false, at: stamp() } satisfies ScanMarker);
    } else actions.push(`${topic}: resuming the scan of ${resumed.date}`);
    const verdicts = readJson<unknown[]>(join(root, svFile)) ?? [];
    actions.push(
      `${topic}: scan found ${found} document${found === 1 ? '' : 's'}, ${verdicts.length} verdict${verdicts.length === 1 ? '' : 's'}`,
    );
    const finish = () => {
      rmSync(markerPath, { force: true });
      journal({ stage, next: '', step: 'finish', kind: 'finish', attempt: 0 });
    };
    // 2. the verdicts recorded (never --replace-cited), the scan recorded
    if (verdicts.length && !resumed?.recorded) {
      const r = await child(`npm run record-sources -- ${topic} ${svFile}`);
      if (r.guardFailed) return halt('unexpected-edit', r.error ?? '', { kind: 'fix', text: `read ${dir}` });
      if (!r.ok && r.exit === 2)
        return halt('needs-person', `record-sources refused the scan's verdicts: ${r.error}`, {
          kind: 'decide',
          text: `a verdict would replace one a script cites: run npm run record-sources -- ${topic} ${svFile} --replace-cited by hand if that is right, or edit the file`,
        });
      if (!r.ok)
        return halt('step-failed', `record-sources failed: ${r.error}`, {
          kind: 'run',
          text: `npm run run -- maintain ${topic}`,
        });
    }
    if (verdicts.length)
      writeJsonAtomic(markerPath, {
        ...(readJson<ScanMarker>(markerPath) ?? { date, svFile, found, at: stamp() }),
        recorded: true,
      } satisfies ScanMarker);
    const scanned = await child(
      `npm run evidence -- scanned ${topic} --found ${found} --recorded ${verdicts.length} --at ${stamp()}${scanSession ? ` --session ${scanSession}` : ''}`,
    );
    if (!scanned.ok)
      return halt('step-failed', `evidence scanned failed: ${scanned.error}`, {
        kind: 'run',
        text: `npm run run -- maintain ${topic}`,
      });
    if (!verdicts.length) {
      actions.push(`${topic}: nothing new recorded`);
      finish();
      clearInterval(beat);
      release(dir, lock);
      return { outcome: 'done', stage, halt: null, iterations: 1, costUsd: cost, actions };
    }
    // 3. the report, the notes, the stories
    const report = await child('npm run report');
    if (!report.ok)
      return halt('step-failed', `npm run report failed: ${report.error}`, {
        kind: 'run',
        text: `npm run run -- maintain ${topic}`,
      });
    const open = () =>
      (readJson<PublicRecord>(join(topicDir(topic, root), 'public-record.json'))?.revisions ?? []).filter(
        (r) => !r.note.trim(),
      );
    const revised = open().map((r) => r.id);
    // what this scan revised, noted or not (a resumed scan's notes were written by its first attempt)
    const revisedSince = [
      ...new Set(
        (readJson<PublicRecord>(join(topicDir(topic, root), 'public-record.json'))?.revisions ?? [])
          .filter((r) => r.at.slice(0, 10) >= date)
          .map((r) => r.id),
      ),
    ];
    if (revised.length) {
      const notes = await agent(REVISION_NOTE_BRIEF, [`Write: topics/${topic}/public-record.json`], 'notes');
      if (/^budget/.test(notes.error ?? ''))
        return halt('budget', notes.error!, {
          kind: 'decide',
          text: 'raise agents.budgetUsd or wait for the next week',
        });
      for (const line of (notes.text ?? '').split('\n')) {
        const m = /^(\S+\/\S+):\s+(.+)$/.exec(line.trim());
        if (m) await child(`npm run report -- note ${topic} ${m[1]} "${m[2].replace(/"/g, "'")}"`);
      }
      actions.push(`${topic}: ${revised.length} revised finding${revised.length === 1 ? '' : 's'} noted`);
    }
    const discover = await child(`npm run stories -- discover ${topic}`);
    if (!discover.ok && discover.exit !== 2)
      return halt('step-failed', `stories discover failed: ${discover.error}`, {
        kind: 'run',
        text: `npm run run -- maintain ${topic}`,
      });
    // 4. validated and committed before any article pass
    const v = (d.validate ?? ((env) => runValidate(root, env)))(envFor('validate', [], d.env ?? process.env));
    if (!v.ok) {
      const log = writeValidateLog(dir, v.output);
      return halt(
        'step-failed',
        `npm run validate failed after the scan: ${v.output.trim().split('\n').slice(-5).join(' | ')}`,
        { kind: 'fix', text: `read ${log}; fix what validate reports, then npm run run -- maintain ${topic}` },
      );
    }
    if (d.git !== 'none') {
      try {
        git(['add', '-A', '--', `topics/${topic}`]);
        if (git(['diff', '--cached', '--name-only']).trim())
          git([
            'commit',
            '-q',
            '-m',
            `maintain(${topic}): scan ${date}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`,
          ]);
      } catch (e) {
        return halt('git', `git failed: ${(e as Error).message.split('\n')[0]}`, {
          kind: 'fix',
          text: 'commit the topic by hand in the clone',
        });
      }
    }
    // 5. the released articles: reaffirmed or corrected for approval
    const art = await (d.articles ?? articleWork)(topic, a, {
      now,
      mail: d.mail,
      env: d.env,
      exec,
      argvOf: d.argvOf,
      hooks: d.hooks,
      root,
      runId,
    });
    actions.push(...art.actions);
    // 6. a live video whose script cites a revised claim: never rebuilt; a person decides about a note
    for (const s of ledgeredStories(topic, root)) {
      if (!storyOutputs(topic, s.id, root).video) continue;
      const script = readJson<Script>(join(scriptDir(topic, s.id, root), 'script.json'));
      const cited = new Set(
        (script?.sections ?? []).flatMap((sec) =>
          sec.sentences.flatMap((x) => (x.assertions ?? []).flatMap((as) => as.claims.map((c) => c.id))),
        ),
      );
      const hit = revisedSince.filter((id) => cited.has(id));
      if (!hit.length) continue;
      const sdir = runDir(topic, s.id, root);
      const why = `a cited finding was revised after publication (${hit.join(', ')}); the video is never rebuilt`;
      if (readHalt(sdir)?.why !== why)
        writeHalt(sdir, {
          kind: 'needs-person',
          stage: 'published',
          why,
          unblock: {
            kind: 'decide',
            text: `add a note to metadata.description in publish.json and run npm run publish -- push ${topic} ${s.id}, or clear this halt with npm run run -- clear ${topic} ${s.id} if nothing is needed`,
          },
          at: stamp(),
          runId,
          board: { stage: 'published', next: 'a person' },
        });
      actions.push(`${topic}/${s.id}: live video cites a revised finding (${hit.join(', ')}): needs-person`);
    }
    finish();
    clearInterval(beat);
    release(dir, lock);
    return { outcome: 'done', stage, halt: null, iterations: 1, costUsd: cost, actions };
  } catch (e) {
    return halt('step-failed', `the scan failed: ${(e as Error).message ?? String(e)}`, {
      kind: 'fix',
      text: `read ${dir}; then npm run run -- maintain ${topic}`,
    });
  } finally {
    clearInterval(beat);
  }
}

export const maintainDeps = (mail: MailTransport | null): MaintainDeps => ({ mail, env: process.env });

/** Every story of the topic with a publishing ledger (stories.json may no longer list a produced story). */
function ledgeredStories(topic: string, root: string): { id: string }[] {
  const scripts = join(topicDir(topic, root), 'scripts');
  if (!existsSync(scripts)) return [];
  return readdirSync(scripts).flatMap((folder) => {
    const ledger = readJson<{ video: string }>(join(scripts, folder, 'publish.json'));
    return ledger?.video ? [{ id: ledger.video.split('/').slice(1).join('/') }] : [];
  });
}
