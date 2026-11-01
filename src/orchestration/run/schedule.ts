// `.automation/schedule.json` (spec §4.2): what the tick decided is due and what the work plane started this week.
// Operational state, never a workflow stage. The local-time helpers answer "has the configured weekday and hour passed
// this week?" in the configured timezone, for the digest, the production pick and the discovery batch.
import { join } from 'node:path';
import { ROOT, readJson, writeJsonAtomic } from '../../shared/io';
import { automationDir } from './notify';
import { isoWeek as weekOf } from './runner';

export const SCHEDULE_FILE = 'schedule.json';

export interface DueResume {
  topic: string;
  storyId: string;
  why: 'backoff' | 'moved' | 'week-rolled';
  at: string;
}
export interface PickRecord {
  topic: string;
  storyId: string;
  institution: string;
  at: string;
}
export interface ScheduleState {
  week?: string; // the ISO week the picks belong to
  picks?: PickRecord[];
  due?: DueResume[];
  digest?: { lastSlot: string };
  discovery?: { lastSlot: string };
  maintenance?: Record<string, string>; // topic -> last scan ISO date
  lastTick?: string;
  lastWork?: { kind: string; outcome: string; at: string };
}

export const readSchedule = (root = ROOT): ScheduleState =>
  readJson<ScheduleState>(join(automationDir(root), SCHEDULE_FILE)) ?? {};
export const writeSchedule = (root: string, s: ScheduleState): void =>
  writeJsonAtomic(join(automationDir(root), SCHEDULE_FILE), s);
export const updateSchedule = (root: string, f: (s: ScheduleState) => ScheduleState): ScheduleState => {
  const next = f(readSchedule(root));
  writeSchedule(root, next);
  return next;
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The local date, weekday index and hour of an instant in a timezone. */
export function localParts(ms: number, timeZone: string): { date: string; weekday: number; hour: number } {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
    hour: Number(p.hour) % 24,
  };
}

/** The most recent occurrence of `weekday` at `hour` (local to `timeZone`) at or before `ms`, as that day's local
 *  date: the slot id a once-per-slot action records. */
export function lastSlot(ms: number, weekday: string, hour: number, timeZone: string): string {
  const want = WEEKDAYS.indexOf(weekday.toLowerCase());
  const day = 24 * 60 * 60 * 1000;
  for (let back = 0; back < 8; back++) {
    const p = localParts(ms - back * day, timeZone);
    if (p.weekday !== want) continue;
    if (back === 0 && p.hour < hour) continue; // today, but the hour has not come
    return p.date;
  }
  return localParts(ms - 7 * day, timeZone).date;
}

/** ISO week `YYYY-Www` of an instant (UTC), the key of the weekly budget and the weekly picks (the runner's). */
export const isoWeek = (ms: number): string => weekOf(new Date(ms));
