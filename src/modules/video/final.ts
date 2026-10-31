// `npm run video -- final` asks the board whether a story may be rebuilt for release through the board's own CLI
// (`npm run board -- next --json`), never by importing the orchestrator, and records the draft it accepted through
// publishing's (`npm run publish -- accept-draft`), never by importing publishing.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from '../../shared/io';

/** The part of the board's answer `final` reads. */
export interface BoardAnswer {
  stage: string;
  next: string;
  halt: { kind: string } | null;
}
export type Ask = (topic: string, storyId: string, root: string) => BoardAnswer;

/** The board's answer for one story, from `npm run -s board -- next <topic> <story> --json` run in `root`. A non-zero
 *  exit, output that is not JSON or JSON without a `stage` throws `final could not ask the board: <stderr>`. */
export function boardViaCli(topic: string, storyId: string, root: string, spawn = spawnSync): BoardAnswer {
  const argv = ['run', '-s', 'board', '--', 'next', topic, storyId, '--json'];
  // On Windows npm is a .cmd, so it needs a shell; one command string (no args array) keeps Node's DEP0190 quiet.
  const win = process.platform === 'win32';
  const r = spawn(win ? ['npm', ...argv.map((a) => `"${a}"`)].join(' ') : 'npm', win ? [] : argv, {
    shell: win,
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fail = () =>
    new Error(`final could not ask the board: ${(String(r.stderr ?? '') || (r.error?.message ?? '')).trim()}`);
  if (r.status !== 0) throw fail();
  let n: unknown;
  try {
    n = JSON.parse(String(r.stdout));
  } catch {
    throw fail();
  }
  if (typeof (n as BoardAnswer | null)?.stage !== 'string') throw fail();
  return n as BoardAnswer;
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

/** `final` records that `by` accepted the draft `draftSha` through publishing's own CLI (`npm run publish --
 *  accept-draft`), never by importing it: run in `root` with the repo's tsx. Exit 0 prints nothing; any other exit
 *  throws `accept-draft failed: <stderr>`. */
export function acceptDraftViaCli(
  topic: string,
  storyId: string,
  by: string,
  draftSha: string,
  root: string,
  spawn = spawnSync,
): void {
  const r = spawn(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(ROOT, 'src', 'modules', 'publishing', 'cli.ts'),
      'accept-draft',
      topic,
      storyId,
      '--by',
      by,
      '--build',
      draftSha,
      '--note',
      'draft accepted by final',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (r.status !== 0)
    throw new Error(`accept-draft failed: ${(String(r.stderr ?? '') || (r.error?.message ?? '')).trim()}`);
}
