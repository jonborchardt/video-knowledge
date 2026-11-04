// The readiness record (M3 2.5; spec D3: three states everywhere a capability is described). An integration is
// **Implemented** when its code exists and its tests pass (a fact stated here, in code), **Verified** when a person
// exercised it against the real service and recorded the evidence through `npm run run -- verified`, **Enabled**
// when automation.json configures it to run unattended. `readiness.json` (tracked, beside automation.json) holds
// verification only: `{ <integration>: { at, by, evidence } }`, written by `verify` and nothing else. `enabled` is
// never stored: it is read from the configuration at render time. A passing suite never writes a verification, and a
// verification never changes a flag: evidence is one act, enabling another. The evidence is bound to the integration:
// each one names the kind of record (and the event) that proves it, and the verb refuses any other.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { approverProblem } from '../../shared/approver';
import { ROOT, readJson, writeJsonAtomic } from '../../shared/io';
import { loadLedger } from '../../modules/publishing';
import { loadMaintenance } from '../../modules/evidence';
import { loadSocial } from '../../modules/social';
import { RUN_DIR, readJournal } from './journal';
import { filterCorOutbox } from '../../modules/mail';
import { readInbox } from './inbox';
import { launches } from './launch';
import { discoveryRecords } from './discovery-state';
import { readSchedule } from './schedule';
import { readShadow } from './release';
import { runFolders } from './status';

export const READINESS_FILE = 'readiness.json';

/** What proves an integration: the kind of record a verification must name, and for a ledger event its types. */
export type EvidenceKind =
  | 'ledger' // ledger:<topic>/<story>#<event>, one of `events`, by a person where `person` is set
  | 'outbox' // a <Message-ID> the outbox holds, sent
  | 'inbox' // a <Message-ID> the inbox handled and applied (a request id prefix where `request` is set)
  | 'scan' // scan:<topic>, a maintenance scan recorded
  | 'shadow' // shadow:<topic>/<story>, a shadow record with both verdicts
  | 'launch' // launch:<topic>/<story>, live
  | 'social' // social:<topic>/<story>, a posted record with an id
  | 'tick' // tick:<ISO>, a recorded tick
  | 'topic-run' // run:<run id>, a topic run's journal that finished
  | 'discovery'; // discovery:<slot>, a discovery record
export interface Evidence {
  kind: EvidenceKind;
  events?: string[];
  /** The ledger event must carry a person's decision arrived by this channel (never an automated void or expiry). */
  via?: 'email';
  /** The inbox record's request id prefix (`rq-` a release, `ar-` an article correction, `pb-` a batch). */
  request?: string;
  /** The form a person types, for the usage line and the runbook. */
  form: string;
}
export interface Integration {
  key: string;
  name: string;
  /** Exists in code with passing tests (true today for every integration but the scheduled tasks, which are the
   *  person's own Task Scheduler or cron entries). */
  implemented: boolean;
  /** The automation.json key its enabled state is read from; null when no flag governs it (a person's act). */
  enabledBy: string | null;
  evidence: Evidence;
}

