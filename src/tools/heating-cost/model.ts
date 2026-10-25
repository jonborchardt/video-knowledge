// The heating-cost model: the EIA source's Method block as a function. Pure, no imports, so a browser script can bundle it.
export const KWH_PER_MMBTU = 293.07;
export const MMBTU_PER_MCF = 1.036;
export const MMBTU_PER_THERM = 0.1;

/** To $ per MMBtu. */
export const fromCentsPerKwh = (c: number) => (c * KWH_PER_MMBTU) / 100;
export const fromDollarsPerMcf = (d: number) => d / MMBTU_PER_MCF;
export const fromDollarsPerTherm = (d: number) => d / MMBTU_PER_THERM;

export interface Inputs {
  elec: number; // $ per MMBtu
  gas: number; // $ per MMBtu
  afue: number; // 0-1
  cops: [number, number]; // low, high seasonal COP
  therms?: number; // annual gas use from a bill
}
export type Side = 'heat-pump' | 'furnace' | 'depends';
export interface Result {
  ratio: number;
  breakEven: number;
  perMmbtu: { furnace: number; heatPump: [number, number] };
  annual: { furnace: number; heatPump: [number, number] } | null;
  side: Side;
}

const bad = (n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || n <= 0;

export function estimate(i: Inputs): Result | { missing: (keyof Inputs)[] } {
  const missing: (keyof Inputs)[] = [];
  if (bad(i.elec)) missing.push('elec');
  if (bad(i.gas)) missing.push('gas');
  if (bad(i.afue) || i.afue > 1) missing.push('afue');
  if (!Array.isArray(i.cops) || bad(i.cops[0]) || bad(i.cops[1])) missing.push('cops');
  if (i.therms !== undefined && bad(i.therms)) missing.push('therms');
  if (missing.length) return { missing };

  const ratio = i.elec / i.gas;
  const breakEven = ratio * i.afue;
  const [lo, hi] = [Math.min(...i.cops), Math.max(...i.cops)]; // a visitor may type the pair either way round
  const side: Side = lo > breakEven ? 'heat-pump' : hi <= breakEven ? 'furnace' : 'depends';
  let annual: Result['annual'] = null;
  if (i.therms !== undefined) {
    const mmbtu = i.therms * MMBTU_PER_THERM;
    const delivered = mmbtu * i.afue;
    annual = { furnace: mmbtu * i.gas, heatPump: [(delivered / lo) * i.elec, (delivered / hi) * i.elec] };
  }
  return {
    ratio,
    breakEven,
    perMmbtu: { furnace: i.gas / i.afue, heatPump: [i.elec / lo, i.elec / hi] },
    annual,
    side,
  };
}
