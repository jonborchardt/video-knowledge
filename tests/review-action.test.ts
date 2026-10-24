// The review page's actions (POST, dev server only) and the job runner behind the long ones: a foreign page cannot
// post, a stale build is refused, a decision is written through the publish verbs, a long verb starts one job at a time.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addOutputTo, loadLedger, recordApproved, recordUploaded } from '../src/lib/publish';
import { JOB_FILE, jobStatus, startJob } from '../src/lib/review-job';
import { handle, sameOrigin } from '../src/admin/review-action';
import { storySlug } from '../src/lib/script';
import { type Fixture, syntheticProduction, syntheticShort } from './production-helpers';

const ORIGIN = 'http://localhost:4321';
const post = (path: string, fields: Record<string, string> | [string, string][], origin: string | null = ORIGIN) => {
  const body = new URLSearchParams(fields);
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin ? { origin } : {}) },
  });
};
const pathOf = (f: Fixture) => storySlug(f.story);
const run = async <F extends Fixture>(f: F, body: (f: F) => Promise<void>) => {
  try {
    await body(f);
  } finally {
    f.cleanup();
  }
};
const recorder = () => {
  const calls: { label: string; args: string[] }[] = [];
  const start = (_dir: string, label: string, args: string[]) => void calls.push({ label, args });
  return { calls, start };
};

describe('sameOrigin', () => {
  it('needs the Origin header to be the server itself', () => {
    expect(sameOrigin(post('/x', {}))).toBe(true);
    expect(sameOrigin(post('/x', {}, 'https://evil.example'))).toBe(false);
    expect(sameOrigin(post('/x', {}, null))).toBe(false);
  });
});

