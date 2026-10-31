// The publication checks of `npm run publish -- verify`, pure: what the package says YouTube should hold against what a
// read-back answers. No network, no ledger writes except the expectedOf fixture's upload.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { sha } from '../../../shared/io';
import { openOutput, recordUploaded } from '../publish';
import { CHECKS, type Expected, chapterLines, expectedOf, verdictOf, verificationChecks } from '../verify';
import type { RemoteCaption, RemoteVideo } from '../youtube';
import { type Fixture, syntheticProduction } from '../../../../tests/production-helpers';

const now = new Date('2026-10-27T12:00:00Z');
const x: Expected = {
  visibility: 'private',
  publishAt: null,
  title: 'Is it cheaper?',
  description: 'Is it cheaper?\n\nChapters\n0:00 Hook\n1:10 The bills\n',
  tags: ['heat pumps', 'energy'],
  category: '27',
  language: 'en',
  chapters: [
    { stamp: '0:00', title: 'Hook' },
    { stamp: '1:10', title: 'The bills' },
  ],
  captionsLanguage: 'en',
  thumbnail: true,
  syntheticMedia: false,
  file: { size: 1024 },
};
const ok: RemoteVideo = {
  id: 'vid00000001',
  privacyStatus: 'private',
  uploadStatus: 'processed',
  rejectionReason: null,
  publishAt: null,
  processingStatus: 'succeeded',
  title: x.title,
  description: 'Is it cheaper?\r\n\r\nChapters\r\n0:00 Hook\r\n1:10 The bills',
  tags: x.tags,
  categoryId: '27',
  defaultLanguage: 'en',
  license: 'youtube',
  embeddable: true,
  madeForKids: false,
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: false,
  ytRating: undefined,
  regionRestriction: undefined,
  hasCustomThumbnail: true,
  fileSize: 1024,
  fileAvailability: 'available',
};
const track: RemoteCaption = { id: 'c', language: 'en', trackKind: 'standard', status: 'serving' };
const check = (c: ReturnType<typeof verificationChecks>, name: string) => c.find((k) => k.name === name)!;

