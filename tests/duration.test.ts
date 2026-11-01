// Acceptance criterion 17 (Milestone 2): a target duration shapes the narrative by band; the standards do not move.
import { describe, expect, it } from 'vitest';
import { BANDS, bandOf, runtimeProblem, runtimeWindow, wordsBudget } from '../src/shared/duration';
import { validateScript } from '../src/shared/sentence-validation';
import { sentenceFingerprint, sentences } from '../src/shared/sentences';
import type { EvidencePackage, Script, Sentence } from '../src/shared/types';
import { buildStoryboard } from '../src/modules/storyboard';
import { buildPackage } from '../src/modules/script';
import { discover } from '../src/modules/stories';
import { videoChecks } from '../src/modules/video/qa';
import type { Timeline } from '../src/modules/video/types';
import { articleIssues, validateArticle } from '../src/modules/article/validation';
import { article } from '../src/modules/article/tests/article-helpers';
import { discoverShorts, buildShortPackage } from '../src/modules/shorts';
import { asTopic, corpus, fact, good, hashOf, pkg, plan, read, review, scene, sentence, t } from './script-helpers';

const withTarget = (q: EvidencePackage, target: number): EvidencePackage => ({ ...q, targetDurationSeconds: target });
const run = (s: Script, q: EvidencePackage) => validateScript(s, corpus(), read, { pkg: q, hashDoc: hashOf(q) });
const blockingCats = (v: ReturnType<typeof run>) =>
  v.issues.filter((i) => i.severity === 'blocking').map((i) => i.category);

const three = (): Sentence[] => [
  sentence(
    's01',
    'Say you join under a friend who promises you an income from selling and recruiting.',
    'hypothetical',
  ),
  sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
    fact('s02.a', 'Of 601 participants, 47% reported losing money.'),
  ]),
  sentence('s03', 'So what does that leave for the ordinary recruit who signs up?', 'rhetorical'),
];
const micro = (target = 15): Script => ({
  ...good(),
  targetDurationSeconds: target,
  sections: [{ name: 'answer', sentences: three() }],
});
const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const fiveSections = (target: number): Script => ({
  ...good(),
  targetDurationSeconds: target,
  sections: [
    { name: 'hook', sentences: [sentence('h1', `Hook. ${filler(80)}.`, 'rhetorical')] },
    { name: 'setup', sentences: [sentence('u1', `Setup. ${filler(80)}.`, 'hypothetical')] },
    { name: 'investigation', sentences: three() },
    { name: 'answer', sentences: [sentence('a1', `Answer. ${filler(100)}.`, 'rhetorical')] },
    { name: 'takeaway', sentences: [sentence('t1', `Takeaway. ${filler(100)}.`, 'rhetorical')] },
  ],
});

describe('bands and tolerance', () => {
  it("maps a target to a band, and no target to today's rules", () => {
    expect(bandOf(15)).toBe('micro');
    expect(bandOf(5)).toBe('micro');
    expect(bandOf(90)).toBe('short');
    expect(bandOf(300)).toBe('standard');
    expect(bandOf(900)).toBe('long');
    expect(bandOf(undefined)).toBeNull();
  });
  it('tolerates the larger of 35% and 3 s', () => {
    expect(runtimeWindow(15)).toEqual([9.75, 20.25]);
    expect(runtimeWindow(600)).toEqual([390, 810]);
    expect(runtimeWindow(6)).toEqual([3, 9]);
    expect(runtimeProblem(25, 15)).toMatch(/25.*15/);
    expect(runtimeProblem(14, 15)).toBeNull();
    expect(runtimeProblem(25, undefined)).toBeNull();
    expect(wordsBudget(60, 150)).toEqual([98, 203]);
  });
  it('a Short of a micro parent targets the smaller of 8 s and half the parent, one at most', () => {
    expect(BANDS.micro.shorts.max).toBe(1);
    expect(BANDS.micro.shorts.targetOf(15)).toBe(7.5);
    expect(BANDS.micro.shorts.targetOf(20)).toBe(8);
    expect(BANDS.short.shorts.targetOf(60)).toBe(30);
    expect(BANDS.standard.shorts.targetOf(300)).toBeNull();
  });
});

