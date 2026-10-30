// The review page's model: the packaged build with its findings placed in the video, the ledger's decisions per build,
// what a person can do next and why not, and the reviewer's notes parsed back to places.
import { writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../src/shared/io';
import {
  type Ledger,
  addOutputTo,
  loadLedger,
  publishPath,
  recordApproved,
  recordChangesRequested,
  recordUploaded,
  saveLedger,
} from '../src/modules/publishing/publish';
import { parseNotes, reviewMediaHref, reviewView } from '../src/lib/review-view';
import { href } from '../src/lib/url';
import { type Fixture, setLook, syntheticProduction, syntheticShort } from './production-helpers';

const now = new Date('2026-10-26T00:00:00Z');
const timeline = {
  fps: 30,
  scenes: [
    { id: 'sc01', start: 0, sentences: [{ id: 's01', start: 0, text: 'First.' }] },
    { id: 'sc02', start: 60, sentences: [{ id: 's02', start: 60, text: 'Second.' }] },
  ],
};
/** A fixture with a timeline and a build report whose QA failed on s02. */
function placed<F extends Fixture>(f: F, qaFailed = true): F {
  writeFileSync(join(f.dir, 'video', 'timeline.json'), JSON.stringify(timeline));
  const rp = join(f.dir, 'video', 'build-report.json');
  const report = readJson<Record<string, unknown>>(rp)!;
  const checks = [
    { name: 'mp4 decodable', ok: true, detail: '10s' },
    ...(qaFailed
      ? [{ name: 'narration not truncated', ok: false, detail: 's02', scene: 'sc02', sentence: 's02' }]
      : []),
  ];
  writeFileSync(rp, JSON.stringify({ ...report, qa: { ok: !qaFailed, checks } }));
  return f;
}
const run = <F extends Fixture, T>(f: F, body: (f: F) => T) => {
  try {
    return body(f);
  } finally {
    f.cleanup();
  }
};

describe('reviewView', { timeout: 30_000 }, () => {
  it('links a failed QA check to its sentence and sorts it first', () =>
    run(placed(syntheticProduction('packaged', { release: true })), (f) => {
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.findings[0]).toMatchObject({ source: 'qa', severity: 'blocking' });
      expect(v.findings[0].at).toMatchObject({ seconds: 2, scene: 'sc02', sentence: 's02' });
      expect(v.sentences.map((s) => s.id)).toEqual(['s01', 's02']);
      expect(v.pkg).toMatchObject({ status: 'release', mp4Sha: 'releasesha', portrait: false });
      expect(v.kind).toBe('youtube-video');
    }));

  it('explains that a build with an older look cannot be approved', () =>
    run(syntheticProduction('packaged', { release: true }), (f) => {
      expect(reviewView(f.topic, f.story, f.root).can.approve).toBe(true);
      setLook(f.dir, 'old');
      // the way forward is named: the release re-render
      expect(reviewView(f.topic, f.story, f.root).can.approve).toMatch(
        new RegExp(`rendered with look old.*npm run video -- final ${f.topic} ${f.story} --approved-by`),
      );
    }));

  it('keeps every build in the history, newest first, the current one marked', () =>
    run(placed(syntheticProduction('packaged', { release: true })), (f) => {
      const note = { text: 'cut it' };
      const l: Ledger = loadLedger(f.topic, f.story, f.root) ?? { video: `${f.topic}/${f.story}`, outputs: {} };
      l.outputs.youtube = {
        kind: 'youtube-video',
        metadata: {},
        events: [{ at: '2026-10-20T00:00:00Z', type: 'changes-requested', by: 'Jon', build: 'old1', notes: [note] }],
      };
      saveLedger(publishPath(f.topic, f.story, f.root), l);
      recordChangesRequested(f.topic, f.story, { root: f.root, by: 'Jon', now, build: 'releasesha', notes: [note] });
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.history.map((h) => [h.build, h.current])).toEqual([
        ['releasesha', true],
        ['old1', false],
      ]);
      expect(v.state?.status).toBe('changes-requested');
    }));

  it('explains why a draft cannot be approved and why nothing goes live before approval', () =>
    run(placed(syntheticProduction('packaged'), false), (f) => {
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.can.approve).toMatch(/draft/);
      expect(v.can.acceptDraft).toBe(true);
      expect(v.can.requestChanges).toBe(true);
      expect(v.can.goLive).toMatch(/approv/);
    }));

  it('an uploaded, approved release build can go live', () =>
    run(placed(syntheticProduction('packaged', { release: true }), false), (f) => {
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'aaaaaaaaaaa' });
      expect(reviewView(f.topic, f.story, f.root).can.goLive).toMatch(/approv/);
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.can.goLive).toBe(true);
      expect(v.can.approve).toMatch(/already/);
      expect(v.can.upload).toMatch(/uploaded/);
    }));

  it('without a package every action explains itself', () =>
    run(syntheticProduction('locked'), (f) => {
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.pkg).toBeNull();
      for (const why of Object.values(v.can)) expect(typeof why).toBe('string');
    }));

  it("a Short's view reads its own package, and it cannot go live before its parent", () =>
    run(placed(syntheticShort('packaged', { release: true })), (f) => {
      const source = relative(f.root, f.dir).split(sep).join('/');
      addOutputTo(f.topic, f.parent, 'short:fixture-short', 'youtube-short', {
        derivedFrom: 'youtube',
        source,
        root: f.root,
      });
      recordUploaded(f.topic, f.story, { root: f.root, by: 'Jon', now, id: 'bbbbbbbbbbb' });
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      let v = reviewView(f.topic, f.story, f.root);
      expect(v).toMatchObject({ kind: 'youtube-short', output: 'short:fixture-short' });
      expect(v.pkg).toMatchObject({ mp4Sha: 'shortreleasesha' });
      expect(v.parent?.storyId).toBe(f.parent);
      expect(v.can.goLive).toMatch(/youtube first/);
      // the parent goes live (recorded by hand here), then the Short may
      const ledger = loadLedger(f.topic, f.parent, f.root)!;
      ledger.outputs.youtube.events.push({
        at: '2026-10-26T00:00:01Z',
        type: 'published',
        by: 'Jon',
        id: 'ccccccccccc',
      });
      saveLedger(publishPath(f.topic, f.parent, f.root), ledger);
      // its description now links the live parent, so the metadata is pushed before it goes live
      v = reviewView(f.topic, f.story, f.root);
      expect(v.can.goLive).toMatch(/Push metadata/);
      const parentView = reviewView(f.topic, f.parent, f.root);
      expect(parentView.shorts).toEqual([expect.objectContaining({ storyId: f.story, status: 'metadata-behind' })]);
    }));
});

