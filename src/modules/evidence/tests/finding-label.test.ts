import { describe, expect, it } from 'vitest';
import { findingLabel, labelCounts } from '../finding-label';
import { loadTopic, publicTopicNames, type Verdict } from '../topics';

const c = (decidedBy: string | null, verdict: Verdict | null, confidence: number | null) => ({
  decidedBy,
  verdict,
  confidence,
});

describe('finding labels', () => {
  it.each([
    [c(null, 'wrong', 0.5), 'reported'],
    [c(null, null, null), 'reported'],
    [c('S', 'right', 0.75), 'verified'],
    [c('S', 'wrong', 0.9), 'verified'],
    [c('S', 'right', 0.74), 'unresolved'],
    [c('S', 'partly', 0.9), 'qualification'],
    [c('S', 'untestable', null), 'unresolved'],
    [c('S', 'unknown', null), 'unresolved'],
    [c('S', null, null), 'unresolved'],
  ] as const)('findingLabel(%o) is %s', (x, want) => expect(findingLabel(x)).toBe(want));

  it('an AI guess is never a verified finding, in any public topic', () => {
    for (const n of publicTopicNames())
      for (const cl of loadTopic(n).claims) if (!cl.decidedBy) expect(findingLabel(cl)).toBe('reported');
  });

  it('labelCounts has every label', () => {
    expect(labelCounts([c('S', 'right', 0.9)])).toEqual({ verified: 1, qualification: 0, unresolved: 0, reported: 0 });
  });
});
