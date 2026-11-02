// The terminal and admin view of every run: what runs, what is halted and what unblocks it. Read from the run
// folders only (journals, locks, halts); nothing here decides a stage. Every `run/` folder counts, including one of a
// story whose writer never wrote script.json (a halt at `package`) and a Short's.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, storySlug, topicDir, topicsDir } from '../../shared/io';
import { type Halt, readHalt, readJournal, RUN_DIR } from './journal';
import { readLock } from './lock';
import { alive } from './proc';
import { discoveryHalts, discoveryHaltsDir } from './discovery-state';

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

const dirsIn = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory()) : [];

/** Every story and Short folder under `root` that has a run/ folder: `topics/<t>/scripts/<slug>[/shorts/<slug>]`. */
export function runFolders(root: string): { topic: string; dir: string; storyId: string }[] {
  const out: { topic: string; dir: string; storyId: string }[] = [];
  for (const topic of dirsIn(topicsDir(root))) {
    // a topic run (the research pipeline) keeps its run folder under work/
    const research = join(topicsDir(root), topic, 'work', RUN_DIR);
    if (existsSync(research)) out.push({ topic, dir: join(topicsDir(root), topic, 'work'), storyId: 'research' });
    const scripts = join(topicsDir(root), topic, 'scripts');
    for (const slug of dirsIn(scripts)) {
      const dir = join(scripts, slug);
      const id = idFromDir(dir, slug, topic, root);
      if (existsSync(join(dir, RUN_DIR))) out.push({ topic, dir, storyId: id });
      for (const short of dirsIn(join(dir, 'shorts'))) {
        const sdir = join(dir, 'shorts', short);
        if (existsSync(join(sdir, RUN_DIR))) out.push({ topic, dir: sdir, storyId: `${id}/shorts/${short}` });
      }
    }
  }
  return out;
}

export function statusOf(root = ROOT, isAlive: (pid: number) => boolean = alive): StatusRow[] {
  const rows: StatusRow[] = [];
  for (const d of runFolders(root)) {
    const run = join(d.dir, RUN_DIR);
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
      step: running ? (lock.childStep ?? last?.step ?? null) : null,
      halt: running ? null : halt,
      lastFinish: finishes.at(-1)?.at ?? null,
      costUsd: journal.reduce((s, e) => s + (e.costUsd ?? 0), 0),
    });
  }
  // the discovery job's halts (a proposal whose review never completed, an institution whose agent failed): rows
  // under the pseudo-topic `proposals`, so the halt mail and the digest carry them like a story's
  for (const h of discoveryHalts(root))
    rows.push({
      topic: 'proposals',
      storyId: h.slug,
      dir: discoveryHaltsDir(root),
      state: 'halted',
      since: h.halt.at,
      step: null,
      halt: h.halt,
      lastFinish: null,
      costUsd: 0,
    });
  return rows;
}

/** The story id a folder belongs to: its script.json names it; a folder without one yet (a run between its first
 *  step and the writer's file) is matched to the topic's stories.json by slug, so its row key is the board's from the
 *  first step; a folder no story explains keeps its slug. */
function idFromDir(dir: string, slug: string, topic: string, root: string): string {
  const script = join(dir, 'script.json');
  if (existsSync(script)) {
    try {
      const s = JSON.parse(readFileSync(script, 'utf8')) as { story?: string };
      if (s.story) return s.story;
    } catch {
      /* fall through */
    }
  }
  const stories = readJson<{ stories?: { id: string }[] }>(join(topicDir(topic, root), 'stories.json'));
  return stories?.stories?.find((s) => storySlug(s.id) === slug)?.id ?? slug;
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
