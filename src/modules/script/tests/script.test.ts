import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPackage } from '../evidence-package';
import { docHasher, docReader, scriptDir, shortId, shortOf, storySlug, sha } from '../../../shared/io';
import { releaseCheck, storyboardFingerprint } from '../../../shared/release-check';
import { approverProblem } from '../../../shared/approver';
import { validationFingerprint } from '../../../shared/sentence-validation';
import { type RenderCheckSummary, renderCheckProblems } from '../../video/render-check';
import { revisionsInPass, sectionsFor, sentenceFingerprint, sentences } from '../../../shared/sentences';
import type { EvidencePackage, Release, Script, Section, Sentence } from '../../../shared/types';
import { evalExpr, repetitions, validateScript } from '../../../shared/sentence-validation';
import { buildStoryboard, pointProblems } from '../../storyboard';
import { TOPIC, claim, study } from '../../../../tests/corpus';
import {
  DOC_D,
  MLM,
  RENTAL,
  approveAll,
  asTopic,
  blockedScript,
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
} from '../../../../tests/script-helpers';

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
    const a = buildPackage(story(), asTopic(t()), read, { review, readTranscript: transcript });
    const st = a.claims[0].statements.find((s) => s.source === 's1a')!;
    expect(st.context).toMatch(/former distributor tell it, quote s1a words/);
    const b = buildPackage(story(), asTopic(t()), read, { review, previous: a });
    expect(b.claims[0].statements.find((s) => s.source === 's1a')!.context).toBe(st.context);
    expect(b.fingerprint).toBe(a.fingerprint);
    const c = buildPackage(story(), asTopic(t()), read, { review });
    expect(c.claims[0].statements.find((s) => s.source === 's1a')!.context).toBeNull();
  });

  it('is reproducible and leaves its inputs untouched', () => {
    const s = story();
    const before = JSON.stringify(s);
    const a = buildPackage(s, asTopic(t()), read, { review });
    const b = buildPackage(s, asTopic(t()), read, { review });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(JSON.stringify(s)).toBe(before);
    expect(scriptDir('demo', 'decision:mlm-and-seminars')).toMatch(
      /[\\/]demo[\\/]scripts[\\/]decision-mlm-and-seminars$/,
    );
  });

  it('hashes cited documents through the injected reader, never the disk', () => {
    const a = buildPackage(story(), asTopic(t()), read, { review, readDoc: () => 'one\ntwo' });
    expect(a.documents.length).toBeGreaterThan(0);
    expect(a.documents.every((d) => d.sha === sha('one\ntwo') && d.lines === 2)).toBe(true);
    const gone = buildPackage(story(), asTopic(t()), read, { review, readDoc: () => null });
    expect(gone.documents.every((d) => d.lines === 0)).toBe(true);
    expect(docHasher(() => 'one\ntwo')('any')).toBe(sha('one\ntwo'));
  });

  it('an uncited verdict recorded as contextual is context in the package', () => {
    const x = asTopic(t());
    const cite = `${TOPIC}/sources/other-e.txt#L1-L2`;
    x.claims
      .find((c) => c.id === MLM)!
      .verdicts.push({
        ...study('Other E', 'right', 0.8, cite),
        applicability: { level: 'contextual', reason: 'background on the mechanism' },
      });
    const e = buildPackage(story(), x, read, { review }).claims[0].evidence.find((y) => y.cite === cite)!;
    expect(e).toMatchObject({ role: 'context', applicability: 'contextual', basis: 'recorded', audited: false });
  });
});

