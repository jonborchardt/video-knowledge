// The tick's due-publication step (spec §4.4 step 4, phase 3): for every ledger, what is due now. A schedule past its
// time is synced (YouTube made it public: `published`, observed) and verified. The Shorts of a published video go
// live in ledger order, one per tick, with the tick's `via` naming the request the person decided; a retryable
// failure is retried next tick, and the video is never touched again. A live Short whose description is behind
// (its parent's link) is pushed. An open request past its expiry is renewed once, with a new mail through the
// outbox; a second expiry is a person's (`request-expired`). Every effect is a publishing verb as a child.
// Nothing here retries forever: a sync, a verification read or a Short's go-live that keeps failing is tried
// MAX_TRIES times (counted under the story's run folder, since the ledger keeps one copy of an identical event),
// then the story halts `step-failed` once, so the halt mail and `status` name it.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, scriptDir, topicsDir, writeJsonAtomic } from '../../shared/io';
import type { Mailer } from './mailer';
import type { ReleaseManifest } from '../../shared/types';
import { type Ledger, loadLedger, openOutput, openRequest, requestOf } from '../../modules/publishing';
import type { CliResult } from '../../shared/cli';
import { type Halt, readHalt, runDir, writeHalt } from './journal';
import { storyRunLive } from './lock';
import { sendReleaseRequest } from './requests';

/** How many times a failing publication step (a sync, a verification read, a Short's go-live) is tried before the
 *  story halts for a person. */
export const MAX_TRIES = 3;
/** Under the story's run folder: the tries of each step since its marker (the publish, the schedule, the decision).
 *  The ledger keeps one copy of an identical event, so repeats are counted here. */
export const RETRIES_FILE = 'retries.json';
type Retries = Record<string, { since: string; tries: number }>;
const retriesPath = (dir: string) => join(dir, RETRIES_FILE);
/** The tries of `key` so far since `since` (0 when the marker moved). */
export function triesOf(dir: string, key: string, since: string): number {
  const r = readJson<Retries>(retriesPath(dir))?.[key];
  return r?.since === since ? r.tries : 0;
}
/** Records one more try of `key` since `since`; returns the new count. */
export function countTry(dir: string, key: string, since: string): number {
  const all = readJson<Retries>(retriesPath(dir)) ?? {};
  const tries = triesOf(dir, key, since) + 1;
  all[key] = { since, tries };
  writeJsonAtomic(retriesPath(dir), all);
  return tries;
}

export interface PublishDeps {
  now?: () => number;
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  mail: Mailer | null;
  env?: NodeJS.ProcessEnv;
  /** Every story with a ledger, as [topic, storyId]; the default scans the topics. */
  stories?: () => [string, string][];
  alive?: (pid: number) => boolean; // tests inject; a live run's story is left for the next tick
}

/** Every story with a publish.json, from the topic folders. */
export function storiesWithLedgers(root = ROOT): [string, string][] {
  const out: [string, string][] = [];
  const topics = topicsDir(root);
  if (!existsSync(topics)) return out;
  for (const topic of readdirSync(topics)) {
    const scripts = join(topics, topic, 'scripts');
    if (!existsSync(scripts)) continue;
    for (const slug of readdirSync(scripts)) {
      const ledger = readJson<Ledger>(join(scripts, slug, 'publish.json'));
      const storyId = ledger?.video?.split('/').slice(1).join('/');
      if (storyId) out.push([topic, storyId]);
    }
  }
  return out;
}

