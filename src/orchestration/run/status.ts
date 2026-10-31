// The terminal and admin view of every run: what runs, what is halted and what unblocks it. Read from the run
// folders only (journals, locks, halts); nothing here decides a stage.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, scriptDirs, topicsDir } from '../../shared/io';
import { type Halt, readHalt, readJournal, RUN_DIR } from './journal';
import { readLock } from './lock';
import { alive } from './proc';

export interface StatusRow {
  topic: string;
  storyId: string;
  dir: string;
  state: 'running' | 'halted' | 'idle';
  since: string | null;
  step: string | null;
  halt: Halt | null;
  lastFinish: string | null;
  costUsd: number;
}

/** Every story (and Short) folder under `root` with a run/ folder. */
export function statusOf(root = ROOT, isAlive: (pid: number) => boolean = alive): StatusRow[] {
  const rows: StatusRow[] = [];
  const dirs = scriptDirs(root).flatMap((d) => {
    const shorts = join(d.dir, 'shorts');
    const nested = existsSync(shorts)
      ? readdirSync(shorts)
          .map((s) => join(shorts, s))
          .filter((p) => statSync(p).isDirectory())
          .map((p) => ({ topic: d.topic, dir: p, storyId: `${idFromDir(d.dir, root)}/shorts/${relative(shorts, p)}` }))
      : [];
    return [{ topic: d.topic, dir: d.dir, storyId: idFromDir(d.dir, root) }, ...nested];
  });
  for (const d of dirs) {
    const run = join(d.dir, RUN_DIR);
    if (!existsSync(run)) continue;
    const lock = readLock(run);
    const halt = readHalt(run);
    const journal = readJournal(run);
    const last = journal.at(-1);
    const finishes = journal.filter((e) => e.kind === 'finish');
    const running = lock !== null && isAlive(lock.pid);
    rows.push({
      topic: d.topic,
      storyId: d.storyId,
      dir: run,
      state: running ? 'running' : halt ? 'halted' : 'idle',
      since: running ? lock.startedAt : (halt?.at ?? null),
      step: running ? (last?.step ?? null) : null,
      halt: running ? null : halt,
      lastFinish: finishes.at(-1)?.at ?? null,
      costUsd: journal.reduce((s, e) => s + (e.costUsd ?? 0), 0),
    });
  }
  return rows;
}

/** The story id a run folder belongs to: the script.json inside names it; a folder without one keeps its slug. */
function idFromDir(dir: string, root: string): string {
  const script = join(dir, 'script.json');
  if (existsSync(script)) {
    try {
      const s = JSON.parse(readFileSync(script, 'utf8')) as { story?: string };
      if (s.story) return s.story;
    } catch {
      /* fall through */
    }
  }
  return relative(topicsDir(root), dir).replaceAll('\\', '/').split('/').pop() ?? dir;
}

export function renderStatus(rows: StatusRow[]): string {
  if (!rows.length) return 'no runs\n';
  return (
    rows
      .map((r) => {
        const head = `${r.topic} ${r.storyId}: ${r.state}${r.since ? ` since ${r.since}` : ''}${r.step ? ` (${r.step})` : ''}`;
        const h = r.halt ? `\n  HALT ${r.halt.kind}: ${r.halt.why}\n  UNBLOCK: ${r.halt.unblock.text}` : '';
        return `${head}${h}\n  spent ${r.costUsd.toFixed(2)} USD; journal ${r.dir}`;
      })
      .join('\n') + '\n'
  );
}
