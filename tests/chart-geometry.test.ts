import { describe, expect, it } from 'vitest';
import { barGeometry, chartProblems } from '../src/lib/chart-geometry';
import type { ChartPoint, Unit } from '../src/lib/storyboard';

const pt = (label: string, value: number, unit: Unit = 'count'): ChartPoint => ({
  label,
  value,
  unit,
  display: String(value),
  cite: 'x#L1',
});

describe('chart geometry', () => {
  it('the largest bar fills the width from a zero baseline', () => {
    const b = barGeometry([pt('a', 10), pt('b', 5)], 200, 40);
    expect(b.map((x) => [x.x, x.w])).toEqual([
      [0, 200],
      [0, 100],
    ]);
    expect(b[1].y).toBeGreaterThan(b[0].y);
  });
  it('mixed units are a problem', () =>
    expect(chartProblems({ type: 'bar', points: [pt('a', 1, 'usd'), pt('b', 1, 'percent')] })).toEqual([
      'mixed units: usd, percent',
    ]));
  it('a percent over 100 and an empty chart are problems', () => {
    expect(chartProblems({ type: 'bar', points: [pt('a', 120, 'percent')] })).toHaveLength(1);
    expect(chartProblems({ type: 'bar', points: [] })).toEqual(['no points']);
  });
});
