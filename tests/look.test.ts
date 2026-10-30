// The look a build is drawn with (src/shared/look.ts): what moves its fingerprint, what never does, and how a build
// report without one reads.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { brandKey, kitPaletteOf, LOOK_SLOTS, lookFingerprint, lookStale } from '../src/shared/look';

const PALETTE = { ground: '#172A45', accent: '#C5A46A', paper: '#F2EBDD', ink: '#444E59' };
let root = '';
const kit = () => join(root, 'brand', 'spending');
const writeKit = (extra: Record<string, unknown> = {}) =>
  writeFileSync(join(kit(), 'kit.json'), JSON.stringify({ palette: PALETTE, ...extra }));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vk-look-'));
  mkdirSync(kit(), { recursive: true });
  mkdirSync(join(root, 'src/modules/video/remotion'), { recursive: true });
  writeKit();
  for (const s of LOOK_SLOTS) writeFileSync(join(kit(), `${s}.svg`), '<svg>\n</svg>\n');
  writeFileSync(join(root, 'src/modules/video/remotion/theme.ts'), 'export const theme = {};\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('look fingerprint', () => {
  it('is stable for the same files and ignores CRLF', () => {
    const a = lookFingerprint('heat-pumps', root);
    writeFileSync(join(kit(), 'close-card.svg'), '<svg>\r\n</svg>\r\n');
    writeFileSync(join(root, 'src/modules/video/remotion/theme.ts'), 'export const theme = {};\r\n');
    expect(lookFingerprint('heat-pumps', root)).toBe(a);
  });
  it('moves on a palette role, a slot SVG or theme.ts, and on nothing else in the kit', () => {
    const a = lookFingerprint('heat-pumps', root);
    writeKit({ slogan: { text: 'other' }, assets: { stamp: {} } });
    writeFileSync(join(kit(), 'og-default.svg'), '<svg/>');
    expect(lookFingerprint('heat-pumps', root)).toBe(a);
    writeKit({ palette: { ...PALETTE, accent: '#000000' } });
    const b = lookFingerprint('heat-pumps', root);
    expect(b).not.toBe(a);
    writeFileSync(join(kit(), 'seal.svg'), '<svg/>');
    const c = lookFingerprint('heat-pumps', root);
    expect(c).not.toBe(b);
    writeFileSync(join(root, 'src/modules/video/remotion/theme.ts'), 'export const theme = { a: 1 };\n');
    expect(lookFingerprint('heat-pumps', root)).not.toBe(c);
  });
  it('a missing kit gives a stable fingerprint and never throws', () => {
    const empty = mkdtempSync(join(tmpdir(), 'vk-look-'));
    try {
      expect(lookFingerprint('heat-pumps', empty)).toBe(lookFingerprint('heat-pumps', empty));
      expect(kitPaletteOf('heat-pumps', empty)).toBeNull();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
  it('a topic no commission claims draws from the Commonwealth kit', () => {
    expect(brandKey('no-such-topic')).toBe('cor');
  });
  it('lookStale: legacy, changed, current, no report', () => {
    const fp = { script: 'a', storyboard: 'b', config: 'c' };
    expect(lookStale({ fingerprints: fp }, 'heat-pumps', root)).toMatch(/^rendered before builds recorded their look/);
    expect(lookStale({ fingerprints: { ...fp, look: 'old' } }, 'heat-pumps', root)).toMatch(
      /^rendered with look old; the kit and theme are now /,
    );
    const look = lookFingerprint('heat-pumps', root);
    expect(lookStale({ fingerprints: { ...fp, look } }, 'heat-pumps', root)).toBeNull();
    expect(lookStale(null, 'heat-pumps', root)).toBeNull();
  });
});
