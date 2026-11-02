// merge-claims rewrites the parallel extraction batches before `record` reads them in order: a duplicate new claim
// becomes a reuse (`c`) or a reference (`n2`) to the canonical text, and the first mention in record order is the
// one that creates the claim (`n`), whatever the merge agent named as canonical (the real run named a text created
// in a later batch, and `record` refused the earlier reference).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';

const SCRIPT = join(ROOT, 'src', 'modules', 'evidence', 'merge-claims.mjs');
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const run = (dir: string, files: string[]) =>
  execFileSync(process.execPath, [SCRIPT, join(dir, 'merges.json'), ...files.map((f) => join(dir, f))], {
    encoding: 'utf8',
  });
const read = (dir: string, f: string) =>
  JSON.parse(readFileSync(join(dir, f), 'utf8')) as { video: string; as: Record<string, unknown>[] }[];
const kinds = (b: { as: Record<string, unknown>[] }) =>
  b.as.map((a) => (a.n ? `n:${a.n}` : a.n2 ? `n2:${a.n2}` : `c:${a.c}`));

describe('merge-claims', () => {
  it('a merge whose canonical text is created in a later batch is turned round: the first mention creates the claim', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-merge-'));
    roots.push(dir);
    const EARLY = 'An extended warranty can usually be bought after the sale.';
    const LATE = 'An extended warranty can typically still be purchased later.';
    writeFileSync(join(dir, 'merges.json'), JSON.stringify({ [EARLY]: `=${LATE}` }));
    writeFileSync(
      join(dir, 'h1.json'),
      JSON.stringify([
        {
          video: 'v1',
          sum: 's',
          as: [
            { n: EARLY, q: 'q1', v: ['partly', 0.4, 'early guess'] },
            { n: 'Another claim.', q: 'q2', v: ['right', 0.5, 'g'] },
          ],
        },
      ]),
    );
    writeFileSync(
      join(dir, 'h2.json'),
      JSON.stringify([
        { video: 'v2', sum: 's', as: [{ n2: LATE, q: 'q3' }] }, // references the canonical before it exists
        { video: 'v3', sum: 's', as: [{ n: LATE, q: 'q4', v: ['right', 0.5, 'guess'], l: 'for' }] },
      ]),
    );
    run(dir, ['h1.json', 'h2.json']);
    const h1 = read(dir, 'h1.json');
    const h2 = read(dir, 'h2.json');
    // one claim text, created once, where record first meets it; every later mention references it
    expect(kinds(h1[0])).toEqual([`n:${LATE}`, 'n:Another claim.']);
    expect(kinds(h2[0])).toEqual([`n2:${LATE}`]);
    expect(kinds(h2[1])).toEqual([`n2:${LATE}`]);
    expect(h1[0].as[0].q).toBe('q1'); // the quote stays with its source
    // the creation carries the AI guess and lean record needs; a reference carries none
    expect(h1[0].as[0].v).toEqual(['right', 0.5, 'guess']);
    expect(h1[0].as[0].l).toBe('for');
    expect(h2[1].as[0].v).toBeUndefined();
    expect(h2[1].as[0].l).toBeUndefined();
  });

  it('within one file, a reference that precedes its creation swaps roles with it; an existing-claim reuse is untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vk-merge-'));
    roots.push(dir);
    const T = 'Most extended warranties can be cancelled for a pro-rated refund.';
    writeFileSync(join(dir, 'merges.json'), JSON.stringify({ 'Dealers mark up warranties.': 'dealer-markup' }));
    writeFileSync(
      join(dir, 'h1.json'),
      JSON.stringify([
        {
          video: 'a',
          sum: 's',
          as: [
            { n2: T, q: 'qa' },
            { n: 'Dealers mark up warranties.', q: 'qm' },
          ],
        },
        { video: 'b', sum: 's', as: [{ n: T, q: 'qb', v: ['right', 0.5, 'g'], f: true }] },
        { video: 'c', sum: 's', as: [{ n2: T, q: 'qc' }] },
      ]),
    );
    const out = run(dir, ['h1.json']);
    expect(out).toMatch(/merged 1/);
    const h1 = read(dir, 'h1.json');
    expect(kinds(h1[0])).toEqual([`n:${T}`, 'c:dealer-markup']);
    expect(kinds(h1[1])).toEqual([`n2:${T}`]);
    expect(kinds(h1[2])).toEqual([`n2:${T}`]);
    expect(h1[0].as[0].v).toEqual(['right', 0.5, 'g']);
    expect(h1[0].as[0].f).toBe(true);
    expect(h1[1].as[0].v).toBeUndefined();
    // a text no mention creates refers to a claim already in the store: every mention stays a reference
    const dir2 = mkdtempSync(join(tmpdir(), 'vk-merge-'));
    roots.push(dir2);
    writeFileSync(
      join(dir2, 'merges.json'),
      JSON.stringify({ 'Warranties are marked up.': '=Dealers mark up warranties.' }),
    );
    writeFileSync(
      join(dir2, 'h2.json'),
      JSON.stringify([
        { video: 'd', sum: 's', as: [{ n: 'Warranties are marked up.', q: 'qd', v: ['right', 0.5, 'g'] }] },
        { video: 'e', sum: 's', as: [{ n2: 'Dealers mark up warranties.', q: 'qe' }] },
        { video: 'f', sum: 's', as: [{ n: 'Dealers mark up warranties.', q: 'qf' }] }, // an earlier rewrite's creation without a guess
      ]),
    );
    run(dir2, ['h2.json']);
    const h2 = read(dir2, 'h2.json');
    expect(kinds(h2[0])).toEqual(['n2:Dealers mark up warranties.']);
    expect(kinds(h2[1])).toEqual(['n2:Dealers mark up warranties.']);
    expect(kinds(h2[2])).toEqual(['n2:Dealers mark up warranties.']);
    expect(h2[0].as[0].v).toBeUndefined();
    // a second run changes nothing
    run(dir, ['h1.json']);
    expect(read(dir, 'h1.json')).toEqual(h1);
    // a creation that lost its guess to an earlier rewrite gets it back from the mention that still carries it
    const broken = read(dir, 'h1.json');
    delete broken[0].as[0].v;
    broken[1].as[0].v = ['right', 0.5, 'g'];
    writeFileSync(join(dir, 'h1.json'), JSON.stringify(broken));
    run(dir, ['h1.json']);
    expect(read(dir, 'h1.json')).toEqual(h1);
  });
});
