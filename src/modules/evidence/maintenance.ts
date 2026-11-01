// A topic's maintenance record (spec §2 Maintenance, §6; phase 6 Task 1): when it was last scanned for new sources
// and what each scan found and recorded. Written only by `npm run evidence -- scanned` (the maintenance job's last
// step); read by the work plane to pick the topic whose scan is oldest. Pure here; the CLI writes.
import { join } from 'node:path';
import { ROOT, readJson, topicDir } from '../../shared/io';
import type { MaintenanceFile, MaintenanceScan } from '../../shared/types';

export const MAINTENANCE_FILE = 'maintenance.json';
export const maintenancePath = (topic: string, root = ROOT) => join(topicDir(topic, root), MAINTENANCE_FILE);
export const loadMaintenance = (topic: string, root = ROOT): MaintenanceFile | null =>
  readJson<MaintenanceFile>(maintenancePath(topic, root));

/** Due when never scanned, or `everyDays` or more since the last scan. */
export function scanDue(file: MaintenanceFile | null, everyDays: number, now: Date): boolean {
  if (!file?.lastScan) return true;
  return now.getTime() - Date.parse(file.lastScan) >= everyDays * 24 * 60 * 60 * 1000;
}

/** The record with one more scan; the same `at` twice is one scan (a re-run after a crash). */
export function appendScan(file: MaintenanceFile | null, scan: MaintenanceScan): MaintenanceFile {
  const scans = file?.scans ?? [];
  if (scans.some((s) => s.at === scan.at)) return file!;
  const next = [...scans, scan].sort((x, y) => x.at.localeCompare(y.at));
  return { lastScan: next.at(-1)!.at, scans: next };
}
