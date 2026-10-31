import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docKey, studyVerdicts, validate } from '../src/shared/evidence-gate';
import { passageReader } from '../src/shared/io';
import type { Assertion } from '../src/shared/types';
import { DOC_A, DOC_B, DOC_C, claim, corpus, guess, reader, sources, study } from './corpus';

const FASTER = 'AI tools make experienced developers faster';
const faster = (id = 'faster') => `demo/${id}`;
const fact = (
  text: string,
  evidence: Assertion['evidence'],
  stance: 'asserts' | 'denies' = 'asserts',
  id = faster(),
): Assertion => ({
  id: 'a1',
  text,
  kind: 'fact',
  claims: [{ id, stance }],
  evidence,
});
const studyRef = (cite: string, id = faster()) => ({ kind: 'study' as const, claim: id, cite });

describe('evidence validator', () => {
  it('many sources repeating a claim do not verify it', () => {
    const c = claim('faster', FASTER, { verdicts: [guess('right', 0.5)], sources: sources(10) });
    const v = validate(
      fact(FASTER, [
        { kind: 'guess', claim: c.id },
        ...c.sources.map((s) => ({ kind: 'statement' as const, claim: c.id, source: s.id })),
      ]),
      corpus(c),
      reader,
    );
    expect(v.status).toBe('unverified');
    expect(v.decision).toBe('blocked');
    expect(v.supporting).toHaveLength(0);
    expect(v.suggestions.join(' ')).toMatch(/Attribute/);
  });

  it('a claim contradicted by independent evidence is unsupported', () => {
    const c = claim('faster', FASTER, {
      verdicts: [guess('right', 0.5), study('RCT A', 'wrong', 0.8, DOC_A)],
      sources: sources(5),
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader);
    expect(v.status).toBe('unsupported');
    expect(v.decision).toBe('blocked');
    expect(v.contradicting[0].by).toBe('RCT A');
    // The same evidence supports the denial.
    const d = validate(
      fact(`The evidence does not support "${FASTER}"`, [studyRef(DOC_A)], 'denies'),
      corpus(c),
      reader,
    );
    expect(d.status).toBe('supported');
    expect(d.decision).toBe('approved');
    expect(d.review).toBe(false);
  });

  it('two legitimate studies disagreeing make the fact disputed and the disagreement supported', () => {
    const c = claim('faster', FASTER, {
      verdicts: [study('RCT A', 'right', 0.7, DOC_A), study('Field C', 'wrong', 0.6, DOC_C)],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader);
    expect(v.status).toBe('disputed');
    expect(v.decision).toBe('qualify');
    expect(v.contradicting[0].cited).toBe(false); // the uncited study still shows up
    const d = validate(
      { ...fact(`Studies disagree on whether ${FASTER}`, [studyRef(DOC_A), studyRef(DOC_C)]), kind: 'disagreement' },
      corpus(c),
      reader,
    );
    expect(d.status).toBe('supported');
    expect(d.decision).toBe('approved');
  });

  it('a study that supports only a weaker statement yields qualified, not approved', () => {
    const c = claim('faster', FASTER, { verdicts: [study('Survey B', 'partly', 0.6, DOC_B)] });
    const v = validate(fact(FASTER, [studyRef(DOC_B)]), corpus(c), reader);
    expect(v.status).toBe('qualified');
    expect(v.decision).toBe('qualify');
    expect(v.limitations[0]).toMatch(/Survey B/);
  });

  it('a figure absent from the cited evidence blocks the assertion', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    const ok = validate(fact(`${FASTER}, by 26 percent`, [studyRef(DOC_A)]), corpus(c), reader);
    expect(ok.status).toBe('supported'); // 26 is in the passage
    const bad = validate(fact(`${FASTER}, by 55 percent`, [studyRef(DOC_A)]), corpus(c), reader);
    expect(bad.status).toBe('unverified');
    expect(bad.decision).toBe('blocked');
    expect(bad.limitations.join(' ')).toMatch(/"55"/);
    expect(bad.suggestions.join(' ')).toMatch(/Drop "55"/);
  });

  it('absolute wording needs the qualification the evidence carries', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.6, DOC_A)] });
    const v = validate(
      fact(`AI tools always make experienced developers faster`, [studyRef(DOC_A)]),
      corpus(c),
      reader,
    );
    expect(v.status).toBe('qualified');
    expect(v.decision).toBe('qualify');
    expect(v.review).toBe(true);
    expect(v.limitations.join(' ')).toMatch(/"always"/);
  });

  it('a citation to a missing source, verdict or passage fails closed', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    for (const ref of [
      studyRef('demo/sources/nope.txt#L1-L2'),
      studyRef(DOC_A, 'demo/no-such-claim'),
      { kind: 'statement' as const, claim: c.id, source: 'ghost' },
    ]) {
      const v = validate({ ...fact(FASTER, [ref]), claims: [{ id: c.id, stance: 'asserts' }] }, corpus(c), reader);
      expect(v.decision).toBe('blocked');
      expect(v.status).toBe('unverified');
      expect(v.problems.length).toBeGreaterThan(0);
    }
    // A verdict exists but its passage does not: still blocked.
    const d = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, 'demo/sources/rct-a.txt#L999')] });
    const v = validate(fact(FASTER, [studyRef('demo/sources/rct-a.txt#L999')]), corpus(d), reader);
    expect(v.problems[0]).toMatch(/passage not found/);
  });

  it('a confident AI guess is not verification', () => {
    const c = claim('faster', FASTER, { verdicts: [guess('right', 0.95)] });
    const v = validate(fact(FASTER, [{ kind: 'guess', claim: c.id }]), corpus(c), reader);
    expect(v.status).toBe('unverified');
    expect(v.decision).toBe('blocked');
    expect(v.limitations[0]).toMatch(/AI guess/);
  });

  it('attributing a claim to its sources passes without endorsing it', () => {
    const c = claim('income', 'Day trading reliably produces income', {
      verdicts: [guess('wrong', 0.5)],
      sources: sources(3),
    });
    const refs = c.sources.map((s) => ({ kind: 'statement' as const, claim: c.id, source: s.id }));
    const v = validate(
      {
        id: 'a',
        text: `Several influencers claim "${c.text}"`,
        kind: 'attribution',
        claims: [{ id: c.id, stance: 'asserts' }],
        evidence: refs,
      },
      corpus(c),
      reader,
    );
    expect(v.status).toBe('supported');
    expect(v.decision).toBe('approved');
    expect(v.limitations[0]).toMatch(/not whether it is true/);
    // "Several" needs more than one distinct channel.
    const one = validate(
      {
        id: 'a',
        text: `Several influencers claim "${c.text}"`,
        kind: 'attribution',
        claims: [{ id: c.id, stance: 'asserts' }],
        evidence: refs.slice(0, 1),
      },
      corpus(c),
      reader,
    );
    expect(one.decision).toBe('blocked');
    // The bare fact is still blocked.
    const bare = validate(
      { id: 'b', text: c.text, kind: 'fact', claims: [{ id: c.id, stance: 'asserts' }], evidence: refs },
      corpus(c),
      reader,
    );
    expect(bare.decision).toBe('blocked');
  });

  it('paraphrases are flagged for review; canonical wording with strong support is not', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    expect(validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader).review).toBe(false);
    const p = validate(fact('Experienced developers get faster with AI tools', [studyRef(DOC_A)]), corpus(c), reader);
    expect(p.status).toBe('supported');
    expect(p.review).toBe(true);
    expect(p.verbatim).toBe(false);
  });

  it('the latest verdict per document wins', () => {
    const c = claim('faster', FASTER, {
      verdicts: [study('RCT A', 'right', 0.8, DOC_A), { ...study('RCT A', 'unknown', 0, DOC_A), date: '2026-03-01' }],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader);
    expect(v.supporting).toHaveLength(0); // the retraction is what counts
    expect(v.status).toBe('unverified');
  });

  it('a verdict whose note limits its own scope is partial, so the sentence needs qualification', () => {
    const c = claim('faster', FASTER, {
      verdicts: [
        study(
          'Futures study',
          'wrong',
          0.6,
          DOC_C,
          'Developers were slower, though the setting was a lab task rather than real work.',
        ),
      ],
    });
    const v = validate(
      fact(`The evidence does not support "${FASTER}"`, [studyRef(DOC_C)], 'denies'),
      corpus(c),
      reader,
    );
    expect(v.supporting).toHaveLength(0);
    expect(v.qualifying[0].applicability).toBe('partial');
    expect(v.qualifying[0].basis).toBe('heuristic');
    expect(v.status).toBe('qualified');
    expect(v.decision).toBe('qualify');
  });

  it('a base rate contradicts a "most" claim directly but is only context for a "can" claim', () => {
    const note = 'Among 1,551 persistent day traders only 0.5% beat a wage.';
    const most = claim('most', 'Most retail day traders make money', {
      verdicts: [study('Futures study', 'wrong', 0.7, DOC_C, note)],
    });
    const m = validate(
      {
        ...fact('Most retail day traders make money', [studyRef(DOC_C, most.id)]),
        claims: [{ id: most.id, stance: 'asserts' }],
      },
      corpus(most),
      reader,
    );
    expect(m.modality).toBe('typical');
    expect(m.status).toBe('unsupported');
    const can = claim('can', 'An experienced day trader can multiply a small account within a month', {
      verdicts: [study('Futures study', 'wrong', 0.7, DOC_C, note)],
    });
    const v = validate(
      {
        ...fact(`The evidence does not support "${can.text}"`, [studyRef(DOC_C, can.id)], 'denies'),
        claims: [{ id: can.id, stance: 'denies' }],
      },
      corpus(can),
      reader,
    );
    expect(v.modality).toBe('possibility');
    expect(v.supporting).toHaveLength(0);
    expect(v.context[0].applicability).toBe('contextual');
    expect(v.status).toBe('unverified');
    expect(v.decision).toBe('blocked');
    expect(v.suggestions.join(' ')).toMatch(/base rate/);
  });

  it('a reviewer judgment overrides the heuristic applicability', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    const key = `${c.id}|asserts|${DOC_A}`;
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'contextual', reason: 'different population' },
    });
    expect(v.supporting).toHaveLength(0);
    expect(v.context[0].basis).toBe('review');
    expect(v.context[0].why).toBe('different population');
    expect(v.status).toBe('unverified');
    const up = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'direct', reason: 'same task' },
    });
    expect(up.status).toBe('supported');
  });

  it('citing a document on one claim does not hide its verdict on another claim', () => {
    const a = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    const b = claim('quality', 'AI tools raise code quality', {
      verdicts: [study('RCT A', 'wrong', 0.7, 'demo/sources/rct-a.txt#L10-L11')],
    });
    const v = validate(
      {
        id: 'x',
        text: 'AI tools make experienced developers faster and raise code quality',
        kind: 'fact',
        claims: [
          { id: a.id, stance: 'asserts' },
          { id: b.id, stance: 'asserts' },
        ],
        evidence: [studyRef(DOC_A)],
      },
      corpus(a, b),
      (cite) => (cite.startsWith('demo/sources/rct-a.txt') ? 'passage' : null),
    );
    expect(v.status).toBe('disputed');
    expect(v.contradicting[0].cited).toBe(false);
  });

  it('denying a claim that contains an absolute word is not penalised for the word', () => {
    const c = claim('always', 'AI tools always make developers faster', {
      verdicts: [study('RCT A', 'wrong', 0.7, DOC_A)],
    });
    const v = validate(
      fact(`The evidence does not support "${c.text}"`, [studyRef(DOC_A, c.id)], 'denies', c.id),
      corpus(c),
      reader,
    );
    expect(v.status).toBe('supported');
    expect(v.decision).toBe('approved');
    expect(v.limitations.join(' ')).not.toMatch(/stronger than the evidence/);
  });

  it('a counted attribution needs that many cited sources', () => {
    const c = claim('income', 'Day trading reliably produces income', { sources: sources(3) });
    const refs = c.sources.map((s) => ({ kind: 'statement' as const, claim: c.id, source: s.id }));
    const base = {
      id: 'a',
      text: `3 sources claim "${c.text}"`,
      kind: 'attribution' as const,
      claims: [{ id: c.id, stance: 'asserts' as const }],
    };
    expect(validate({ ...base, evidence: refs }, corpus(c), reader).decision).toBe('approved');
    expect(validate({ ...base, evidence: refs.slice(0, 2) }, corpus(c), reader).decision).toBe('blocked');
  });

  it('passageReader returns the cited lines and null for anything else', () => {
    const read = passageReader();
    expect(read('ai-coding/sources/2507.09089v2.txt#L11-L12')).toMatch(/randomized controlled trial/);
    expect(read('ai-coding/sources/2507.09089v2.txt#L999999')).toBeNull();
    expect(read('ai-coding/sources/missing.txt#L1')).toBeNull();
    expect(read('not a cite')).toBeNull();
  });

  it('a figure present only in the verdict note does not count', () => {
    const c = claim('faster', FASTER, {
      verdicts: [study('RCT A', 'right', 0.8, DOC_A, 'The trial reported a 26 percent gain among 601 developers.')],
    });
    const v = validate(fact(`${FASTER} among 601 developers`, [studyRef(DOC_A)]), corpus(c), reader);
    expect(v.decision).toBe('blocked');
    expect(v.limitations.join(' ')).toMatch(/"601"/);
  });

  it('a figure the passage states in words is accepted when the sentence uses digits, and vice versa', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    expect(validate(fact(`${FASTER}, by 26 percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe('approved');
    expect(validate(fact(`${FASTER}, by twenty-six percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe(
      'approved',
    );
    expect(validate(fact(`${FASTER}, by twenty-five percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe(
      'blocked',
    );
  });

  it('two documents marked sameStudy count as one independent source', () => {
    const same = { 'survey-b.txt': 'rct-a.txt' };
    const c = claim('faster', FASTER, {
      verdicts: [study('RCT A', 'right', 0.7, DOC_A), study('Summary B', 'right', 0.5, DOC_B)],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A), studyRef(DOC_B)]), { ...corpus(c), sameStudy: same }, reader);
    expect(v.supporting).toHaveLength(2);
    expect(v.independent).toBe(1);
    expect(validate(fact(FASTER, [studyRef(DOC_A), studyRef(DOC_B)]), corpus(c), reader).independent).toBe(2);
  });

  it('docKey follows one hop and ignores cycles', () => {
    expect(docKey('demo/sources/b.txt#L1', { 'b.txt': 'a.txt', 'a.txt': 'b.txt' })).toBe('demo/sources/a.txt');
    expect(docKey('demo/sources/a.txt#L1', { 'a.txt': 'a.txt' })).toBe('demo/sources/a.txt');
    expect(docKey('demo/sources/a.txt#L1')).toBe('demo/sources/a.txt');
  });

  it('the primary report, not its summary, is the one verdict per study', () => {
    const same = { 'survey-b.txt': 'rct-a.txt' };
    const c = claim('faster', FASTER, {
      verdicts: [
        study('RCT A', 'right', 0.7, DOC_A),
        { ...study('Summary B', 'partly', 0.5, DOC_B), date: '2026-05-01' }, // newer, but a summary
      ],
    });
    expect(studyVerdicts(c, same).map((v) => v.by)).toEqual(['RCT A']);
    expect(
      studyVerdicts(c)
        .map((v) => v.by)
        .sort(),
    ).toEqual(['RCT A', 'Summary B']);
  });

  it('a figure that is part of the referenced claim wording is not an invented figure', () => {
    const TENX = 'Engineers using AI agents are ten times as productive';
    const c = claim('tenx', TENX, { verdicts: [study('Field C', 'wrong', 0.7, DOC_C, 'measured 18%, not 10x')] });
    const passageWithoutTen = (cite: string) => (cite === DOC_C ? 'experienced developers were slower' : null);
    const d = validate(
      fact(`The evidence does not support "${TENX}"`, [studyRef(DOC_C, c.id)], 'denies', c.id),
      corpus(c),
      passageWithoutTen,
    );
    expect(d.decision).toBe('approved');
    const extra = validate(
      fact(`The evidence does not support "${TENX}" in 2024`, [studyRef(DOC_C, c.id)], 'denies', c.id),
      corpus(c),
      passageWithoutTen,
    );
    expect(extra.decision).toBe('blocked');
    expect(extra.limitations.join(' ')).toMatch(/"2024"/);
  });

  it('rejects a figure that rounds a passage figure', () => {
    const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
    expect(validate(fact(`${FASTER}, by about 25 percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe(
      'blocked',
    );
  });
});

describe('recorded applicability', () => {
  const rec = (level: 'direct' | 'partial' | 'contextual', reason = 'recorded reason') => ({
    applicability: { level, reason },
  });
  const key = `${faster()}|asserts|${DOC_A}`;

  it('a verdict recorded as contextual never supports, whatever a reviewer says', () => {
    const c = claim('faster', FASTER, {
      verdicts: [{ ...study('RCT A', 'right', 0.8, DOC_A), ...rec('contextual', 'background on the mechanism') }],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'direct', reason: 'same task' },
    });
    expect(v.supporting).toHaveLength(0);
    expect(v.context[0].basis).toBe('recorded');
    expect(v.context[0].why).toBe('background on the mechanism');
    expect(v.status).toBe('unverified');
    expect(v.decision).toBe('blocked');
  });

  it('a recorded partial caps a reviewer direct at partial', () => {
    const c = claim('faster', FASTER, { verdicts: [{ ...study('RCT A', 'right', 0.8, DOC_A), ...rec('partial') }] });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'direct', reason: 'same task' },
    });
    expect(v.qualifying[0].applicability).toBe('partial');
    expect(v.qualifying[0].basis).toBe('recorded');
    expect(v.status).toBe('qualified');
  });

  it('a reviewer may narrow a recorded direct', () => {
    const c = claim('faster', FASTER, { verdicts: [{ ...study('RCT A', 'right', 0.8, DOC_A), ...rec('direct') }] });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'contextual', reason: 'different task' },
    });
    expect(v.context[0].basis).toBe('review');
    expect(v.status).toBe('unverified');
  });

  it('a reviewer may widen the wording heuristic up to the recorded level', () => {
    const c = claim('faster', FASTER, {
      verdicts: [{ ...study('RCT A', 'right', 0.8, DOC_A, 'Faster, though in a lab task.'), ...rec('direct') }],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader, {
      [key]: { level: 'direct', reason: 'the lab task is the claim' },
    });
    expect(v.supporting[0].basis).toBe('review');
    expect(v.status).toBe('supported');
  });

  it('an unrecorded verdict keeps the heuristic exactly', () => {
    const a = fact(FASTER, [studyRef(DOC_A), studyRef(DOC_B)]);
    const plain = claim('faster', FASTER, {
      verdicts: [study('RCT A', 'right', 0.8, DOC_A), study('Survey B', 'right', 0.6, DOC_B, 'though self-reported')],
    });
    const recorded = claim('faster', FASTER, {
      verdicts: [
        { ...study('RCT A', 'right', 0.8, DOC_A), ...rec('direct') },
        { ...study('Survey B', 'right', 0.6, DOC_B, 'though self-reported'), ...rec('direct') },
      ],
    });
    expect(validate(a, corpus(plain), reader)).toEqual(validate(a, corpus(recorded), reader));
  });

  it('the recorded ceiling holds for either stance', () => {
    const c = claim('faster', FASTER, {
      verdicts: [{ ...study('RCT A', 'wrong', 0.8, DOC_A), ...rec('contextual', 'background') }],
    });
    const v = validate(
      fact(`The evidence does not support "${FASTER}"`, [studyRef(DOC_A)], 'denies'),
      corpus(c),
      reader,
      {
        [`${faster()}|denies|${DOC_A}`]: { level: 'direct', reason: 'same task' },
      },
    );
    expect(v.supporting).toHaveLength(0);
    expect(v.context[0].basis).toBe('recorded');
  });

  it('a recorded level belongs to its cite, not to the document', () => {
    const wider = 'demo/sources/rct-a.txt#L10-L14';
    const read = (cite: string) =>
      cite === wider ? 'Developers finished tasks faster, across all three sites.' : reader(cite);
    const c = claim('faster', FASTER, {
      verdicts: [
        { ...study('RCT A', 'right', 0.8, DOC_A), ...rec('contextual', 'background') },
        { ...study('RCT A', 'right', 0.8, wider, 'RCT A wider note'), date: '2026-02-01', ...rec('direct') },
      ],
    });
    const v = validate(fact(FASTER, [studyRef(wider)]), corpus(c), read);
    expect(v.supporting[0].ref).toMatchObject({ cite: wider });
    expect(v.status).toBe('supported');
  });

  it('a figure only in a contextual passage is not verified', () => {
    const c = claim('faster', FASTER, {
      verdicts: [
        { ...study('RCT A', 'right', 0.8, DOC_A), ...rec('contextual', 'background') },
        { ...study('Survey B', 'right', 0.8, DOC_B), ...rec('direct') },
      ],
    });
    const v = validate(
      fact('AI tools make experienced developers 26 percent faster', [studyRef(DOC_A), studyRef(DOC_B)]),
      corpus(c),
      reader,
    );
    expect(v.limitations).toContain('The figure "26" does not appear in the cited passages.');
    expect(v.decision).toBe('blocked');
  });

  it('a contextual passage cannot make one side of a disagreement', () => {
    const c = claim('faster', FASTER, {
      verdicts: [
        { ...study('RCT A', 'right', 0.8, DOC_A), ...rec('contextual', 'background') },
        study('Field C', 'wrong', 0.7, DOC_C),
      ],
    });
    const v = validate(
      { ...fact(`Studies disagree on whether ${FASTER}`, [studyRef(DOC_A), studyRef(DOC_C)]), kind: 'disagreement' },
      corpus(c),
      reader,
    );
    expect(v.status).toBe('unsupported');
  });

  it('a recorded contextual contradiction is listed, not hidden', () => {
    const c = claim('faster', FASTER, {
      verdicts: [
        { ...study('RCT A', 'right', 0.8, DOC_A), ...rec('direct') },
        { ...study('Field C', 'wrong', 0.7, DOC_C), ...rec('contextual', 'background') },
      ],
    });
    const v = validate(fact(FASTER, [studyRef(DOC_A)]), corpus(c), reader);
    expect(v.status).toBe('supported');
    expect(v.contradicting).toHaveLength(0);
    expect(v.limitations.some((l) => l.startsWith('Context only, '))).toBe(true);
  });
});

describe('line endings', () => {
  it('passageReader returns the same text for an LF and a CRLF checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-eol-'));
    mkdirSync(join(dir, 'topics', 'demo', 'sources'), { recursive: true });
    writeFileSync(join(dir, 'topics', 'demo', 'sources', 'lf.txt'), 'one\ntwo\nthree\n');
    writeFileSync(join(dir, 'topics', 'demo', 'sources', 'crlf.txt'), 'one\r\ntwo\r\nthree\r\n');
    expect(passageReader(dir)('demo/sources/crlf.txt#L1-L2')).toBe(passageReader(dir)('demo/sources/lf.txt#L1-L2'));
    expect(passageReader(dir)('demo/sources/crlf.txt#L2')).toBe('two');
  });
});
