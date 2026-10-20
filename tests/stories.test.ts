import { describe, expect, it } from 'vitest';
import type { ReviewFile } from '../src/lib/review';
import { discover, loadStories, staleReviewIds, storyTopicNames } from '../src/lib/stories';
import { loadTopic } from '../src/lib/topics';
import { loadReview } from '../src/lib/review';
import { DOC_A, DOC_B, DOC_C, claim, guess, reader, sources, study, topic } from './corpus';

const FASTER = 'AI tools make experienced developers faster';
const LABELS =
  /\bexpected \w+, found\b|what the evidence says|the evidence says no|say yes|say no|\b(contradicted|surprise|gap|conflict|decision):/i;

const popularWrong = () =>
  claim('tenx', 'Engineers using AI agents are ten times as productive', {
    verdicts: [
      guess('wrong', 0.5),
      study('Field C', 'wrong', 0.7, DOC_C, 'Field C measured an 18% gain, far from ten times.'),
    ],
    sources: sources(6),
    lean: 'pro-hype',
  });
const conflicted = () =>
  claim('faster', FASTER, {
    verdicts: [guess('right', 0.5), study('RCT A', 'right', 0.7, DOC_A), study('Field C', 'wrong', 0.6, DOC_C)],
    sources: [...sources(4), ...sources(2, 'denies')],
  });
const gap = () =>
  claim('review', 'AI code review catches real bugs', {
    verdicts: [guess('right', 0.6)],
    sources: sources(7),
    lean: 'pro',
  });
const supported = () =>
  claim('tests', 'Fast test feedback raises AI code quality', {
    verdicts: [study('RCT A', 'right', 0.7, DOC_A)],
    sources: sources(3),
  });
// Two subjects that share a recap group but not a question.
const mlm = () =>
  claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
    verdicts: [study('RCT A', 'right', 0.7, DOC_A), study('Survey B', 'right', 0.6, DOC_B)],
    sources: sources(5),
    lean: 'skeptic',
  });
const rental = () =>
  claim('rental-leverage', 'Rental property lets investors borrow against appreciation', {
    verdicts: [study('Field C', 'partly', 0.5, DOC_C)],
    sources: sources(3),
  });
const betting = () =>
  claim('sports-betting', 'Sports betting apps turn a profit for most users', {
    verdicts: [study('Survey B', 'wrong', 0.6, DOC_B)],
    sources: sources(3),
  });
const dayTrading = () =>
  claim('day-trading', 'Most retail day traders lose money', {
    verdicts: [guess('partly', 0.4), study('RCT A', 'right', 0.7, DOC_A), study('Field C', 'right', 0.7, DOC_C)],
    sources: sources(6),
    lean: 'skeptic',
  });

