// The fixture's reach (spec §5.8, register D20): an output of a fixture topic goes unlisted at most on a person's
// decision, never public, with the same approval any release needs; sync and verify read unlisted as its published
// state; nothing in the module sets a visibility without a decision.
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isFixtureTopic } from '../../../config/site';
import { readJson, sha, toJson } from '../../../shared/io';
import { Refusal } from '../../../shared/refusal';
import { storyOutputs } from '../outputs';
import { loadLedger, openOutput, recordApproved, recordUploaded } from '../publish';
import { decideProblem } from '../decide';
import { goLive, sync, verify } from '../uploader';
import { expectedOf } from '../verify';
import type { RemoteVideo, YouTubeClient } from '../youtube';
import { type Fixture, cliRoot, syntheticProduction } from '../../../../tests/production-helpers';

const fixtures: Fixture[] = [];
afterAll(() => fixtures.forEach((f) => f.cleanup()), 120_000); // many temp roots: slow under full-suite load
const now = new Date('2026-11-01T12:00:00Z');

/** A packaged release of the fixture topic (the synthetic heat-pumps production moved under test-fixture), its
 *  build uploaded private and approved by a person. */
function staged(fixture = true) {
  const f0 = syntheticProduction('packaged', { release: true });
  fixtures.push(f0);
  cliRoot(f0.root);
  const topic = fixture ? 'test-fixture' : f0.topic;
  if (fixture) renameSync(join(f0.root, 'topics', f0.topic), join(f0.root, 'topics', topic));
  const f = { ...f0, topic, dir: f0.dir.replace(f0.topic, topic) };
  const review = join(f.dir, 'video', 'review');
  const bytes = Buffer.alloc(1024, 3);
  writeFileSync(join(review, 'fixture.mp4'), bytes);
  writeFileSync(join(review, 'thumbnail.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const rp = join(review, 'review.json');
  writeFileSync(rp, toJson({ ...readJson<object>(rp)!, mp4Sha: sha(bytes) }));
  const list = readJson<{ checklist?: string[] }>(rp)!.checklist ?? [];
  const base = { root: f.root, by: 'Jon', now };
  recordUploaded(f.topic, f.story, { ...base, id: 'vid00000000', visibility: 'private' });
  const state = { privacy: 'private' as RemoteVideo['privacyStatus'] };
  const calls: { method: string; args: unknown[] }[] = [];
  const client: YouTubeClient = {
    insertVideo: async () => ({ id: 'x' }),
    setThumbnail: async () => undefined,
    insertCaptions: async () => undefined,
    updateVideo: async (id, body) => {
      calls.push({ method: 'updateVideo', args: [id, body] });
      if (body.status?.privacyStatus) state.privacy = body.status.privacyStatus;
    },
    getVideo: async (id) => ({
      id,
      privacyStatus: state.privacy,
      uploadStatus: 'processed',
      rejectionReason: null,
      publishAt: null,
      processingStatus: 'succeeded',
    }),
    listCaptions: async () => [],
    deleteCaptions: async () => undefined,
  };
  const approve = () => recordApproved(f.topic, f.story, { ...base, checked: list.length });
  const events = () => loadLedger(f.topic, f.story, f.root)!.outputs.youtube.events;
  const sent = () => calls.map((c) => (c.args[1] as { status?: { privacyStatus?: string } }).status?.privacyStatus);
  return { f, base, client, approve, events, sent, state };
}

describe('a fixture output goes live', () => {
  it('unlisted, never public, on the same approval as any release; the ledger records the visibility; the site shows nothing', async () => {
    const s = staged();
    expect(isFixtureTopic(s.f.topic)).toBe(true);
    await expect(goLive(s.f.topic, s.f.story, { ...s.base, client: s.client })).rejects.toThrow(Refusal);
    await expect(goLive(s.f.topic, s.f.story, { ...s.base, client: s.client })).rejects.toThrow(/not approved/);
    expect(s.sent()).toEqual([]);
    s.approve();
    const r = await goLive(s.f.topic, s.f.story, { ...s.base, client: s.client });
    expect(r.event?.type).toBe('published');
    expect(r.event?.visibility).toBe('unlisted');
    expect(s.sent()).toEqual(['unlisted']);
    expect(s.sent()).not.toContain('public');
    expect(openOutput(s.f.topic, s.f.story, { root: s.f.root }).state.live).toBe(true);
    expect(storyOutputs(s.f.topic, s.f.story, s.f.root).video).toBeNull(); // not public: no page embeds it
    // verify reads unlisted as its published state
    expect(expectedOf(openOutput(s.f.topic, s.f.story, { root: s.f.root }))!.visibility).toBe('unlisted');
    const v = await verify(s.f.topic, s.f.story, {
      ...s.base,
      client: s.client,
      anonymous: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
    });
    expect(v.checks.find((c) => c.name === 'privacy')).toMatchObject({ result: 'pass' });
  });
  it('is never scheduled: publishAt would make it public; go-live and decide refuse --at for a fixture topic', async () => {
    const s = staged();
    s.approve();
    const at = new Date(now.getTime() + 2 * 3600_000).toISOString();
    await expect(goLive(s.f.topic, s.f.story, { ...s.base, client: s.client, at })).rejects.toThrow(
      /fixture.*never scheduled/,
    );
    expect(s.sent()).toEqual([]);
    expect(s.events().some((e) => e.type === 'scheduled')).toBe(false);
    const ledger = loadLedger(s.f.topic, s.f.story, s.f.root)!;
    const req = {
      request: 'rq-000000000000',
      release: 'r',
      outputs: ['youtube'],
      at: now.toISOString(),
      expiresAt: new Date(now.getTime() + 86400_000).toISOString(),
      channel: 'email' as const,
    };
    const manifest = {
      topic: s.f.topic,
      releaseSha: 'r',
      ctas: { commercial: [] },
      fixtureRun: 'run1',
    } as unknown as Parameters<typeof decideProblem>[1];
    expect(
      decideProblem(ledger, manifest, req, { request: req.request, by: 'Jon', verdict: 'schedule', at }, now, 30),
    ).toMatch(/fixture.*never scheduled/);
    expect(
      decideProblem(ledger, manifest, req, { request: req.request, by: 'Jon', verdict: 'ok' }, now, 30),
    ).toBeNull();
  });
  it('sync records an approved fixture video found unlisted as published (observed), with the visibility', async () => {
    const s = staged();
    s.approve();
    s.state.privacy = 'unlisted'; // Studio, or a go-live that died after the update
    const r = await sync(s.f.topic, s.f.story, { ...s.base, client: s.client });
    expect('event' in r && r.event?.type).toBe('published');
    expect('event' in r && r.event?.visibility).toBe('unlisted');
    expect('event' in r && r.event?.note).toMatch(/observed/);
    expect(s.sent()).toEqual([]);
  });
  it('a non-fixture output is unchanged: public, recorded without a visibility', async () => {
    const s = staged(false);
    s.approve();
    const r = await goLive(s.f.topic, s.f.story, { ...s.base, client: s.client });
    expect(r.event?.type).toBe('published');
    expect(r.event?.visibility).toBeUndefined();
    expect(s.sent()).toEqual(['public']);
    expect(storyOutputs(s.f.topic, s.f.story, s.f.root).video?.id).toBe('vid00000000');
    expect(s.events().filter((e) => e.type === 'published')).toHaveLength(1);
  });
});
