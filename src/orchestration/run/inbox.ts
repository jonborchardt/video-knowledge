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
import type { InMail, MailTransport } from '../../shared/mail';
import type { ReleaseManifest } from '../../shared/types';
import { type Halt, clearHalt, readHalt, runDir, writeHalt } from './journal';
import { type OutboxEntry, automationDir, readOutbox, sendTracked } from './notify';
import { DRAFT_ACCEPTED_FILE, readShadow, recordShadowPerson } from './release';
import { type Decision, batchIdIn, correctionIdIn, ownText, parseReply, requestIdIn } from './replies';
import { draftRequests } from './requests';
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
  lastUid: number;
  handled: InboxRecord[];
}
const inboxPath = (root: string) => join(automationDir(root), INBOX_FILE);
export const readInbox = (root = ROOT): InboxFile =>
  readJson<InboxFile>(inboxPath(root)) ?? { lastUid: 0, handled: [] };
const writeInbox = (root: string, f: InboxFile) => writeJsonAtomic(inboxPath(root), f);

export interface InboxDeps {
  now?: () => number;
  /** Runs `npm run <cli> -- <args>` and waits (the tick spawns the repo's CLI with the verb's environment). */
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
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

/** The request thread a mail belongs to: the outbox entry whose Message-ID the reply names, a request mail or a
 *  clarification sent in its thread (which carries the request id, or the story of a draft request). */
export function threadOf(m: InMail, outbox: OutboxEntry[]): OutboxEntry | null {
  const ids = [m.inReplyTo, ...m.references].filter((x): x is string => !!x);
  const hit = outbox.find(
    (e) =>
      ids.includes(e.messageId) &&
      (e.kind === 'release-request' ||
        e.kind === 'draft-request' ||
        e.kind === 'batch' ||
        e.kind === 'correction-request' ||
        (e.kind === 'reply' && e.topic && e.storyId)),
  );
  if (!hit) return null;
  if (hit.kind !== 'reply') return hit;
  // a reply in a thread: the request mail it continues names the kind
  const origin = outbox.find(
    (e) =>
      e.kind !== 'reply' &&
      e.topic === hit.topic &&
      e.storyId === hit.storyId &&
      (!hit.request || e.request === hit.request),
  );
  return origin ?? { ...hit, kind: hit.request ? 'release-request' : 'draft-request' };
}

const address = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();

export async function pollInbox(
  a: Automation,
  mail: MailTransport,
  root = ROOT,
  deps: InboxDeps,
): Promise<InboxReport> {
  const now = deps.now ?? Date.now;
  const file = readInbox(root);
  const got = await mail.fetchSince(file.lastUid);
  const report: InboxReport = { fetched: got.length, applied: [], ignored: [], clarified: [], refused: [], failed: [] };
  const outbox = readOutbox(root);
  const by = a.approvals.approverName || address(a.approvals.to);
  let maxUid = file.lastUid;
  let leftAt: number | null = null; // the first message left for the next poll (its verb failed): fetched again
  for (const m of got) {
    maxUid = Math.max(maxUid, m.uid);
    if (file.handled.some((h) => h.messageId === m.messageId)) {
      writeInbox(root, file);
      continue;
    }
    const done = (outcome: string, request?: string) => {
      file.handled.push({
        messageId: m.messageId,
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
    const thread = threadOf(m, outbox);
    if (!thread) {
      ignore('not a reply to a request this automation sent');
      continue;
    }
    const own = ownText(m.text);
    const reply = (text: string) =>
      sendTracked(
        mail,
        {
          from: a.approvals.from || a.notifications.to,
          to: a.approvals.to,
          subject: `Re: ${m.subject.replace(/^Re:\s*/i, '')}`,
          text,
          inReplyTo: m.messageId,
          references: [...m.references, m.messageId],
        },
        'reply',
        root,
        { now, ...(thread.request && { request: thread.request }), topic: thread.topic, storyId: thread.storyId },
      );
    const moved = (topic: string, storyId: string) =>
      updateSchedule(root, (s) => ({
        ...s,
        due: [...(s.due ?? []), { topic, storyId, why: 'moved', at: new Date(now()).toISOString() }],
      }));
    if (thread.kind === 'release-request' && thread.topic && thread.storyId) {
      const { topic, storyId } = thread;
      const id = requestIdIn(m.subject) ?? requestIdIn(own);
      if (!id || id !== thread.request) {
        ignore(`the request id in the reply (${id ?? 'none'}) is not the thread's (${thread.request})`);
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
        const err = (r.stderr || r.stdout).trim().split('\n').at(-1) ?? 'exit 1';
        const dir = runDir(topic, storyId, root);
        const why = `publish decide ${id} failed: ${err}`;
        if (readHalt(dir)?.why !== why)
          writeHalt(dir, {
            kind: 'step-failed',
            stage: 'release',
            why,
            unblock: {
              kind: 'fix',
              text: `fix what it names, or run npm run publish -- decide ${topic} ${storyId} --request ${id} --by "<name>" --verdict ${d.verdict} by hand; the next tick tries the reply again`,
            },
            at: new Date(now()).toISOString(),
            runId: 'tick',
            board: { stage: 'release', next: 'the decision' },
          } satisfies Halt);
        report.failed.push(`${id}: ${err}`);
        leftAt ??= m.uid;
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
    if (thread.kind === 'draft-request' && thread.topic && thread.storyId) {
      const { topic, storyId } = thread;
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
        const args = ['request-changes', topic, storyId, '--by', by, '--via', `email:${m.messageId}`];
        for (const n of d.notes ?? []) {
          args.push('--note', n.text);
          if (n.seconds !== undefined) args.push('--at', String(n.seconds));
          if (n.scene) args.push('--scene', n.scene);
          if (n.sentence) args.push('--sentence', n.sentence);
        }
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
    // topic batches (phase 4) and corrections (phase 6) answer by their own ids
    const other = batchIdIn(m.subject) ?? batchIdIn(own) ?? correctionIdIn(m.subject) ?? correctionIdIn(own);
    ignore(other ? `${other}: not handled in this phase` : 'not a request reply');
  }
  // a message left behind is fetched again next poll (the handled ones after it are skipped by their ids)
  file.lastUid = leftAt === null ? maxUid : Math.max(file.lastUid, leftAt - 1);
  writeInbox(root, file);
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
  for (const n of d.notes ?? []) {
    args.push('--note', n.text);
    if (n.seconds !== undefined) args.push('--at-seconds', String(n.seconds));
    if (n.scene) args.push('--scene', n.scene);
    if (n.sentence) args.push('--sentence', n.sentence);
  }
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