describe('chained questions', () => {
  const chained = () => buildPackage(story(), asTopic(t()), read, { review, chain: [story()] });
  const FIGURE = 'In a survey of 601 participants, 47% reported losing money.';
  const chainScript = (q: EvidencePackage, names: string[]): Script => ({
    ...script([]),
    generation: { ...script([]).generation, evidencePackage: q.fingerprint },
    sections: names.map((name, i) => ({
      name: name as Section['name'],
      sentences: [
        name === 'question-1'
          ? sentence(`s0${i + 1}`, FIGURE, 'factual', [fact(`s0${i + 1}.a`, FIGURE)])
          : sentence(`s0${i + 1}`, 'So what comes next?', 'rhetorical'),
      ],
    })),
  });

  it('a one-question package has no questions, so existing packages keep their fingerprint', () => {
    expect(pkg().questions).toBeUndefined();
    expect(buildPackage(story(), asTopic(t()), read, { review, chain: [] }).fingerprint).toBe(pkg().fingerprint);
  });

  it('a chained package lists each question in order and carries each claim once', () => {
    const q = chained();
    expect(q.questions!.map((x) => x.story)).toEqual([story().id, story().id]);
    expect(q.claims.map((c) => c.id)).toEqual(story().claims);
    expect(q.questions![1]).toMatchObject({ premise: story().premise, tension: story().tension, arc: story().arc });
    expect(q.chainWhy).toBe(''); // the fixture review sets none
  });

  it("a package refuses more questions than a video answers, and carries every question's gaps", () => {
    expect(() => buildPackage(story(), asTopic(t()), read, { review, chain: [story(), story(), story()] })).toThrow(
      /at most 3/,
    );
    const follow = { ...story(), gaps: ['a gap only the follow-up has'] };
    expect(buildPackage(story(), asTopic(t()), read, { review, chain: [follow] }).gaps).toContain(
      'a gap only the follow-up has',
    );
  });

  it('a chained script needs a section per question that answers it, and a close', () => {
    const q = chained();
    const blocking = (names: string[]) =>
      run(chainScript(q, names), null, q)
        .issues.filter((i) => i.severity === 'blocking' && i.category === 'structure')
        .map((i) => i.explanation);
    expect(blocking(['hook', 'question-1', 'question-2', 'close'])).toEqual([
      expect.stringMatching(/section "question-2" asserts none of .* is not answered/),
    ]);
    expect(blocking(['hook', 'question-1', 'close'])).toEqual([expect.stringMatching(/no "question-2" section/)]);
    expect(blocking(['hook', 'question-1', 'question-2', 'findings', 'close'])).toContainEqual(
      expect.stringMatching(/unknown section "findings"/),
    );
  });
});

describe('section layouts', () => {
  it('a script has the five sections, or a block per question when its package chains them', () => {
    expect(sectionsFor(pkg())).toEqual(['hook', 'setup', 'investigation', 'answer', 'takeaway']);
    const chained = buildPackage(story(), asTopic(t()), read, { review, chain: [story()] });
    expect(sectionsFor(chained)).toEqual(['hook', 'question-1', 'question-2', 'close']);
  });
  it('the retired seven-section names are unknown sections', () => {
    const old = { ...script([]), sections: [{ name: 'conclusion' as Section['name'], sentences: [] }] };
    expect(run(old).issues.map((i) => i.explanation)).toContain('unknown section "conclusion"');
  });
});

