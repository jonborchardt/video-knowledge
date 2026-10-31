import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  appendJournal,
  attemptsAt,
  clearHalt,
  type Halt,
  type JournalEntry,
  readHalt,
  readJournal,
  RUN_DIR,
  RUN_HALT_KINDS,
  runDir,
  writeHalt,
} from '../../src/orchestration/run/journal';

const tmp = mkdtempSync(join(tmpdir(), 'vk-journal-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  at: '2026-10-31T00:00:00.000Z',
  runId: 'r1',
  stage: 'script',
  next: 'agent: script.md',
  step: 'agent: script.md',
  kind: 'prompt',
  attempt: 1,
  ...over,
});

describe('journal', () => {
  it('runDir is the run/ folder of the story and is created on demand', () => {
    const d = runDir('heat-pumps', 'decision:a', tmp);
    expect(d).toBe(join(tmp, 'topics', 'heat-pumps', 'scripts', 'decision-a', RUN_DIR));
    appendJournal(d, entry({}));
    expect(readFileSync(join(d, 'journal.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
  it('appends one line per entry and reads them back in order', () => {
    const d = join(tmp, 'j2');
    appendJournal(d, entry({ attempt: 1 }));
    appendJournal(d, entry({ attempt: 2 }));
    expect(readJournal(d).map((e) => e.attempt)).toEqual([1, 2]);
  });
  it('attemptsAt counts entries with that next since the last resume or finish', () => {
    const es = [
      entry({ next: 'x' }),
      entry({ next: 'x' }),
      entry({ kind: 'resume', next: '' }),
      entry({ next: 'x' }),
      entry({ next: 'y' }),
    ];
    expect(attemptsAt(es, 'x')).toBe(1);
    expect(attemptsAt(es, 'y')).toBe(1);
    expect(attemptsAt(es, 'z')).toBe(0);
  });
  it('halts are written, read and cleared; the kinds include unexpected-edit and forbidden-flag', () => {
    const d = join(tmp, 'j3');
    const h: Halt = {
      kind: 'unexpected-edit',
      stage: 'graphics',
      why: 'package.json changed',
      unblock: { kind: 'fix', text: 'read the session' },
      at: '2026-10-31T00:00:00.000Z',
      runId: 'r1',
      board: { stage: 'graphics', next: 'agent: graphics.md' },
    };
    expect(readHalt(d)).toBeNull();
    writeHalt(d, h);
    expect(readHalt(d)).toEqual(h);
    clearHalt(d);
    expect(readHalt(d)).toBeNull();
    expect(RUN_HALT_KINDS).toContain('unexpected-edit');
    expect(RUN_HALT_KINDS).toContain('forbidden-flag');
    expect(RUN_HALT_KINDS).not.toContain('renderer-edited');
  });
});
