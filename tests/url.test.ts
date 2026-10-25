import { describe, expect, it } from 'vitest';
import { datasetSource } from '../src/lib/url';

describe('datasetSource', () => {
  it('names each document once with its overall line range and the period', () => {
    const cites = [
      'h/sources/a.txt#L140-L150',
      'h/sources/a.txt#L135-L139',
      'h/sources/a.txt#L180-L186',
      'h/sources/a.txt#L140',
    ];
    expect(datasetSource({ 'a.txt': 'EIA table' }, cites, '2024 annual')).toBe(
      'EIA table, lines 135-186 (2024 annual)',
    );
  });
  it('keeps documents apart and falls back to the file name', () => {
    expect(datasetSource({ 'a.txt': 'A' }, ['h/sources/a.txt#L1-L2', 'h/sources/b.txt#L5-L9'], '2024')).toBe(
      'A, lines 1-2; b.txt, lines 5-9 (2024)',
    );
  });
});
