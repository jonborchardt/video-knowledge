import { describe, expect, it } from 'vitest';
import { type DataTable, datasetProblems, loadDatasets } from '../src/lib/datasets';
import { type PassageReader, passageReader } from '../src/lib/evidence';
import { publicTopicNames } from '../src/lib/topics';

const CITE = 'x/sources/prices.txt#L1';
const read: PassageReader = (cite) => (cite === CITE ? 'Alabama | 44.49 | 17.98' : null);
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
    const spaced: PassageReader = (c) => (c === CITE ? '  Alabama   |  44.49 |17.98 ' : null);
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
  });
});