describe('pacing', () => {
  const dense = (id: string) => sentence(id, 'Of 601 people surveyed, 47 percent lost money.', 'rhetorical');
  const long = (id: string) => sentence(id, 'word '.repeat(80).trim() + '.', 'rhetorical');
  const layout = (sections: [string, Sentence[]][]): Script => ({
    ...script([]),
    sections: sections.map(([name, sentences]) => ({ name: name as Section['name'], sentences })),
  });
  const warned = (s: Script) =>
    run(s)
      .issues.filter((i) => ['number-dense', 'slow-start', 'repetition'].includes(i.category))
      .map((i) => `${i.sentence} ${i.category}`);

  it('warns on a dense stretch of figures once, at its start, and on a slow start', () => {
    const s = layout([
      ['hook', [long('s01')]],
      ['setup', [long('s02')]],
      ['investigation', ['s03', 's04', 's05', 's06', 's07'].map(dense)],
    ]);
    expect(warned(s)).toEqual(['s03 number-dense', 's03 slow-start']);
  });

  it('pacing: false raises no pacing warning on a number-dense script', () => {
    const s = layout([
      ['hook', [long('s01')]],
      ['setup', [long('s02')]],
      ['investigation', ['s03', 's04', 's05', 's06', 's07'].map(dense)],
    ]);
    expect(cats(validateScript(s, corpus(), read, { pkg: pkg(), pacing: false }))).not.toContain('number-dense');
  });
  it('pointProblems names a display that does not state its value', () => {
    const pt = { label: 'x', value: 12, unit: 'percent' as const, display: '13%', cite: DOC_D };
    expect(pointProblems(pt, new Set([DOC_D]), read)).toContain('display "13%" does not state the value 12');
  });

  it('a list of dispositions retires several warnings on one sentence', () => {
    const s = layout([
      ['hook', [long('s01')]],
      ['setup', [long('s02')]],
      ['investigation', ['s03', 's04', 's05', 's06', 's07'].map(dense)],
    ]);
    const fingerprint = sentenceFingerprint(sentences(s).find((x) => x.id === 's03')!);
    const r = {
      ...approveAll(s),
      dispositions: {
        s03: ['number-dense', 'slow-start'].map((category) => ({ fingerprint, category, reason: 'the test needs it' })),
      },
    };
    expect(
      run(s, r).issues.filter((i) => ['number-dense', 'slow-start'].includes(i.category) && !i.disposition),
    ).toEqual([]);
  });
});

