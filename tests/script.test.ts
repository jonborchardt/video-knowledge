import { describe, expect, it } from 'vitest';
import {
  type EvidencePackage,
  type Script,
  buildPackage,
  evalExpr,
  scriptDir,
  sentenceFingerprint,
  sentences,
  validateScript,
  words,
} from '../src/lib/script';
import { spokenWords } from '../src/lib/numbers';
import {
  type ChartPoint,
  type ChartSpec,
  type ChartType,
  type StoryboardPlan,
  buildStoryboard,
} from '../src/lib/storyboard';
import { TOPIC, claim, study } from './corpus';
import {
  DOC_D,
  MLM,
  RENTAL,
  approveAll,
  asTopic,
  cats,
  corpus,
  fact,
  good,
  hashOf,
  partlySentence,
  pkg,
  plan,
  read,
  review,
  run,
  scene,
  script,
  sentence,
  story,
  t,
} from './script-helpers';

describe('evidence package', () => {
  it('carries the reviewed claim list, not the recap group, and no stale gaps', () => {
    const s = story();
    expect(s.claims).toEqual([MLM]);
    expect(s.gaps.join(' ')).not.toMatch(/Rental/);
    const p = pkg();
    expect(p.claims.map((c) => c.id)).toEqual([MLM]);
    expect(p.gaps.join(' ')).not.toMatch(/Rental/);
    expect(p.audience).toMatch(/default/);
  });

  it('resolves every reference to a document and a passage, and keeps statements apart from study evidence', () => {
    const p = pkg();
    const c = p.claims[0];
    expect(c.evidence).toHaveLength(1);
    expect(c.evidence[0].role).toBe('supports');
    expect(c.evidence[0].passage).toMatch(/601 participants/);
    expect(p.documents.map((d) => d.file)).toEqual([`${TOPIC}/sources/survey-d.txt`]);
    expect(p.documents[0].cites).toEqual([DOC_D]);
    expect(c.statements).toHaveLength(3);
    expect(c.guess).toBeNull();
  });

  it('persists a transcript window around each recorded quote, and keeps it when the transcript is gone', () => {
    const transcript = (id: string) =>
      id === 's1a'
        ? 'intro words here. to hear another former distributor tell it, quote s1a words and so on. more words.'
        : null;
    const a = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), transcript);
    const st = a.claims[0].statements.find((s) => s.source === 's1a')!;
    expect(st.context).toMatch(/former distributor tell it, quote s1a words/);
    const b = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), () => null, a);
    expect(b.claims[0].statements.find((s) => s.source === 's1a')!.context).toBe(st.context);
    expect(b.fingerprint).toBe(a.fingerprint);
    const c = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), () => null, null);
    expect(c.claims[0].statements.find((s) => s.source === 's1a')!.context).toBeNull();
  });

  it('is reproducible and leaves its inputs untouched', () => {
    const s = story();
    const before = JSON.stringify(s);
    const a = buildPackage(s, asTopic(t()), read, review);
    const b = buildPackage(s, asTopic(t()), read, review);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(JSON.stringify(s)).toBe(before);
    expect(scriptDir('demo', 'decision:mlm-and-seminars')).toMatch(
      /[\\/]demo[\\/]scripts[\\/]decision-mlm-and-seminars$/,
    );
  });
});

