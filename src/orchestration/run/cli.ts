// npm run run -- <verb> ...
//   story <topic> <story-id> [--approver "<name>"] [--notes-file <path>] [--until <stage>|requested] [--fresh] [--no-commit] [--model <m>]
//                                      drive one story from the board's ready through packaged and the release loop (the
//                                      draft by policy, the release build, the Shorts, the private uploads, push, verify,
//                                      the manifest, the approval request: --until requested, the default; --until
//                                      packaged stops before it) unattended: each
//                                      board step runs as a child process or a budgeted claude -p agent under its role's
//                                      permission rules; journaled under the story's run/; one run per story (exit 3 when
//                                      a live run holds it); a crash resumes with the same command. Exit 0 done, 1 halted
//                                      (HALT <kind>: <why> then UNBLOCK: <what clears it>), 2 usage or refusal.
//                                      --fresh (a fixture topic only): archive the production folder to
//                                      topics/<topic>/history/<run id>/ first and run every stage again.
//                                      --model <m>: every role's model for this run (a test run with real agents uses a
//                                      cheaper model than automation.json's production default).
//                                      --no-commit: a supervised run on a feature branch; the finish validates and
//                                      leaves the artifacts uncommitted for the person (the runner commits only on
//                                      git.commitOn's branch).
//   topic <topic>                      the research pipeline for one approved proposal (what the work plane runs); a
//                                      crashed run resumes with the same command; a thin topic is parked, not halted
//   maintain <topic>                   the maintenance scan of one public topic by hand (what the work plane runs when
//                                      enabled.maintenance and schedule.maintenance.everyDays say it is due)
//   clear <topic> <story-id>|research --by <name>
//                                      clears a story's halt that needs no action (a live video whose cited finding was
//                                      revised), or the topic run's (`research`: a scan or research run), journaled by name
//   discover [--institution <key>] [--dry-run]
//                                      the weekly topic discovery by hand (costs agents): one discovery agent per
//                                      institution with a channel, one independent review per proposal, the batch and its
//                                      mail; --dry-run runs the agents and prints the batch, recording and mailing nothing.
//   launch <topic> <story-id>          the launch job by hand (what the work plane runs once the release group is live and
//                                      verified): report seed, brand, build, links freeze, validate, commit, push, resumable
//                                      from its record under .automation/launch/; clears the launch's halt first.
//   status [--json]                    every run folder: running, halted (kind, why, unblock) or idle, and its spend.
//   tick [--preflight]                 the control plane (automation.json enabled.tick): one short pass: preflight,
//                                      outbox, due resumes, stuck runs, halt emails, the digest. Never runs a story.
//                                      --preflight: the preflight alone, as if enabled.tick and enabled.work were on;
//                                      prints what a live tick would stop on and writes nothing (exit 1 on a problem).
//   work [--job <kind>] [--dry-run]    the work plane (enabled.work): one due long job in the foreground (a resume, the
//                                      production pick), then exit; the locks bound how many run at once.
//   pick [--dry-run]                   the production pick by hand: the ranking, the knobs, the choice; starts it
//                                      without --dry-run.
//   schedule --print                   the two Task Scheduler (or cron) commands and the power settings, for you to
//                                      run; this never creates a task.
//   mail-test [--await-reply]          one message to notifications.to through the outbox; with the flag, waits up to
//                                      ten minutes for your reply and saves it under tests/fixtures/mail/.
//   verified <integration> --by <name> --evidence <ref>
//                                      records your verification of one integration in readiness.json (the only writer):
//                                      the evidence must name a record of the kind that proves that integration (a ledger
//                                      event of the named type, a reply decision, a <Message-ID> the outbox sent or the
//                                      inbox applied, scan:<topic>, shadow:<topic>/<story>, launch:<topic>/<story>,
//                                      social:<topic>/<story>, tick:<ISO>, run:<id> of a finished topic run,
//                                      discovery:<slot>); never an automated actor; it changes no flag.
// Policy: automation.json (src/shared/automation.ts). Secrets: .env, loaded here and handed to each child by verb.
import { readFileSync } from 'node:fs';
import { AGENT_ROLES, loadAutomation } from '../../shared/automation';
import { approverProblem } from '../../shared/approver';
import { loadDotEnv, ROOT, toJson } from '../../shared/io';
import { PRODUCTION_STAGES, type ProductionStage } from '../production';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeMail, libraryTransport, mailConfigFromEnv } from '../../shared/mail';
import { archiveProduction, freshProblem } from './fresh';
import { sendTracked } from './notify';
import { candidates, pickJob, pickJobIfDue, pickState, rank } from './pick';
import { runStory } from './runner';
import { renderStatus, statusOf } from './status';
import { tick } from './tick';
import { type Job, type JobKind, launchDeps, nextJob, scheduleText, work } from './work';
import { launch } from './launch';
import { discover, discoveryDeps } from './discovery';
import { runTopic } from './topic-runner';
import { maintain, maintainDeps } from './maintain';
import { clearHalt, readHalt, runDir, topicRunDir, appendJournal } from './journal';
import { INTEGRATIONS, verify } from './readiness';