export const INTEGRATIONS: readonly Integration[] = [
  {
    key: 'youtube-upload',
    name: 'YouTube upload (private)',
    implemented: true,
    enabledBy: 'enabled.work',
    evidence: { kind: 'ledger', events: ['uploaded'], form: 'ledger:<topic>/<story>#uploaded' },
  },
  {
    key: 'youtube-go-live',
    name: 'YouTube go-live or schedule',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: { kind: 'ledger', events: ['published', 'scheduled'], form: 'ledger:<topic>/<story>#published' },
  },
  {
    key: 'approval-mail-send',
    name: 'Approval mail sent (outbox)',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: { kind: 'outbox', form: 'a <Message-ID> the outbox sent' },
  },
  {
    key: 'approval-mail-receive',
    name: 'Approval mail received (inbox)',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: { kind: 'inbox', form: 'a <Message-ID> the inbox handled' },
  },
  {
    key: 'decide-by-reply',
    name: 'Release decision by reply',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: { kind: 'ledger', events: ['decided'], via: 'email', form: 'ledger:<topic>/<story>#decided (a reply)' },
  },
  {
    key: 'correction-by-reply',
    name: 'Article correction by reply',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: { kind: 'inbox', request: 'ar-', form: 'a <Message-ID> the inbox applied to an ar- request' },
  },
  {
    key: 'maintenance-scan',
    name: 'Maintenance scan',
    implemented: true,
    enabledBy: 'enabled.maintenance',
    evidence: { kind: 'scan', form: 'scan:<topic>' },
  },
  {
    key: 'agent-draft-review-shadow',
    name: 'Agent draft review (shadow)',
    implemented: true,
    enabledBy: 'review.draft',
    evidence: { kind: 'shadow', form: 'shadow:<topic>/<story>' },
  },
  {
    key: 'cloudflare-deploy-probe',
    name: 'Cloudflare deploy probe',
    implemented: true,
    enabledBy: 'enabled.work',
    evidence: { kind: 'launch', form: 'launch:<topic>/<story>' },
  },
  {
    key: 'x-post',
    name: 'X post',
    implemented: true,
    enabledBy: 'enabled.social',
    evidence: { kind: 'social', form: 'social:<topic>/<story>' },
  },
  {
    key: 'scheduled-tasks',
    name: 'Scheduled tasks (the tick and the work plane)',
    implemented: false,
    enabledBy: null,
    evidence: { kind: 'tick', form: 'tick:<ISO of a recorded tick>' },
  },
  {
    key: 'research-pipeline',
    name: 'Research pipeline',
    implemented: true,
    enabledBy: 'enabled.research',
    evidence: { kind: 'topic-run', form: 'run:<run id of a finished topic run>' },
  },
  {
    key: 'discovery',
    name: 'Topic discovery',
    implemented: true,
    enabledBy: 'enabled.discovery',
    evidence: { kind: 'discovery', form: 'discovery:<slot>' },
  },
];

export interface Verification {
  at: string;
  by: string;
  evidence: string;
}
export type Readiness = Record<string, Verification>;

export const readinessPath = (root = ROOT) => join(root, READINESS_FILE);
export const loadReadiness = (root = ROOT): Readiness => readJson<Readiness>(readinessPath(root)) ?? {};

/** What is wrong with a readiness file (validated at build through its test); [] when nothing. */
export function readinessProblems(x: unknown): string[] {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return ['readiness.json: expected an object'];
  const out: string[] = [];
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (!INTEGRATIONS.some((i) => i.key === k)) out.push(`${k}: unknown integration`);
    if (v === null || typeof v !== 'object') {
      out.push(`${k}: expected { at, by, evidence }`);
      continue;
    }
    const r = v as Record<string, unknown>;
    for (const f of ['at', 'by', 'evidence']) if (typeof r[f] !== 'string' || !r[f]) out.push(`${k}.${f}: missing`);
    if (typeof r.by === 'string' && /^automated:/i.test(r.by.trim()))
      out.push(`${k}.by: a person verifies, never an automated actor`);
  }
  return out;
}

/** Reads a flag by its dotted key: `enabled.social` is a boolean; `review.draft` is enabled when not `person`. */
function enabledOf(a: Automation, key: string | null): boolean | null {
  if (!key) return null;
  if (key === 'review.draft') return a.review.draft !== 'person';
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], a);
  return typeof v === 'boolean' ? v : null;
}

export interface ReadinessRow extends Integration {
  enabled: boolean | null;
  verified: Verification | null;
}
/** The integration table: implemented (code), verified (readiness.json), enabled (automation.json), per integration. */
export function readinessView(root = ROOT, a: Automation): ReadinessRow[] {
  const r = loadReadiness(root);
  return INTEGRATIONS.map((i) => ({ ...i, enabled: enabledOf(a, i.enabledBy), verified: r[i.key] ?? null }));
}

const story = (s: string): [string, string] | null => {
  const i = s.indexOf('/');
  return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : null;
};
const MESSAGE_ID = /^<[^<>\s]+@[^<>\s]+>$/;

/** Whether `ref` names a record that proves `i`: the right kind, and the record exists. `null` when the reference
 *  has no checkable form at all. */
