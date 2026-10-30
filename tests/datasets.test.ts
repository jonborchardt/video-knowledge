import { describe, expect, it } from 'vitest';
import {
  DATASET_MAX_AGE_DAYS,
  type DataTable,
  dataRef,
  datasetAgeDays,
  datasetProblems,
  loadDatasets,
} from '../src/lib/datasets';
import { type PassageReader } from '../src/shared/types';
import { passageReader } from '../src/shared/io';
import { publicTopicNames } from '../src/lib/topics';
import { TOOLS } from '../src/tools';

const CITE = 'x/sources/prices.txt#L2';
const HEAD = 'x/sources/prices.txt#L1';
const read: PassageReader = (cite) =>
  cite === CITE ? 'Alabama | 44.49 | 17.98' : cite === HEAD ? 'Source: EIA (retrieved 2026-10-18)' : null;
const cell = (value: number, display: string, cite = CITE) => ({
  label: 'v',
  value,
  unit: 'usd' as const,
  display,
  cite,
});
const table = (rows: DataTable['rows']): DataTable => ({
  id: 't',
  title: 'T',
  asOf: '2024 annual',
  retrieved: '2026-10-18',
  columns: [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
  ],
  rows,
});

describe('datasets', () => {
  it('a clean table has no problems', () => {
    expect(
      datasetProblems(table([{ label: 'Alabama', cells: [cell(44.49, '44.49'), cell(17.98, '17.98')] }]), read),
    ).toEqual([]);
  });
  it('a cell whose figure is not in its passage is a problem', () => {
    const p = datasetProblems(table([{ label: 'Alabama', cells: [cell(44.49, '44.49'), cell(19.99, '19.99')] }]), read);
    expect(p.join('\n')).toContain('"19.99" is not in');
  });
  it("in a '|' table line, the row label is the first field and each cell its own column's field", () => {
    const swapped = datasetProblems(
      table([{ label: 'Alabama', cells: [cell(17.98, '17.98'), cell(44.49, '44.49')] }]),
      read,
    );
    expect(swapped).toEqual([
      'cell "Alabama/a": display "17.98" is not field 2 of its line ("44.49")',
      'cell "Alabama/b": display "44.49" is not field 3 of its line ("17.98")',
    ]);
    const relabelled = datasetProblems(
      table([{ label: 'Alaska', cells: [cell(44.49, '44.49'), cell(17.98, '17.98')] }]),
      read,
    );
    expect(relabelled.join('\n')).toContain('row "Alaska" is not the first field of its line ("Alabama")');
    const spaced: PassageReader = (c) => (c === CITE ? '  Alabama   |  44.49 |17.98 ' : read(c));
    expect(
      datasetProblems(table([{ label: 'Alabama', cells: [cell(44.49, '44.49'), cell(17.98, '17.98')] }]), spaced),
    ).toEqual([]);
  });
  it('a row with the wrong number of cells is a problem', () => {
    expect(datasetProblems(table([{ label: 'Alabama', cells: [cell(44.49, '44.49')] }]), read)).toContain(
      'row "Alabama": 1 cells for 2 columns',
    );
  });
  it('a cell citing a passage that does not exist is a problem', () => {
    const none = 'x/sources/none.txt#L1';
    const p = datasetProblems(table([{ label: 'Alabama', cells: [cell(1, '1', none), cell(2, '2', none)] }]), read);
    expect(p).toContain(`cell "Alabama": no passage at ${none}`);
  });
  it('a dataset must carry the retrieval date its source states', () => {
    const ok = table([{ label: 'Alabama', cells: [cell(44.49, '44.49'), cell(17.98, '17.98')] }]);
    expect(datasetProblems(ok, read)).toEqual([]);
    expect(datasetProblems({ ...ok, retrieved: '2025-01-01' }, read)).toEqual([
      'prices.txt: line 1 does not say "retrieved 2025-01-01"',
    ]);
    expect(datasetProblems({ ...ok, retrieved: 'last week' }, read)).toContain('retrieved "last week" is not a date');
    expect(datasetProblems(ok, read, '2026-10-17')).toContain('retrieved 2026-10-18 is after today (2026-10-17)');
    expect(datasetProblems(ok, read, '2026-10-18')).toEqual([]);
  });
  it('a dataset ages from its retrieval date', () => {
    const d = table([]);
    expect(datasetAgeDays(d, '2026-10-18')).toBe(0);
    expect(datasetAgeDays(d, '2027-10-18')).toBe(365);
  });
  it('every dataset a tool uses is younger than DATASET_MAX_AGE_DAYS', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const t of Object.values(TOOLS)) {
      const ref = (t.defaults as { prices?: string }).prices;
      const d = loadDatasets(t.topic).find((x) => dataRef(t.topic, x.id) === ref);
      if (!d) continue;
      expect(
        datasetAgeDays(d, today),
        `${ref} retrieved ${d.retrieved}: refresh it (README, Refreshing a dataset)`,
      ).toBeLessThanOrEqual(DATASET_MAX_AGE_DAYS);
    }
  });
  it('every committed dataset is clean and ids are unique per topic', () => {
    for (const n of publicTopicNames()) {
      const ds = loadDatasets(n);
      expect(new Set(ds.map((d) => d.id)).size).toBe(ds.length);
      for (const d of ds) expect(datasetProblems(d, passageReader()), `${n}/${d.id}`).toEqual([]);
    }
  });
});

describe('heat-pumps datasets', () => {
  it('state-prices carries the U.S. row as the source prints it', () => {
    const d = loadDatasets('heat-pumps').find((x) => x.id === 'state-prices')!;
    expect(d.rows[0].label).toBe('U.S.');
    expect(d.rows[0].cells.map((c) => c.value)).toEqual([48.3, 14, 3.45, 3.28, 2.76]);
    expect(d.retrieved).toBe('2026-10-18');
  });
});
