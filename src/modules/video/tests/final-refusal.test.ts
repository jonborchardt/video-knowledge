// `npm run video -- final` asks the board through its CLI (decision C): the refusal is the board's answer, the same
// text the in-process call gave, and a board that cannot answer is a refusal, never a pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTICLE_FILES } from '../../article';
import { boardNext } from '../../../orchestration';
import { readJson, ROOT, toJson } from '../../../shared/io';
import { type BoardAnswer, boardViaCli, finalRefusal } from '../final';
import { type Fixture, syntheticProduction } from '../../../../tests/production-helpers';

/** The refusal `final` gave when it called boardNext in process (scripts/video.ts before decision C). */
const inlineRefusal = (n: BoardAnswer): string | null =>
  n.halt?.kind === 'published'
    ? `final never rebuilds a live video; the board says: ${n.next}`
    : n.stage !== 'packaged'
      ? `final needs a packaged story; the board says ${n.stage}: ${n.next}`
      : null;

const rm = (fx: Fixture, f: string) => rmSync(join(fx.dir, f), { recursive: true, force: true });
const editReport = (fx: Fixture, over: object) => {
  const f = join(fx.dir, 'video', 'build-report.json');
  writeFileSync(f, toJson({ ...readJson<object>(f)!, ...over }));
};
/** A fixture at `stage`, then `edit` applied to it. */
const at =
  (stage: 'graphics' | 'packaged', edit: (fx: Fixture) => void = () => {}) =>
  () => {
    const fx = syntheticProduction(stage);
    edit(fx);
    return fx;
  };
const STATES: [string, () => Fixture][] = [
  ['no render.json', at('graphics', (fx) => rm(fx, 'video/render.json'))],
  [
    'rendered, QA failed',
    at('packaged', (fx) => {
      editReport(fx, { qa: { ok: false, checks: [{ name: 'fixture', ok: false }] } });
      rm(fx, 'video/review');
    }),
  ],
  ['QA passed, no package', at('packaged', (fx) => rm(fx, 'video/review'))],
  ['package of another build report', at('packaged', (fx) => editReport(fx, { generatedAt: '2026-02-02' }))],
  ['article pending at scored', at('packaged', (fx) => rm(fx, ARTICLE_FILES.release))],
  ['fully packaged', at('packaged')],
];

describe('final asks the board (finalRefusal over the board in process)', () => {
  for (const [name, make] of STATES)
    it(`${name}: refuses iff the board does not say packaged, in the old words`, () => {
      const fx = make();
      try {
        const n = boardNext(fx.topic, fx.story, fx.root);
        const r = finalRefusal(fx.topic, fx.story, fx.root, () => n);
        expect(r === null).toBe(n.stage === 'packaged');
        expect(r).toBe(inlineRefusal(n));
        if (name === 'fully packaged') expect(r).toBeNull();
        else expect(r).not.toBeNull();
      } finally {
        fx.cleanup();
      }
    }, 60_000);
});

/** A fixture root the board CLI runs in: its package.json is the repo's name (so ROOT resolves to it) with `board`
 *  pointing at the repo's board CLI, or at a stub command. */
const runAt = (root: string, board: string) =>
  writeFileSync(join(root, 'package.json'), toJson({ name: 'video-knowledge', private: true, scripts: { board } }));
const tsx = (f: string) =>
  `node "${join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs').replaceAll('\\', '/')}" "${join(ROOT, f).replaceAll('\\', '/')}"`;
const porcelain = () => execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });

describe('final asks the board through its CLI (the real spawner)', () => {
  it('runs exactly the board query, refuses a story that is not packaged and passes a packaged one', () => {
    const before = porcelain();
    for (const [stage, refused] of [
      ['locked', true],
      ['packaged', false],
    ] as const) {
      const fx = syntheticProduction(stage);
      try {
        runAt(fx.root, tsx('src/orchestration/board.ts'));
        const calls: unknown[][] = [];
        const spy = ((...a: Parameters<typeof spawnSync>) => {
          calls.push(a);
          return spawnSync(...a);
        }) as typeof spawnSync;
        const r = finalRefusal(fx.topic, fx.story, fx.root, (t, s, root) => boardViaCli(t, s, root, spy));
        expect(r).toBe(inlineRefusal(boardNext(fx.topic, fx.story, fx.root)));
        expect(r === null).toBe(!refused);
        expect(calls).toHaveLength(1);
        const [cmd, args, opts] = calls[0] as [string, string[], Record<string, unknown>];
        const argv = ['run', '-s', 'board', '--', 'next', fx.topic, fx.story, '--json'];
        const win = process.platform === 'win32';
        // On Windows: one command string through the shell (no args array, so no DEP0190); elsewhere npm + argv.
        expect([cmd, ...args]).toEqual(win ? [['npm', ...argv.map((a) => `"${a}"`)].join(' ')] : ['npm', ...argv]);
        expect(opts).toMatchObject({
          cwd: fx.root,
          shell: win,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } finally {
        fx.cleanup();
      }
    }
    expect(porcelain()).toBe(before);
  }, 120_000);

  it('a board that fails or answers no JSON is a refusal carrying its stderr, never a pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-final-'));
    try {
      runAt(root, `node -e "process.stderr.write('the board broke');process.exit(1)"`);
      expect(finalRefusal('t', 's', root)).toBe('final could not ask the board: the board broke');
      runAt(root, `node -e "process.stdout.write('not json');process.stderr.write('odd')"`);
      expect(finalRefusal('t', 's', root)).toBe('final could not ask the board: odd');
      runAt(root, `node -e "process.stdout.write('null');process.stderr.write('no stage')"`);
      expect(finalRefusal('t', 's', root)).toBe('final could not ask the board: no stage');
      runAt(root, `node -e "process.stdout.write(JSON.stringify({next:'x'}))"`);
      expect(finalRefusal('t', 's', root)).toBe('final could not ask the board: ');
      runAt(root, 'no-such-command-vk');
      expect(finalRefusal('t', 's', root)).toMatch(/^final could not ask the board: .+/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
