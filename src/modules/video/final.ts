// `npm run video -- final` asks the board whether a story may be rebuilt for release through the board's own CLI
// (`npm run board -- next --json`), never by importing the orchestrator.
import { spawnSync } from 'node:child_process';

/** The part of the board's answer `final` reads. */
export interface BoardAnswer {
  stage: string;
  next: string;
  halt: { kind: string } | null;
}
export type Ask = (topic: string, storyId: string, root: string) => BoardAnswer;

/** The board's answer for one story, from `npm run -s board -- next <topic> <story> --json` run in `root`. A non-zero
 *  exit or output that is not JSON throws `final could not ask the board: <stderr>`. */
export function boardViaCli(topic: string, storyId: string, root: string, spawn = spawnSync): BoardAnswer {
  const r = spawn('npm', ['run', '-s', 'board', '--', 'next', topic, storyId, '--json'], {
    shell: process.platform === 'win32',
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fail = () => new Error(`final could not ask the board: ${String(r.stderr ?? r.error ?? '').trim()}`);
  if (r.status !== 0) throw fail();
  try {
    return JSON.parse(String(r.stdout)) as BoardAnswer;
  } catch {
    throw fail();
  }
}

/** Why `final` refuses this story, or null when the board says it is packaged (and not live). */
export function finalRefusal(topic: string, storyId: string, root: string, ask: Ask = boardViaCli): string | null {
  let n: BoardAnswer;
  try {
    n = ask(topic, storyId, root);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (n.halt?.kind === 'published') return `final never rebuilds a live video; the board says: ${n.next}`;
  if (n.stage !== 'packaged') return `final needs a packaged story; the board says ${n.stage}: ${n.next}`;
  return null;
}
