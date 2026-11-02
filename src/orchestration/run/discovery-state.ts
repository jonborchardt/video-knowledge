// The discovery job's operational state under .automation/discovery/ (spec §4.2, §5.1): one record per weekly slot
// (what ran, what it cost, the batch and whether its mail went out), the halts a slug or an institution left behind
// (read by the status rows, so the halt mail and the digest carry them), and the proposals' lines for the digest.
// Readers only; the job (discovery.ts) writes. Kept apart from the job so status.ts can read without the cycle.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, writeJsonAtomic } from '../../shared/io';
import { loadProposals } from '../../modules/topic-discovery';
import type { ModelUsage } from './agent';
import type { Halt } from './journal';
import { AUTOMATION_DIR } from './runner';

export const DISCOVERY_DIR = 'discovery';
export const discoveryDir = (root = ROOT) => join(root, AUTOMATION_DIR, DISCOVERY_DIR);
const haltsDir = (root: string) => join(discoveryDir(root), 'halts');

export interface AgentRun {
  session: string | null;
  costUsd: number;
  ok: boolean;
  error?: string;
  /** M3 usage (absent on a record before it: unknown, never zero). The discovery job has no journal, so the record
   *  is its attempt list. */
  modelRequested?: string;
  models?: ModelUsage[];
  turns?: number | null;
  ms?: number;
}
export interface InstitutionRun extends AgentRun {
  proposals: string[]; // the slugs the discovery agent wrote (new files)
  reviews: Record<string, AgentRun>;
  done: boolean; // every review attempted
}
export interface BatchRecord {
  id: string;
  listed: { slug: string; institution: string; question: string }[];
  parked: { slug: string; why: string }[];
  unreviewed: string[];
  invalid: string[];
}
export interface DiscoveryRecord {
  slot: string;
  startedAt: string;
  finishedAt: string | null;
  institutions: Record<string, InstitutionRun>;
  batch: BatchRecord | null;
  emailed: boolean;
  costUsd: number;
  dryRun?: boolean;
}

export const discoveryRecordPath = (root: string, slot: string) => join(discoveryDir(root), `${slot}.json`);
export const readDiscovery = (root: string, slot: string): DiscoveryRecord | null =>
  readJson<DiscoveryRecord>(discoveryRecordPath(root, slot));
export function writeDiscovery(root: string, r: DiscoveryRecord): void {
  mkdirSync(discoveryDir(root), { recursive: true });
  writeJsonAtomic(discoveryRecordPath(root, r.slot), r);
}
/** Every slot's record, oldest first. */
export function discoveryRecords(root = ROOT): DiscoveryRecord[] {
  const dir = discoveryDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .flatMap((n) => readJson<DiscoveryRecord>(join(dir, n)) ?? []);
}

/** A halt the job left for one slug (its review never completed) or one institution (its discovery agent failed). */
export interface DiscoveryHalt {
  slug: string; // the proposal's slug, or `institution:<key>`
  halt: Halt;
}
export const discoveryHaltPath = (root: string, slug: string) =>
  join(haltsDir(root), `${slug.replace(/[^a-z0-9_-]+/gi, '_')}.json`);
export function writeDiscoveryHalt(root: string, slug: string, h: Halt): void {
  mkdirSync(haltsDir(root), { recursive: true });
  writeJsonAtomic(discoveryHaltPath(root, slug), { slug, halt: h } satisfies DiscoveryHalt);
}
export function discoveryHalts(root = ROOT): DiscoveryHalt[] {
  const dir = haltsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .flatMap((n) => readJson<DiscoveryHalt>(join(dir, n)) ?? []);
}
export const discoveryHaltsDir = haltsDir;

/** The digest's proposal lines: what waits on the person (batched, undecided) and what was parked, with the reason. */
export function proposalsDigest(root = ROOT): { pending: string[]; parked: { slug: string; why: string }[] } {
  const all = loadProposals(root);
  return {
    pending: all
      .filter((x) => x.proposal.status === 'proposed' && x.proposal.batch)
      .map(
        (x) => `${x.proposal.slug} (${x.proposal.institution}, batch ${x.proposal.batch!.id}): ${x.proposal.question}`,
      ),
    parked: all
      .filter((x) => x.proposal.status === 'parked')
      .map((x) => ({ slug: x.proposal.slug, why: x.proposal.parkedWhy ?? 'parked' })),
  };
}
