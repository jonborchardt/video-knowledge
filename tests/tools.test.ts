import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/lib/io';
import { passageReader } from '../src/lib/evidence';
import { loadStories } from '../src/lib/stories';
import { TOOLS, toolOf } from '../src/tools';
import {
  type Result,
  convertPrice,
  estimate,
  fromCentsPerKwh,
  fromDollarsPerMcf,
} from '../src/tools/heating-cost/model';
import { heatingCost } from '../src/tools/heating-cost/spec';

// Every file under dir, as repo-relative paths with '/' separators.
const walk = (dir: string) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((f) => join(ROOT, dir, f))
    .filter((f) => statSync(f).isFile())
    .map((f) => relative(ROOT, f).replaceAll('\\', '/'));
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
  it('takes the COP pair in either order', () => {
    const i = { ...worked, afue: 0.95, therms: 600 };
    expect(estimate({ ...i, cops: [3.0, 2.5] })).toEqual(estimate({ ...i, cops: [2.5, 3.0] }));
  });
  it('annual costs from a bill', () => {
    const r = estimate({ ...worked, afue: 0.95, cops: [2.5, 3.0], therms: 600 }) as Result;
    expect(r.annual!.furnace).toBeCloseTo(600 * 0.1 * worked.gas, 6);
    expect(r.annual!.heatPump[0]).toBeCloseTo(((600 * 0.1 * 0.95) / 2.5) * worked.elec, 6);
    expect(r.annual!.heatPump[1]).toBeCloseTo(((600 * 0.1 * 0.95) / 3.0) * worked.elec, 6);
    expect((estimate({ ...worked, afue: 0.95, cops: [2.5, 3.0] }) as Result).annual).toBeNull();
  });
});

describe('heating-cost units and limits', () => {
  it('converts a price between units, not re-reading the number', () => {
    expect(round2(convertPrice(48.3, 'mmbtu', 'kwh'))).toBe(16.48);
    expect(round2(convertPrice(14.5, 'mcf', 'mmbtu'))).toBe(14);
    expect(round2(convertPrice(1.4, 'therm', 'mcf'))).toBe(14.5);
    expect(convertPrice(convertPrice(3.21, 'kwh', 'therm'), 'therm', 'kwh')).toBeCloseTo(3.21, 9);
  });
  it('says the annual figures count every therm entered as heating', () => {
    expect(heatingCost.limitations.join(' ')).toMatch(/annual figures assume all the therms entered are for heating/);
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
  it('tools and datasets hold no outbound link', () => {
    const files = [
      ...walk('src/tools'),
      ...walk('src/components/tools'),
      ...walk('topics').filter((f) => /\/data\/[^/]+\.json$/.test(f)),
    ];
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(readFileSync(join(ROOT, f), 'utf8'), f).not.toMatch(/https?:\/\//);
  });
});
