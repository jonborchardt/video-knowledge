// The inbox adapter (spec §4.4 step 3, §7.2, §12, phase 3): the tick reads new mail and keeps only the approver's
// replies to a request this automation sent: the thread is required (In-Reply-To or References names a Message-ID
// the outbox recorded for the request, or for a clarification in its thread), and for a release request its id must
// also appear in the subject or in the person's own text and agree with the thread. Each reply is read with the
// forgiving grammar and applied once through `publish decide` (the ledger key is the request id); the message is
// recorded handled in `.automation/inbox.json` only after the verb, so a crash in between is caught by the verb's
// idempotence (an existing `decided` prints and exits 0). Anything unreadable gets one clarification in the thread.
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import type { CliResult } from '../../shared/cli';
import { ROOT, readJson, scriptDir, writeJsonAtomic } from '../../shared/io';
import type { Mailer } from './mailer';
import type { ReleaseManifest } from '../../shared/types';
import { type Halt, clearHalt, readHalt, runDir, writeHalt } from './journal';
import { aliveLocks } from './lock';
import { type OutboxEntry, automationDir } from './notify';
import { DRAFT_ACCEPTED_FILE, readShadow, recordShadowPerson } from './release';
import { type Decision, batchIdIn, correctionIdIn, parseReply, requestIdIn } from './replies';
import { address, filterCorOutbox, ownText, readCorReceived } from '../../modules/mail';
import { draftRequests } from './requests';
import { loadProposals } from '../../modules/topic-discovery';
import { updateSchedule } from './schedule';

export const INBOX_FILE = 'inbox.json';
export interface InboxRecord {
  messageId: string;
  uid: number;
  outcome: string; // applied:<verdict> | ignored:<why> | clarified | refused:<why>
  request?: string;
  at: string;
}
export interface InboxFile {
  /** Only a pre-module file carries it: it seeds the mail module's cursor once. */
  lastUid?: number;
  handled: InboxRecord[];
}
/** A reply's notes as a verb's arguments; the time flag differs by verb. */
const noteArgs = (notes: Decision['notes'] & object, at: '--at' | '--at-seconds'): string[] =>
  notes.flatMap((n) => [
    '--note',
    n.text,
    ...(n.seconds !== undefined ? [at, String(n.seconds)] : []),
    ...(n.scene ? ['--scene', n.scene] : []),
    ...(n.sentence ? ['--sentence', n.sentence] : []),
  ]);
const inboxPath = (root: string) => join(automationDir(root), INBOX_FILE);
export const readInbox = (root = ROOT): InboxFile => readJson<InboxFile>(inboxPath(root)) ?? { handled: [] };
const writeInbox = (root: string, f: InboxFile) => writeJsonAtomic(inboxPath(root), f);

export interface InboxDeps {
  now?: () => number;
  /** Runs `npm run <cli> -- <args>` and waits (the tick spawns the repo's CLI with the verb's environment). */
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  alive?: (pid: number) => boolean; // tests inject; a live run's story is left for the next poll
}
export interface InboxReport {
  fetched: number;
  applied: string[];
  ignored: string[];
  clarified: string[];
  refused: string[];
  /** Messages whose verb failed (exit 1): left for the next poll, the story halted step-failed. */
  failed: string[];
}

const REQUEST_KINDS = ['release-request', 'draft-request', 'batch', 'correction-request'];
/** The request a sent mail belongs to: a request mail itself, or the request behind a clarification sent in its
 *  thread (which carries the request id, or the story of a draft request). The core threads a reply to a sent mail;
 *  what that mail means is this adapter's. */
export function originOf(e: OutboxEntry | null | undefined, all: OutboxEntry[]): OutboxEntry | null {
  if (!e) return null;
  if (REQUEST_KINDS.includes(e.kind)) return e;
  if (e.kind !== 'reply') return null;
  const { request, topic, storyId } = e.meta ?? {};
  const origin = all.find(
    (x) =>
      REQUEST_KINDS.includes(x.kind) &&
      x.meta?.topic === topic &&
      x.meta?.storyId === storyId &&
      (!request || x.meta?.request === request),
  );
  if (origin) return origin;
  return topic && storyId ? { ...e, kind: request ? 'release-request' : 'draft-request' } : null;
}