describe('the script by band', () => {
  it('blocks a five-section 400-word script under a 15 s target, and passes a one-section three-sentence one', () => {
    const q = withTarget(pkg(), 15);
    const bad = blockingCats(run(fiveSections(15), q));
    expect(bad).toContain('sections');
    expect(bad).toContain('words');
    const ok = blockingCats(run(micro(), q));
    expect(ok).not.toContain('sections');
    expect(ok).not.toContain('words');
    expect(ok).not.toContain('sentences');
  });
  it('blocks the short script under a 30-minute target (words), never by structure alone', () => {
    const q = withTarget(pkg(), 1800);
    const v = run({ ...micro(1800), sections: [{ name: 'hook', sentences: three() }] }, q);
    expect(blockingCats(v)).toContain('words');
  });
  it("requires the script to carry the package's target", () => {
    const q = withTarget(pkg(), 15);
    const v = run({ ...micro(), targetDurationSeconds: undefined }, q);
    expect(blockingCats(v)).toContain('duration');
  });
  it('judges the same sentences identically under micro and long: the gate and the fingerprints do not move', () => {
    const s = three();
    const a = run({ ...micro(15), sections: [{ name: 'answer', sentences: s }] }, withTarget(pkg(), 15));
    const b = run({ ...micro(1800), sections: [{ name: 'answer', sentences: s }] }, withTarget(pkg(), 1800));
    // What the band is allowed to change: proportion, the plain form's sections and the pacing warnings.
    const DURATION = new Set([
      'sections',
      'words',
      'sentences',
      'duration',
      'structure',
      'slow-start',
      'number-dense',
      'repetition',
    ]);
    const strip = (v: typeof a) => ({
      statuses: v.sentences.map((x) => x.assertions.map((y) => [y.id, y.status, y.issues])),
      fps: v.sentences.map((x) => x.fingerprint),
      issues: v.issues.filter((i) => !DURATION.has(i.category)),
    });
    expect(strip(a)).toEqual(strip(b));
    expect(a.sentences.map((x) => x.fingerprint)).toEqual(s.map(sentenceFingerprint));
  });
  it("keeps only the band's pacing checks", () => {
    const slow = (target: number): Script => ({
      ...good(),
      targetDurationSeconds: target,
      sections: [
        { name: 'hook', sentences: [sentence('h1', `Hook. ${filler(200)}.`, 'rhetorical')] },
        { name: 'answer', sentences: three() },
      ],
    });
    const cats = (v: ReturnType<typeof run>) => v.issues.map((i) => i.category);
    expect(cats(run(slow(300), withTarget(pkg(), 300)))).toContain('slow-start');
    expect(cats(run(slow(15), withTarget(pkg(), 15)))).not.toContain('slow-start');
  });
});