const usage = () =>
  readFileSync(new URL(import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('//'))
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n');

const [verb, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

const die = (msg: string, code = 2): never => {
  console.error(msg);
  process.exit(code);
};
const printHalt = (h: { kind: string; why: string; unblock: { text: string } }) => {
  console.log(`HALT ${h.kind}: ${h.why}`);
  console.log(`UNBLOCK: ${h.unblock.text}`);
};

loadDotEnv();

switch (verb) {
  case 'story': {
    const [topic, storyId] = rest;
    if (!topic || !storyId) die(usage());
    const approver = flag('--approver');
    if (approver !== undefined) {
      const problem = approverProblem(approver);
      if (problem) die(problem);
    }
    const until = flag('--until') as ProductionStage | 'requested' | undefined;
    if (until && until !== 'requested' && !PRODUCTION_STAGES.includes(until))
      die(`--until must be one of ${PRODUCTION_STAGES.join(', ')}, requested`);
    const notesFile = flag('--notes-file');
    const loaded = loadAutomation(ROOT);
    const model = flag('--model');
    const a = model
      ? {
          ...loaded,
          agents: {
            ...loaded.agents,
            models: Object.fromEntries(AGENT_ROLES.map((r) => [r, model])) as typeof loaded.agents.models,
          },
        }
      : loaded;
    let runId: string | undefined;
    if (rest.includes('--fresh')) {
      const problem = freshProblem(topic);
      if (problem) die(problem);
      try {
        const f = archiveProduction(topic, storyId, ROOT);
        runId = f.runId;
        console.log(
          `fresh run ${f.runId}: ${f.archived ? `archived the previous production to ${f.archived}` : 'no previous production'}`,
        );
      } catch (e) {
        die((e as Error).message);
      }
    }
    const cfg = mailConfigFromEnv();
    const r = await runStory(topic, storyId, a, {
      approver: approver ?? `automated: run ${new Date().toISOString().slice(0, 10)}`,
      notes: notesFile ? readFileSync(notesFile, 'utf8') : undefined,
      until,
      root: ROOT,
      mail: cfg && a.approvals.to ? libraryTransport(cfg) : null, // no mailbox: the halt says what to do
      ...(runId && { runId }),
      ...(rest.includes('--no-commit') && { git: 'none' as const }),
    });
    if (r.outcome === 'held') die(`a live run holds ${topic} ${storyId}; nothing done`, 3);
    if (r.outcome === 'halted' && r.halt) {
      printHalt(r.halt);
      console.log(`stage ${r.stage}; ${r.iterations} iterations; ${r.costUsd.toFixed(2)} USD`);
      process.exit(1);
    }
    console.log(`done at ${r.stage}; ${r.iterations} iterations; ${r.costUsd.toFixed(2)} USD`);
    break;
  }
  case 'launch': {
    const [topic, storyId] = rest;
    if (!topic || !storyId) die(usage());
    const a = loadAutomation(ROOT);
    const r = await launch(topic, storyId, a, launchDeps(ROOT), ROOT);
    if (r.outcome === 'halted' && r.halt) {
      printHalt(r.halt);
      process.exit(1);
    }
    const pushed = r.record?.pushed ? `, pushed ${r.record.pushed}` : '';
    console.log(`launched: committed ${r.record?.committed ?? 'nothing'}${pushed}; the tick probes the deploy`);
    break;
  }
  case 'topic': {
    // the research pipeline for one approved proposal (what the work plane runs): real agents, the watcher and the
    // research verbs as children; a crashed run resumes with the same command
    const topic = rest[0];
    if (!topic) die(usage());
    const a = loadAutomation(ROOT);
    const r = await runTopic(topic, a, { root: ROOT });
    if (r.outcome === 'held') die('another run holds this topic', 3);
    if (r.outcome === 'halted' && r.halt) {
      printHalt(r.halt);
      process.exit(1);
    }
    console.log(`done: ${topic} ${r.stage} (${r.iterations} steps, ${r.costUsd.toFixed(2)} USD)`);
    break;
  }
  case 'maintain': {
    // the maintenance scan of one public topic by hand (what the work plane runs when a scan is due): costs agents
    const topic = rest[0];
    if (!topic) die(usage());
    const a = loadAutomation(ROOT);
    const cfg = mailConfigFromEnv();
    const r = await maintain(topic, a, maintainDeps(cfg && a.approvals.to ? libraryTransport(cfg) : null), ROOT);
    for (const line of r.actions) console.log(line);
    if (r.outcome === 'held') die('another run holds this topic', 3);
    if (r.outcome === 'halted' && r.halt) {
      printHalt(r.halt);
      process.exit(1);
    }
    console.log(`scan done: ${topic} (${r.costUsd.toFixed(2)} USD)`);
    break;
  }
  case 'clear': {
    // a person clears a halt that needs no action (a live video whose cited finding was revised): journaled by name
    const [topic, storyId] = rest;
    if (!topic || !storyId) die(usage());
    const by = flag('--by');
    if (!by || /^automated:/i.test(by)) die('clear needs --by <your name>');
    const dir = storyId === 'research' ? topicRunDir(topic, ROOT) : runDir(topic, storyId, ROOT); // research: the topic run's
    const h = readHalt(dir);
    if (!h) {
      console.log('no halt to clear');
      break;
    }
    clearHalt(dir);
    appendJournal(dir, {
      at: new Date().toISOString(),
      runId: 'clear',
      stage: h.stage,
      next: h.board.next,
      step: 'clear',
      kind: 'do',
      attempt: 0,
      error: `cleared by ${by}: ${h.kind}: ${h.why}`,
    });
    console.log(`cleared ${h.kind} on ${topic} ${storyId} (by ${by})`);
    break;
  }
  case 'discover': {
    // a person's manual discovery (costs one discovery agent per institution and one review agent per proposal);
    // --dry-run runs the agents and prints the batch without recording, mailing or committing anything
    const a = loadAutomation(ROOT);
    const cfg = mailConfigFromEnv();
    const dry = rest.includes('--dry-run');
    const only = flag('--institution');
    const r = await discover(
      a,
      {
        ...discoveryDeps(cfg && a.approvals.to && !dry ? libraryTransport(cfg) : null),
        dryRun: dry,
        ...(only && { institutions: () => [only] }),
      },
      ROOT,
    );
    if (r.outcome === 'halted' && r.halt) {
      printHalt(r.halt);
      process.exit(1);
    }
    if (r.outcome === 'held') die('another discovery is running', 3);
    const rec = r.record;
    console.log(
      `discovery ${dry ? '(dry run) ' : ''}done: ${Object.keys(rec?.institutions ?? {}).length} institutions, ${Object.values(rec?.institutions ?? {}).reduce((n, i) => n + i.proposals.length, 0)} proposals, ${rec?.batch ? `batch ${rec.batch.id} with ${rec.batch.listed.length} listed and ${rec.batch.parked.length} parked` : 'no batch'}, ${rec?.costUsd.toFixed(2) ?? '0.00'} USD`,
    );
    break;
  }
  case 'status': {
    const rows = statusOf(ROOT);
    process.stdout.write(rest.includes('--json') ? toJson(rows) : renderStatus(rows));
    break;
  }
  case 'tick': {
    const a = loadAutomation(ROOT);
    const cfg = mailConfigFromEnv();
    const preflightOnly = rest.includes('--preflight');
    const r = await tick(a, ROOT, { mail: cfg && !preflightOnly ? libraryTransport(cfg) : null, preflightOnly });
    for (const line of r.actions) console.log(line);
    console.log(
      r.outcome === 'ok' || r.outcome === 'disabled' || r.outcome === 'held'
        ? 'RESULT: TICK OK'
        : `RESULT: TICK FAILED (${r.outcome})`,
    );
    process.exit(r.outcome === 'preflight' ? 1 : 0);
    break;
  }
  case 'work': {
    const a = loadAutomation(ROOT);
    const only = flag('--job');
    const pick = () => pickJobIfDue(a, ROOT);
    if (rest.includes('--dry-run')) {
      const job = nextJob(a, ROOT, { pick });
      console.log(
        job
          ? `would run ${job.kind}${job.topic ? ` ${job.topic} ${job.storyId}` : ''}: ${job.why}`
          : 'idle: nothing due',
      );
      break;
    }
    const wcfg = mailConfigFromEnv();
    const r = await work(a, ROOT, {
      pick: only && only !== 'pick' ? () => null : pick,
      mail: wcfg && a.approvals.to ? libraryTransport(wcfg) : null,
      ...(only && { skip: [] as Job[], only: only as JobKind }),
    });
    console.log(
      `RESULT: WORK ${r.job?.kind ?? 'none'} ${r.outcome}${r.job?.topic ? ` (${r.job.topic} ${r.job.storyId})` : ''}`,
    );
    process.exit(r.outcome === 'halted' ? 1 : 0);
    break;
  }
  case 'pick': {
    const a = loadAutomation(ROOT);
    const ranked = rank(candidates(ROOT));
    const state = pickState(ROOT);
    console.log(
      `week ${state.week}: ${state.picks.length} of ${a.production.storiesPerWeek} picked; ${a.production.perInstitutionPerWeek} per institution; ${a.runs.maxConcurrentStoryRuns} at once; ${a.production.maxAwaitingApproval} awaiting approval at most; production ${a.enabled.production ? 'on' : 'off'}`,
    );
    for (const c of ranked)
      console.log(
        `  ${c.queued ? 'queued ' : ''}${c.overall.toFixed(2)} ${c.topic} ${c.storyId} (${c.institution}; evidence ${c.evidence.toFixed(2)}; live ${c.liveInTopic}/${c.liveInInstitution})`,
      );
    const job = pickJobIfDue(a, ROOT);
    console.log(job ? `choice: ${job.topic} ${job.storyId}` : 'choice: none (nothing due or no candidate)');
    if (rest.includes('--dry-run') || !job) break;
    const r = await pickJob(a, ROOT);
    console.log(r.started ? `started ${r.started}: ${r.result?.outcome}` : r.why);
    process.exit(r.result?.outcome === 'halted' ? 1 : 0);
    break;
  }
  case 'schedule': {
    if (!rest.includes('--print')) die(usage());
    console.log(scheduleText(loadAutomation(ROOT), ROOT));
    break;
  }
  case 'verified': {
    // a person's verification of one integration against the real service: evidence bound, no flag touched
    const [integration] = rest;
    const by = flag('--by');
    const evidence = flag('--evidence');
    if (!integration || !by || !evidence)
      die(
        `verified needs <integration> --by <name> --evidence <ref>; integrations: ${INTEGRATIONS.map((i) => i.key).join(', ')}`,
      );
    try {
      const r = verify(ROOT, integration!, { by: by!, evidence: evidence! });
      console.log(
        `${r.changed ? 'verified' : 'already verified'} ${integration} (by ${r.record.by}, ${r.record.at}, evidence ${r.record.evidence}); enabling is a separate act in automation.json`,
      );
    } catch (e) {
      die((e as Error).message);
    }
    break;
  }
  case 'mail-test': {
    const a = loadAutomation(ROOT);
    const cfg = mailConfigFromEnv();
    if (!cfg) die('mail is not configured: MAIL_SMTP_HOST, MAIL_IMAP_HOST, MAIL_USER and MAIL_PASSWORD in .env');
    if (!a.notifications.to) die('automation.json notifications.to is empty');
    const mail = rest.includes('--fake') ? new FakeMail() : libraryTransport(cfg!);
    const at = new Date().toISOString();
    const { messageId } = await sendTracked(
      mail,
      {
        from: a.approvals.from || cfg!.user,
        to: a.notifications.to,
        subject: `video-knowledge mail test ${at}`,
        text: `Reply to this message with any words; the reply is saved as a fixture (addresses replaced).\nSent ${at}.`,
      },
      'test',
      ROOT,
    );
    console.log(`sent ${messageId} to ${a.notifications.to}`);
    if (!rest.includes('--await-reply')) break;
    const deadline = Date.now() + 10 * 60_000;
    let since = await mail.lastUid(); // only what arrives after the test: never the whole inbox
    while (Date.now() < deadline) {
      const got = await mail.fetchSince(since);
      for (const m of got) since = Math.max(since, m.uid);
      const reply = got.find((m) => m.inReplyTo === messageId || m.references.includes(messageId));
      if (reply) {
        const file = join(ROOT, 'tests', 'fixtures', 'mail', `reply-${at.slice(0, 10)}-${reply.uid}.eml`);
        const raw = (reply.raw ?? '')
          .replaceAll(a.notifications.to, 'jon@example.test')
          .replaceAll(cfg!.user, 'automation@example.test');
        writeFileSync(file, raw);
        console.log(`reply at ${reply.date}; own text:\n${reply.text}\nsaved ${file}`);
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, 20_000));
    }
    die('no reply within ten minutes', 1);
    break;
  }
  default:
    die(usage());
}
