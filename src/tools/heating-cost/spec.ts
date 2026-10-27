import { type DataTable, dataRef } from '../../lib/datasets';
import type { ToolSpec } from '../index';

const SRC = 'heat-pumps/sources/eia-2026-state-residential-energy-prices.txt';

export const heatingCost: ToolSpec = {
  id: 'heating-cost',
  topic: 'heat-pumps',
  story: 'decision:is-it-cheaper-to-run-than-gas',
  // Whether a heat pump is cheaper to run than a gas furnace turns on the price ratio and the heat pump seasonal COP,
  // so the answer differs by household; the evidence gives the method, not one answer.
  justification: { model: `${SRC}#L119-L127` },
  defaults: {
    prices: dataRef('heat-pumps', 'state-prices'),
    afue: [
      { value: 0.95, cite: `${SRC}#L131` },
      { value: 0.8, cite: `${SRC}#L131` },
    ],
    cops: { value: [2.5, 3.0], cite: `${SRC}#L133` },
    // the U.S. break-even at the source's "latest" prices (Jan-Jul 2026 electricity, 2025 gas), stated, not used
    latest: { value: 3.42, cite: `${SRC}#L135` },
  },
  assumptions: [
    '1 MMBtu = 293.07 kWh.',
    'Residential natural gas carries 1.036 MMBtu per Mcf (EIA approximate U.S. average).',
    '1 therm = 0.1 MMBtu (a definition).',
    'Break-even seasonal COP = price ratio x AFUE, with prices compared per MMBtu of energy.',
    'Prices are annual averages including fixed monthly charges.',
    'The COP is a seasonal average over the heating season.',
  ],
  limitations: [
    'Ignores backup resistance heat.',
    'Ignores tiered and time-of-use rates.',
    'A household that keeps its gas connection keeps the fixed gas charge; one that disconnects saves it.',
    'Ignores installation cost.',
    'Ignores cooling.',
    'The annual figures assume all the therms entered are for heating: gas for water heating, cooking or drying, left in, makes both annual costs too high.',
  ],
  whyDefaults:
    'The efficiencies are the source’s own illustrative values: furnace AFUE 0.95 and 0.80, heat pump seasonal COP 2.5 and 3.0. Prices are the state averages from the same source, starting from the U.S. average. None was chosen to favour either machine.',
};

/** The page's provenance sentence: the price year, why that year, the retrieval date and the newer U.S. break-even. */
export const priceNote = (table: DataTable, latest: { value: number; cite: string }) =>
  `Prices are EIA ${table.asOf} averages, the latest year with both annual prices, retrieved ${table.retrieved}. With January to July 2026 electricity and 2025 gas prices, the U.S. break-even rises to ${latest.value.toFixed(2)}.`;
