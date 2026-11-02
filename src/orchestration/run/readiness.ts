// The readiness record (M3 2.5; spec D3: three states everywhere a capability is described). An integration is
// **Implemented** when its code exists and its tests pass (a fact stated here, in code), **Verified** when a person
// exercised it against the real service and recorded the evidence through `npm run run -- verified`, **Enabled**
// when automation.json configures it to run unattended. `readiness.json` (tracked, beside automation.json) holds
// verification only: `{ <integration>: { at, by, evidence } }`, written by `verify` and nothing else. `enabled` is
// never stored: it is read from the configuration at render time. A passing suite never writes a verification, and a
// verification never changes a flag: evidence is one act, enabling another.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Automation } from '../../shared/automation';
import { approverProblem } from '../../shared/approver';
import { ROOT, readJson, writeJsonAtomic } from '../../shared/io';
import { loadLedger } from '../../modules/publishing';
import { loadMaintenance } from '../../modules/evidence';
import { loadSocial } from '../../modules/social';
import { readJournal, runDir, topicRunDir } from './journal';
import { readOutbox } from './notify';
import { readInbox } from './inbox';
import { launches } from './launch';
import { discoveryRecords } from './discovery-state';
import { readSchedule } from './schedule';
import { runFolders } from './status';
import { RUN_DIR } from './journal';

export const READINESS_FILE = 'readiness.json';

export interface Integration {
  key: string;
  name: string;
  /** Exists in code with passing tests (true today for every integration but the scheduled tasks, which are the
   *  person's own Task Scheduler or cron entries). */
  implemented: boolean;
  /** The automation.json key its enabled state is read from; null when no flag governs it (a person's act). */
  enabledBy: string | null;
  /** What a verification should name as evidence. */
  evidence: string;
}