describe('downstream artifacts by band', () => {
  it('the storyboard allows at most two scenes for a micro story', () => {
    const q = withTarget(pkg(), 15);
    const s = micro();
    const v = run(s, q);
    const two = buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'])], s), s, v, q, read);
    expect(two.issues.map((i) => i.category)).not.toContain('scenes');
    expect(two.targetDurationSeconds).toBe(15);
    const three = buildStoryboard(
      plan([scene('sc1', ['s01']), scene('sc2', ['s02']), scene('sc3', ['s03'])], s),
      s,
      v,
      q,
      read,
    );
    expect(three.issues.filter((i) => i.severity === 'blocking').map((i) => i.category)).toContain('scenes');
  });
  it('QA fails a measured runtime outside the tolerance and passes one inside; no target is informational', () => {
    const fps = 30;
    const tl = (target?: number, endSeconds = 10): Timeline =>
      ({
        fps,
        width: 1920,
        height: 1080,
        durationInFrames: 0,
        scenes: [
          { id: 'sc1', kind: 'typography', start: 0, duration: 0 },
          { id: 'end', kind: 'close-card', start: 0, duration: endSeconds * fps },
        ],
        ...(target !== undefined && { targetDurationSeconds: target }),
      }) as unknown as Timeline;
    const probe = (seconds: number) => ({ duration: seconds, video: null, audio: null });
    const runtime = (p: ReturnType<typeof probe>, t: Timeline) => videoChecks(p, t).find((c) => c.name === 'runtime')!;
    expect(runtime(probe(35), tl(15)).ok).toBe(false); // 25 s narrated
    expect(runtime(probe(24), tl(15)).ok).toBe(true); // 14 s narrated
    expect(runtime(probe(35), tl()).ok).toBe(true);
    expect(runtime(probe(35), tl()).detail).toMatch(/no target/);
  });
  it('a micro article is one paragraph without tables; a short one two to four', () => {
    const base = article();
    const cats = (a: typeof base, target: number) =>
      articleIssues(a, withTarget(pkg(), target), read, { script: null, figures: new Set() })
        .filter((i) => i.severity === 'blocking')
        .map((i) => i.category);
    expect(cats(base, 15)).toContain('proportion'); // two prose blocks
    const one = { ...base, sections: [base.sections[1]] };
    expect(cats(one, 15)).not.toContain('proportion');
    const table = {
      ...one,
      sections: [
        {
          ...one.sections[0],
          blocks: [
            ...one.sections[0].blocks,
            { kind: 'table' as const, id: 'tb1', caption: 'c', columns: [], rows: [] },
          ],
        },
      ],
    };
    expect(cats(table, 15)).toContain('proportion');
    expect(cats(one, 60)).toContain('proportion'); // one paragraph is too few for short
    expect(cats(base, 60)).not.toContain('proportion');
  });
  it("an article is proportioned by its paragraphs, never by the script's words budget or target copy", () => {
    // the first real fixture run blocked its article four times on "copy targetDurationSeconds from the package"
    const base = article();
    const one = { ...base, sections: [base.sections[1]] };
    const v = validateArticle(one, corpus(), read, {
      pkg: withTarget(pkg(), 15),
      hashDoc: hashOf(pkg()),
      review: null,
      script: null,
      figures: new Set(),
    });
    const cats = v.issues.map((i) => i.category);
    expect(cats).not.toContain('duration');
    expect(cats).not.toContain('words');
    expect(cats).not.toContain('sections');
    expect(cats).not.toContain('sentences');
  });
  it("the review's target rides on the story and the package", () => {
    const r = {
      ...review,
      stories: {
        ...review.stories,
        'decision:mlm-and-seminars': { ...review.stories!['decision:mlm-and-seminars'], targetDurationSeconds: 15 },
      },
    };
    const s = discover(t(), read, r).stories.find((x) => x.id === 'decision:mlm-and-seminars')!;
    expect(s.targetDurationSeconds).toBe(15);
    const q = buildPackage(s, asTopic(t()), read, { review: r });
    expect(q.targetDurationSeconds).toBe(15);
    expect(pkg().targetDurationSeconds).toBeUndefined();
    expect('targetDurationSeconds' in pkg()).toBe(false);
  });
  it('a micro parent yields at most one Short, targeted at 7.5 s', () => {
    const q = withTarget(pkg(), 15);
    const s = micro();
    const v = validateScript(s, corpus(), read, {
      pkg: q,
      hashDoc: hashOf(q),
      review: {
        reviewer: 'r',
        date: 'd',
        revision: 1,
        packageFingerprint: q.fingerprint,
        approved: Object.fromEntries(sentences(s).map((x) => [x.id, sentenceFingerprint(x)])),
        findings: [],
      },
    });
    expect(v.status).toBe('passed');
    const sb = buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'])], s), s, v, q, read);
    const file = discoverShorts(
      { script: s, v, sb, pkg: q, release: null },
      { candidates: { s01: { keep: true, slug: 'one', format: 'THE COMMISSION FINDS', hook: 'Hook', carries: [] } } },
    );
    const c = file.candidates.find((x) => x.key === 's01')!;
    expect(c).toBeDefined();
    expect(c.blocking.filter((b) => /cap of/.test(b))).toEqual([]);
    const ready = { ...c, readiness: 'ready' as const, blocking: [] };
    const shortPkg = buildShortPackage(q, ready, {
      ...file,
      parentFingerprints: { ...file.parentFingerprints, package: q.fingerprint },
    });
    expect(shortPkg.targetDurationSeconds).toBe(7.5);
  });
});