export async function pollInbox(a: Automation, mail: Mailer, root = ROOT, deps: InboxDeps): Promise<InboxReport> {
  const now = deps.now ?? Date.now;
  /** A reply whose verb failed: the message stays for the next poll, which runs the same idempotent verb again; the
   *  story halts step-failed once so the person hears of it (the tick's halt mail). Returns the error line. */
  const verbFailed = (
    r: CliResult,
    topic: string,
    storyId: string,
    stage: string,
    next: string,
    what: string,
    byHand: string,
  ): string => {
    const err = (r.stderr || r.stdout).trim().split('\n').at(-1) ?? 'exit 1';
    const dir = runDir(topic, storyId, root);
    const why = `${what}: ${err}`;
    if (readHalt(dir)?.why !== why)
      writeHalt(dir, {
        kind: 'step-failed',
        stage,
        why,
        unblock: {
          kind: 'fix',
          text: `fix what it names, or run ${byHand} by hand; the next tick tries the reply again`,
        },
        at: new Date(now()).toISOString(),
        runId: 'tick',
        board: { stage, next },
      } satisfies Halt);
    return err;
  };
  const file = readInbox(root);
  /** A run of the story or of one of its Shorts is live: a ledger write now would land inside an agent step and
   *  the tree guard would revert it (a Short halted unexpected-edit on 2026-11-03), so the reply waits a poll. */
  const runLive = (topic: string, storyId: string) => {
    const under = scriptDir(topic, storyId, root).replaceAll('\\', '/') + '/';
    return aliveLocks(root, deps.alive).some((d) => d.replaceAll('\\', '/').startsWith(under));
  };
  await mail.fetch();
  const outbox = filterCorOutbox(() => true, root);
  const handled = new Set(file.handled.map((h) => h.messageId));
  // a reply to a general question is the asking agent's, never a decision: this adapter does not look at it
  const got = readCorReceived(root).filter(
    (m) => !handled.has(m.key) && outbox.find((e) => e.messageId === m.thread)?.kind !== 'question',
  );
  const report: InboxReport = { fetched: got.length, applied: [], ignored: [], clarified: [], refused: [], failed: [] };
  const by = a.approvals.approverName || address(a.approvals.to);
  for (const m of got) {
    const done = (outcome: string, request?: string) => {
      file.handled.push({
        messageId: m.key,
        uid: m.uid,
        outcome,
        ...(request && { request }),
        at: new Date(now()).toISOString(),
      });
      writeInbox(root, file);
    };
    const ignore = (why: string) => {
      report.ignored.push(`${m.messageId}: ${why}`);
      done(`ignored:${why}`);
    };
    if (address(m.from) !== address(a.approvals.to)) {
      ignore('not from the approver');
      continue;
    }
    const thread = originOf(
      outbox.find((e) => e.messageId === m.thread),
      outbox,
    );
    if (!thread) {
      ignore('not a reply to a request this automation sent');
      continue;
    }
    const own = ownText(m.text);
    const reply = (text: string) =>
      mail.sendTracked(
        {
          from: a.approvals.from || a.notifications.to,
          to: a.approvals.to,
          subject: `Re: ${m.subject.replace(/^Re:\s*/i, '')}`,
          text,
          inReplyTo: m.messageId,
          references: [...m.references, m.messageId],
        },
        'reply',
        {
          now,
          ...(thread.meta?.request && { request: thread.meta?.request }),
          topic: thread.meta?.topic,
          storyId: thread.meta?.storyId,
        },
      );
    const moved = (topic: string, storyId: string) =>
      updateSchedule(root, (s) => ({
        ...s,
        due: [...(s.due ?? []), { topic, storyId, why: 'moved', at: new Date(now()).toISOString() }],
      }));
    if (
      (thread.kind === 'release-request' || thread.kind === 'draft-request') &&
      thread.meta?.topic &&
      thread.meta?.storyId &&
      runLive(thread.meta?.topic, thread.meta?.storyId)
    ) {
      continue;
    }
    if (thread.kind === 'release-request' && thread.meta?.topic && thread.meta?.storyId) {
      const { topic, storyId } = thread.meta ?? {};
      const id = requestIdIn(m.subject) ?? requestIdIn(own);
      if (!id || id !== thread.meta?.request) {
        ignore(`the request id in the reply (${id ?? 'none'}) is not the thread's (${thread.meta?.request})`);
        continue;
      }
      const parsed = parseReply(own, a, new Date(now()), 'release');
      if ('problem' in parsed) {
        await reply(
          `I could not read your reply to the release request ${id}: ${parsed.problem}.\n\n${parsed.hint}\n\nThe request stays open.`,
        );
        report.clarified.push(id);
        done('clarified', id);
        continue;
      }
      const d = parsed.decision;
      if (d.shadowMarks) markShadow(root, topic, storyId, d.shadowMarks);
      const r = await deps.run('publish', decideArgs(topic, storyId, id, by, d, m.messageId, root));
      if (r.status === 2) {
        const why = r.stderr.trim().replace(/^refused: /, '');
        await reply(
          `Your reply to the release request ${id} could not be applied: ${why}.${/expired|changed/.test(why) ? ' A new request follows when the release is ready again.' : ''}`,
        );
        report.refused.push(`${id}: ${why}`);
        done(`refused:${why}`, id);
        continue;
      }
      if (r.status !== 0) {
        // the verb failed (YouTube refused, a crash): the message stays for the next poll, which runs the same
        // idempotent verb again; the story halts step-failed so the person hears of it (the tick's halt mail)
        const err = verbFailed(
          r,
          topic,
          storyId,
          'release',
          'the decision',
          `publish decide ${id} failed`,
          `npm run publish -- decide ${topic} ${storyId} --request ${id} --by "<name>" --verdict ${d.verdict}`,
        );
        report.failed.push(`${id}: ${err}`);
        continue;
      }
      // the request was decided before this reply: a different answer is told so and never applied; the same one
      // is a copy of the decision (a resend, a second OK) and needs no answer
      const earlier = /already recorded: decided \S+ \((\w+)\)/.exec(r.stdout)?.[1];
      if (earlier && earlier !== d.verdict) {
        await reply(
          `The release request ${id} was already decided (${earlier}); this reply (${d.verdict}) was not applied. A change to a live release is a new output or a correction, by hand.`,
        );
        report.refused.push(`${id}: already decided (${earlier})`);
        done(`refused:already decided (${earlier})`, id);
        continue;
      }
      const dir = runDir(topic, storyId, root);
      if (readHalt(dir)?.why.startsWith(`publish decide ${id} failed`)) clearHalt(dir);
      report.applied.push(`${id}: ${d.verdict}`);
      done(`applied:${d.verdict}`, id);
      moved(topic, storyId); // the work plane resumes the story's loop (the Shorts, the launch)
      continue;
    }
    if (thread.kind === 'draft-request' && thread.meta?.topic && thread.meta?.storyId) {
      const { topic, storyId } = thread.meta ?? {};
      const parsed = parseReply(own, a, new Date(now()), 'draft');
      if ('problem' in parsed || parsed.decision.verdict === 'schedule') {
        await reply(
          `I could not read your reply to the draft of ${storyId}: reply OK to accept it, or CHANGES: and one note per line.`,
        );
        report.clarified.push(storyId);
        done('clarified');
        continue;
      }
      const d = parsed.decision;
      if (d.shadowMarks) markShadow(root, topic, storyId, d.shadowMarks);
      const build = Object.entries(draftRequests(topic, storyId, root)).find(
        ([, v]) => v.messageId === thread.messageId,
      )?.[0];
      if (!build) {
        ignore('no draft build matches this request');
        continue;
      }
      if (d.verdict === 'ok') {
        // the acceptance for the release loop, which runs `video final` (minutes) as the next work job
        writeJsonAtomic(join(runDir(topic, storyId, root), DRAFT_ACCEPTED_FILE), {
          build,
          by,
          via: { channel: 'email', messageId: m.messageId },
          at: new Date(now()).toISOString(),
        });
        report.applied.push(`${storyId}: draft ok`);
        done('applied:draft-ok');
      } else {
        const args = [
          'request-changes',
          topic,
          storyId,
          '--by',
          by,
          '--via',
          `email:${m.messageId}`,
          ...noteArgs(d.notes ?? [], '--at'),
        ];
        const r = await deps.run('publish', args);
        if (r.status === 2) {
          await reply(
            `Your notes on the draft of ${storyId} could not be recorded: ${r.stderr.trim().replace(/^refused: /, '')}`,
          );
          report.refused.push(storyId);
          done('refused');
          continue;
        }
        if (r.status !== 0) throw new Error(`publish request-changes failed: ${(r.stderr || r.stdout).trim()}`);
        report.applied.push(`${storyId}: draft changes`);
        done('applied:draft-changes');
      }
      moved(topic, storyId);
      continue;
    }
    if (thread.kind === 'batch') {
      // a proposal batch (spec 5.1): APPROVE and REJECT lines through `topics approve|reject` by the approver, the
      // batch id required in the subject or the own text; a slug outside the batch is reported back, never applied;
      // APPROVE ALL and REJECT ALL expand over the batch's slugs only; the verbs are idempotent
      const id = batchIdIn(m.subject) ?? batchIdIn(own);
      if (!id || id !== thread.meta?.request) {
        ignore(`the batch id in the reply (${id ?? 'none'}) is not the thread's (${thread.meta?.request})`);
        continue;
      }
      const parsed = parseReply(own, a, new Date(now()), 'topics');
      if ('problem' in parsed) {
        await reply(`I could not read your reply to the proposal batch ${id}: ${parsed.problem}.\n\n${parsed.hint}`);
        report.clarified.push(id);
        done('clarified', id);
        continue;
      }
      const t = parsed.decision.topics!;
      const inBatch = loadProposals(root)
        .filter((x) => x.proposal.batch?.id === id)
        .map((x) => x.proposal.slug);
      const approve = t.approve === 'all' ? [...new Set([...inBatch, ...(t.named ?? [])])] : t.approve;
      const reject = Array.isArray(t.reject)
        ? t.reject
        : inBatch
            .filter((s) => !approve.includes(s))
            .map((slug) => ({ slug, note: (t.reject as { all: string }).all }));
      const applied = { approve: [] as string[], reject: [] as string[] };
      const skipped: string[] = [];
      const refused: string[] = [];
      const via = `email:${m.messageId}`;
      for (const slug of approve) {
        if (!inBatch.includes(slug)) {
          skipped.push(`${slug}: not in batch ${id}`);
          continue;
        }
        const r = await deps.run('topics', ['approve', slug, '--by', by, '--via', via]);
        if (r.status === 0) applied.approve.push(slug);
        else refused.push(`${slug}: ${(r.stderr || r.stdout).trim().replace(/^refused: /, '')}`);
      }
      for (const { slug, note } of reject) {
        if (!inBatch.includes(slug)) {
          skipped.push(`${slug}: not in batch ${id}`);
          continue;
        }
        const r = await deps.run('topics', ['reject', slug, '--by', by, '--note', note, '--via', via]);
        if (r.status === 0) applied.reject.push(slug);
        else refused.push(`${slug}: ${(r.stderr || r.stdout).trim().replace(/^refused: /, '')}`);
      }
      if (skipped.length || refused.length || t.unknown?.length)
        await reply(
          [
            `Your reply to the proposal batch ${id} was applied in part.`,
            `Applied: ${[applied.approve.length ? `APPROVE ${applied.approve.join(', ')}` : '', applied.reject.length ? `REJECT ${applied.reject.join(', ')}` : ''].filter(Boolean).join('; ') || 'nothing'}`,
            ...(skipped.length ? ['Skipped (not in this batch):', ...skipped.map((x) => `  - ${x}`)] : []),
            ...(refused.length ? ['Refused:', ...refused.map((x) => `  - ${x}`)] : []),
            ...(t.unknown?.length ? ['Lines I could not read:', ...t.unknown.map((x) => `  - ${x}`)] : []),
            '',
            'Reply with lines like: APPROVE <slug>; REJECT <slug>: <why>; APPROVE ALL; REJECT ALL: <why>.',
          ].join('\n'),
        );
      const summary = `approve ${applied.approve.join(', ') || 'none'}; reject ${applied.reject.join(', ') || 'none'}`;
      report.applied.push(`${id}: ${summary}`);
      done(
        `applied:topics approve=${applied.approve.join(',')} reject=${applied.reject.join(',')} skipped=${skipped.length} refused=${refused.length}`,
        id,
      );
      continue;
    }
    if (thread.kind === 'correction-request' && thread.meta?.topic && thread.meta?.storyId) {
      // an article correction (register D10): OK runs `article decide --verdict ok` (the correction itself, for the
      // exact fingerprint the request bound, by the person); CHANGES records the notes for the next writer pass
      const { topic, storyId } = thread.meta ?? {};
      const id = correctionIdIn(m.subject) ?? correctionIdIn(own);
      if (!id || id !== thread.meta?.request) {
        ignore(`the correction id in the reply (${id ?? 'none'}) is not the thread's (${thread.meta?.request})`);
        continue;
      }
      const parsed = parseReply(own, a, new Date(now()), 'correction');
      if ('problem' in parsed || parsed.decision.verdict === 'schedule') {
        await reply(
          `I could not read your reply to the correction request ${id}: reply OK to release the correction, or CHANGES: and one note per line.${'problem' in parsed ? `\n\n${parsed.problem}` : ''}`,
        );
        report.clarified.push(id);
        done('clarified', id);
        continue;
      }
      const d = parsed.decision;
      const args = [
        'decide',
        topic,
        storyId,
        '--request',
        id,
        '--verdict',
        d.verdict === 'ok' ? 'ok' : 'changes',
        '--by',
        by,
        '--via',
        `email:${m.messageId}`,
      ];
      for (const n of d.notes ?? []) args.push('--note', n.text);
      const r = await deps.run('article', args);
      if (r.status === 2) {
        const why = r.stderr.trim().replace(/^refused: /, '');
        await reply(
          `Your reply to the correction request ${id} could not be applied: ${why}.${/changed since/.test(why) ? ' A new request follows.' : ''}`,
        );
        report.refused.push(`${id}: ${why}`);
        done(`refused:${why}`, id);
        continue;
      }
      if (r.status !== 0) {
        const err = verbFailed(
          r,
          topic,
          storyId,
          'article',
          'the correction',
          `article decide ${id} failed`,
          `npm run article -- decide ${topic} ${storyId} --request ${id} --verdict ${d.verdict} --by "<name>"`,
        );
        report.failed.push(`${id}: ${err}`);
        continue;
      }
      report.applied.push(`${id}: correction ${d.verdict}`);
      done(`applied:correction-${d.verdict}`, id);
      if (d.verdict === 'ok') moved(topic, storyId); // the launch job deploys the corrected article (no social post)
      continue;
    }
    const other = correctionIdIn(m.subject) ?? correctionIdIn(own);
    ignore(other ? `${other}: not a request this automation sent` : 'not a request reply');
  }
  return report;
}