describe('repetition', () => {
  const FIGURE = 'Of 601 people surveyed, 47 percent lost money.';
  const said = (id: string, text = FIGURE) => sentence(id, text, 'factual', [fact(`${id}.a`, text)]);
  const filler = (id: string) => sentence(id, 'Why would that be?', 'rhetorical');

  it('flags a sentence that re-reads two earlier figures, not one that unpacks them next', () => {
    const all = sentences(script([said('s01'), said('s02'), filler('s03'), filler('s04'), said('s05')]));
    expect([...repetitions(all)]).toEqual([['s05', ['601 (first in s01)', '47 (first in s01)']]]);
  });

  it('a comma or a currency sign makes a four-digit number a figure, not a year', () => {
    const money = (id: string) => said(id, 'They paid $1,950 for 2,000 units.');
    const all = sentences(script([money('s01'), filler('s02'), filler('s03'), filler('s04'), money('s05')]));
    expect([...repetitions(all).keys()]).toEqual(['s05']);
  });

  it('one figure reused as context, small counts and years stay quiet', () => {
    const later = said('s05', 'Of those 601, in 2018, five years on, most lost money.');
    expect(repetitions(sentences(script([said('s01'), filler('s02'), filler('s03'), filler('s04'), later]))).size).toBe(
      0,
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
    const v2 = validateScript(s2, corpus(), read, { review: r, previous: v1 });
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
  const v = (s: Script, q: EvidencePackage | null) => validateScript(s, corpus(), read, { pkg: q, hashDoc: hashOf(q) });
  it('a named speaker must appear in the quote context or the source title', () => {
    expect(
      cats(v(attributed('former distributor'), pkgWith('to hear another former distributor tell it: quote s1a words'))),
    ).toEqual([]);
    expect(
      cats(v(attributed('John Oliver'), pkgWith('to hear another former distributor tell it: quote s1a words'))),
    ).toContain('speaker-unverified');
    expect(cats(v(attributed('Video s1a'), pkgWith(null)))).toContain('speaker-unverified'); // not in the sentence
    const titled = script([
      sentence('s01', 'Video s1a says "quote s1a words".', 'attributed', [
        {
          id: 's01.a',
          text: 'Video s1a says "quote s1a words".',
          kind: 'attribution',
          claims: [{ id: MLM, stance: 'asserts' }],
          evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
          quote: { text: 'quote s1a words', source: 's1a', speaker: 'Video s1a' },
        },
      ]),
    ]);
    expect(cats(v(titled, pkgWith(null)))).toEqual([]); // the source title, named in the sentence
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
    // A resolved finding (its sentence changed) is history that must stay reproducible too.
    const resolved = { ...finding(['demo/store/transcripts/s1a.txt']), fingerprint: 'stale' };
    expect(run(s, { ...r, findings: [resolved] }).issues.map((i) => i.category)).toContain('unreproducible-ref');
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
    const v2 = validateScript(s2, corpus(), read, { review: r2, previous: v1, pkg: pkg(), hashDoc: hashOf(pkg()) });
    expect(v2.resolved.map((x) => [x.explanation, x.resolvedBy])).toEqual([['say it is self-reported', 2]]);
    const v3 = validateScript(s2, corpus(), read, { review: r2, previous: v2, pkg: pkg(), hashDoc: hashOf(pkg()) });
    expect(v3.resolved.map((x) => [x.explanation, x.resolvedBy])).toEqual([['say it is self-reported', 2]]);
  });

  it('approvals lapse when the evidence package changes', () => {
    const s = good();
    const q = pkg();
    const r = { ...approveAll(s), packageFingerprint: q.fingerprint };
    const h = () => q.documents[0].sha;
    expect(validateScript(s, corpus(), read, { review: r, pkg: q, hashDoc: h }).status).toBe('passed');
    const stale = validateScript(s, corpus(), read, {
      review: { ...r, packageFingerprint: 'other' },
      pkg: q,
      hashDoc: h,
    });
    expect(stale.status).toBe('needs-review');
    expect(stale.counts.unreviewed).toBe(3);
    expect(stale.issues.map((i) => i.category)).toContain('stale-review');
    const { packageFingerprint: _drop, ...legacy } = r; // an older review file with no packageFingerprint
    void _drop;
    expect(validateScript(s, corpus(), read, { review: legacy, pkg: q, hashDoc: h }).status).toBe('needs-review');
  });

  it('a changed source document blocks', () => {
    const s = good();
    const q = pkg();
    const ok = validateScript(s, corpus(), read, { review: approveAll(s), pkg: q, hashDoc: () => q.documents[0].sha });
    expect(ok.status).toBe('passed');
    const changed = validateScript(s, corpus(), read, { review: approveAll(s), pkg: q, hashDoc: () => 'deadbeef00' });
    expect(changed.status).toBe('blocked');
    expect(changed.issues.map((i) => i.category)).toContain('stale-source');
    const missing = validateScript(s, corpus(), read, { review: approveAll(s), pkg: q, hashDoc: () => null });
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
          category: 'needs-qualification',
          reason: 'the narration says "in a narrower setting"',
        },
      },
    };
    const v1 = validateScript(s1, corpus(), read, { review: r, pkg: q, hashDoc: hashOf(q) });
    expect(v1.counts.dispositioned).toBe(1);
    expect(v1.issues.find((i) => i.category === 'needs-qualification')?.disposition).toMatch(/narrower/);
    expect(v1.status).toBe('passed');
    const s2 = script([{ ...partlySentence(), text: partlySentence().text + ' Really.' }], 2);
    const v2 = validateScript(s2, corpus(), read, { review: r, pkg: q, hashDoc: hashOf(q) });
    expect(v2.counts.dispositioned).toBe(0);
    expect(v2.counts.warnings).toBe(v1.counts.warnings + 1);
    expect(v2.issues.find((i) => i.category === 'needs-qualification')?.disposition).toBeUndefined();
  });
});

describe('release lock', () => {
  it('releaseCheck warns when the locked fingerprints no longer match', () => {
    const s = good();
    const q = pkg();
    const v = validateScript(s, corpus(), read, { review: approveAll(s, q), pkg: q, hashDoc: hashOf(q) });
    const sb = buildStoryboard(plan([scene('sc1', ['s01', 's02', 's03'])]), s, v, q, read);
    const rel: Release = {
      topic: TOPIC,
      story: s.story,
      approvedBy: 'test',
      date: 'd',
      revision: 1,
      fingerprints: {
        script: v.scriptFingerprint,
        package: q.fingerprint,
        validation: validationFingerprint(v),
        storyboard: storyboardFingerprint(sb),
      },
    };
    expect(releaseCheck(rel, v, null).map((i) => i.category)).toEqual([]);
    expect(releaseCheck({ ...rel, fingerprints: { ...rel.fingerprints, script: 'other' } }, v, null)[0].category).toBe(
      'release-stale',
    );
    expect(releaseCheck(rel, v, sb)).toEqual([]);
    expect(releaseCheck(rel, v, { ...sb, scriptFingerprint: 'other' })[0].category).toBe('release-stale');
    expect(releaseCheck(null, v, sb)).toEqual([]);
  });
});

