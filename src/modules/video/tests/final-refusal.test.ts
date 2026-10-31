// `npm run video -- final` asks the board through its CLI: it refuses unless the board says packaged and not live,
// and a board that cannot answer is a refusal, never a pass.
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';
import { cliArgv } from '../../../shared/cli';
import { type BoardAnswer, boardViaCli, finalRefusal } from '../final';
import { cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

describe('finalRefusal', () => {
  const says = (n: BoardAnswer) => finalRefusal('t', 's', ROOT, () => n);
  it('refuses a live video, a story the board does not call packaged, and passes a packaged one', () => {
    expect(says({ stage: 'packaged', next: 'n', halt: { kind: 'published' } })).toBe(
      'final never rebuilds a live video; the board says: n',
    );
    expect(says({ stage: 'locked', next: 'n', halt: null })).toBe(
      'final needs a packaged story; the board says locked: n',
    );
    expect(says({ stage: 'packaged', next: 'n', halt: null })).toBeNull();
  });
});

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
        cliRoot(fx.root);
        const calls: unknown[][] = [];
        const spy = ((...a: Parameters<typeof spawnSync>) => {
          calls.push(a);
          return spawnSync(...a);
        }) as typeof spawnSync;
        const r = finalRefusal(fx.topic, fx.story, fx.root, (t, s, root) => boardViaCli(t, s, root, spy));
        if (refused) expect(r).toMatch(/^final needs a packaged story; the board says locked: /);
        else expect(r).toBeNull();
        expect(calls).toHaveLength(1);
        const [cmd, args, opts] = calls[0] as [string, string[], Record<string, unknown>];
        expect([cmd, args]).toEqual(cliArgv('board', ['next', fx.topic, fx.story, '--json']));
        expect(opts).toMatchObject({ cwd: fx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } finally {
        fx.cleanup();
      }
    }
    expect(porcelain()).toBe(before);
  }, 120_000);

  it('a board that fails or answers no JSON is a refusal carrying its stderr, never a pass', () => {
    const answer = (status: number, stdout: string, stderr: string) =>
      (() => ({ status, stdout, stderr })) as unknown as typeof spawnSync;
    const ask = (r: typeof spawnSync) => () => boardViaCli('t', 's', ROOT, r);
    expect(finalRefusal('t', 's', ROOT, ask(answer(1, '', 'the board broke')))).toBe(
      'final could not ask the board: the board broke',
    );
    expect(finalRefusal('t', 's', ROOT, ask(answer(0, 'not json', 'odd')))).toBe('final could not ask the board: odd');
    expect(finalRefusal('t', 's', ROOT, ask(answer(0, JSON.stringify({ next: 'x' }), '')))).toBe(
      'final could not ask the board: ',
    );
  });
});
