// The tick's due-publication step (spec §4.4 step 4, phase 3): for every ledger, what is due now. A schedule past its
// time is synced (YouTube made it public: `published`, observed) and verified. The Shorts of a published video go
// live in ledger order, one per tick, with the tick's `via` naming the request the person decided; a retryable
// failure is retried next tick, and the video is never touched again. A live Short whose description is behind
// (its parent's link) is pushed. An open request past its expiry is renewed once, with a new mail through the
// outbox; a second expiry is a person's (`request-expired`). Every effect is a publishing verb as a child.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { MANIFEST_FILE, REVIEW_DIR, ROOT, readJson, scriptDir, topicsDir } from '../../shared/io';
import type { MailTransport } from '../../shared/mail';
import type { ReleaseManifest } from '../../shared/types';
import { type Ledger, loadLedger, openOutput, openRequest, requestOf } from '../../modules/publishing';
import type { CliResult } from '../../shared/cli';
import { type Halt, readHalt, runDir, writeHalt } from './journal';
import { sendReleaseRequest } from './requests';

export interface PublishDeps {
  now?: () => number;
  run: (cli: string, args: string[]) => Promise<CliResult> | CliResult;
  mail: MailTransport | null;
  env?: NodeJS.ProcessEnv;
  /** Every story with a ledger, as [topic, storyId]; the default scans the topics. */
  stories?: () => [string, string][];
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
  const run = async (cli: string, args: string[]) => d.run(cli, args);
  for (const [topic, storyId] of (d.stories ?? (() => storiesWithLedgers(root)))()) {
    const ledger = loadLedger(topic, storyId, root);
    if (!ledger) continue;
    const main = openOutput(topic, storyId, { root });
    const tag = `${topic}/${storyId}`;
    if (main.state.status === 'scheduled') {
      const at = main.out.events.findLast((e) => e.type === 'scheduled')?.publishAt;
      if (at && Date.parse(at) <= now()) {
        const r = await run('publish', ['sync', topic, storyId, '--by', by]);
        actions.push(`${tag}: sync (${r.status})`);
        if (r.status === 0 && openOutput(topic, storyId, { root }).state.live)
          await run('publish', ['verify', topic, storyId, '--by', by]);
      }
      continue;
    }
    if (main.state.live) {
      // a video that decide published is read back once here (the launch needs it verified since)
      const published = main.out.events.findLastIndex((e) => e.type === 'published');
      if (!main.out.events.slice(published).some((e) => e.type === 'verified')) {
        const r = await run('publish', ['verify', topic, storyId, '--by', by]);
        actions.push(`${tag}: verify (${r.status})`);
      }
      const req = main.out.events.findLast((e) => e.type === 'approval-requested')?.request;
      const via = `tick:${req ?? ''}`;
      for (const id of Object.keys(ledger.outputs)) {
        if (!id.startsWith('short:')) continue;
        const s = openOutput(topic, storyId, { root, output: id });
        const shortStory = `${storyId}/shorts/${id.slice('short:'.length)}`;
        const shortTag = `${topic}/${shortStory}`;
        if (s.state.live) {
          // a live Short whose description is behind: pushed once, then read back
          if (s.state.status === 'metadata-behind' && !s.state.failed) {
            const r = await run('publish', ['push', topic, shortStory, '--by', by]);
            actions.push(`${shortTag}: push (${r.status})`);
            if (r.status === 0) await run('publish', ['verify', topic, shortStory, '--by', by]);
          }
          continue;
        }
        if (s.state.failed && !s.state.failed.retryable) continue; // a person's
        // its description gains the parent's link once the parent is live: pushed before it goes live
        if (s.state.status === 'metadata-behind') {
          const r = await run('publish', ['push', topic, shortStory, '--by', by]);
          actions.push(`${shortTag}: push (${r.status})`);
          if (r.status !== 0) break;
        }
        if (openOutput(topic, storyId, { root, output: id }).state.status === 'approved') {
          const r = await run('publish', ['go-live', topic, shortStory, '--by', by, '--via', via]);
          actions.push(`${shortTag}: go-live${s.state.failed ? ' retry' : ''} (${r.status})`);
          if (r.status === 0 && openOutput(topic, storyId, { root, output: id }).state.live)
            await run('publish', ['verify', topic, shortStory, '--by', by]);
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
      const dir = runDir(topic, storyId, root);
      if (readHalt(dir)?.kind !== 'request-expired') {
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
        writeHalt(dir, h);
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
