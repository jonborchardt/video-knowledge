// The dev server's stream of a review build: the Range header the player sends to seek.
import { describe, expect, it } from 'vitest';
import { parseRange } from '../src/admin/media';

describe('parseRange', () => {
  it('reads the three forms the player sends', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=990-5000', 1000)).toEqual({ start: 990, end: 999 }); // clamped to the file
  });
  it('no header is the whole file; anything unsatisfiable is invalid', () => {
    expect(parseRange(null, 1000)).toBeNull();
    for (const h of ['bytes=1000-', 'bytes=5-2', 'chunks=0-1', 'bytes=-0', 'bytes=0-1,5-6', 'bytes=x-'])
      expect(parseRange(h, 1000)).toBe('invalid');
  });
});