describe('verificationChecks', () => {
  it('a video that matches the package passes every check', () => {
    const c = verificationChecks(x, ok, [track], 403, now);
    expect(c.map((k) => k.name)).toEqual([...CHECKS]);
    expect(c.filter((k) => k.result !== 'pass' && k.result !== 'skip')).toEqual([]);
    expect(verdictOf(c)).toBe('passed');
  });

  it('a mismatch names the field and never stores the remote value', () => {
    const c = verificationChecks(x, { ...ok, title: 'SECRET REMOTE TITLE', defaultLanguage: undefined }, [], 403, now);
    expect(check(c, 'title')).toMatchObject({ result: 'fail' });
    expect(check(c, 'language').detail).toContain('not set');
    expect(check(c, 'captions').result).toBe('fail');
    expect(JSON.stringify(c)).not.toContain('SECRET REMOTE TITLE');
    expect(verdictOf(c)).toBe('failed');
  });

  it('still processing is pending, not failed', () => {
    const c = verificationChecks(
      x,
      {
        ...ok,
        uploadStatus: 'uploaded',
        processingStatus: 'processing',
        hasCustomThumbnail: false,
        fileAvailability: undefined,
        fileSize: undefined,
      },
      null,
      403,
      now,
    );
    expect(['upload', 'processing', 'thumbnail', 'captions', 'file'].map((n) => check(c, n).result)).toEqual(
      Array(5).fill('pending'),
    );
    expect(verdictOf(c)).toBe('pending');
  });

  it('a schedule that went public is pending until sync records it', () => {
    const due = { ...x, publishAt: '2026-10-27T11:00:00Z' };
    const c = verificationChecks(due, { ...ok, privacyStatus: 'public' }, [track], 200, now);
    expect(check(c, 'privacy')).toMatchObject({ result: 'pending' });
    expect(check(c, 'privacy').detail).toContain('sync');
    const ahead = { ...x, publishAt: '2026-10-28T11:00:00Z' };
    expect(
      check(verificationChecks(ahead, { ...ok, publishAt: '2026-10-28T11:00:00.000Z' }, [track], 403, now), 'privacy')
        .result,
    ).toBe('pass');
    expect(check(verificationChecks(ahead, ok, [track], 403, now), 'privacy').result).toBe('fail');
  });

  it('an oEmbed network error is pending', () => {
    expect(check(verificationChecks(x, ok, [track], 0, now), 'public').result).toBe('pending');
    const pub = { ...x, visibility: 'public' as const };
    expect(check(verificationChecks(pub, { ...ok, privacyStatus: 'public' }, [track], 0, now), 'public').result).toBe(
      'pending',
    );
    expect(check(verificationChecks(pub, { ...ok, privacyStatus: 'public' }, [track], 401, now), 'public').result).toBe(
      'fail',
    );
  });

  it('a private video reachable without signing in fails', () => {
    const c = verificationChecks(x, ok, [track], 200, now);
    expect(check(c, 'public')).toMatchObject({ result: 'fail', detail: 'reachable without signing in' });
  });

  it('a schedule gone public before sync is pending on public too, not failed', () => {
    const due = { ...x, publishAt: '2026-10-27T11:00:00Z' };
    const c = verificationChecks(due, { ...ok, privacyStatus: 'public' }, [track], 200, now);
    expect(check(c, 'public').result).toBe('pending');
    expect(check(c, 'public').detail).toContain('sync');
    expect(verdictOf(c)).toBe('pending');
    const ahead = { ...x, publishAt: '2026-10-28T11:00:00Z' };
    expect(check(verificationChecks(ahead, ok, [track], 200, now), 'public').result).toBe('fail');
  });

  it('any serving track in the language passes, whatever order the API lists them in', () => {
    const failed = { ...track, id: 'old', status: 'failed' };
    expect(check(verificationChecks(x, ok, [failed, track], 403, now), 'captions').result).toBe('pass');
    expect(
      check(verificationChecks(x, ok, [failed, { ...track, status: 'syncing' }], 403, now), 'captions').result,
    ).toBe('pending');
    expect(check(verificationChecks(x, ok, [failed], 403, now), 'captions').result).toBe('fail');
  });

  it('the uploaded file must be the packaged build', () => {
    expect(check(verificationChecks(x, { ...ok, fileSize: x.file!.size + 1 }, [track], 403, now), 'file').result).toBe(
      'fail',
    );
    expect(check(verificationChecks({ ...x, file: null }, ok, [track], 403, now), 'file').result).toBe('skip');
  });

  it('restrictions and declarations name what is set', () => {
    const c = verificationChecks(
      x,
      { ...ok, ytRating: 'ytAgeRestricted', embeddable: false, madeForKids: true },
      [track],
      403,
      now,
    );
    expect(check(c, 'restrictions').result).toBe('fail');
    expect(check(c, 'restrictions').detail).toContain('age-restricted');
    expect(check(c, 'restrictions').detail).toContain('embedding off');
    expect(check(c, 'declarations').result).toBe('fail');
    expect(check(c, 'declarations').detail).toContain('made for kids');
  });

  it('a Short has no chapters to check and a deleted video fails only exists', () => {
    expect(check(verificationChecks({ ...x, chapters: [] }, ok, [track], 403, now), 'chapters').result).toBe('skip');
    const gone = verificationChecks(x, null, null, 404, now);
    expect(gone.filter((k) => k.result === 'fail').map((k) => k.name)).toEqual(['exists']);
    expect(check(gone, 'public').result).toBe('pass');
    expect(gone.filter((k) => k.name !== 'exists' && k.name !== 'public').every((k) => k.result === 'skip')).toBe(true);
  });

  it('chapterLines reads m:ss and h:mm:ss lines only', () => {
    expect(chapterLines('Intro\n0:00 Hook\n4:22 Q2\n1:02:03 Long\nnot 1:00')).toEqual([
      { stamp: '0:00', title: 'Hook' },
      { stamp: '4:22', title: 'Q2' },
      { stamp: '1:02:03', title: 'Long' },
    ]);
  });
});

describe('expectedOf', () => {
  const fixtures: Fixture[] = [];
  afterAll(() => fixtures.forEach((f) => f.cleanup()));

  it('reads the package, the ledger and the mp4 on disk', () => {
    const f = syntheticProduction('packaged', { release: true });
    fixtures.push(f);
    const review = join(f.dir, 'video', 'review');
    const bytes = Buffer.alloc(512, 1);
    writeFileSync(join(review, 'fixture.mp4'), bytes);
    const rp = JSON.parse(readFileSync(join(review, 'review.json'), 'utf8')) as Record<string, unknown>;
    const chapters = [
      { stamp: '0:00', title: 'Hook' },
      { stamp: '0:40', title: 'The bills' },
    ];
    writeFileSync(join(review, 'review.json'), JSON.stringify({ ...rp, chapters, mp4Sha: sha(bytes) }));
    recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'studio00001' });
    const e = expectedOf(openOutput(f.topic, f.story, { root: f.root }))!;
    expect(e).toMatchObject({
      visibility: 'private',
      publishAt: null,
      title: rp.title,
      chapters,
      category: '27',
      language: 'en',
      captionsLanguage: 'en',
      thumbnail: true,
      syntheticMedia: false,
    });
    expect(e.file!.size).toBe(statSync(join(review, 'fixture.mp4')).size);
  });
});
