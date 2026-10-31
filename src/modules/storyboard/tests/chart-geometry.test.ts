import { describe, expect, it } from 'vitest';
import { barGeometry, chartProblems, datasetChart } from '../chart-geometry';
import type { ChartPoint, DataTable, Unit } from '../../../shared/types';

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
    expect(b.map((x) => x.w)).toEqual([200, 100]);
    expect(b[1].y).toBeGreaterThan(b[0].y);
  });
  it('mixed units are a problem', () =>
    expect(chartProblems({ type: 'bar', points: [pt('a', 1, 'usd'), pt('b', 1, 'percent')] })).toEqual([
      'mixed units: usd, percent',
    ]));
  it('dollars and pounds on one chart are mixed units', () =>
    expect(chartProblems({ type: 'stat-tiles', points: [pt('a', 1, 'usd'), pt('b', 1, 'gbp')] })).toEqual([
      'mixed units: usd, gbp',
    ]));
  it('a ratio point in a chart drawn to length is a problem (its value is a denominator); stat tiles only print it', () => {
    const ratio: ChartPoint = { label: 'odds', value: 238, unit: 'ratio', display: '1 in 238', cite: 'x#L1' };
    for (const type of ['bar', 'stacked-bar', 'dot-plot'] as const)
      expect(chartProblems({ type, points: [ratio] })).toEqual(['"odds": a ratio cannot be drawn to length']);
    expect(chartProblems({ type: 'stat-tiles', points: [ratio] })).toEqual([]);
  });
  it('a percent over 100 and an empty chart are problems', () => {
    expect(chartProblems({ type: 'bar', points: [pt('a', 120, 'percent')] })).toHaveLength(1);
    expect(chartProblems({ type: 'bar', points: [] })).toEqual(['no points']);
  });

  describe('datasetChart', () => {
    const table = (keys: string[], rows: ChartPoint[][]): DataTable => ({
      id: 't',
      title: 'T',
      asOf: '2024',
      retrieved: '2026-10-18',
      columns: keys.map((k) => ({ key: k, label: k })),
      rows: rows.map((cells, i) => ({ label: `r${i}`, cells })),
    });
    it('one column of one unit is a bar chart labelled by row', () => {
      const c = datasetChart(table(['a'], [[pt('x', 1)], [pt('y', 2)]]));
      expect(c?.type).toBe('bar');
      expect(c?.points.map((p) => p.label)).toEqual(['r0', 'r1']);
    });
    it('several columns or mixed units draw no chart', () => {
      expect(datasetChart(table(['a', 'b'], [[pt('x', 1), pt('y', 2)]]))).toBeNull();
      expect(datasetChart(table(['a'], [[pt('x', 1)], [pt('y', 2, 'usd')]]))).toBeNull();
    });
  });
});
