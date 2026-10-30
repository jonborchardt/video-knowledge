// Pins the ledger across its move to src/shared: the fixtures were written by the code as it was in src/lib (labels
// computed inside the ledger); the ledger now takes the labels the caller computed (`ledgerClaims`) and must write the
// same bytes.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ledgerClaims, claimStates } from '../src/lib/finding-label';
import { noteRevision, nextPublicRecord, publicRecordProblems } from '../src/shared/public-record';
import { toJson } from '../src/shared/io';
import type { ClaimView } from '../src/lib/topics';

const DIR = 'tests/fixtures/public-record';
const fixture = (name: string) => readFileSync(`${DIR}/${name}.json`, 'utf8');
const empty = { exhibits: {}, revisions: [] };

describe('public record equivalence', () => {
  // Each fixture carries its own input (the ledger's view of a topic when it was frozen), so a later change to a topic's
  // store never touches this test.
  for (const f of readdirSync(DIR).filter((f) => f !== 'synthetic.json')) {
    it(`${f}: seed and a no-change rerun write the same bytes`, () => {
      const fx = JSON.parse(fixture(f.replace(/\.json$/, '')));
      const live = new Set<string>(fx.live);
      const states = Object.fromEntries(fx.input.map((c: { id: string; state: unknown }) => [c.id, c.state]));
      const seeded = nextPublicRecord(empty, null, fx.input, '2026-01-01', live);
      const again = nextPublicRecord(seeded, states as never, fx.input, '2026-01-02', live);
      expect(toJson({ seeded, again })).toBe(toJson({ seeded: fx.seeded, again: fx.again }));
    });
  }

  it('a label change writes the same revisions, problems and noted record', () => {
    const claim = (id: string, verdict: string, confidence: number, decidedBy: string | null = 'S') =>
      ({ id, verdict, confidence, decidedBy, sources: [] }) as unknown as ClaimView;
    const before = claimStates({
      claims: [claim('x', 'right', 0.9), claim('y', 'right', 0.9), claim('z', 'right', 0.8), claim('w', 'right', 0.9)],
    });
    const after = {
      claims: [
        claim('x', 'partly', 0.9),
        claim('y', 'wrong', 0.9),
        claim('z', 'right', 0.95),
        claim('w', 'right', 0.9, null),
      ],
    };
    const live = new Set(['x', 'y', 'z', 'w']);
    const record = nextPublicRecord(empty, before, ledgerClaims(after), '2026-11-02', live);
    expect(toJson({ record, problems: publicRecordProblems(record), noted: noteRevision(record, 'x', 'n') })).toBe(
      fixture('synthetic'),
    );
  });
});