describe('story discovery', () => {
  it('turns related claims into an audited candidate with every field a producer needs', () => {
    const t = topic(
      [popularWrong(), conflicted(), gap(), supported()],
      [{ title: 'Is it worth adopting?', claims: [conflicted(), popularWrong(), supported()] }],
    );
    const { stories } = discover(t, reader);
    const decision = stories.find((s) => s.kind === 'decision')!;
    expect(decision.claims).toHaveLength(3);
    expect(decision.audit.findings).toHaveLength(3);
    expect(decision.readiness).toBe('needs-review'); // a cluster is not ready until a reviewer confirms its question
    expect(decision.blocking.join(' ')).toMatch(/reviewer/);
    for (const s of stories) {
      expect(s.scores.overall).toBeLessThanOrEqual(1);
      expect(s.scores.editorial).toBeLessThanOrEqual(1);
      expect(s.question).toMatch(/\?$/);
      expect(s.alternates).toHaveLength(2);
      expect(s.whyWatch && s.tension && s.evidenceNeeded && s.coherence.explanation).toBeTruthy();
      expect(['ready', 'needs-review', 'needs-research']).toContain(s.readiness);
      expect(s.scores.explanation).toMatch(/not audience data/);
      if (s.readiness !== 'ready') expect(s.blocking.length).toBeGreaterThan(0);
    }
  });

  it('1. an MLM cluster does not keep rental-property claims once reviewed; unreviewed it cannot be ready', () => {
    const t = () => topic([mlm(), rental()], [{ title: 'MLM and seminars', claims: [mlm(), rental()] }]);
    const raw = discover(t(), reader).stories.find((s) => s.kind === 'decision')!;
    expect(raw.claims).toEqual(['demo/mlm-income', 'demo/rental-leverage']);
    expect(raw.readiness).toBe('needs-review');
    expect(raw.coherence.basis).toBe('heuristic');
    expect(raw.coherence.explanation).toMatch(/No shared wording/);
    const review: ReviewFile = {
      stories: {
        'decision:mlm-and-seminars': {
          coherence: { score: 0.9, reason: 'One question: how much do MLM participants make?' },
          claims: ['demo/mlm-income'],
          question: 'How much money do MLM participants actually make?',
          title: 'How Much Money Do MLM Participants Actually Make?',
        },
      },
    };
    const reviewed = discover(t(), reader, review).stories.find((s) => s.kind === 'decision')!;
    expect(reviewed.claims).toEqual(['demo/mlm-income']);
    expect(reviewed.title).toBe('How Much Money Do MLM Participants Actually Make?');
    expect(reviewed.readiness).toBe('ready');
    expect(reviewed.reviewed).toBe(true);
  });

  it('1b. two documents of one study count once in the audit', () => {
    const review: ReviewFile = {
      stories: {
        'decision:mlm-and-seminars': { coherence: { score: 0.9, reason: 'one question' }, claims: ['demo/mlm-income'] },
      },
    };
    const build = (sameStudy?: Record<string, string>) =>
      discover(
        topic([mlm(), rental()], [{ title: 'MLM and seminars', claims: [mlm(), rental()] }], sameStudy),
        reader,
        review,
      ).stories.find((s) => s.kind === 'decision')!;
    expect(build().audit.central.independent).toBe(2);
    const deduped = build({ 'survey-b.txt': 'rct-a.txt' });
    expect(deduped.audit.central.independent).toBe(1);
    expect(deduped.scores.explanation).toMatch(/1 independent document/);
  });

  it('2. a day-trading story does not absorb sports betting, and a reviewer can reject the mixed cluster', () => {
    const t = () =>
      topic([dayTrading(), betting()], [{ title: 'Trading and betting', claims: [dayTrading(), betting()] }]);
    const raw = discover(t(), reader);
    const cluster = raw.stories.find((s) => s.kind === 'decision')!;
    expect(cluster.readiness).not.toBe('ready');
    const review: ReviewFile = {
      stories: { 'decision:trading-and-betting': { reject: 'day trading and sports betting are different questions' } },
    };
    const after = discover(t(), reader, review);
    expect(after.stories.find((s) => s.kind === 'decision')).toBeUndefined();
    expect(after.rejected.find((r) => r.id === 'decision:trading-and-betting')?.reason).toMatch(/different questions/);
    // A coherence score below 0.5 rejects too.
    const low = discover(t(), reader, {
      stories: { 'decision:trading-and-betting': { coherence: { score: 0.3, reason: 'two subjects' } } },
    });
    expect(low.rejected.find((r) => r.id === 'decision:trading-and-betting')?.reason).toMatch(/incoherent/);
  });

  it('3. and 4. a base-rate study about one population is context, not proof, for a possibility claim', () => {
    const c = claim(
      'multiply',
      'An experienced day trader can multiply a small account within a month trading momentum stocks',
      {
        verdicts: [
          guess('wrong', 0.5),
          study(
            'Futures study',
            'wrong',
            0.5,
            DOC_C,
            'Among 1,551 futures day traders only 0.5% beat a wage; the setting is index futures rather than momentum stocks.',
          ),
        ],
        sources: sources(4),
        lean: 'pro-hype',
      },
    );
    const { stories } = discover(topic([c]), reader);
    const s = stories.find((x) => x.kind === 'contradicted')!;
    expect(s.audit.central.supporting).toHaveLength(0);
    expect(s.audit.central.context[0].applicability).toBe('contextual');
    expect(s.audit.central.status).toBe('unverified');
    expect(s.readiness).toBe('needs-research');
    expect(s.gaps.join(' ')).toMatch(/context only/);
  });

  it('5. a claim that needs qualification is not approved as worded; accepting the qualifications makes it ready', () => {
    const c = claim('faster', FASTER, {
      verdicts: [
        guess('wrong', 0.5),
        study('Survey B', 'partly', 0.6, DOC_B, 'Gains are real but only for junior staff.'),
      ],
      sources: sources(4),
    });
    const t = () => topic([c]);
    const s = discover(t(), reader).stories.find((x) => x.kind === 'surprise')!;
    expect(s.audit.central.decision).toBe('qualify');
    expect(s.readiness).toBe('needs-review');
    expect(s.blocking.join(' ')).toMatch(/needs review/);
    const ok = discover(t(), reader, {
      stories: { [s.id]: { qualificationsAccepted: true, premise: 'Only for junior staff.' } },
    }).stories[0];
    expect(ok.readiness).toBe('ready');
    expect(ok.readinessWhy).toMatch(/accepted qualifications/);
  });

  it('6. a genuine disagreement is a ready story without a definitive conclusion', () => {
    const { stories } = discover(topic([conflicted()]), reader);
    const s = stories.find((x) => x.kind === 'conflict')!;
    expect(s.audit.central.kind).toBe('disagreement');
    expect(s.audit.central.decision).toBe('approved');
    expect(s.readiness).toBe('ready');
    expect(s.title).toMatch(/^Why do studies disagree/);
  });

  it('7. one thin piece of evidence scores less depth than several studies and sources', () => {
    const c = claim('tests', 'Fast test feedback raises AI code quality', {
      verdicts: [guess('partly', 0.4), study('RCT A', 'right', 0.7, DOC_A)],
      sources: sources(3),
    });
    const { stories } = discover(topic([c]), reader);
    const s = stories[0];
    const deep = discover(topic([dayTrading()]), reader).stories[0]; // two studies, six sources, a flip
    expect(s.scores.depth).toBeLessThan(deep.scores.depth);
    expect(s.scores.explanation).toMatch(/1 study/);
  });

  it('8. titles never expose the classifier', () => {
    const t = topic(
      [popularWrong(), conflicted(), gap(), supported(), dayTrading()],
      [{ title: 'Adopt?', claims: [conflicted(), supported()] }],
    );
    for (const s of discover(t, reader).stories)
      for (const title of [s.title, ...s.alternates]) expect(title).not.toMatch(LABELS);
  });

  it('9. a confident AI guess never makes a story ready', () => {
    const c = claim('review', 'AI code review catches real bugs', {
      verdicts: [guess('right', 0.95)],
      sources: sources(7),
    });
    const { stories } = discover(topic([c]), reader);
    expect(stories).toHaveLength(1);
    expect(stories[0].readiness).toBe('needs-research');
    expect(stories[0].scores.evidence).toBe(0);
    expect(stories[0].audit.central.kind).toBe('attribution');
  });

  it('10. repeated runs are stable, ids survive review, and variations are rejected', () => {
    const t = () =>
      topic(
        [popularWrong(), conflicted(), gap(), supported()],
        [{ title: 'Adopt?', claims: [conflicted(), supported()] }],
      );
    const a = discover(t(), reader);
    expect(JSON.stringify(a)).toBe(JSON.stringify(discover(t(), reader)));
    expect(a.stories.map((s) => s.id)).toMatchSnapshot();
    const b = discover(t(), reader, { stories: { 'decision:adopt': { title: 'Should you adopt AI coding tools?' } } });
    expect(b.stories.map((s) => s.id).sort()).toEqual(a.stories.map((s) => s.id).sort());
    // The same claim as both "contradicted" and "surprise": one survives, the other is listed as a variation.
    const flip = claim('tenx', 'Engineers using AI agents are ten times as productive', {
      verdicts: [guess('right', 0.5), study('Field C', 'wrong', 0.7, DOC_C)],
      sources: sources(6),
    });
    const one = discover(topic([flip]), reader);
    expect(one.stories).toHaveLength(1);
    expect(one.rejected[0].reason).toMatch(/variation of/);
  });

  it('a single-claim candidate whose claim sits inside a reviewed hub is subsumed, not duplicated', () => {
    const t = () =>
      topic([popularWrong(), conflicted()], [{ title: 'Adopt?', claims: [popularWrong(), conflicted()] }]);
    const review: ReviewFile = {
      stories: {
        'decision:adopt': { coherence: { score: 0.9, reason: 'one decision' }, qualificationsAccepted: true },
      },
    };
    const f = discover(t(), reader, review);
    expect(f.stories.map((s) => s.id)).toEqual(['decision:adopt']);
    expect(f.rejected.filter((r) => /subsumed by decision:adopt/.test(r.reason)).length).toBeGreaterThanOrEqual(2);
    // Unreviewed, the group cannot subsume anything.
    expect(discover(t(), reader).stories.length).toBeGreaterThan(1);
  });

  it('keeps editorial quality separate from evidence strength', () => {
    const { stories } = discover(topic([popularWrong(), gap()]), reader);
    const g = stories.find((s) => s.kind === 'gap')!;
    expect(g.scores.editorial).toBeGreaterThan(0.4);
    expect(g.scores.evidence).toBe(0);
    expect(g.readiness).toBe('needs-research');
  });

  it('rejects a story whose central conclusion the evidence contradicts', () => {
    const c = claim('faster', FASTER, {
      verdicts: [guess('right', 0.5), study('Survey B', 'wrong', 0.3, DOC_B)],
      sources: sources(3),
      decidedBy: null,
    });
    const { rejected } = discover(topic([c, gap()], [{ title: 'Adopt?', claims: [c, gap()] }]), reader);
    expect(rejected.find((r) => r.id === 'decision:adopt')?.reason).toMatch(/contradicted/);
  });
});

