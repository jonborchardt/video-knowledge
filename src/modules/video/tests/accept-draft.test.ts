// `npm run video -- final` records the draft it accepted through publishing's CLI (`publish -- accept-draft`), after
// the release build is packaged: the event is the one the in-process recordApproved call wrote, and a refusal fails
// final.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLedger } from '../../publishing';
import { publishPath, recordApproved, recordScheduled, recordUploaded } from '../../publishing/publish';
import { readJson, ROOT, toJson } from '../../../shared/io';
import { cliArgv, runCli } from '../../../shared/cli';
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
      acceptDraftViaCli(fx.topic, fx.story, 'Jon', D, fx.root, false, spy);
      expect(calls).toHaveLength(1);
      const [cmd, args, opts] = calls[0] as [string, string[], Record<string, unknown>];
      expect([cmd, args]).toEqual(
        cliArgv('publish', [
          'accept-draft',
          fx.topic,
          fx.story,
          '--by',
          'Jon',
          '--build',
          D,
          '--note',
          'draft accepted by final',
        ]),
      );
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
        /^accept-draft failed: refused: build a1a1a1a1a1 was narrated under commercial terms/,
      );
    } finally {
      fx.cleanup();
    }
  }, 120_000);

  it('the dry run final makes before narration adds --dry-run, and its refusal stops final', () => {
    const calls: string[][] = [];
    const refuse = ((_cmd: string, args: string[]) => {
      calls.push(args);
      return {
        status: 2,
        stdout: '',
        stderr: 'refused: youtube is already approved for publication (it is scheduled)\n',
      };
    }) as unknown as typeof spawnSync;
    expect(() => acceptDraftViaCli('t', 's', 'Jon', 'd0d0d0d0d0', ROOT, true, refuse)).toThrow(
      'accept-draft refused: refused: youtube is already approved for publication (it is scheduled)',
    );
    expect(calls[0]).toEqual(
      cliArgv('publish', [
        'accept-draft',
        't',
        's',
        '--by',
        'Jon',
        '--build',
        'd0d0d0d0d0',
        '--note',
        'draft accepted by final',
        '--dry-run',
      ])[1],
    );
    const pass = (() => ({ status: 0, stdout: '', stderr: '' })) as unknown as typeof spawnSync;
    expect(() => acceptDraftViaCli('t', 's', 'Jon', 'd0d0d0d0d0', ROOT, true, pass)).not.toThrow();
  });

  it('a scheduled release refuses the real final before narration, rendering or any ledger write', () => {
    // a release build approved, uploaded and scheduled; then an edit put a new draft package on disk
    const fx = syntheticProduction('packaged', { release: true });
    try {
      writeFileSync(join(fx.root, 'package.json'), toJson({ name: 'video-knowledge', private: true }));
      const a = { root: fx.root, by: 'Jon', now: new Date('2026-10-26T00:00:00Z') };
      recordApproved(fx.topic, fx.story, a);
      recordUploaded(fx.topic, fx.story, { ...a, id: 'sssssssssss' });
      recordScheduled(fx.topic, fx.story, { ...a, at: '2099-01-01T00:00:00Z' });
      const pp = join(fx.dir, 'video', 'review', 'review.json');
      const review = readJson<{ provenance?: { narration?: object } }>(pp)!;
      writeFileSync(
        pp,
        toJson({
          ...review,
          status: 'private review build',
          mp4Sha: 'd1d1d1d1d1',
          provenance: { ...review.provenance, narration: { ...review.provenance?.narration, publishable: false } },
        }),
      );
      const ledgerPath = publishPath(fx.topic, fx.story, fx.root);
      const before = {
        ledger: readFileSync(ledgerPath, 'utf8'),
        review: readFileSync(pp, 'utf8'),
        video: readdirSync(join(fx.dir, 'video')).sort(),
      };
      // the real verb, in the fixture root (no .env there: no Azure key, so narration could not even start)
      const r = runCli('video', ['final', fx.topic, fx.story, '--approved-by', 'Jon'], { cwd: fx.root });
      expect(r.status).not.toBe(0);
      // either the board refuses it, or the dry run of the acceptance does: both before narration
      expect(r.stderr).toMatch(
        /accept-draft refused: .*\(it is scheduled\)|final (needs a packaged story|never rebuilds)/,
      );
      expect(r.stderr).not.toMatch(/azure|narrat(ed|ing)|render/i);
      expect(readFileSync(ledgerPath, 'utf8')).toBe(before.ledger);
      expect(readFileSync(pp, 'utf8')).toBe(before.review);
      expect(readdirSync(join(fx.dir, 'video')).sort()).toEqual(before.video);
      // the scheduled release and its approval stand exactly as recorded
      const ev = loadLedger(fx.topic, fx.story, fx.root)!.outputs.youtube.events;
      expect(ev.map((e) => e.type)).toEqual(['approved', 'uploaded', 'scheduled']);
    } finally {
      fx.cleanup();
    }
  }, 240_000);
});