describe('script validation', () => {
  it('a factual sentence without provenance blocks; an attributed one passes on the statement without endorsing it', () => {
    const bare = run(script([sentence('s01', 'Most people who join lose money.', 'factual')]));
    expect(bare.status).toBe('blocked');
    expect(cats(bare)).toContain('missing-provenance');
    const attributed = script([
      sentence('s01', 'Three videos in the corpus say most participants lose money.', 'attributed', [
        {
          id: 's01.a',
          text: 'Three sources claim most MLM participants earn nothing or lose money.',
          kind: 'attribution',
          claims: [{ id: MLM, stance: 'asserts' }],
          evidence: [1, 2, 3].map((i) => ({ kind: 'statement' as const, claim: MLM, source: `s${i}a` })),
        },
      ]),
    ]);
    const v = run(attributed);
    expect(v.sentences[0].assertions[0].validation.kind).toBe('attribution');
    expect(v.sentences[0].assertions[0].validation.limitations.join(' ')).toMatch(/not whether it is true/);
    expect(v.status).toBe('needs-review'); // approved by the gate, still needs the reviewer
    // The same words offered as fact on the strength of the statements alone are blocked.
    const asFact = script([
      sentence('s01', 'Most participants lose money.', 'factual', [
        {
          ...fact('s01.a', 'Most MLM participants lose money.', []),
          evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
        },
      ]),
    ]);
    expect(cats(run(asFact))).toContain('unsupported');
  });

  it('rejects an invented figure and a figure no assertion owns', () => {
    const invented = run(
      script([sentence('s01', 'In the survey, 62 percent lost money.', 'factual', [fact('s01.a', '62% lost money.')])]),
    );
    expect(cats(invented)).toContain('invented-number');
    const orphan = run(
      script([
        sentence('s01', 'Of 601 people, 47 percent lost money and 9 in 10 regretted it.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
        ]),
      ]),
    );
    expect(cats(orphan)).toContain('figure-without-assertion');
    expect(orphan.issues.find((i) => i.category === 'figure-without-assertion')!.explanation).toMatch(/"9"/);
  });

  it('checks quotations against the passage', () => {
    const q = (text: string) =>
      run(
        script([
          sentence('s01', `The report says "${text}".`, 'factual', [
            fact('s01.a', `The survey reports "${text}".`, [DOC_D], { quote: { text, cite: DOC_D } }),
          ]),
        ]),
      );
    expect(cats(q('47% reported losing money'))).toEqual([]);
    expect(cats(q('47% reported making money'))).toContain('misquote');
  });

  it('accepts a derived figure only when the arithmetic reproduces from cited inputs', () => {
    const calc = (expression: string, result: string, inputs = ['47', '27']) =>
      run(
        script([
          sentence('s01', `That leaves ${result} percent who neither lost nor broke even.`, 'factual', [
            fact('s01.a', `${result}% of participants neither lost money nor broke even.`, [DOC_D], {
              calc: { expression, inputs: inputs.map((value) => ({ value, cite: DOC_D })), result },
            }),
          ]),
        ]),
      );
    expect(cats(calc('100 - 47 - 27', '26'))).toEqual([]);
    expect(cats(calc('100 - 47 - 27', '28'))).toContain('bad-arithmetic');
    expect(cats(calc('100 - 47 - 33', '20', ['47', '33']))).toContain('bad-arithmetic'); // 33 is not in the passage
    expect(cats(calc('100 - 47 - 27', '26', ['47']))).toContain('bad-arithmetic'); // an undeclared operand
    expect(evalExpr('process.exit(1)')).toBeNull();
    expect(evalExpr('2 * (3 + 4)')).toBe(14);
  });

  it('partial or contextual evidence never establishes an unqualified conclusion on its own', () => {
    const partly = run(
      script([
        sentence('s01', 'Rental property lets investors borrow against appreciation.', 'factual', [
          {
            id: 's01.a',
            text: 'Rental property lets investors borrow against appreciation.',
            kind: 'fact',
            claims: [{ id: RENTAL, stance: 'asserts' }],
            evidence: [{ kind: 'study', claim: RENTAL, cite: `${TOPIC}/sources/field-c.txt#L20-L21` }],
          },
        ]),
      ]),
    );
    expect(partly.status).toBe('needs-review');
    expect(partly.issues.map((i) => i.category)).toContain('needs-qualification');
    expect(partly.sentences[0].assertions[0].status).toBe('needs-review');
    // Context only (a base rate against a possibility claim) blocks outright.
    const can = claim('can', 'A participant can make a living from an MLM', {
      verdicts: [study('Survey D', 'wrong', 0.7, DOC_D, 'Most (47%) lost money; a majority did not profit.')],
    });
    const v = validateScript(
      script([
        sentence('s01', 'You can make a living from it.', 'factual', [
          {
            id: 's01.a',
            text: 'A participant can make a living from an MLM.',
            kind: 'fact',
            claims: [{ id: can.id, stance: 'asserts' }],
            evidence: [{ kind: 'study', claim: can.id, cite: DOC_D }],
          },
        ]),
      ]),
      { name: TOPIC, claims: [can] },
      read,
    );
    expect(v.status).toBe('blocked');
    expect(v.issues[0].explanation).toMatch(/context only/);
  });

  it('checks each assertion in a sentence on its own', () => {
    const v = run(
      script([
        sentence('s01', 'Of 601 people, 47 percent lost money, and 62 percent quit within a year.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
          fact('s01.b', '62% quit within a year.'),
        ]),
      ]),
    );
    const [a, b] = v.sentences[0].assertions;
    expect(a.issues.filter((i) => i.severity === 'blocking')).toEqual([]);
    expect(b.status).toBe('blocked');
    expect(v.sentences[0].status).toBe('blocked');
    expect(a.status).toBe('needs-review'); // a sound half does not pass while its sentence is blocked
  });

  it('a revised sentence loses its approval and its old findings are recorded as resolved', () => {
    const s1 = script([
      sentence('s01', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
        fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
      ]),
    ]);
    const r = approveAll(s1, pkg(), [
      {
        sentence: 's01',
        assertion: 's01.a',
        fingerprint: sentenceFingerprint(sentences(s1)[0]),
        revision: 1,
        category: 'missing-qualification',
        severity: 'warning',
        explanation: 'say it is self-reported',
      },
    ]);
    const v1 = run(s1, r);
    expect(v1.status).toBe('passed');
    expect(v1.sentences[0].assertions[0].status).toBe('verified');
    expect(v1.issues.map((i) => i.by)).toContain('review');
    const s2 = script(
      [
        sentence('s01', 'Of 601 people surveyed, 47 percent said they lost money.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
        ]),
      ],
      2,
    );
    const v2 = validateScript(s2, corpus(), read, r, {}, v1);
    expect(v2.status).toBe('needs-review');
    expect(v2.sentences[0].approved).toBe(false);
    expect(v2.sentences[0].assertions[0].status).toBe('needs-review');
    expect(v2.resolved).toHaveLength(1);
    expect(v2.resolved[0].resolvedBy).toBe(2);
    expect(v2.history.map((h) => h.revision)).toEqual([1, 2]);
  });

  it('a blocking issue prevents a passing result even when the reviewer approved everything', () => {
    const s = script([
      sentence('s01', 'In the survey 62 percent lost money.', 'factual', [fact('s01.a', '62% lost money.')]),
    ]);
    const r = approveAll(s);
    expect(run(s, r).status).toBe('blocked');
    const blockedByReview = run(
      script([
        sentence('s01', 'Of 601 people, 47 percent lost money.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
        ]),
      ]),
      {
        ...approveAll(
          script([
            sentence('s01', 'Of 601 people, 47 percent lost money.', 'factual', [
              fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
            ]),
          ]),
        ),
        findings: [
          {
            sentence: 's01',
            fingerprint: sentenceFingerprint(
              sentence('s01', 'Of 601 people, 47 percent lost money.', 'factual', [
                fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
              ]),
            ),
            category: 'overgeneralization',
            severity: 'blocking',
            explanation: 'the survey is US adults, the sentence says people',
          },
        ],
      },
    );
    expect(blockedByReview.status).toBe('blocked');
    const limit = run(script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])], 3));
    expect(limit.revisionLimitReached).toBe(true);
  });

  it('a figure written in words is checked like a digit', () => {
    const v = run(
      script([
        sentence('s01', 'In the survey sixty-two percent lost money.', 'factual', [
          fact('s01.a', 'sixty-two percent lost money.'),
        ]),
      ]),
    );
    expect(cats(v)).toContain('invented-number');
    const ok = run(
      script([
        sentence('s01', 'In the survey forty-seven percent lost money.', 'factual', [
          fact('s01.a', 'forty-seven percent of participants reported losing money.'),
        ]),
      ]),
    );
    expect(cats(ok)).toEqual([]);
  });

  it('an attributed figure must be in the recorded quote, words or digits', () => {
    const quoteWords = (text: string) =>
      script([
        sentence('s01', text, 'attributed', [
          {
            id: 's01.a',
            text,
            kind: 'attribution',
            claims: [{ id: MLM, stance: 'asserts' }],
            evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
          },
        ]),
      ]);
    expect(cats(run(quoteWords('One source says ten people joined.')))).toContain('figure-not-in-quote');
  });

  it('flags a figure in a hypothetical for the reviewer without blocking', () => {
    const v = run(script([sentence('s01', 'Say you recruit five friends and each pays $100.', 'hypothetical')]));
    expect(v.issues.map((i) => `${i.severity}:${i.category}`)).toContain('warning:figure-in-non-factual');
    expect(v.sentences[0].status).toBe('needs-review');
  });
});