describe('chained questions', () => {
  const corpus = () => topic([conflicted(), dayTrading(), popularWrong()]);
  const ready = () =>
    discover(corpus(), reader)
      .stories.filter((s) => s.readiness === 'ready')
      .map((s) => s.id);
  const chain = (head: string, ids: string[], extra: ReviewFile['stories'] = {}, chainWhy = 'each answer, next') =>
    discover(corpus(), reader, { stories: { [head]: { chain: ids, chainWhy }, ...extra } }).stories.find(
      (s) => s.id === head,
    )!;

  it('a chain of ready stories stays ready and lists the follow-up questions', () => {
    const [a, b] = ready();
    const s = chain(a, [b]);
    expect(s.readiness).toBe('ready');
    expect(s.chain).toEqual([{ id: b, question: expect.any(String) }]);
    const all = discover(corpus(), reader, { stories: { [a]: { chain: [b], chainWhy: 'next' } } }).stories;
    expect(all.find((x) => x.id === b)!.partOf).toBe(a);
    expect(all.find((x) => x.id === b)!.chainCandidates).toBeUndefined();
  });

  it('suggests follow-ups among ready stories that share no claims, without applying them', () => {
    const all = discover(corpus(), reader).stories;
    const suggested = all.filter((s) => s.chainCandidates);
    for (const s of suggested)
      for (const id of s.chainCandidates!) {
        const o = all.find((x) => x.id === id)!;
        expect(o.readiness).toBe('ready');
        expect(o.claims.some((c) => s.claims.includes(c))).toBe(false);
      }
    expect(all.every((s) => !s.chain && !s.partOf)).toBe(true);
  });

  it('a chain that cannot be produced holds the story at needs-review', () => {
    const [a, b] = ready();
    expect(chain(a, ['gap:not-a-story']).blocking.join(' ')).toMatch(/not a current candidate/);
    expect(chain(a, [b], {}, '').blocking.join(' ')).toMatch(/needs chainWhy/);
    expect(chain(a, [a]).blocking.join(' ')).toMatch(/twice/);
    const nested = chain(a, [b], { [b]: { chain: [a], chainWhy: 'x' } });
    expect(nested.readiness).toBe('needs-review');
    expect(nested.blocking.join(' ')).toMatch(/chains do not nest/);
    expect(chain(a, [b, b, b]).blocking.join(' ')).toMatch(/at most 3 questions/);
  });

  it('a follow-up belongs to one video: a second story chaining it is held', () => {
    const [a, b, c] = ready();
    const twice = discover(corpus(), reader, {
      stories: { [a]: { chain: [b], chainWhy: 'x' }, [c]: { chain: [b], chainWhy: 'x' } },
    }).stories;
    expect(twice.find((s) => s.id === b)!.partOf).toBe(a);
    const second = twice.find((s) => s.id === c)!;
    expect(second.readiness).toBe('needs-review');
    expect(second.blocking.join(' ')).toMatch(/already a follow-up in/);
  });
});

