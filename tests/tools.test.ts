import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDatasets } from '../src/lib/datasets';
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

// Each fixture computed by hand from the raw EIA values, constants from L119 (293.07 kWh/MMBtu, 1.036 MMBtu/Mcf).
describe('heating-cost against hand-computed fixtures', () => {
  const at = (c: number, m: number) =>
    estimate({ elec: fromCentsPerKwh(c), gas: fromDollarsPerMcf(m), afue: 0.95, cops: [2.5, 3.0] }) as Result;
  // Alabama 2024: 15.18 c/kWh (L8), $18.63/Mcf (L65)
  it('Alabama 2024: a heat pump at COP 2.5 already wins', () => {
    const r = at(15.18, 18.63);
    expect(r.ratio).toBeCloseTo(2.4739, 3);
    expect(r.breakEven).toBeCloseTo(2.3502, 3);
    expect(r.perMmbtu.furnace).toBeCloseTo(18.9291, 3);
    expect(r.perMmbtu.heatPump[0]).toBeCloseTo(17.7952, 3);
    expect(r.perMmbtu.heatPump[1]).toBeCloseTo(14.8293, 3);
    expect(r.side).toBe('heat-pump');
  });
  // Alaska 2024: 24.82 c/kWh (L9), $11.73/Mcf (L66)
  it('Alaska 2024: the furnace wins at both COPs', () => {
    const r = at(24.82, 11.73);
    expect(r.ratio).toBeCloseTo(6.4244, 3);
    expect(r.breakEven).toBeCloseTo(6.1032, 3);
    expect(r.side).toBe('furnace');
  });
  // Hawaii 2024: 42.86 c/kWh (L19), $48.88/Mcf (L76)
  it('Hawaii 2024: the break-even lies between the COPs', () => {
    const r = at(42.86, 48.88);
    expect(r.ratio).toBeCloseTo(2.6623, 3);
    expect(r.breakEven).toBeCloseTo(2.5292, 3);
    expect(r.side).toBe('depends');
  });
  // U.S. 2024, 600 therms of heating gas a year
  it('a year at U.S. prices: the furnace pays for fuel, the heat pump for delivered heat', () => {
    const us = { ...worked, cops: [2.5, 3.0] as [number, number], therms: 600 };
    const hi = estimate({ ...us, afue: 0.95 }) as Result;
    const lo = estimate({ ...us, afue: 0.8 }) as Result;
    expect(hi.annual!.furnace).toBeCloseTo(839.77, 2);
    expect(lo.annual!.furnace).toBeCloseTo(839.77, 2);
    expect(hi.annual!.heatPump[0]).toBeCloseTo(1101.19, 2);
    expect(hi.annual!.heatPump[1]).toBeCloseTo(917.66, 2);
    expect(lo.annual!.heatPump[0]).toBeCloseTo(927.32, 2);
    expect(lo.annual!.heatPump[1]).toBeCloseTo(772.77, 2);
  });
  it('the same U.S. prices typed in cents per kWh and dollars per Mcf give the $ per MMBtu answer', () => {
    const viaUnits = estimate({
      elec: convertPrice(16.48, 'kwh', 'mmbtu'),
      gas: convertPrice(14.5, 'mcf', 'mmbtu'),
      afue: 0.95,
      cops: [2.5, 3.0],
    }) as Result;
    expect(viaUnits.breakEven).toBeCloseTo(3.2783, 3);
    expect(convertPrice(14.5, 'mcf', 'therm')).toBeCloseTo(1.3996, 3);
  });
});

describe('heat-pumps state prices against the raw EIA columns', () => {
  it('every state-prices row recomputes from Parts 1 and 2 of the EIA source to the cent', () => {
    const lines = readFileSync(
      join(ROOT, 'topics/heat-pumps/sources/eia-2026-state-residential-energy-prices.txt'),
      'utf8',
    ).split(/\r?\n/);
    // field 1 of Part 1 (L7-L58) is 2024 c/kWh; field 5 of Part 2 (L64-L115) is 2024 $/Mcf
    const part = (from: number, to: number, field: number) =>
      new Map(
        lines
          .slice(from - 1, to)
          .filter((l) => l.includes('|'))
          .map((l) => l.split('|').map((f) => f.trim()))
          .map((f) => [f[0] === 'U.S. Total' ? 'U.S.' : f[0], Number(f[field])]),
      );
    const cents = part(7, 58, 1);
    const mcf = part(64, 115, 5);
    const d = loadDatasets('heat-pumps').find((x) => x.id === 'state-prices')!;
    expect(d.rows.length).toBe(52);
    expect(cents.size).toBe(52);
    expect(mcf.size).toBe(52);
    for (const row of d.rows) {
      const e = fromCentsPerKwh(cents.get(row.label)!);
      const g = fromDollarsPerMcf(mcf.get(row.label)!);
      const R = e / g;
      const want: Record<string, number> = { elec: e, gas: g, ratio: R, breakEven95: R * 0.95, breakEven80: R * 0.8 };
      d.columns.forEach((c, i) => expect(row.cells[i].display, `${row.label}/${c.key}`).toBe(want[c.key].toFixed(2)));
    }
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