describe('document hashing', () => {
  it('docHasher and buildPackage shas do not depend on the checkout line endings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-sha-'));
    mkdirSync(join(dir, 'demo', 'sources'), { recursive: true });
    writeFileSync(join(dir, 'demo', 'sources', 'lf.txt'), ['one', 'two', ''].join('\n'));
    writeFileSync(join(dir, 'demo', 'sources', 'crlf.txt'), ['one', 'two', ''].join('\r\n'));
    expect(docHasher(docReader(dir))('demo/sources/crlf.txt')).toBe(docHasher(docReader(dir))('demo/sources/lf.txt'));
    expect(docHasher(docReader(dir))('demo/sources/missing.txt')).toBeNull();
  });
});

describe('review fixes: sameStudy and release', () => {
  it('script validation counts documents of one study once', () => {
    const DOC_E = TOPIC + '/sources/survey-e.txt#L1-L2';
    const readE = (cite: string) => (cite === DOC_E ? 'A summary: 47% of the 601 reported losing money.' : read(cite));
    const both = claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
      verdicts: [study('Survey D', 'right', 0.7, DOC_D), study('Summary E', 'right', 0.5, DOC_E)],
    });
    const s = script([
      sentence('s01', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
        fact('s01.a', 'Of 601 participants, 47% reported losing money.', [DOC_D, DOC_E]),
      ]),
    ]);
    const independent = (sameStudy?: Record<string, string>) =>
      validateScript(s, { name: TOPIC, claims: [both], ...(sameStudy ? { sameStudy } : {}) }, readE).sentences[0]
        .assertions[0].validation.independent;
    expect(independent()).toBe(2);
    expect(independent({ 'survey-e.txt': 'survey-d.txt' })).toBe(1);
  });

  it('the release records content fingerprints of the validation and storyboard, not timestamps', () => {
    const s = good();
    const q = pkg();
    const vv = validateScript(s, corpus(), read, { review: approveAll(s, q), pkg: q, hashDoc: hashOf(q) });
    const sb = buildStoryboard(plan([scene('sc1', ['s01', 's02', 's03'])]), s, vv, q, read);
    expect(validationFingerprint({ ...vv, date: 'other' })).toBe(validationFingerprint(vv));
    const noisy = {
      ...sb,
      issues: [
        { sentence: '-', category: 'x', severity: 'warning' as const, explanation: 'x', by: 'deterministic' as const },
      ],
    };
    expect(storyboardFingerprint(noisy)).toBe(storyboardFingerprint(sb));
    const rel: Release = {
      topic: TOPIC,
      story: s.story,
      approvedBy: 'test',
      date: 'd',
      revision: 1,
      fingerprints: {
        script: vv.scriptFingerprint,
        package: q.fingerprint,
        validation: validationFingerprint(vv),
        storyboard: storyboardFingerprint(sb),
      },
    };
    expect(releaseCheck(rel, vv, sb)).toEqual([]);
    const edited = { ...sb, scenes: [{ ...sb.scenes[0], visual: { ...sb.scenes[0].visual, onScreenText: ['47%'] } }] };
    expect(releaseCheck(rel, vv, edited).map((i) => i.category)).toEqual(['release-stale']);
    const other = { ...rel, fingerprints: { ...rel.fingerprints, validation: 'x' } };
    expect(releaseCheck(other, vv, sb).map((i) => i.category)).toEqual(['release-stale']);
  });
});

