// `npm run publish -- decide` (spec §7.2, §4.5, phase 3): a person's decision on an open release request, applied
// against the exact manifest the request bound. Every step is idempotent and `decided` is written last, so a decide
// interrupted anywhere is completed by the next call and never repeated: a paid link's approval and the re-package
// (the website's and packaging's CLIs as children, since those modules own the files), one `approved` per output of
// the group, the push when the metadata is behind, a sync, then the main output's go-live now or at the time. The
// Shorts are approved here and go live from the tick once the video is published (a derivative follows its parent).
import { join } from 'node:path';
import { isFixtureTopic } from '../../config/site';
import { ROOT, readJson } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import { expired } from '../../shared/request';
import type { ReleaseManifest } from '../../shared/types';
import {
  type ApprovalRequest,
  type Ledger,
  type PublishEvent,
  type ReviewNote,
  type VerbResult,
  appendEvent,
  loadLedger,
  mainOutput,
  openOutput,
  publishPath,
  recordApproved,
  recordChangesRequested,
  requestDecided,
  requestOf,
  saveLedger,
  videoDirOf,
} from './publish';
import { goLive, push, sync } from './uploader';
import type { YouTubeClient } from './youtube';

export type DecideVerdict = 'ok' | 'schedule' | 'changes';
export interface DecideArgs {
  request: string;
  by: string;
  verdict: DecideVerdict;
  at?: string; // ISO, schedule
  notes?: ReviewNote[]; // changes
  paid?: string[]; // the cta ids this reply approves
  via: NonNullable<PublishEvent['via']>;
  root?: string;
  now?: Date;
}

/** Why the decision may not be applied, or null. The CLI prints an existing `decided` for the request and exits 0
 *  before this is asked (idempotent). */
export function decideProblem(
  ledger: Ledger,
  manifest: ReleaseManifest | null,
  req: ApprovalRequest | null,
  a: Pick<DecideArgs, 'request' | 'by' | 'verdict' | 'at' | 'paid'>,
  now: Date,
  scheduleLeadMinutes: number,
  completing = false, // the video is already live or scheduled under this request: a crashed decide finishing
): string | null {
  if (!req) return `unknown request ${a.request}`;
  const main = mainOutput(ledger) ?? 'youtube';
  if (requestDecided(ledger.outputs[main]?.events ?? [], req.request))
    return `request ${req.request} was decided already`;
  if (!completing && expired(req.expiresAt, now))
    return `request ${req.request} expired at ${req.expiresAt}; a new request is needed`;
  if (!manifest) return 'no release manifest on disk; npm run packaging -- manifest rewrites it';
  // a fixture topic's output goes unlisted at most: a schedule (publishAt) would make it public (spec 5.8)
  if (a.verdict === 'schedule' && (manifest.fixtureRun || isFixtureTopic(manifest.topic)))
    return 'a fixture topic is never scheduled (publishAt would make it public): reply OK for unlisted at most';
  if (req.release !== manifest.releaseSha)
    return `the release changed since the request (${req.release} is now ${manifest.releaseSha}): a new request is needed`;
  if (a.by.trim().startsWith('automated:')) return 'a release is decided by a person, never by an automated run';
  if (a.verdict === 'schedule') {
    const t = a.at ? Date.parse(a.at) : NaN;
    if (Number.isNaN(t)) return 'schedule needs --at <ISO>';
    if (t - now.getTime() < scheduleLeadMinutes * 60_000)
      return `--at ${a.at} is under the lead of ${scheduleLeadMinutes} minutes`;
  }
  for (const id of a.paid ?? [])
    if (!manifest.ctas.commercial.some((c) => c.id === id)) return `paid link ${id} is not in the manifest`;
  return null;
}

/** The environment decide hands its children (the website's and packaging's verbs): no publishing, mail, voice or
 *  social secret, and no .env reload (the runner's rule: a child holds only its verb's keys). */
export function childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) if (!/^(YOUTUBE_|APPROVAL_|AZURE_|MAIL_|X_)/.test(k)) out[k] = v;
  out.VK_NO_DOTENV = '1';
  return out;
}

export interface DecideDeps {
  client: YouTubeClient;
  /** Runs `npm run <cli> -- <args>` and waits: the paid-link approval (website) and the re-package (packaging). */
  run: (cli: string, args: string[]) => { status: number | null; stdout: string; stderr: string };
  manifestOf: () => ReleaseManifest | null;
  scheduleLeadMinutes: number;
}

/** Applies the decision, step by idempotent step, `decided` last. A refusal writes nothing; a failure after a step
 *  leaves that step recorded, and the next call completes the rest. */
