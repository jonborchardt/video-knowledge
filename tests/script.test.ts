import { describe, expect, it } from 'vitest';
import type { PassageReader } from '../src/lib/evidence';
import type { ReviewFile } from '../src/lib/review';
import {
  type EvidencePackage,
  type Script,
  type ScriptAssertion,
  type ScriptReviewFile,
  type Sentence,
  buildPackage,
  evalExpr,
  scriptDir,
  scriptFingerprint,
  sentenceFingerprint,
  sentences,
  validateScript,
} from '../src/lib/script';
import { discover } from '../src/lib/stories';
import { type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import type { Topic } from '../src/lib/topics';
import { TOPIC, claim, passages, sources, study, topic } from './corpus';

// A passage with figures, in the shape of a survey result.
const DOC_D = `${TOPIC}/sources/survey-d.txt#L1-L2`;
const read: PassageReader = (cite) =>
  cite === DOC_D
    ? 'Of the 601 participants surveyed, 47% reported losing money, 27% broke even and 25% made a profit.'
    : (passages[cite] ?? null);

const MLM = `${TOPIC}/mlm-income`;
const RENTAL = `${TOPIC}/rental-leverage`;
const mlm = () =>
  claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
    verdicts: [study('Survey D', 'right', 0.7, DOC_D, 'A probability sample of 601 participants: 47% lost money.')],
    sources: sources(3),
    lean: 'skeptic',
  });
const rental = () =>
  claim('rental-leverage', 'Rental property lets investors borrow against appreciation', {
    verdicts: [study('Field C', 'partly', 0.5, `${TOPIC}/sources/field-c.txt#L20-L21`)],
    sources: sources(2),
  });
const review: ReviewFile = {
  stories: {
    'decision:mlm-and-seminars': {
      coherence: { score: 0.9, reason: 'one question' },
      claims: [MLM],
      title: 'How Much Money Do MLM Participants Actually Make?',
    },
  },
};
const t = () => topic([mlm(), rental()], [{ title: 'MLM and seminars', claims: [mlm(), rental()] }]);
const asTopic = (x: ReturnType<typeof t>): Topic => ({ ...x, docNames: {}, sameStudy: {} }) as unknown as Topic;
const story = () => discover(t(), read, review).stories.find((s) => s.id === 'decision:mlm-and-seminars')!;
const pkg = () => buildPackage(story(), asTopic(t()), read, review);

const fact = (id: string, text: string, cites = [DOC_D], extra: Partial<ScriptAssertion> = {}): ScriptAssertion => ({
  id,
  text,
  kind: 'fact',
  claims: [{ id: MLM, stance: 'asserts' }],
  evidence: cites.map((cite) => ({ kind: 'study' as const, claim: MLM, cite })),
  ...extra,
});
const sentence = (id: string, text: string, type: Sentence['type'], assertions?: ScriptAssertion[]): Sentence => ({
  id,
  text,
  type,
  ...(assertions ? { assertions } : {}),
});
const script = (sent: Sentence[], revision = 1): Script => ({
  topic: TOPIC,
  story: 'decision:mlm-and-seminars',
  title: 'T',
  revision,
  generation: { model: 'test', brief: 'b', date: 'd', wordsPerMinute: 150, evidencePackage: 'x' },
  sections: [{ name: 'hook', sentences: sent }],
});
const approveAll = (s: Script, findings: ScriptReviewFile['findings'] = []): ScriptReviewFile => ({
  reviewer: 'test',
  date: 'd',
  revision: s.revision,
  approved: Object.fromEntries(sentences(s).map((x) => [x.id, sentenceFingerprint(x)])),
  findings,
});
const corpus = () => ({ name: TOPIC, claims: [mlm(), rental()] });
const run = (s: Script, r: ScriptReviewFile | null = null) => validateScript(s, corpus(), read, r);
const cats = (v: ReturnType<typeof run>) => v.issues.filter((i) => i.severity === 'blocking').map((i) => i.category);

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
    const r = approveAll(s1, [
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
  const good = () =>
    script([
      sentence('s01', 'Say you join under a friend.', 'hypothetical'),
      sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
        fact('s02.a', 'Of 601 participants, 47% reported losing money.'),
      ]),
      sentence('s03', 'So what does that leave?', 'rhetorical'),
    ]);
  const p = () => pkg();
  const plan = (scenes: StoryboardPlan['scenes'], s = good()): StoryboardPlan => ({
    topic: TOPIC,
    story: s.story,
    scriptFingerprint: scriptFingerprint(s),
    generation: { model: 'test', brief: 'b', date: 'd' },
    scenes,
  });
  const scene = (
    id: string,
    ss: string[],
    extra: Partial<StoryboardPlan['scenes'][0]> = {},
  ): StoryboardPlan['scenes'][0] => ({
    id,
    sentences: ss,
    purpose: 'p',
    visual: { category: 'typography', description: 'words on screen' },
    ...extra,
  });

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
            chart: { type: 'bar', series: [{ label: 'lost money', value: '47%', cite: DOC_D }] },
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
    expect(sb.scenes[1].duration).toBeCloseTo((8 / 150) * 60 + 2, 1);
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
          chart: { type: 'bar', series: [{ label: 'lost', value: '62%', cite: DOC_D }] },
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

  it('chart values written in words are checked against the passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const chart = (value: string) =>
      plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: {
            category: 'data-chart',
            description: 'bars',
            chart: { type: 'bar', series: [{ label: 'lost', value, cite: DOC_D }] },
          },
        }),
      ]);
    expect(buildStoryboard(chart('forty-seven percent'), s, v, p(), read).status).toBe('ok');
    expect(buildStoryboard(chart('sixty-two percent'), s, v, p(), read).issues.map((i) => i.category)).toContain(
      'chart-data',
    );
  });
});

// Keep the package type honest about what the storyboard needs from it.
it('the package exposes the cites and sources the storyboard checks against', () => {
  const p: EvidencePackage = pkg();
  expect(p.documents.flatMap((d) => d.cites)).toContain(DOC_D);
  expect(p.claims.flatMap((c) => c.statements.map((s) => s.source))).toContain('s1a');
});