describe('storyboard', () => {
  const p = () => pkg();
  it('takes its narration from the script and keeps timing consistent', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const sb = buildStoryboard(
      plan([
        scene('sc1', ['s01']),
        scene('sc2', ['s02'], {
          pauseSeconds: 2,
          visual: {
            category: 'data-chart',
            description: 'three bars',
            chart: {
              type: 'bar',
              points: [{ label: 'lost money', value: 47, unit: 'percent', display: '47%', cite: DOC_D }],
            },
          },
          citations: [{ label: 'Survey D', cite: DOC_D }],
        }),
        scene('sc3', ['s03']),
      ]),
      s,
      v,
      p(),
      read,
    );
    expect(sb.status).toBe('ok');
    expect(sb.scenes.map((x) => x.narration)).toEqual(sentences(s).map((x) => x.text));
    expect(sb.scenes[0].start).toBe(0);
    for (let i = 1; i < sb.scenes.length; i++) expect(sb.scenes[i].start).toBe(sb.scenes[i - 1].end);
    for (const x of sb.scenes) expect(x.end).toBeCloseTo(x.start + x.duration, 5);
    expect(sb.runtime).toBe(sb.scenes.at(-1)!.end);
    expect(sb.scenes[1].duration).toBeCloseTo((spokenWords(sentences(s)[1].text) / 150) * 60 + 2, 1);
  });

  it('rejects reworded narration, missing or repeated sentences, stale plans, and chart data outside the passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const cat = (sb: ReturnType<typeof buildStoryboard>) =>
      sb.issues.filter((i) => i.severity === 'blocking').map((i) => i.category);
    expect(
      cat(
        buildStoryboard(
          plan([
            scene('sc1', ['s01', 's02', 's03'], {
              narration:
                'Say you join under a friend. Of 601 people surveyed, 47 percent lose money. So what does that leave?',
            }),
          ]),
          s,
          v,
          p(),
          read,
        ),
      ),
    ).toContain('reworded-narration');
    expect(cat(buildStoryboard(plan([scene('sc1', ['s01', 's02'])]), s, v, p(), read))).toContain('missing-sentence');
    expect(
      cat(buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s02', 's03'])]), s, v, p(), read)),
    ).toContain('duplicate-sentence');
    expect(
      cat(buildStoryboard(plan([scene('sc1', ['s02']), scene('sc2', ['s01', 's03'])]), s, v, p(), read)),
    ).toContain('out-of-order');
    expect(
      cat(
        buildStoryboard({ ...plan([scene('sc1', ['s01', 's02', 's03'])]), scriptFingerprint: 'old' }, s, v, p(), read),
      ),
    ).toContain('stale-script');
    const badChart = plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: {
          category: 'data-chart',
          description: 'bars',
          chart: { type: 'bar', points: [{ label: 'lost', value: 62, unit: 'percent', display: '62%', cite: DOC_D }] },
        },
      }),
    ]);
    expect(cat(buildStoryboard(badChart, s, v, p(), read))).toContain('chart-data');
    // A blocked script cannot be storyboarded.
    const blocked = run(script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])]));
    expect(
      cat(
        buildStoryboard(
          plan([scene('sc1', ['s01'])], script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])])),
          script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])]),
          blocked,
          p(),
          read,
        ),
      ),
    ).toContain('script-blocked');
  });

  const point = (o: Partial<ChartPoint>): ChartPoint => ({
    label: 'lost money',
    value: 47,
    unit: 'percent',
    display: '47%',
    cite: DOC_D,
    ...o,
  });
  const chartPlan = (points: ChartPoint[], type: string = 'bar') =>
    plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: { category: 'data-chart', description: 'bars', chart: { type: type as ChartType, points } },
      }),
    ]);

  it('chart values written in words are checked against the passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const chart = (display: string, value: number) => chartPlan([point({ display, value })]);
    expect(buildStoryboard(chart('forty-seven percent', 47), s, v, p(), read).status).toBe('ok');
    expect(buildStoryboard(chart('sixty-two percent', 62), s, v, p(), read).issues.map((i) => i.category)).toContain(
      'chart-data',
    );
  });

  it('per-sentence timing tiles the scene and numerals lengthen it', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    expect(v.spokenWords).toBeGreaterThan(v.words);
    const sb = buildStoryboard(
      plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'], { pauseSeconds: 1 })]),
      s,
      v,
      pkg(),
      read,
    );
    const t = sb.scenes[0].timing;
    expect(t.map((x) => x.id)).toEqual(['s01', 's02']);
    expect(t[0].start).toBe(0);
    expect(t[1].start).toBeCloseTo(t[0].end, 5);
    expect(sb.scenes[0].duration).toBeCloseTo(t[1].end, 5);
    expect(sb.scenes[1].duration).toBeCloseTo(sb.scenes[1].timing[0].duration + 1, 5);
    expect(t[1].duration).toBeGreaterThan((words(sentences(s)[1].text) / 150) * 60); // "601" and "47" lengthen it
    expect(sb.scenes[1].timing[0].start).toBeCloseTo(sb.scenes[1].start, 5); // absolute, not scene-relative
  });

  it('building a storyboard from its own output is byte-for-byte idempotent', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const once = buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'])]), s, v, pkg(), read);
    const twice = buildStoryboard(JSON.parse(JSON.stringify(once)) as StoryboardPlan, s, v, pkg(), read);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('scenes reference registered assets by id', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const withAssets = (
      ids: string[],
      assets: StoryboardPlan['assets'],
      extra: Partial<StoryboardPlan['scenes'][0]['visual']> = {},
    ) => ({
      ...plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: { category: 'diagram', description: 'tree', assetIds: ids, ...extra },
        }),
      ]),
      assets,
    });
    const issues = (p: StoryboardPlan) => buildStoryboard(p, s, v, pkg(), read).issues;
    expect(
      buildStoryboard(
        withAssets(['tree'], { tree: { kind: 'component', description: 'node tree' } }),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
    expect(issues(withAssets(['ghost'], {})).map((i) => i.category)).toContain('asset');
    expect(
      issues(withAssets([], { unused: { kind: 'image', description: 'x' } })).some(
        (i) => i.category === 'asset' && i.severity === 'warning',
      ),
    ).toBe(true);
    const doc = { page: { kind: 'document-render' as const, description: 'the rank table' } };
    expect(issues(withAssets(['page'], doc)).some((i) => i.category === 'asset' && i.severity === 'warning')).toBe(
      true,
    );
    expect(
      issues(withAssets(['page'], doc, { excerpt: { cite: DOC_D } })).filter((i) => i.category === 'asset'),
    ).toEqual([]);
    const legacy = withAssets([], {}, { assets: ['a free-text asset'] } as unknown as Partial<
      StoryboardPlan['scenes'][0]['visual']
    >);
    expect(issues(legacy).map((i) => i.category)).toContain('asset');
  });

  it('accepts numeric points whose display matches the value and the passage', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    expect(buildStoryboard(chartPlan([point({})]), s, v, pkg(), read).status).toBe('ok');
    expect(
      buildStoryboard(chartPlan([point({ value: 14, display: 'fourteen percent' })]), s, v, pkg(), read).status,
    ).toBe('ok');
    expect(
      buildStoryboard(
        chartPlan([point({ value: 5000, unit: 'usd', display: 'less than $5,000', qualifier: 'lt' })]),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
    expect(
      buildStoryboard(
        chartPlan([point({ value: 601, unit: 'count', display: '601' })], 'stat-tiles'),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
  });

  it('rejects display/value mismatch, out-of-passage figures, bad units and unknown types', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const cat = (pts: ChartPoint[], type?: string) =>
      buildStoryboard(chartPlan(pts, type), s, v, pkg(), read).issues.map((i) => i.category);
    expect(cat([point({ value: 83.33, display: '$84', unit: 'usd' })])).toContain('chart-data');
    expect(cat([point({ value: 62, display: '62%' })])).toContain('chart-data');
    expect(cat([point({ value: 147, display: '147%' })])).toContain('chart-data');
    expect(cat([point({ value: 601, unit: 'ratio', display: '1 in 601' })])).toEqual([]);
    expect(cat([point({ value: 1, unit: 'ratio', display: '1 in 601' })])).toContain('chart-data');
    expect(cat([point({})], 'proportional-table')).toContain('chart');
    expect(cat([])).toContain('chart');
    const legacy = plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: {
          category: 'data-chart',
          description: 'bars',
          chart: { type: 'bar', series: [{ label: 'lost', value: '47%', cite: DOC_D }] } as unknown as ChartSpec,
        },
      }),
    ]);
    expect(
      buildStoryboard(legacy, s, v, pkg(), read)
        .issues.map((i) => i.explanation)
        .join(' '),
    ).toMatch(/series was replaced by points/);
  });
});