export async function publishDue(a: Automation, root = ROOT, d: PublishDeps): Promise<string[]> {
  const now = d.now ?? Date.now;
  const actions: string[] = [];
  const by = a.approvals.approverName || 'automation';
  const readBack = 'automated: tick'; // a sync or a verification is the tick's own act, never the approver's
  const run = async (cli: string, args: string[]) => d.run(cli, args);
  for (const [topic, storyId] of (d.stories ?? (() => storiesWithLedgers(root)))()) {
    // a live run owns the story's ledger: its own publish verbs write it, and nothing locks the file. What is due is
    // read from the ledger each pass and nothing is counted here, so the same step is due on the tick after the run.
    if (storyRunLive(root, topic, storyId, d.alive)) continue;
    const ledger = loadLedger(topic, storyId, root);
    if (!ledger) continue;
    const main = openOutput(topic, storyId, { root });
    const tag = `${topic}/${storyId}`;
    const dir = () => runDir(topic, storyId, root);
    /** A person's halt, written once (the halt mail is keyed by its why); a different halt of the story is replaced. */
    const haltOnce = (why: string, text: string) => {
      if (readHalt(dir())?.why === why) return;
      writeHalt(dir(), {
        kind: 'step-failed',
        stage: 'release',
        why,
        unblock: { kind: 'fix', text },
        at: new Date(now()).toISOString(),
        runId: 'tick',
        board: { stage: 'release', next: 'a person' },
      } satisfies Halt);
    };
    if (main.state.status === 'scheduled') {
      const at = main.out.events.findLast((e) => e.type === 'scheduled')?.publishAt;
      if (at && Date.parse(at) <= now()) {
        // a sync that keeps failing after the time (the API down, the video gone) is tried MAX_TRIES times, then a person's
        if (triesOf(dir(), 'sync', at) >= MAX_TRIES) {
          haltOnce(
            `${main.id}: the sync after its scheduled time ${at} keeps failing (${MAX_TRIES} tries)`,
            `read the video back (npm run publish -- sync ${topic} ${storyId}) and fix what it names`,
          );
          continue;
        }
        const r = await run('publish', ['sync', topic, storyId, '--by', readBack]);
        actions.push(`${tag}: sync (${r.status})`);
        if (r.status !== 0) {
          if (countTry(dir(), 'sync', at) >= MAX_TRIES)
            haltOnce(
              `${main.id}: the sync after its scheduled time ${at} keeps failing (${MAX_TRIES} tries)`,
              `read the video back (npm run publish -- sync ${topic} ${storyId}) and fix what it names`,
            );
        } else if (openOutput(topic, storyId, { root }).state.live)
          await run('publish', ['verify', topic, storyId, '--by', readBack]);
      }
      continue;
    }
    if (main.state.live) {
      // the video decide published, and every live Short, is read back here (the launch needs a verification since
      // the publish); a failing read is tried MAX_TRIES times, then the story halts for a person
      const liveOutputs: [string, string][] = [[main.id, storyId]];
      for (const id of Object.keys(ledger.outputs)) {
        if (!id.startsWith('short:')) continue;
        if (openOutput(topic, storyId, { root, output: id }).state.live)
          liveOutputs.push([id, `${storyId}/shorts/${id.slice('short:'.length)}`]);
      }
      for (const [id, cliStory] of liveOutputs) {
        const o = openOutput(topic, storyId, { root, output: id });
        const published = o.out.events.findLastIndex((e) => e.type === 'published');
        const reads = o.out.events.slice(published).filter((e) => e.type === 'verified');
        if (reads.length && reads.at(-1)!.result !== 'failed') continue;
        const since = o.out.events[published]?.at ?? '';
        const key = `verify|${id}`;
        const done = triesOf(dir(), key, since);
        if (done < MAX_TRIES) {
          const r = await run('publish', ['verify', topic, cliStory, '--by', readBack]);
          actions.push(`${id === main.id ? tag : `${topic}/${cliStory}`}: verify (${r.status})`);
          countTry(dir(), key, since);
        } else
          haltOnce(
            `${id}: the verification keeps failing after ${done} reads since the publish`,
            `compare what YouTube holds with the package (npm run publish -- verify ${topic} ${cliStory}) and fix it`,
          );
      }
      // the Shorts follow their video only under a person's decision on the request (spec 12), by that person
      const decided = main.out.events.findLast(
        (e) => e.type === 'decided' && (e.verdict === 'ok' || e.verdict === 'schedule'),
      );
      const via = `tick:${decided?.request ?? ''}`;
      const actor = decided?.by ?? by;
      for (const id of Object.keys(ledger.outputs)) {
        if (!id.startsWith('short:')) continue;
        const s = openOutput(topic, storyId, { root, output: id });
        const shortStory = `${storyId}/shorts/${id.slice('short:'.length)}`;
        const shortTag = `${topic}/${shortStory}`;
        const goLiveFix = `fix it, then npm run publish -- go-live ${topic} ${shortStory} --by "<name>"`;
        if (s.state.live) {
          // a live Short whose description is behind: pushed once, then read back
          if (s.state.status === 'metadata-behind' && !s.state.failed) {
            const r = await run('publish', ['push', topic, shortStory, '--by', by]);
            actions.push(`${shortTag}: push (${r.status})`);
            if (r.status === 0) await run('publish', ['verify', topic, shortStory, '--by', readBack]);
          }
          continue;
        }
        if (s.state.failed && !s.state.failed.retryable) {
          // a person's: said once, so the halt mail carries it
          haltOnce(`${id}: ${s.state.failed.step} failed: ${s.state.failed.error}`, goLiveFix);
          continue;
        }
        if (!decided) {
          actions.push(`${tag}: ${id} waits: no decided request (a person makes it live)`);
          continue;
        }
        // a retryable failure is retried once per tick, MAX_TRIES times since the decision, then a person's
        const retryKey = `go-live|${id}`;
        const spent = (tries: number) =>
          haltOnce(
            `${id}: go-live keeps failing after ${tries} tries: ${s.state.failed?.error ?? ''}`.trim(),
            goLiveFix,
          );
        if (s.state.failed?.retryable && triesOf(dir(), retryKey, decided.at) >= MAX_TRIES) {
          spent(triesOf(dir(), retryKey, decided.at));
          continue;
        }
        // its description gains the parent's link once the parent is live: pushed before it goes live
        if (s.state.status === 'metadata-behind') {
          const r = await run('publish', ['push', topic, shortStory, '--by', by]);
          actions.push(`${shortTag}: push (${r.status})`);
          if (r.status !== 0) break;
        }
        if (openOutput(topic, storyId, { root, output: id }).state.status === 'approved') {
          const r = await run('publish', ['go-live', topic, shortStory, '--by', actor, '--via', via]);
          actions.push(`${shortTag}: go-live${s.state.failed ? ' retry' : ''} (${r.status})`);
          const after = openOutput(topic, storyId, { root, output: id }).state;
          if (after.failed && !after.failed.retryable)
            haltOnce(`${id}: ${after.failed.step} failed: ${after.failed.error}`, goLiveFix);
          else if (after.failed?.retryable) {
            const tries = countTry(dir(), retryKey, decided.at);
            if (tries >= MAX_TRIES)
              haltOnce(`${id}: go-live keeps failing after ${tries} tries: ${after.failed.error}`, goLiveFix);
          }
          if (r.status === 0 && openOutput(topic, storyId, { root, output: id }).state.live)
            await run('publish', ['verify', topic, shortStory, '--by', readBack]);
          break; // in order, one per tick: the next after this one has been read back
        }
      }
      continue;
    }
    // an open request past its expiry: renewed once, then a person's
    const latest = main.out.events.findLast((e) => e.type === 'approval-requested');
    if (!latest || main.out.events.some((e) => e.type === 'decided' && e.request === latest.request)) continue;
    if (Date.parse(latest.expiresAt!) > now()) continue;
    if ((latest.renewed ?? 0) >= 1) {
      if (readHalt(dir())?.kind !== 'request-expired') {
        const h: Halt = {
          kind: 'request-expired',
          stage: 'release',
          why: `the release request ${latest.request} expired twice without a decision`,
          unblock: {
            kind: 'decide',
            text: `approve each output on the review page, or npm run publish -- request ${topic} ${storyId} --channel email --renew for a fresh request`,
          },
          at: new Date(now()).toISOString(),
          runId: 'tick',
          board: { stage: 'release', next: 'a decision' },
        };
        writeHalt(dir(), h);
      }
      actions.push(`${tag}: request-expired`);
      continue;
    }
    const r = await run('publish', ['request', topic, storyId, '--channel', 'email', '--renew', '--by', by]);
    actions.push(`${tag}: renew request ${latest.request} (${r.status})`);
    if (r.status !== 0 || !d.mail) continue;
    const manifest = readJson<ReleaseManifest>(
      join(scriptDir(topic, storyId, root), 'video', REVIEW_DIR, MANIFEST_FILE),
    );
    const l2 = loadLedger(topic, storyId, root);
    const open = manifest && l2 && openRequest(l2, manifest.releaseSha, new Date(now()));
    if (!open || !requestOf(l2, open.request)) continue;
    await sendReleaseRequest(topic, storyId, manifest, a, d.mail, { root, now, env: d.env, run: d.run });
    actions.push(`${tag}: request ${open.request} mailed`);
  }
  return actions;
}
