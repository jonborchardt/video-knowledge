// The publishing ledger (publish.json): its shape, the idempotent append, the state an output's events derive to, the
// composed upload metadata, the CLI's verbs and their refusals. Nothing here touches YouTube: the ledger records what a
// person (or later an uploader) did.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readJson } from '../src/lib/io';
import {
  type Ledger,
  type Output,
  currentBuild,
  outputState,
  type PublishEvent,
  addOutput,
  appendEvent,
  emptyLedger,
  eventKey,
  ledgerProblems,
  mainOutput,
  saveLedger,
} from '../src/lib/publish';

const tmp = mkdtempSync(join(tmpdir(), 'vk-publish-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const ev = (type: PublishEvent['type'], extra: Partial<PublishEvent> = {}, at = '2026-10-24T09:00:00Z'): PublishEvent =>
  ({ at, type, by: 'Jon', ...extra }) as PublishEvent;
const uploaded = (build: string, id: string, at?: string) =>
  ev('uploaded', { build, buildStatus: 'release', metadata: 'm1', id, visibility: 'private' }, at);

/** The spec's example ledger. */
const example = (): Ledger => ({
  video: 'ai-coding/decision:how-much-faster',
  outputs: {
    youtube: {
      kind: 'youtube-video',
      metadata: { tags: ['ai coding'], thumbnail: { file: 'video/publish/thumbnail.png', sha: 'abc' } },
      events: [
        uploaded('9b2dfb11fb', 'dQw4w9WgXcQ', '2026-10-24T09:00:00Z'),
        ev('approved', { build: '9b2dfb11fb', id: 'dQw4w9WgXcQ', note: 'clean' }, '2026-10-25T18:12:00Z'),
        ev('scheduled', { id: 'dQw4w9WgXcQ', publishAt: '2026-10-28T15:00:00Z' }, '2026-10-25T18:15:00Z'),
        ev('published', { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' }, '2026-10-28T15:01:00Z'),
        ev('updated', { id: 'dQw4w9WgXcQ', metadata: 'a91f22d0c4', fields: ['thumbnail'] }, '2026-11-02T10:00:00Z'),
      ],
    },
    'short-1': {
      kind: 'youtube-short',
      derivedFrom: 'youtube',
      source: 'video/shorts/short-1.mp4',
      metadata: { title: 'Developers were slower with AI' },
      events: [ev('failed', { step: 'upload', error: 'quota exceeded', retryable: true, by: 'uploader' })],
    },
  },
});

describe('ledger', () => {
  it('starts with one youtube output', () => {
    expect(emptyLedger('t/s').outputs.youtube.kind).toBe('youtube-video');
    expect(emptyLedger('t/s').video).toBe('t/s');
  });

  it("accepts the spec's example", () => {
    expect(ledgerProblems(example(), 'ai-coding/decision:how-much-faster')).toEqual([]);
  });

  it('names the field that is wrong', () => {
    const bad = (mutate: (l: Ledger) => void) => {
      const l = example();
      mutate(l);
      return ledgerProblems(l, 'ai-coding/decision:how-much-faster');
    };
    expect(bad((l) => (l.video = 'other'))[0]).toMatch(/video/);
    expect(bad((l) => ((l.outputs.youtube.events[0] as { type: string }).type = 'liked'))[0]).toMatch(/type/);
    expect(bad((l) => delete (l.outputs.youtube.events[1] as Partial<PublishEvent>).by)[0]).toMatch(/by/);
    expect(bad((l) => (l.outputs['short-1'].derivedFrom = 'nope'))[0]).toMatch(/derivedFrom/);
    expect(bad((l) => delete l.outputs.youtube.events[0].build)[0]).toMatch(/build/);
    expect(bad((l) => delete l.outputs.youtube.events[2].publishAt)[0]).toMatch(/publishAt/);
    expect(bad((l) => delete l.outputs['short-1'].events[0].error)[0]).toMatch(/error/);
    expect(bad((l) => (l.outputs.youtube.events[3].at = '2026-01-01T00:00:00Z'))[0]).toMatch(/at .* before/);
  });

  it('appends once per key', () => {
    let l = emptyLedger('t/s');
    const first = appendEvent(l, 'youtube', uploaded('b1', 'id1'));
    expect(first.existing).toBeNull();
    const again = appendEvent(first.ledger, 'youtube', uploaded('b1', 'id1', '2026-10-25T00:00:00Z'));
    expect(again.existing).toEqual(first.ledger.outputs.youtube.events[0]);
    expect(again.ledger.outputs.youtube.events).toHaveLength(1);
    l = appendEvent(again.ledger, 'youtube', uploaded('b1', 'id2')).ledger; // the same build, another id: a re-upload
    expect(l.outputs.youtube.events).toHaveLength(2);
    const f = ev('failed', { step: 'upload', error: 'x' });
    l = appendEvent(appendEvent(l, 'youtube', f).ledger, 'youtube', f).ledger;
    expect(l.outputs.youtube.events.filter((e) => e.type === 'failed')).toHaveLength(2);
    expect(eventKey(f)).toBeNull();
  });

  it('refuses an event for an output that does not exist', () => {
    expect(() => appendEvent(emptyLedger('t/s'), 'nope', uploaded('b1', 'id1'))).toThrow(/nope/);
  });

  it('the main output is the last live youtube video', () => {
    let l = emptyLedger('t/s');
    expect(mainOutput(l)).toBe('youtube');
    l = appendEvent(l, 'youtube', ev('retracted', { note: 'wrong channel' })).ledger;
    expect(mainOutput(l)).toBeNull();
    l = addOutput(l, 'youtube-2', 'youtube-video');
    expect(mainOutput(l)).toBe('youtube-2');
    expect(mainOutput(addOutput(emptyLedger('t/s'), 'blog', 'blog-post'))).toBe('youtube');
  });

  it('adds an output once', () => {
    const l = addOutput(emptyLedger('t/s'), 'short-1', 'youtube-short', { derivedFrom: 'youtube' });
    expect(l.outputs['short-1']).toEqual({ kind: 'youtube-short', derivedFrom: 'youtube', metadata: {}, events: [] });
    expect(() => addOutput(l, 'short-1', 'youtube-short')).toThrow(/exists/);
    expect(() => addOutput(l, 'short-2', 'youtube-short', { derivedFrom: 'nope' })).toThrow(/derivedFrom/);
  });

  it('saves atomically and round-trips', () => {
    const path = join(tmp, 'publish.json');
    saveLedger(path, example());
    expect(readJson<Ledger>(path)).toEqual(example());
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });
});

describe('outputState', () => {
  const release = { sha: 'r1', status: 'release' } as const;
  const draft = { sha: 'd1', status: 'draft' } as const;
  const ctx = {
    topic: 'ai-coding',
    story: 'decision:how-much-faster',
    output: 'youtube',
    now: new Date('2026-10-26T00:00:00Z'),
  };
  const out = (...events: PublishEvent[]): Output => ({ kind: 'youtube-video', metadata: {}, events });
  const up = (build: string, id: string, status: 'draft' | 'release' = 'release') =>
    ev('uploaded', { build, buildStatus: status, metadata: 'm1', id, visibility: 'private' });

  it('starts not uploaded', () => {
    const s = outputState(out(), release, 'm1', ctx);
    expect(s.status).toBe('not-uploaded');
    expect(s.next).toContain('npm run publish -- uploaded ai-coding decision:how-much-faster');
  });

  it('an uploaded draft waits for final, an uploaded release for approve', () => {
    expect(outputState(out(up('d1', 'id1', 'draft')), draft, 'm1', ctx).next).toContain('npm run video -- final');
    const s = outputState(out(up('r1', 'id1')), release, 'm1', ctx);
    expect(s.status).toBe('uploaded');
    expect(s.id).toBe('id1');
    expect(s.next).toContain('npm run publish -- approve ai-coding decision:how-much-faster --by');
  });

  it('a new build after an upload is build-behind; the old upload is superseded once the new one lands', () => {
    const s = outputState(out(up('d1', 'id1', 'draft')), release, 'm1', ctx);
    expect(s.status).toBe('build-behind');
    expect(s.superseded).toEqual([]);
    const s2 = outputState(out(up('d1', 'id1', 'draft'), up('r1', 'id2')), release, 'm1', ctx);
    expect(s2.status).toBe('uploaded');
    expect(s2.superseded).toEqual(['id1']);
    expect(s2.uploadedBuild).toBe('r1');
  });

  it('approved, then scheduled, which falls due', () => {
    const base = [up('r1', 'id1'), ev('approved', { build: 'r1', id: 'id1' })];
    expect(outputState(out(...base), release, 'm1', ctx).status).toBe('approved');
    const soon = outputState(
      out(...base, ev('scheduled', { id: 'id1', publishAt: '2026-10-28T15:00:00Z' })),
      release,
      'm1',
      ctx,
    );
    expect(soon.status).toBe('scheduled');
    expect(soon.due).toBe(false);
    const due = outputState(
      out(...base, ev('scheduled', { id: 'id1', publishAt: '2026-10-20T15:00:00Z' })),
      release,
      'm1',
      ctx,
    );
    expect(due.due).toBe(true);
    expect(due.next).toContain('record published');
  });

  it('published stays published when the build on disk moves on', () => {
    const o = out(
      up('r1', 'id1'),
      ev('approved', { build: 'r1' }),
      ev('published', { id: 'id1', url: 'https://youtu.be/id1' }),
    );
    const s = outputState(o, { sha: 'r2', status: 'release' }, 'm1', ctx);
    expect(s.status).toBe('published');
    expect(s.url).toBe('https://youtu.be/id1');
    expect(s.next).toContain('npm run publish -- add ai-coding decision:how-much-faster youtube-2');
  });

  it('metadata behind, until an update records the new sha', () => {
    const o = out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' }));
    const s = outputState(o, release, 'm2', ctx);
    expect(s.status).toBe('metadata-behind');
    expect(s.next).toContain('npm run publish -- updated');
    o.events.push(ev('updated', { id: 'id1', metadata: 'm2', fields: ['thumbnail'] }));
    expect(outputState(o, release, 'm2', ctx).status).toBe('published');
  });

  it('a failure is an overlay on the state before it', () => {
    const o = out(up('r1', 'id1'), ev('failed', { step: 'approve', error: 'boom', retryable: true }));
    const s = outputState(o, release, 'm1', ctx);
    expect(s.status).toBe('uploaded');
    expect(s.failed?.error).toBe('boom');
    expect(s.next).toContain('retry');
  });

  it('retracted', () => {
    expect(outputState(out(ev('retracted', { note: 'no' })), release, 'm1', ctx).status).toBe('retracted');
  });

  it('survives a missing review package', () => {
    const o = out(up('r1', 'id1'), ev('approved', { build: 'r1' }), ev('published', { id: 'id1' }));
    const s = outputState(o, null, null, ctx);
    expect(s.status).toBe('published');
    const fresh = outputState(out(up('r1', 'id1')), null, null, ctx);
    expect(fresh.status).toBe('uploaded');
    expect(fresh.next).toContain('package');
  });

  it('reads the current build from the review package', () => {
    const dir = join(tmp, 'cb');
    expect(currentBuild(dir)).toBeNull();
    mkdirSync(join(dir, 'video', 'review'), { recursive: true });
    writeFileSync(
      join(dir, 'video', 'review', 'review.json'),
      JSON.stringify({ mp4Sha: 'abc', status: 'release build' }),
    );
    expect(currentBuild(dir)).toEqual({ sha: 'abc', status: 'release' });
    writeFileSync(
      join(dir, 'video', 'review', 'review.json'),
      JSON.stringify({ mp4Sha: 'abd', status: 'private review build' }),
    );
    expect(currentBuild(dir)).toEqual({ sha: 'abd', status: 'draft' });
  });
});