function markShadow(
  root: string,
  topic: string,
  storyId: string,
  marks: { n: number; mark: 'agree' | 'disagree' }[],
): void {
  const e = readShadow(root).findLast((x) => x.story === `${topic}/${storyId}`);
  if (e) recordShadowPerson(root, e.story, e.build, { verdict: e.person?.verdict ?? 'accept', marks });
}

/** The `publish decide` arguments for a parsed decision: `paid: 'all'` is every numbered link of the manifest,
 *  numbers are the manifest's `n`. */
export function decideArgs(
  topic: string,
  storyId: string,
  request: string,
  by: string,
  d: Decision,
  messageId: string,
  root: string,
): string[] {
  const args = ['decide', topic, storyId, '--request', request, '--by', by, '--verdict', d.verdict];
  if (d.verdict === 'schedule' && d.at) args.push('--at', d.at);
  args.push(...noteArgs(d.notes ?? [], '--at-seconds'));
  if (d.paid) {
    const manifest = readJson<ReleaseManifest>(
      join(scriptDir(topic, storyId, root), 'video', 'review', 'release-manifest.json'),
    );
    const links = manifest?.ctas.commercial ?? [];
    const wanted = d.paid;
    const ids = wanted === 'all' ? links.map((l) => l.id) : links.filter((l) => wanted.includes(l.n)).map((l) => l.id);
    for (const id of ids) args.push('--paid', id);
  }
  args.push('--via', `email:${messageId}`);
  return args;
}