describe('parseNotes', () => {
  const v = {
    sentences: [{ id: 's31', text: 'x', at: { label: 's31', seconds: 239.5, scene: 'sc20', sentence: 's31' } }],
    scenes: [{ label: 'sc20', seconds: 230, scene: 'sc20' }],
  };
  it('reads the place a line starts with', () => {
    expect(parseNotes('[3:59 sc20 s31] too fast\n\n  plain note  ', v)).toEqual([
      { text: 'too fast', seconds: 239, scene: 'sc20', sentence: 's31' },
      { text: 'plain note' },
    ]);
  });
  it('fills the time and scene from a bare sentence or scene id; an unknown id stays text', () => {
    expect(parseNotes('s31 louder', v)).toEqual([{ text: 'louder', seconds: 239.5, scene: 'sc20', sentence: 's31' }]);
    expect(parseNotes('sc20 darker', v)).toEqual([{ text: 'darker', seconds: 230, scene: 'sc20' }]);
    expect(parseNotes('s99 what', v)).toEqual([{ text: 's99 what' }]);
  });
});

describe('review fixes', () => {
  it('a release build approved before its upload can be uploaded from the page', () =>
    run(placed(syntheticProduction('packaged', { release: true }), false), (f) => {
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      const v = reviewView(f.topic, f.story, f.root);
      expect(v.state?.status).toBe('approved');
      expect(v.can.upload).toBe(true);
    }));
  it('shows the composed title, the one an approval binds', () =>
    run(placed(syntheticProduction('packaged', { release: true }), false), (f) => {
      recordApproved(f.topic, f.story, { root: f.root, by: 'Jon', now });
      const l = loadLedger(f.topic, f.story, f.root)!;
      l.outputs.youtube.metadata.title = 'Override';
      saveLedger(publishPath(f.topic, f.story, f.root), l);
      expect(reviewView(f.topic, f.story, f.root).title).toBe('Override');
    }));
});

it('reviewMediaHref names the packaged file of a story folder', () => {
  expect(reviewMediaHref('heat-pumps', 'some-slug')).toBe(href('/heat-pumps/review-media/review.mp4/some-slug'));
});
