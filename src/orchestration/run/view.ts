// The admin Automation tab's model (read-only, from .automation/ and the journals): the last tick and work job, this
// week's picks, what is due, the unsent mail, the preflight halt, the week's spend.
import { join } from 'node:path';
import { ROOT, readJson } from '../../shared/io';
import { weekSpend } from './runner';
import type { Halt } from './journal';
import { type OutboxEntry, automationDir, unsentOutbox } from './notify';
import { type DueResume, type PickRecord, isoWeek, readSchedule } from './schedule';
import { statusOf } from './status';
import { PREFLIGHT_HALT } from './tick';

export interface AutomationView {
  lastTick: string | null;
  lastWork: { kind: string; outcome: string; at: string } | null;
  week: string;
  picks: PickRecord[];
  due: DueResume[];
  unsent: OutboxEntry[];
  preflight: Halt | null;
  spendUsd: number;
}

export function automationView(root = ROOT, now = Date.now()): AutomationView {
  const s = readSchedule(root);
  const week = isoWeek(now);
  return {
    lastTick: s.lastTick ?? null,
    lastWork: s.lastWork ?? null,
    week,
    picks: s.week === week ? (s.picks ?? []) : [],
    due: s.due ?? [],
    unsent: unsentOutbox(root),
    preflight: readJson<Halt>(join(automationDir(root), PREFLIGHT_HALT)),
    spendUsd: weekSpend(root, week) || statusOf(root).reduce((n, r) => n + r.costUsd, 0),
  };
}