describe('speaker attribution', () => {
  const pkgWith = (context: string | null) => {
    const q = pkg();
    q.claims[0].statements[0].context = context;
    return q;
  };
  const attributed = (speaker?: string) =>
    script([
      sentence('s01', 'A former distributor said "quote s1a words".', 'attributed', [
        {
          id: 's01.a',
          text: 'A former distributor said "quote s1a words".',
          kind: 'attribution',
          claims: [{ id: MLM, stance: 'asserts' }],
          evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
          quote: { text: 'quote s1a words', source: 's1a', ...(speaker ? { speaker } : {}) },
        },
      ]),
    ]);
  const v = (s: Script, q: EvidencePackage | null) => validateScript(s, corpus(), read, null, {}, null, q, hashOf(q));
  it('a named speaker must appear in the quote context or the source title', () => {
    expect(
      cats(v(attributed('former distributor'), pkgWith('to hear another former distributor tell it: quote s1a words'))),
    ).toEqual([]);
    expect(
      cats(v(attributed('John Oliver'), pkgWith('to hear another former distributor tell it: quote s1a words'))),
    ).toContain('speaker-unverified');
    expect(cats(v(attributed('Video s1a'), pkgWith(null)))).toEqual([]); // the source title
    expect(cats(v(attributed('former distributor'), pkgWith(null)))).toContain('speaker-unverified');
  });
  it('a source quoted on two claims is checked against the context of the claim the assertion rests on', () => {
    const q = pkg();
    q.claims[0].statements[0].context = 'John Oliver says: quote s1a words';
    q.claims.push({
      ...q.claims[0],
      id: RENTAL,
      statements: [{ ...q.claims[0].statements[0], context: 'a former distributor says: quote s1a words' }],
    });
    const onRental = (speaker: string) =>
      script([
        sentence('s01', 'A former distributor said "quote s1a words".', 'attributed', [
          {
            id: 's01.a',
            text: 'A former distributor said "quote s1a words".',
            kind: 'attribution',
            claims: [{ id: RENTAL, stance: 'asserts' }],
            evidence: [{ kind: 'statement', claim: RENTAL, source: 's1a' }],
            quote: { text: 'quote s1a words', source: 's1a', speaker },
          },
        ]),
      ]);
    expect(cats(v(onRental('former distributor'), q))).toEqual([]);
    expect(cats(v(onRental('John Oliver'), q))).toContain('speaker-unverified');
  });

  it('warns when a source quotation names no speaker', () => {
    expect(v(attributed(), pkgWith('x quote s1a words y')).issues.map((i) => i.category)).toContain('speaker-missing');
  });
});