export const INTEGRATIONS: readonly Integration[] = [
  {
    key: 'youtube-upload',
    name: 'YouTube upload (private)',
    implemented: true,
    enabledBy: 'enabled.work',
    evidence: 'ledger:<topic>/<story>#uploaded',
  },
  {
    key: 'youtube-go-live',
    name: 'YouTube go-live or schedule',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: 'ledger:<topic>/<story>#published',
  },
  {
    key: 'approval-mail-send',
    name: 'Approval mail sent (outbox)',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: '<Message-ID> the outbox holds',
  },
  {
    key: 'approval-mail-receive',
    name: 'Approval mail received (inbox)',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: '<Message-ID> the inbox handled',
  },
  {
    key: 'decide-by-reply',
    name: 'Release decision by reply',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: 'ledger:<topic>/<story>#decided',
  },
  {
    key: 'correction-by-reply',
    name: 'Article correction by reply',
    implemented: true,
    enabledBy: 'enabled.tick',
    evidence: '<Message-ID> the inbox handled',
  },
  {
    key: 'maintenance-scan',
    name: 'Maintenance scan',
    implemented: true,
    enabledBy: 'enabled.maintenance',
    evidence: 'scan:<topic>',
  },
  {
    key: 'agent-draft-review-shadow',
    name: 'Agent draft review (shadow)',
    implemented: true,
    enabledBy: 'review.draft',
    evidence: 'run:<run id>',
  },
  {
    key: 'cloudflare-deploy-probe',
    name: 'Cloudflare deploy probe',
    implemented: true,
    enabledBy: 'enabled.work',
    evidence: 'launch:<topic>/<story>',
  },
  { key: 'x-post', name: 'X post', implemented: true, enabledBy: 'enabled.social', evidence: 'social:<topic>/<story>' },
  {
    key: 'scheduled-tasks',
    name: 'Scheduled tasks (the tick and the work plane)',
    implemented: false,
    enabledBy: null,
    evidence: 'tick:<ISO of a recorded tick>',
  },
  {
    key: 'research-pipeline',
    name: 'Research pipeline',
    implemented: true,
    enabledBy: 'enabled.research',
    evidence: 'run:<run id>',
  },
  {
    key: 'discovery',
    name: 'Topic discovery',
    implemented: true,
    enabledBy: 'enabled.discovery',
    evidence: 'discovery:<slot>',
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

/** Whether the evidence names a record that exists under `root`; null when the reference has no checkable form. */
export function evidenceExists(root: string, ref: string): boolean | null {
  const m = /^(\w+):(.*)$/.exec(ref);
  if (/^<[^<>\s]+@[^<>\s]+>$/.test(ref)) {
    return (
      readOutbox(root).some((e) => e.messageId === ref) || readInbox(root).handled.some((h) => h.messageId === ref)
    );
  }
  if (!m) return null;
  const [, kind, rest] = m;
  const story = (s: string): [string, string] | null => {
    const i = s.indexOf('/');
    return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : null;
  };
  switch (kind) {
    case 'ledger': {
      const [path, type] = rest.split('#');
      const ts = story(path);
      if (!ts || !type) return false;
      const ledger = loadLedger(ts[0], ts[1], root);
      return !!ledger && Object.values(ledger.outputs).some((o) => o.events.some((e) => e.type === type));
    }
    case 'journal': {
      const [path, line] = rest.split('#');
      const ts = story(path);
      if (!ts) return false;
      const dir = ts[1] === 'research' ? topicRunDir(ts[0], root) : runDir(ts[0], ts[1], root);
      const entries = readJournal(dir);
      return line ? Number(line) >= 1 && Number(line) <= entries.length : entries.length > 0;
    }
    case 'run':
      return (
        runFolders(root).some((f) => readJournal(join(f.dir, RUN_DIR)).some((e) => e.runId === rest)) ||
        discoveryRecords(root).some((d) => d.slot === rest)
      );
    case 'launch': {
      const ts = story(rest);
      return !!ts && launches(root).some((l) => l.topic === ts[0] && l.storyId === ts[1] && l.liveAt !== null);
    }
    case 'scan': {
      const m2 = loadMaintenance(rest, root);
      return !!m2 && m2.scans.length > 0;
    }
    case 'social': {
      const ts = story(rest);
      const f = ts && loadSocial(ts[0], ts[1], root);
      return !!f && Object.values(f.outputs).some((o) => o.posts.some((p) => p.status === 'posted' && p.id));
    }
    case 'discovery':
      return discoveryRecords(root).some((d) => d.slot === rest);
    case 'tick': {
      const s = readSchedule(root);
      return s.lastTick === rest || s.lastWork?.at === rest;
    }
    default:
      return null;
  }
}

/** Records a person's verification of one integration, bound to evidence that exists. The same evidence again is a
 *  no-op (the first verification stands); every refusal throws and writes nothing. Never touches automation.json. */
export function verify(
  root: string,
  integration: string,
  o: { by: string; evidence: string; now?: Date },
): { changed: boolean; record: Verification } {
  if (!INTEGRATIONS.some((i) => i.key === integration))
    throw new Error(`unknown integration ${integration}; one of: ${INTEGRATIONS.map((i) => i.key).join(', ')}`);
  if (/^automated:/i.test(o.by.trim())) throw new Error('a person verifies an integration, never an automated actor');
  if (approverProblem(o.by)) throw new Error('--by needs a real name (no placeholder)');
  const ev = o.evidence.trim();
  if (!ev) throw new Error('--evidence must name a record');
  const exists = evidenceExists(root, ev);
  if (exists === null)
    throw new Error(
      `--evidence must name a record: ledger:<topic>/<story>#<event>, journal:<topic>/<story>#<line>, run:<run id>, launch:<topic>/<story>, scan:<topic>, social:<topic>/<story>, discovery:<slot>, tick:<ISO>, or a <Message-ID> the outbox or inbox holds`,
    );
  if (!exists) throw new Error(`no such record: ${ev}`);
  const all = loadReadiness(root);
  const prev = all[integration];
  if (prev && prev.evidence === ev) return { changed: false, record: prev };
  const record: Verification = { at: (o.now ?? new Date()).toISOString(), by: o.by.trim(), evidence: ev };
  all[integration] = record;
  if (!existsSync(root)) throw new Error(`no such root ${root}`);
  writeJsonAtomic(readinessPath(root), all);
  return { changed: true, record };
}
