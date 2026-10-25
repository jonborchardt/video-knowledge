import { describe, expect, it } from 'vitest';
import { passageReader } from '../src/lib/evidence';
import { loadStories } from '../src/lib/stories';
import { TOOLS, toolOf } from '../src/tools';
import { type Result, estimate, fromCentsPerKwh, fromDollarsPerMcf } from '../src/tools/heating-cost/model';

const round2 = (n: number) => Math.round(n * 100) / 100;
const worked = { elec: fromCentsPerKwh(16.48), gas: fromDollarsPerMcf(14.5) };

describe('heating-cost model', () => {
  it('reproduces the EIA worked example', () => {
    const r = estimate({ ...worked, afue: 0.95, cops: [2.5, 3.0] }) as Result;
    expect(round2(r.ratio)).toBe(3.45);
    expect(round2(r.breakEven)).toBe(3.28);
    expect(round2(r.perMmbtu.furnace)).toBe(14.73);
    expect(r.perMmbtu.heatPump.map(round2)).toEqual([19.32, 16.1]);
    expect(r.side).toBe('furnace');
  });
  it('side is heat-pump above, furnace at or below, depends between the COPs', () => {
    const side = (elec: number, cops: [number, number]) => (estimate({ elec, gas: 10, afue: 1, cops }) as Result).side;
    expect(side(28, [2.5, 3.0])).toBe('depends'); // breakEven 2.8
    expect(side(20, [2.5, 3.0])).toBe('heat-pump');
    expect(side(30, [2.5, 3.0])).toBe('furnace'); // at the high COP
  });
  it('refuses non-positive inputs, never NaN', () => {
    expect(estimate({ elec: 0, gas: 10, afue: 1.2, cops: [0, 3] })).toEqual({ missing: ['elec', 'afue', 'cops'] });
    expect(estimate({ elec: NaN, gas: Infinity, afue: 1, cops: [2, 3], therms: 0 })).toEqual({
      missing: ['elec', 'gas', 'therms'],
    });
  });
  it('annual costs from a bill', () => {
    const r = estimate({ ...worked, afue: 0.95, cops: [2.5, 3.0], therms: 600 }) as Result;
    expect(r.annual!.furnace).toBeCloseTo(600 * 0.1 * worked.gas, 6);
    expect(r.annual!.heatPump[0]).toBeCloseTo(((600 * 0.1 * 0.95) / 2.5) * worked.elec, 6);
    expect(r.annual!.heatPump[1]).toBeCloseTo(((600 * 0.1 * 0.95) / 3.0) * worked.elec, 6);
    expect((estimate({ ...worked, afue: 0.95, cops: [2.5, 3.0] }) as Result).annual).toBeNull();
  });
});

describe('tool registry', () => {
  it('every tool is for a decision story, with cited defaults that resolve and carry their figures', () => {
    const read = passageReader();
    for (const t of Object.values(TOOLS)) {
      const s = loadStories(t.topic)!.stories.find((x) => x.id === t.story)!;
      expect(s.kind).toBe('decision');
      expect(toolOf(t.topic, t.story)).toBe(t);
      expect(read(t.justification.model)).toContain('293.07');
      const d = t.defaults as { afue: { value: number; cite: string }[]; cops: { value: number[]; cite: string } };
      for (const a of d.afue) expect(read(a.cite)).toContain(a.value.toFixed(2));
      expect(read(d.cops.cite)).toMatch(/COP 2\.5 .*COP 3\.0/);
    }
    expect(toolOf('heat-pumps', 'nope')).toBeNull();
  });
});
