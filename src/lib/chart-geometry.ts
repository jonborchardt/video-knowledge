// Static charts for the site: the problems that make a chart misleading, and the bars a horizontal chart draws.
import type { ChartPoint, ChartSpec } from './storyboard';

export interface Bar {
  label: string;
  display: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What would make the chart mislead: no points, one scale over mixed units, a percent over 100. */
export function chartProblems(spec: ChartSpec): string[] {
  if (!spec.points.length) return ['no points'];
  const out: string[] = [];
  const units = [...new Set(spec.points.map((p) => p.unit))];
  if (units.length > 1) out.push(`mixed units: ${units.join(', ')}`);
  for (const p of spec.points) if (p.unit === 'percent' && p.value > 100) out.push(`"${p.label}": ${p.value} percent`);
  return out;
}

/** Horizontal bars from a zero baseline: the largest value fills `width`, equal rows over `height`. A bar takes the
 *  middle half of its row, leaving the top of the row for its label. */
export function barGeometry(points: ChartPoint[], width: number, height: number): Bar[] {
  const max = Math.max(...points.map((p) => p.value), 0);
  const row = height / points.length;
  return points.map((p, i) => ({
    label: p.label,
    display: p.display,
    x: 0,
    y: i * row + row * 0.4,
    w: max > 0 ? (Math.max(p.value, 0) / max) * width : 0,
    h: row * 0.5,
  }));
}