describe('the list cap counts videos', () => {
  // Sixteen ready one-claim stories and one sixteen-claim group: discovery lists twelve videos and leaves the rest out.
  const WORDS = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa';
  const many = () =>
    WORDS.split(' ').map((w, i) =>
      claim(`${w}-claim`, `The ${w} widget doubles yearly output`, {
        verdicts: [guess('wrong', 0.5), study('RCT A', 'right', 0.7, DOC_A)],
        sources: sources(2 + (i % 5)),
      }),
    );
  const run = (stories: ReviewFile['stories'] = {}) => {
    const claims = many();
    return discover(topic(claims, [{ title: 'Big group', claims }]), reader, { stories }).stories;
  };
  const best = () => run()[0].id;
  const worst = 'surprise:papa-claim'; // ranked below the cap on its own

  it('a chain is one video, ranked by its best question: a weak first question cannot sink a strong follow-up', () => {
    expect(run().some((s) => s.id === worst)).toBe(false);
    const listed = run({ [worst]: { chain: [best()], chainWhy: 'next' } });
    expect(listed.find((s) => s.id === best())?.partOf).toBe(worst);
    expect(listed.some((s) => s.id === worst)).toBe(true);
    expect(listed.filter((s) => !s.partOf)).toHaveLength(12);
  });

  it('a chain over the claim ceiling holds its first story (claims counted once)', () => {
    const head = run({ [best()]: { chain: ['decision:big-group'], chainWhy: 'next' } }).find((s) => s.id === best())!;
    expect(head.readiness).toBe('needs-review');
    expect(head.blocking.join(' ')).toMatch(/at most 14 claims; this one carries 16/);
  });
});

describe('committed stories', () => {
  it.each(storyTopicNames())('%s/story-review.json judges only current candidates', (name) => {
    expect(staleReviewIds(loadTopic(name), loadReview(name))).toEqual([]);
  });
  it.each(storyTopicNames())('%s/stories.json is valid and current', (name) => {
    const f = loadStories(name)!;
    expect(f.stories.length).toBeGreaterThanOrEqual(1);
    expect(f.stories.filter((s) => !s.partOf).length).toBeLessThanOrEqual(12); // videos; follow-ups ride along
    const ids = f.stories.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of f.stories) {
      for (const title of [s.title, ...s.alternates]) expect(title).not.toMatch(LABELS);
      if (s.readiness === 'ready') {
        expect(s.blocking).toHaveLength(0);
        expect(s.audit.central.decision).not.toBe('blocked');
        if (s.claims.length > 1) expect(s.coherence.basis).toBe('review');
      }
      for (const v of [s.audit.central, ...s.audit.findings.map((f) => f.validation)])
        for (const x of v.supporting) expect(x.passage).toBeUndefined();
    }
  });
});
