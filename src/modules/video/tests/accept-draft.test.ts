// `npm run video -- final` records the draft it accepted through publishing's CLI (`publish -- accept-draft`), after
// the release build is packaged: the event is the one the in-process recordApproved call wrote, and a refusal fails
// final.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLedger } from '../../publishing';
import { readJson, ROOT, toJson } from '../../../shared/io';
import { acceptDraftViaCli } from '../final';
import { afterFinal, syntheticProduction } from '../../../../tests/production-helpers';

describe('final records the acceptance through publish accept-draft', () => {
  it('writes the old in-process event after the release build, and a refusal throws', () => {
    const fx = syntheticProduction('packaged');
    try {
      // the CLI runs in the fixture root: ROOT resolves to it by the package name; shas are hex as in a real build
      writeFileSync(join(fx.root, 'package.json'), toJson({ name: 'video-knowledge', private: true }));
      const pp = join(fx.dir, 'video', 'review', 'review.json');
      const review = readJson<{ title: string }>(pp)!;
      writeFileSync(pp, toJson({ ...review, mp4Sha: 'd0d0d0d0d0' }));
      const D = afterFinal(fx.dir, 'a1a1a1a1a1');
      const calls: unknown[][] = [];
      const spy = ((...a: Parameters<typeof spawnSync>) => {
        calls.push(a);
        return spawnSync(...a);
      }) as typeof spawnSync;
      acceptDraftViaCli(fx.topic, fx.story, 'Jon', D, fx.root, spy);
      expect(calls).toHaveLength(1);
      const [cmd, args, opts] = calls[0] as [string, string[], Record<string, unknown>];
      expect(cmd).toBe(process.execPath);
      expect(args).toEqual([
        join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        join(ROOT, 'src', 'modules', 'publishing', 'cli.ts'),
        'accept-draft',
        fx.topic,
        fx.story,
        '--by',
        'Jon',
        '--build',
        D,
        '--note',
        'draft accepted by final',
      ]);
      expect(opts).toMatchObject({ cwd: fx.root, stdio: ['ignore', 'pipe', 'pipe'] });
      const [e, ...more] = loadLedger(fx.topic, fx.story, fx.root)!.outputs.youtube.events;
      expect(more).toEqual([]);
      // the shape recordApproved({ by, build: draft.sha, accepted: true, note }) wrote inside final
      expect({ ...e, at: '<at>' }).toEqual({
        at: '<at>',
        type: 'approved',
        by: 'Jon',
        build: D,
        title: review.title,
        note: 'draft accepted by final',
      });
      // the release build is never accepted: the refusal becomes final's error
      expect(() => acceptDraftViaCli(fx.topic, fx.story, 'Jon', 'a1a1a1a1a1', fx.root)).toThrow(
        /^accept-draft failed: refused: build a1a1a1a1a1 is the release build/,
      );
    } finally {
      fx.cleanup();
    }
  }, 120_000);
});
