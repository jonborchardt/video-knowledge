// The maintenance record (spec §2 Maintenance, §6; phase 6 Task 1): when a scan is due, and the `scanned` verb that
// appends one scan idempotently.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../../../shared/cli';
import { readJson } from '../../../shared/io';
import type { MaintenanceFile } from '../../../shared/types';
import { appendScan, maintenancePath, scanDue } from '../maintenance';
import { cliRoot } from '../../../../tests/production-helpers';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const now = new Date('2026-12-01T12:00:00Z');

describe('scanDue', () => {
  it('is due when never scanned, and once everyDays have passed', () => {
    expect(scanDue(null, 30, now)).toBe(true);
    expect(scanDue({ lastScan: null, scans: [] }, 30, now)).toBe(true);
    expect(scanDue({ lastScan: '2026-11-15T12:00:00Z', scans: [] }, 30, now)).toBe(false);
    expect(scanDue({ lastScan: '2026-11-01T12:00:00Z', scans: [] }, 30, now)).toBe(true);
    expect(scanDue({ lastScan: '2026-11-01T12:00:01Z', scans: [] }, 30, now)).toBe(false);
  });
});

describe('appendScan', () => {
  it('appends in time order, moves lastScan, and ignores a repeat of the same at', () => {
    const one = appendScan(null, { at: '2026-11-01T00:00:00Z', found: 2, recorded: 3 });
    expect(one).toEqual({
      lastScan: '2026-11-01T00:00:00Z',
      scans: [{ at: '2026-11-01T00:00:00Z', found: 2, recorded: 3 }],
    });
    const two = appendScan(one, { at: '2026-12-01T00:00:00Z', found: 0, recorded: 0 });
    expect(two.lastScan).toBe('2026-12-01T00:00:00Z');
    expect(two.scans).toHaveLength(2);
    expect(appendScan(two, { at: '2026-12-01T00:00:00Z', found: 9, recorded: 9 })).toBe(two);
  });
});

describe('npm run evidence -- scanned', () => {
  it('writes maintenance.json, is idempotent for the same --at, and refuses bad counts', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-maint-'));
    roots.push(root);
    cliRoot(root);
    mkdirSync(join(root, 'topics', 'ev'), { recursive: true });
    const env = { ...process.env, VK_NO_DOTENV: '1' };
    const run = (args: string[]) => runCli('evidence', ['scanned', 'ev', ...args], { cwd: root, env });
    const r = run(['--found', '2', '--recorded', '1', '--at', '2026-12-01T12:00:00.000Z', '--session', 's1']);
    expect(r.status, r.stderr).toBe(0);
    expect(readJson<MaintenanceFile>(maintenancePath('ev', root))).toEqual({
      lastScan: '2026-12-01T12:00:00.000Z',
      scans: [{ at: '2026-12-01T12:00:00.000Z', found: 2, recorded: 1, session: 's1' }],
    });
    const again = run(['--found', '2', '--recorded', '1', '--at', '2026-12-01T12:00:00.000Z']);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/recorded already/);
    expect(readJson<MaintenanceFile>(maintenancePath('ev', root))!.scans).toHaveLength(1);
    expect(run(['--found', 'x', '--recorded', '1']).status).toBe(2);
    expect(runCli('evidence', ['scanned', 'nope', '--found', '0', '--recorded', '0'], { cwd: root, env }).status).toBe(
      2,
    );
    writeFileSync(join(root, 'topics', 'ev', 'x.txt'), '');
  }, 60_000);
});