// Keep the package type honest about what the storyboard needs from it.
it('the package exposes the cites and sources the storyboard checks against', () => {
  const p: EvidencePackage = pkg();
  expect(p.documents.flatMap((d) => d.cites)).toContain(DOC_D);
  expect(p.claims.flatMap((c) => c.statements.map((s) => s.source))).toContain('s1a');
});

describe('reproducible evidence', () => {
  it('flags a finding whose reference is outside the repository', () => {
    const s = good();
    const r = approveAll(s, pkg());
    const finding = (refs: string[]) => ({
      sentence: 's02',
      fingerprint: sentenceFingerprint(sentences(s)[1]),
      category: 'omission',
      severity: 'info' as const,
      explanation: 'x',
      refs,
    });
    for (const ref of [
      'demo/store/transcripts/s1a.txt',
      'demo/work/notes.md',
      'https://example.com',
      'C:/x/y.txt',
      '/tmp/y',
    ])
      expect(
        run(s, { ...r, findings: [finding([ref])] }).issues.map((i) => i.category),
        ref,
      ).toContain('unreproducible-ref');
    expect(run(s, { ...r, findings: [finding([DOC_D])] }).issues.map((i) => i.category)).not.toContain(
      'unreproducible-ref',
    );
  });

  it('resolved findings survive their removal from the review file', () => {
    const s1 = script([
      sentence('s01', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
        fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
      ]),
    ]);
    const finding = {
      sentence: 's01',
      fingerprint: sentenceFingerprint(sentences(s1)[0]),
      revision: 1,
      category: 'missing-qualification',
      severity: 'warning' as const,
      explanation: 'say it is self-reported',
    };
    const v1 = run(s1, approveAll(s1, pkg(), [finding]));
    expect(v1.resolved).toHaveLength(0);
    const s2 = script(
      [
        sentence('s01', 'Of 601 people surveyed, 47 percent said they lost money.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
        ]),
      ],
      2,
    );
    const r2 = approveAll(s2, pkg()); // the reviewer dropped the finding from the file
    const v2 = validateScript(s2, corpus(), read, r2, {}, v1, pkg(), hashOf(pkg()));
    expect(v2.resolved.map((x) => [x.explanation, x.resolvedBy])).toEqual([['say it is self-reported', 2]]);
    const v3 = validateScript(s2, corpus(), read, r2, {}, v2, pkg(), hashOf(pkg()));
    expect(v3.resolved.map((x) => [x.explanation, x.resolvedBy])).toEqual([['say it is self-reported', 2]]);
  });

  it('approvals lapse when the evidence package changes', () => {
    const s = good();
    const q = pkg();
    const r = { ...approveAll(s), packageFingerprint: q.fingerprint };
    const h = () => q.documents[0].sha;
    expect(validateScript(s, corpus(), read, r, {}, null, q, h).status).toBe('passed');
    const stale = validateScript(s, corpus(), read, { ...r, packageFingerprint: 'other' }, {}, null, q, h);
    expect(stale.status).toBe('needs-review');
    expect(stale.counts.unreviewed).toBe(3);
    expect(stale.issues.map((i) => i.category)).toContain('stale-review');
    const { packageFingerprint: _drop, ...legacy } = r; // an older review file with no packageFingerprint
    void _drop;
    expect(validateScript(s, corpus(), read, legacy, {}, null, q, h).status).toBe('needs-review');
  });

  it('a changed source document blocks', () => {
    const s = good();
    const q = pkg();
    const ok = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => q.documents[0].sha);
    expect(ok.status).toBe('passed');
    const changed = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => 'deadbeef00');
    expect(changed.status).toBe('blocked');
    expect(changed.issues.map((i) => i.category)).toContain('stale-source');
    const missing = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => null);
    expect(missing.issues.map((i) => i.category)).toContain('missing-source');
  });

  it('a storyboard built against a validation from another package is blocked', () => {
    const s = good();
    const v = { ...run(s, approveAll(s)), packageFingerprint: 'old' };
    expect(
      buildStoryboard(plan([scene('sc1', ['s01', 's02', 's03'])]), s, v, pkg(), read).issues.map((i) => i.category),
    ).toContain('stale-validation');
  });
});

describe('reviewer dispositions', () => {
  it('a reviewer disposition retires a warning until the sentence changes', () => {
    const s1 = script([partlySentence()]);
    const q = pkg();
    const r = {
      ...approveAll(s1, q),
      dispositions: {
        's01.a': {
          fingerprint: sentenceFingerprint(sentences(s1)[0]),
          reason: 'the narration says "in a narrower setting"',
        },
      },
    };
    const v1 = validateScript(s1, corpus(), read, r, {}, null, q, hashOf(q));
    expect(v1.counts.dispositioned).toBe(1);
    expect(v1.issues.find((i) => i.category === 'needs-qualification')?.disposition).toMatch(/narrower/);
    expect(v1.status).toBe('passed');
    const s2 = script([{ ...partlySentence(), text: partlySentence().text + ' Really.' }], 2);
    const v2 = validateScript(s2, corpus(), read, r, {}, null, q, hashOf(q));
    expect(v2.counts.dispositioned).toBe(0);
    expect(v2.counts.warnings).toBe(v1.counts.warnings + 1);
    expect(v2.issues.find((i) => i.category === 'needs-qualification')?.disposition).toBeUndefined();
  });
});
