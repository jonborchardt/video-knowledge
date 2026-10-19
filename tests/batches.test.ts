// The agent-written research files: extraction batches and study verdicts are checked whole before record writes.
import { describe, expect, it } from 'vitest';
import { checkBatches, checkStudyVerdicts } from '../src/lib/batches';
import { citedPairs, replacedCited } from '../src/lib/cited';

const claims = [{ id: 'demo/old-claim', text: 'An old claim.' }];

describe('extraction batches', () => {
  it('accepts reuse, creation, and n2 from an earlier batch', () => {
    const ok = [
      {
        video: 'v1',
        sum: 'one line',
        as: [
          { c: 'old-claim', s: 'd', q: 'not so' },
          { n: 'A new claim.', q: 'it is', v: ['partly', 0.4, 'narrower'], l: 'pro', f: true },
          { n: 'An untestable claim.', q: 'maybe', v: ['untestable', null, 'no way to tell'] },
        ],
      },
      {
        video: 'v2',
        as: [
          { n2: 'A new claim.', q: 'again' },
          { n2: 'An old claim.', q: 'old' },
        ],
      },
    ];
    expect(checkBatches(ok, 'demo', claims)).toEqual([]);
  });

  it('lists every problem at once, so nothing is recorded', () => {
    const bad = [
      {
        video: 'v1',
        as: [
          { n2: 'Created later.', q: 'too early' }, // n2 before the batch that creates it
          { n: 'Created later.', q: 'x', v: ['right', null, 'no confidence'] },
          { c: 'missing-slug', q: 'x' },
          { c: 'old-claim', n: 'both', q: 'x' },
          { n: 'No guess.', q: 'x' },
          { n: 'Bad lean.', q: 'x', v: ['wrong', 0.5, 'n'], l: 'sideways' },
          { c: 'old-claim' },
        ],
      },
      { as: 'nope' },
    ];
    expect(checkBatches(bad, 'demo', claims)).toEqual([
      'v1 as[0]: n2 matches no existing claim and no "n" in an earlier batch: Created later.',
      'v1 as[1]: right needs a confidence',
      'v1 as[2]: unknown slug missing-slug',
      'v1 as[3]: needs exactly one of "c", "n", "n2"',
      'v1 as[4]: new claim without "v": [verdict, confidence, note]: No guess.',
      'v1 as[5]: bad lean "sideways"',
      'v1 as[6]: no quote "q"',
      'batch 1: no "video" id',
      'batch 1: no "as" array',
    ]);
    expect(checkBatches({}, 'demo', claims)).toEqual(['the file is not a JSON array of batches']);
  });
});

describe('study verdicts', () => {
  it('accepts a cited verdict and flags malformed ones', () => {
    const good = {
      claim: 'demo/old-claim',
      verdict: 'partly',
      confidence: 0.6,
      note: 'gist',
      source: 'demo/sources/paper.txt#L10-L24',
    };
    expect(checkStudyVerdicts([good, { ...good, verdict: 'unknown', confidence: null }])).toEqual([]);
    expect(
      checkStudyVerdicts([
        { ...good, verdict: 'yes' },
        { ...good, confidence: 1.5 },
        { ...good, source: 'paper.txt' },
      ]),
    ).toEqual([
      '[0] demo/old-claim: verdict "yes" is not one of right, wrong, partly, untestable, unknown',
      '[1] demo/old-claim: confidence 1.5 is not a number in [0, 1]',
      '[2] demo/old-claim: "source" is not <topic>/sources/<file>.txt#L<a>-L<b>',
    ]);
  });
});

describe('cited verdicts', () => {
  it('replacedCited flags a new range on a cited claim and document', () => {
    const cited = new Map([['t/c1|t/sources/a.txt', 't/sources/a.txt#L10-L20']]);
    expect(replacedCited([{ claim: 't/c1', source: 't/sources/a.txt#L30-L40' }], cited)).toHaveLength(1);
    expect(replacedCited([{ claim: 't/c1', source: 't/sources/a.txt#L10-L20' }], cited)).toEqual([]);
    expect(replacedCited([{ claim: 't/c2', source: 't/sources/a.txt#L30-L40' }], cited)).toEqual([]);
  });

  it('citedPairs reads the committed scripts', () => {
    expect(
      citedPairs('heat-pumps').get(
        'heat-pumps/payback-should-count-only-heat-pump|heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt',
      ),
    ).toBe('heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L709-L716');
  });
});