export function evidenceProves(root: string, i: Integration, ref: string): boolean | null {
  const e = i.evidence;
  if (MESSAGE_ID.test(ref)) {
    if (e.kind === 'outbox') return filterCorOutbox((x) => x.messageId === ref && x.sentAt !== null, root).length > 0;
    if (e.kind === 'inbox')
      return readInbox(root).handled.some(
        (h) =>
          h.messageId === ref &&
          h.outcome.startsWith('applied') &&
          (!e.request || (h.request ?? '').startsWith(e.request)),
      );
    return false;
  }
  const m = /^(\w[\w-]*):(.*)$/.exec(ref);
  if (!m) return null;
  const [, kind, rest] = m;
  const known = ['ledger', 'scan', 'shadow', 'launch', 'social', 'tick', 'run', 'discovery', 'journal'];
  if (!known.includes(kind)) return null;
  switch (e.kind) {
    case 'ledger': {
      if (kind !== 'ledger') return false;
      const [path, type] = rest.split('#');
      const ts = story(path);
      if (!ts || !type || !e.events?.includes(type)) return false;
      const ledger = loadLedger(ts[0], ts[1], root);
      return (
        !!ledger &&
        Object.values(ledger.outputs).some((o) =>
          o.events.some(
            (ev) =>
              ev.type === type &&
              (!e.via || (ev.via?.channel === e.via && !/^automated:|^automation$|^tick/.test(ev.by))),
          ),
        )
      );
    }
    case 'scan': {
      if (kind !== 'scan') return false;
      const f = loadMaintenance(rest, root);
      return !!f && f.scans.length > 0;
    }
    case 'shadow': {
      if (kind !== 'shadow') return false;
      return readShadow(root).some((s) => s.story === rest && s.person !== null);
    }
    case 'launch': {
      if (kind !== 'launch') return false;
      const ts = story(rest);
      return !!ts && launches(root).some((l) => l.topic === ts[0] && l.storyId === ts[1] && l.liveAt !== null);
    }
    case 'social': {
      if (kind !== 'social') return false;
      const ts = story(rest);
      const f = ts && loadSocial(ts[0], ts[1], root);
      return !!f && Object.values(f.outputs).some((o) => o.posts.some((p) => p.status === 'posted' && p.id));
    }
    case 'tick': {
      if (kind !== 'tick') return false;
      const s = readSchedule(root);
      return s.lastTick === rest || s.lastWork?.at === rest;
    }
    case 'topic-run': {
      if (kind !== 'run') return false;
      return runFolders(root).some((f) => {
        if (f.storyId !== 'research') return false;
        const j = readJournal(join(f.dir, RUN_DIR));
        return j.some((x) => x.runId === rest) && j.some((x) => x.runId === rest && x.kind === 'finish');
      });
    }
    case 'discovery':
      return kind === 'discovery' && discoveryRecords(root).some((d) => d.slot === rest);
    default:
      return false;
  }
}

/** Records a person's verification of one integration, bound to evidence that proves it. The same evidence again is a
 *  no-op (the first verification stands); every refusal throws and writes nothing. Never touches automation.json. */
export function verify(
  root: string,
  integration: string,
  o: { by: string; evidence: string; now?: Date },
): { changed: boolean; record: Verification } {
  const i = INTEGRATIONS.find((x) => x.key === integration);
  if (!i) throw new Error(`unknown integration ${integration}; one of: ${INTEGRATIONS.map((x) => x.key).join(', ')}`);
  if (/^automated:/i.test(o.by.trim())) throw new Error('a person verifies an integration, never an automated actor');
  if (approverProblem(o.by)) throw new Error('--by needs a real name (no placeholder)');
  const ev = o.evidence.trim();
  if (!ev) throw new Error('--evidence must name a record');
  const proves = evidenceProves(root, i, ev);
  if (proves === null)
    throw new Error(
      `--evidence must name a record: ${INTEGRATIONS.map((x) => `${x.key}: ${x.evidence.form}`).join('; ')}`,
    );
  if (!proves) throw new Error(`no such record, or it does not prove ${i.key}: ${ev} (expected ${i.evidence.form})`);
  const all = loadReadiness(root);
  const prev = all[integration];
  if (prev && prev.evidence === ev) return { changed: false, record: prev };
  const record: Verification = { at: (o.now ?? new Date()).toISOString(), by: o.by.trim(), evidence: ev };
  all[integration] = record;
  if (!existsSync(root)) throw new Error(`no such root ${root}`);
  writeJsonAtomic(readinessPath(root), all);
  return { changed: true, record };
}