describe('review actions', () => {
  it('a foreign origin is 403 and starts nothing', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      const r = recorder();
      const params = { topic: f.topic, action: 'go-live', path: pathOf(f) };
      const res = await handle(post('/', { by: 'Jon', build: 'releasesha' }, 'https://evil.example'), params, {
        root: f.root,
        start: r.start,
      });
      expect(res.status).toBe(403);
      expect(r.calls).toEqual([]);
    }));

  it('approving a build that is no longer the current one is refused and writes nothing', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      const params = { topic: f.topic, action: 'approve', path: pathOf(f) };
      const res = await handle(post('/', { by: 'Jon', build: 'oldsha' }), params, { root: f.root });
      expect(res.status).toBe(303);
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/error=.*reload/);
      expect(loadLedger(f.topic, f.story, f.root)?.outputs.youtube.events ?? []).toEqual([]);
    }));

  it('approve and request changes go through the publish verbs', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      const params = (action: string) => ({ topic: f.topic, action, path: pathOf(f) });
      let res = await handle(
        post('/', { by: 'Jon', build: 'releasesha', notes: '[0:02] slower\nkeep the end' }),
        params('request-changes'),
        { root: f.root },
      );
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/ok=/);
      res = await handle(post('/', { by: 'Jon', build: 'releasesha' }), params('approve'), {
        root: f.root,
      });
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/ok=/);
      const ev = loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
      expect(ev.map((e) => e.type)).toEqual(['changes-requested', 'approved']);
      expect(ev[0].notes).toEqual([{ text: 'slower', seconds: 2 }, { text: 'keep the end' }]);
    }));

  it('approve counts the ticked checklist items', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      const rp = join(f.dir, 'video', 'review', 'review.json');
      writeFileSync(rp, JSON.stringify({ ...JSON.parse(readFileSync(rp, 'utf8')), checklist: ['a', 'b'] }));
      const params = { topic: f.topic, action: 'approve', path: pathOf(f) };
      const one: [string, string][] = [
        ['by', 'Jon'],
        ['build', 'releasesha'],
        ['check', '0'],
      ];
      let res = await handle(post('/', one), params, { root: f.root });
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/error=.*checklist/);
      res = await handle(post('/', [...one, ['check', '1']]), params, { root: f.root });
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/ok=/);
    }));

  it('go-live needs the confirmation and a person', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      const r = recorder();
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', id: 'aaaaaaaaaaa' });
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon' });
      const params = { topic: f.topic, action: 'go-live', path: pathOf(f) };
      const o = { root: f.root, start: r.start };
      let res = await handle(post('/', { by: 'Jon', build: 'releasesha', when: 'now' }), params, o);
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/error=.*confirm/);
      res = await handle(
        post('/', { by: 'automated: x', build: 'releasesha', when: 'now', confirm: 'yes' }),
        params,
        o,
      );
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/error=.*person/);
      expect(r.calls).toEqual([]);
      res = await handle(
        post('/', { by: 'Jon', build: 'releasesha', when: 'at', at: '2030-01-02T15:00', confirm: 'yes' }),
        params,
        o,
      );
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/ok=/);
      expect(r.calls).toHaveLength(1);
      expect(r.calls[0].args.slice(0, 4)).toEqual(['publish', 'go-live', f.topic, f.story]);
      expect(r.calls[0].args).toContain('--at');
      expect(r.calls[0].args.at(-1)).toBe(new Date('2030-01-02T15:00').toISOString());
    }));

  it("a Short: go-live before the parent is refused; upload starts the publish verb with the Short's id", () =>
    run(syntheticShort('packaged', { release: true }), async (f) => {
      const r = recorder();
      const source = relative(f.root, f.dir).split(sep).join('/');
      addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source,
        root: f.root,
      });
      const path = `${storySlug(f.parent)}/shorts/fixture-short`;
      const o = { root: f.root, start: r.start };
      await handle(post('/', { by: 'Jon', build: 'shortreleasesha' }), { topic: f.topic, action: 'upload', path }, o);
      expect(r.calls[0].args.slice(0, 4)).toEqual(['publish', 'upload', f.topic, f.story]);
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', id: 'bbbbbbbbbbb' });
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon' });
      const res = await handle(
        post('/', { by: 'Jon', build: 'shortreleasesha', when: 'now', confirm: 'yes' }),
        { topic: f.topic, action: 'go-live', path },
        o,
      );
      expect(decodeURIComponent(res.headers.get('location')!)).toMatch(/error=.*youtube first/);
      expect(r.calls).toHaveLength(1);
    }));

  it('an unknown path or action is 404', () =>
    run(syntheticProduction('packaged', { release: true }), async (f) => {
      expect(
        (await handle(post('/', {}), { topic: f.topic, action: 'approve', path: '../x' }, { root: f.root })).status,
      ).toBe(404);
      expect(
        (await handle(post('/', {}), { topic: f.topic, action: 'delete', path: pathOf(f) }, { root: f.root })).status,
      ).toBe(404);
    }));
});

describe('jobs', () => {
  const dirWith = (f: Fixture, job: object | null) => {
    mkdirSync(join(f.dir, 'video'), { recursive: true });
    if (job) writeFileSync(join(f.dir, 'video', JOB_FILE), JSON.stringify(job));
    return f.dir;
  };
  it('reads running, done, failed and lost', () =>
    run(syntheticProduction('locked'), async (f) => {
      const base = { label: 'upload', args: ['publish', 'upload'], startedAt: '2026-10-24T00:00:00Z' };
      expect(jobStatus(dirWith(f, null))).toBeNull();
      expect(jobStatus(dirWith(f, { ...base, pid: process.pid, exitCode: null }))?.state).toBe('running');
      expect(jobStatus(dirWith(f, { ...base, pid: process.pid, exitCode: 0 }))?.state).toBe('done');
      expect(jobStatus(dirWith(f, { ...base, pid: process.pid, exitCode: 2 }))?.state).toBe('failed');
      expect(jobStatus(dirWith(f, { ...base, pid: 2 ** 30, exitCode: null }))?.state).toBe('lost');
    }));
  it('refuses a second job while one runs', () =>
    run(syntheticProduction('locked'), async (f) => {
      const dir = dirWith(f, { label: 'upload', args: [], startedAt: '', pid: process.pid, exitCode: null });
      expect(() => startJob(dir, 'push', ['publish', 'push'])).toThrow(/running/);
    }));
});