describe('revision passes', () => {
  it('revisions count within the pass', () => {
    expect(revisionsInPass(blockedScript(5, { passStartRevision: 3 }))).toBe(2);
    expect(revisionsInPass(blockedScript(3))).toBe(3);
  });

  it('the revision limit applies per pass and a corrective entry lifts it', () => {
    expect(run(blockedScript(3)).status).toBe('blocked');
    expect(run(blockedScript(3)).revisionLimitReached).toBe(true);
    expect(run(blockedScript(4, { passStartRevision: 3 })).revisionLimitReached).toBe(false);
    const corr = blockedScript(4);
    corr.generation = {
      ...corr.generation,
      corrective: [{ revision: 4, reason: 'r', sentences: ['s02'], authorizedBy: 'jon' }],
    };
    expect(run(corr).revisionLimitReached).toBe(false);
  });
});

describe('lock guards', () => {
  it('approverProblem rejects placeholders', () => {
    for (const n of [
      undefined,
      '',
      '  ',
      '<name>',
      '<approver>',
      'by <name>',
      'automated: /produce run started by <your name>',
    ])
      expect(approverProblem(n)).not.toBeNull();
    for (const n of ['jon', 'Jon Borchardt', 'automated: /produce run started by jon'])
      expect(approverProblem(n)).toBeNull();
  });

  it('renderCheckProblems', () => {
    const now = { script: 's', storyboard: 'b', config: 'c' };
    const rc: RenderCheckSummary = {
      generatedAt: 'd',
      fingerprints: now,
      ok: true,
      problems: [],
      graphics: [],
      needsGraphics: [],
    };
    expect(renderCheckProblems(null, now)).toEqual(['no video/render-check.json: run npm run video -- check']);
    expect(renderCheckProblems(rc, now)).toEqual([]);
    expect(renderCheckProblems(rc, { ...now, storyboard: 'b2' })).toEqual([
      'render check is for script s / storyboard b / config c; now s / b2 / c: run npm run video -- check',
    ]);
    expect(renderCheckProblems({ ...rc, ok: false, problems: ['sc02: x'] }, now)).toEqual(['sc02: x']);
    expect(
      renderCheckProblems({ ...rc, graphics: [{ scene: 'sc18', kind: 'k', key: 'x', approved: false }] }, now),
    ).toEqual(['graphic sc18 is not approved by the visual review']);
    expect(renderCheckProblems({ ...rc, ok: false, needsGraphics: ['sc18'] }, now)).toEqual(['sc18 needs a graphic']);
  });
});

describe('short ids', () => {
  const short = 'decision:who-benefits/shorts/slower-not-faster';
  it('parses a short id and leaves a story id alone', () => {
    expect(shortOf(short)).toEqual({ parent: 'decision:who-benefits', slug: 'slower-not-faster' });
    expect(shortOf('decision:who-benefits')).toBeNull();
    expect(shortOf('a/shorts/Bad_Slug')).toBeNull();
    expect(shortId('decision:who-benefits', 'x')).toBe('decision:who-benefits/shorts/x');
  });
  it('nests the short folder in its parent and slugs the whole id', () => {
    const norm = (p: string) => p.replaceAll('\\', '/');
    expect(norm(scriptDir('ai-coding', short, '/r'))).toMatch(
      /topics\/ai-coding\/scripts\/decision-who-benefits\/shorts\/slower-not-faster$/,
    );
    expect(norm(scriptDir('ai-coding', 'decision:who-benefits', '/r'))).toMatch(
      /topics\/ai-coding\/scripts\/decision-who-benefits$/,
    );
    expect(storySlug(short)).toBe('decision-who-benefits-shorts-slower-not-faster');
  });
  it('selects the short sections from the package', () => {
    expect(sectionsFor({ short: {} as never })).toEqual(['hook', 'finding', 'close']);
    expect(sectionsFor(null)).toEqual(['hook', 'setup', 'investigation', 'answer', 'takeaway']);
  });
});
