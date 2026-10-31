import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ShortBlock } from '../../../shared/types';
import { site } from '../../../config/site';
import { type BuildReport, buildReport } from '../../video/report';
import { checkSegment } from '../../video/select';
import { buildTimeline } from '../../video/timeline';
import type { Timeline } from '../../video/types';
import { inputs, manifest } from '../../video/tests/video-helpers';
import {
  CHECKLIST,
  DRAFT_CHECK,
  REVIEW_FILES,
  type DescriptionLinks,
  SHORT_CHECK,
  chapters,
  renderChecklist,
  renderDescription,
  renderReadme,
  reviewData,
  reviewInputProblem,
  reviewMp4Name,
  thumbnailScene,
} from '../package';

describe('review package chapters', () => {
  const tl = (): Timeline => {
    const t = buildTimeline(checkSegment(inputs()), manifest(inputs()));
    // stretch the fixture's scenes to 20 s each so the YouTube 10 s rule is not what is being tested
    t.scenes.forEach((s, i) => Object.assign(s, { start: i * 600, duration: 600 }));
    return { ...t, durationInFrames: t.scenes.length * 600 };
  };
  const seg = (ch?: Record<string, string>) => checkSegment(inputs({ config: ch ? { chapters: ch } : {} }));
  it('takes render.json chapters at measured starts, first pinned to 0:00', () => {
    const c = chapters(seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' }), tl());
    expect(c.map((x) => [x.stamp, x.title])).toEqual([
      ['0:00', 'One'],
      ['0:20', 'Two'],
      ['0:40', 'Three'],
    ]);
  });
  it('refuses chapters YouTube would ignore, and scenes that are not there', () => {
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two' }), tl())).toThrow(/at least 3/);
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two', sc99: 'X' }), tl())).toThrow(/sc99, not in the timeline/);
    const tight = tl();
    tight.scenes[1].start = 150; // 5 s after the first
    expect(() => chapters(seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' }), tight)).toThrow(/under 10 s: Two/);
  });
  it('packages only the mp4 QA checked, and renders every file from the package data', () => {
    const s = seg({ sc01: 'One', sc02: 'Two', sc03: 'Three' });
    const t = tl();
    const built = buildReport(
      s,
      t,
      manifest(inputs()),
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      { ok: true, checks: [], frames: [] },
      'cmd',
    );
    const report: BuildReport = { ...built, output: { ...built.output!, sha: 'checked' } };
    expect(reviewInputProblem(report, 'checked')).toBeNull();
    expect(reviewInputProblem(report, 'other')).toMatch(/not the file QA checked/);
    expect(reviewInputProblem(report, null)).toMatch(/render first/);
    expect(reviewInputProblem({ ...report, qa: { ...report.qa, ok: false } }, 'checked')).toMatch(/QA failed/);
    const made = {
      mp4: 'x-review-private.mp4',
      mp4Sha: 'checked',
      buildReport: 'b',
      thumbnailSha: null,
      captionsSha: null,
      generatedAt: 'd',
    };
    const pkg = reviewData(s, t, report, made);
    expect(pkg.chapters.map((c) => c.title)).toEqual(['One', 'Two', 'Three']);
    expect(pkg.files).not.toContain(REVIEW_FILES.thumbnail);
    expect(pkg.thumbnailSha).toBeNull();
    const withCard = reviewData(s, t, report, { ...made, thumbnailSha: 'card1' });
    expect(withCard.thumbnailSha).toBe('card1');
    expect(withCard.files).toContain(REVIEW_FILES.thumbnail);
    expect(pkg.captionsSha).toBeNull();
    expect(pkg.files).not.toContain(REVIEW_FILES.captions);
    const withCaptions = reviewData(s, t, report, { ...made, captionsSha: 'cap1' });
    expect(withCaptions.captionsSha).toBe('cap1');
    expect(withCaptions.files).toContain('captions.en.srt');
    expect(renderDescription(pkg, s, t, report)).toContain('0:20 Two');
    expect(renderReadme(pkg, t, report)).toContain(made.mp4);
    expect(renderChecklist(pkg, t)).toContain(CHECKLIST[0]);
    expect(pkg.status).toBe('private review build');
    expect(pkg.title).toMatch(/^\[PRIVATE REVIEW\]/);
    expect(pkg.checklist).toContain(DRAFT_CHECK);
    expect(renderDescription(pkg, s, t, report)).toMatch(/^PRIVATE REVIEW BUILD/);
    expect(reviewMp4Name(join('t', 'scripts', 'x', 'video'))).toBe('x-review-private.mp4');
    // a cleared build (what `final` produces) is the release package: no private banner, no draft-voice check
    const cleared: BuildReport = {
      ...report,
      narration: { ...report.narration, publishable: true },
      clearance: { narration: true, music: true, publishable: true, why: [] },
    };
    const rel = reviewData(s, t, cleared, { ...made, mp4: 'x.mp4' });
    expect(rel.status).toBe('release build');
    expect(rel.title).toBe(t.title);
    expect(rel.checklist).not.toContain(DRAFT_CHECK);
    const desc = renderDescription(rel, s, t, cleared);
    expect(desc).not.toMatch(/PRIVATE|DRAFT|Narration|clearance/i);
    expect(desc).toContain('0:20 Two');
    // the description fits YouTube's 5000 bytes: the sources live on the site, one link replaces the list
    expect(desc).toContain(`${site.url}${t.topic}/`);
    expect(desc).not.toContain('Sources discussed');
    expect(Buffer.byteLength(desc, 'utf8')).toBeLessThan(5000);
    expect(renderReadme(withCaptions, t, report)).toContain('captions.en.srt');
    expect(renderReadme(rel, t, cleared)).toMatch(/^# RELEASE BUILD/);
    expect(renderReadme(rel, t, cleared)).toContain('**public**');
    expect(renderReadme(rel, t, cleared)).toContain('npm run publish -- approve');
    expect(renderReadme(rel, t, cleared)).not.toContain('production.json');
    expect(renderReadme(pkg, t, report)).toContain('npm run publish -- uploaded');
    expect(renderChecklist(rel, t)).toContain('release build');
    expect(reviewMp4Name(join('t', 'scripts', 'x', 'video'), true)).toBe('x.mp4');
    expect(thumbnailScene(t)).toBeNull(); // the fixture has no title card
  });
});

describe('a short review package', () => {
  const short: ShortBlock = {
    parent: 'decision:mlm-and-seminars',
    key: 's02',
    slug: 'my-short',
    format: 'ONE FIGURE FROM THE RECORD',
    sentences: ['s02'],
    hook: 'Nearly half of them lost money.',
    carries: [],
    maxSeconds: 170,
    parentFingerprints: { package: 'p', script: 's', release: 'r' },
  };
  const shortInputs = () => {
    const inp = inputs({ config: { scenes: ['sc03'] } });
    return { ...inp, pkg: { ...inp.pkg, short } };
  };
  it('has no chapters, the short check, a #Shorts description with the full inquiry, and its own file name', () => {
    const s = checkSegment(shortInputs());
    const t = buildTimeline(s, manifest(shortInputs()));
    expect(t.height).toBeGreaterThan(t.width);
    const built = buildReport(
      s,
      t,
      manifest(shortInputs()),
      { file: 'x.mp4', probe: null, renderSeconds: 1 },
      { ok: true, checks: [], frames: [] },
      'cmd',
    );
    const report: BuildReport = { ...built, output: { ...built.output!, sha: 'checked' } };
    const made = {
      mp4: 'parent-short-my-short-review-private.mp4',
      mp4Sha: 'checked',
      buildReport: 'b',
      thumbnailSha: null,
      captionsSha: 'c',
      generatedAt: 'd',
    };
    const pkg = reviewData(s, t, report, made);
    expect(pkg.chapters).toEqual([]);
    expect(pkg.short).toEqual({ parent: short.parent, slug: 'my-short', format: short.format, fullVideo: null });
    expect(pkg.checklist).toContain(SHORT_CHECK);
    expect(pkg.checklist.at(-1)).toBe(DRAFT_CHECK);
    const d = renderDescription(pkg, s, t, report);
    expect(d).toContain('Nearly half of them lost money.');
    expect(d).toContain('#Shorts');
    expect(d).not.toContain('Chapters');
    // the parent's matter page comes in the links (descriptionLinks, tests/links.test.ts); the uploader adds the video
    const parent: DescriptionLinks = {
      cta: 'default',
      links: [{ type: 'parent-matter', node: null, url: 'https://x/heat-pumps/a/', text: 'Full inquiry' }],
    };
    expect(renderDescription(pkg, s, t, report, parent)).toContain('Full inquiry: https://x/heat-pumps/a/');
    expect(reviewMp4Name(join('t', 'scripts', 'parent', 'shorts', 'my-short', 'video'), true)).toBe(
      'parent-short-my-short.mp4',
    );
    expect(reviewMp4Name(join('t', 'scripts', 'parent', 'shorts', 'my-short', 'video'))).toBe(
      'parent-short-my-short-review-private.mp4',
    );
    expect(thumbnailScene({ ...t, scenes: [{ ...t.scenes[0], kind: 'short-title' }] })?.kind).toBe('short-title');
    expect(thumbnailScene(t)).toBeNull();
  });
});