export async function decide(topic: string, storyId: string, a: DecideArgs, d: DecideDeps): Promise<VerbResult> {
  const root = a.root ?? ROOT;
  const now = a.now ?? new Date();
  const ledger0 = loadLedger(topic, storyId, root);
  if (!ledger0) throw new Refusal('no publish.json: nothing was requested');
  const main = mainOutput(ledger0) ?? 'youtube';
  const existing = ledger0.outputs[main].events.find((e) => e.type === 'decided' && e.request === a.request);
  if (existing)
    return {
      event: existing,
      existing: true,
      message: `already recorded: decided ${a.request} (${existing.verdict}) by ${existing.by}`,
    };
  const req = requestOf(ledger0, a.request);
  // completing: an earlier decide of this request got past its first approval (so YouTube may already hold the
  // effect): the rest is finished even once the request expired, never refused
  const m0 = openOutput(topic, storyId, { root, output: main }).state;
  const begun = ledger0.outputs[main].events.some((e) => e.type === 'approved' && e.via?.request === a.request);
  const problem = decideProblem(
    ledger0,
    d.manifestOf(),
    req,
    a,
    now,
    d.scheduleLeadMinutes,
    begun || m0.live || m0.status === 'scheduled',
  );
  if (problem) throw new Refusal(problem);
  const manifest = d.manifestOf()!;
  const base = { root, now, by: a.by };
  const via = { ...a.via, request: a.request };
  // 1. paid links: the website's verb writes approvedBy; packaging rewrites the description; the release sha stands
  if (a.paid?.length) {
    for (const id of a.paid) {
      const r = d.run('links', ['cta', 'approve', topic, storyId, id, '--by', a.by]);
      if (r.status !== 0) throw new Error(`links -- cta approve ${id} failed: ${(r.stderr || r.stdout).trim()}`);
    }
    const r = d.run('video', ['package', topic, storyId]);
    if (r.status !== 0) throw new Error(`video package failed: ${(r.stderr || r.stdout).trim()}`);
    const after = d.manifestOf();
    if (!after || after.releaseSha !== manifest.releaseSha)
      throw new Error('the re-package moved the release sha; a new request is needed');
  }
  if (a.verdict === 'changes') {
    const notes = a.notes ?? [];
    if (!notes.length) throw new Refusal('changes needs at least one note');
    // a note may name a Short by its output id (`short:<slug>`) as its first word; the rest go to the video
    const byOutput = new Map<string, ReviewNote[]>();
    for (const n of notes) {
      const m = /^(short:[a-z0-9-]+)\s+(.+)$/.exec(n.text);
      const id = m ? m[1] : main;
      byOutput.set(id, [...(byOutput.get(id) ?? []), m ? { ...n, text: m[2] } : n]);
    }
    for (const [output, ns] of byOutput) {
      const o = openOutput(topic, storyId, { root, output });
      recordChangesRequested(topic, storyId, { ...base, output, build: o.build?.sha ?? '', notes: ns, via });
    }
    return recordDecided(topic, storyId, { ...a, root, now, main });
  }
  // 2. one approved per output of the manifest, the checklist asserted by the reply
  for (const id of manifest.sequence) {
    const o = openOutput(topic, storyId, { root, output: id });
    const list = readJson<{ checklist?: string[] }>(join(videoDirOf(o), 'review', 'review.json'))?.checklist ?? [];
    recordApproved(topic, storyId, {
      ...base,
      output: id,
      checked: list.length,
      via: { ...via, checklist: 'asserted-by-email' },
    });
  }
  // 3. the main output's metadata, when behind (a paid link just changed the description)
  const m = openOutput(topic, storyId, { root, output: main });
  if (m.state.status === 'metadata-behind') await push(topic, storyId, { ...base, output: main, client: d.client });
  // 4. read back (a go-live that died after YouTube's update is found public here), then go live now or at the time:
  // the video only; the Shorts follow from the tick
  const s = await sync(topic, storyId, { ...base, output: main, client: d.client });
  if ('event' in s && s.event?.type === 'failed') throw new Error(`sync: ${s.message}`);
  const afterSync = openOutput(topic, storyId, { root, output: main });
  if (!afterSync.state.live && afterSync.state.status !== 'scheduled') {
    const r = await goLive(topic, storyId, {
      ...base,
      output: main,
      client: d.client,
      via,
      ...(a.verdict === 'schedule' && { at: a.at }),
    });
    if (r.event?.type === 'failed') throw new Error(`go-live: ${r.message}`);
  }
  return recordDecided(topic, storyId, { ...a, root, now, main });
}

function recordDecided(
  topic: string,
  storyId: string,
  a: DecideArgs & { root: string; now: Date; main: string },
): VerbResult {
  const ledger = loadLedger(topic, storyId, a.root)!;
  const e: PublishEvent = {
    at: a.now.toISOString(),
    type: 'decided',
    by: a.by,
    request: a.request,
    verdict: a.verdict,
    via: { ...a.via, request: a.request },
    ...(a.paid?.length && { paid: a.paid }),
    ...(a.at && a.verdict === 'schedule' && { publishAt: a.at }),
  };
  const r = appendEvent(ledger, a.main, e);
  if (r.existing) return { event: r.existing, existing: true, message: `already recorded: decided ${a.request}` };
  saveLedger(publishPath(topic, storyId, a.root), r.ledger);
  return { event: e, existing: false, message: `recorded decided ${a.request} (${a.verdict}) by ${a.by}` };
}
