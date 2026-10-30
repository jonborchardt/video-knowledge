// The agent-written research files: extraction batches and study verdicts are checked whole before record writes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkApplicabilityFile, checkBatches, checkStudyVerdicts, isStored, withApplicability } from '../batches';
import { citedPairs, replacedCited } from '../cited';

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
      applicability: 'direct',
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

  it('requires an applicability, and a why unless direct', () => {
    const good = {
      claim: 'demo/c',
      verdict: 'right',
      confidence: 0.7,
      note: 'gist',
      source: 'demo/sources/p.txt#L1-L2',
      applicability: 'direct',
    };
    expect(
      checkStudyVerdicts([good, { ...good, applicability: 'contextual', why: 'background on the mechanism' }]),
    ).toEqual([]);
    expect(
      checkStudyVerdicts([
        { ...good, applicability: undefined },
        { ...good, applicability: 'background' },
        { ...good, applicability: 'partial' },
      ]),
    ).toEqual([
      '[0] demo/c: applicability undefined is not one of direct, partial, contextual',
      '[1] demo/c: applicability "background" is not one of direct, partial, contextual',
      '[2] demo/c: partial needs a "why"',
    ]);
  });
  it('checkApplicabilityFile lists every malformed entry', () => {
    expect(
      checkApplicabilityFile({ 'demo/c|demo/sources/p.txt#L1-L2': { level: 'partial', reason: 'lab task' } }),
    ).toEqual([]);
    expect(checkApplicabilityFile([])).toEqual(['applicability.json is not an object']);
    expect(
      checkApplicabilityFile({
        nopipe: { level: 'direct', reason: 'x' },
        'demo/c|demo/sources/p.txt#L1': { level: 'background', reason: '' },
      }),
    ).toEqual([
      'nopipe: key is not <claim>|<cite>',
      'demo/c|demo/sources/p.txt#L1: level "background" is not one of direct, partial, contextual',
      'demo/c|demo/sources/p.txt#L1: no reason',
    ]);
  });
});

describe('recorded applicability', () => {
  it('withApplicability merges by claim and cite, latest wins, keys sorted', () => {
    const v = (claim: string, applicability: string, why?: string) => ({
      claim,
      verdict: 'right',
      confidence: 0.7,
      note: 'n',
      source: 'demo/sources/p.txt#L1-L2',
      applicability,
      ...(why ? { why } : {}),
    });
    const out = withApplicability({ 'demo/z|demo/sources/p.txt#L1-L2': { level: 'partial', reason: 'old' } }, [
      v('demo/z', 'contextual', 'background'),
      v('demo/a', 'direct'),
    ] as never);
    expect(Object.keys(out)).toEqual(['demo/a|demo/sources/p.txt#L1-L2', 'demo/z|demo/sources/p.txt#L1-L2']);
    expect(out['demo/z|demo/sources/p.txt#L1-L2']).toEqual({ level: 'contextual', reason: 'background' });
    expect(out['demo/a|demo/sources/p.txt#L1-L2']).toEqual({
      level: 'direct',
      reason: 'recorded as direct with the verdict',
    });
  });
  it('isStored matches only an identical source record', () => {
    const x = {
      claim: 'demo/a',
      verdict: 'partly',
      confidence: 0.6,
      note: 'n',
      source: 'demo/sources/p.txt#L1-L2',
      applicability: 'partial',
      why: 'w',
    } as const;
    const rec = {
      method: 'source',
      verdict: 'partly',
      confidence: 0.6,
      note: 'n',
      source: 'demo/sources/p.txt#L1-L2',
      date: '2026-10-01',
    };
    expect(isStored(x, [rec])).toBe(true);
    expect(isStored(x, [{ ...rec, note: 'other' }])).toBe(false);
    expect(isStored(x, [{ ...rec, source: 'demo/sources/p.txt#L1-L3' }])).toBe(false);
    expect(isStored(x, [{ ...rec, method: 'prior' }])).toBe(false);
  });
  it('isStored compares only with the current verdict on that document, so restoring a superseded one is recorded', () => {
    const x = {
      claim: 'demo/a',
      verdict: 'right',
      confidence: 0.7,
      note: 'v1',
      source: 'demo/sources/p.txt#L1-L2',
      applicability: 'direct',
    } as const;
    const v1 = {
      method: 'source',
      verdict: 'right',
      confidence: 0.7,
      note: 'v1',
      source: x.source,
      date: '2026-10-01',
    };
    const v2 = { ...v1, verdict: 'wrong', note: 'v2', source: 'demo/sources/p.txt#L5-L9', date: '2026-10-05' };
    expect(isStored(x, [v1, v2])).toBe(false);
    expect(isStored(x, [v2, v1])).toBe(false); // by date, not array order
    expect(isStored(x, [v1, { ...v2, source: 'demo/sources/q.txt#L1-L2' }])).toBe(true); // another document
    expect(isStored(x, [v1, { ...v1, verdict: 'wrong', note: 'v2' }])).toBe(false); // same date: the later record wins
  });
});

describe('cited verdicts', () => {
  it('an applicability-only entry on a cited pair is still a replacement', () => {
    const source = 'demo/sources/p.txt#L1-L2';
    expect(replacedCited([{ claim: 'demo/a', source }], new Map([['demo/a|demo/sources/p.txt', source]]))).toHaveLength(
      1,
    );
  });

  it('replacedCited flags any new verdict on a cited claim and document', () => {
    const cited = new Map([['t/c1|t/sources/a.txt', 't/sources/a.txt#L10-L20']]);
    expect(replacedCited([{ claim: 't/c1', source: 't/sources/a.txt#L30-L40' }], cited)).toHaveLength(1);
    expect(replacedCited([{ claim: 't/c1', source: 't/sources/a.txt#L10-L20' }], cited)).toHaveLength(1);
    expect(replacedCited([{ claim: 't/c1', source: 't/sources/b.txt#L10-L20' }], cited)).toEqual([]);
    expect(replacedCited([{ claim: 't/c2', source: 't/sources/a.txt#L30-L40' }], cited)).toEqual([]);
  });

  it("citedPairs reads every script's study evidence in a topic", () => {
    const root = mkdtempSync(join(tmpdir(), 'vk-cited-'));
    try {
      const cite = 't/sources/a.txt#L1-L2';
      const evidence = [
        { kind: 'study', claim: 't/c', cite },
        { kind: 'statement', claim: 't/c' },
      ];
      mkdirSync(join(root, 'topics', 't', 'scripts', 's'), { recursive: true });
      writeFileSync(
        join(root, 'topics', 't', 'scripts', 's', 'script.json'),
        JSON.stringify({ sections: [{ sentences: [{ assertions: [{ evidence }] }] }] }),
      );
      expect([...citedPairs('t', root)]).toEqual([['t/c|t/sources/a.txt', cite]]);
      expect(citedPairs('none', root).size).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
