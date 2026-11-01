// `npm run links -- cta approve` (phase 3, D14): a person's approval of one paid link, written into cta.json by the
// website module (which owns the file), by the link's stable id, once.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJson, scriptDir, writeJsonAtomic } from '../../../shared/io';
import { Refusal } from '../../../shared/refusal';
import { type CtaFile, approveCommercial, ctaId, ctaPath } from '../cta';

const T = 'heat-pumps';
const S = 'decision:is-it-cheaper-to-run-than-gas';
let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));
const file = (): CtaFile => ({
  primary: { type: 'inquiry', text: 'The full record' },
  secondary: [
    { type: 'reference', url: 'https://example.org/ref', text: 'A reference' },
    { type: 'commercial', url: 'https://shop.example/pump', text: 'The pump we sized', disclosure: 'affiliate link' },
  ],
});
function staged() {
  root = mkdtempSync(join(tmpdir(), 'cta-approve-'));
  mkdirSync(scriptDir(T, S, root), { recursive: true });
  writeJsonAtomic(ctaPath(T, S, root), file());
  return ctaId(file().secondary![1]);
}

describe('approveCommercial', () => {
  it('writes the person into the matching entry once, and refuses an unknown id or an automated name', () => {
    const id = staged();
    expect(approveCommercial(T, S, id, 'Jon', root)).toEqual({ existing: false, url: 'https://shop.example/pump' });
    const f = readJson<CtaFile>(ctaPath(T, S, root))!;
    expect(f.secondary![1].approvedBy).toBe('Jon');
    expect(f.secondary![0].approvedBy).toBeUndefined();
    expect(approveCommercial(T, S, id, 'Someone Else', root)).toEqual({
      existing: true,
      url: 'https://shop.example/pump',
    });
    expect(readJson<CtaFile>(ctaPath(T, S, root))!.secondary![1].approvedBy).toBe('Jon');
    expect(() => approveCommercial(T, S, 'nope', 'Jon', root)).toThrow(Refusal);
    expect(() => approveCommercial(T, S, 'nope', 'Jon', root)).toThrow(/no paid link nope/);
    expect(() => approveCommercial(T, S, ctaId(file().secondary![0]), 'Jon', root)).toThrow(/not a paid link/);
  });
  it('a paid link is approved by a person, never an automated run or a placeholder', () => {
    const id = staged();
    expect(() => approveCommercial(T, S, id, 'automated: production pick', root)).toThrow(/person/);
    expect(() => approveCommercial(T, S, id, '<name>', root)).toThrow(Refusal);
    expect(readJson<CtaFile>(ctaPath(T, S, root))!.secondary![1].approvedBy).toBeUndefined();
    expect(() => approveCommercial(T, 'nope:story', id, 'Jon', root)).toThrow(/no cta.json/);
  });
});
