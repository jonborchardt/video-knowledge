// The look: saturated colour for each role (pink for losses, cyan for data, lime for gains, gold for the pitch, violet
// for accents) over a drifting gradient backdrop, with a camera that pushes in, punches on every cue and zooms between
// scenes (Video.tsx), and glowing springy charts. Fonts are system fonts so a render needs no network. ponytail: bundle a
// webfont when renders must match across machines.
/** The theme every scene reads at render time (never copied into a module-level constant). */
export const theme = {
  bg: '#0B0820', // the deepest field colour, and dark ink on coloured shapes
  field: 'transparent', // what a scene paints behind itself: the backdrop shows through
  raised: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.16)',
  fg: '#F7F4FF',
  muted: '#B4ABD9',
  amber: '#FFB020',
  slate: '#22D3EE',
  red: '#FF3D7F',
  green: '#B6F23A',
  violet: '#8B5CF6',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
};
export type Theme = typeof theme;
export const GUTTER = 120;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Ease out with a small overshoot past 1 before settling (easeOutBack): for sizes and positions, never for figures. */
export const easeBack = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.2 * x * x * x + 1.2 * x * x;
};
/** 0 before `from`, eased to 1 over `len` frames. */
export const ramp = (frame: number, from: number, len: number) => easeOut((frame - from) / len);
/** `ramp`, springing past 1 and back before it settles. */
export const grow = (frame: number, from: number, len: number) => easeBack((frame - from) / (len * 1.4));
/** A figure's display string counted up to `f` (0..1) of itself, same prefix, suffix, decimals and grouping; the
 *  display unchanged when it is not plain `value` ("$300-$650", "<0.01%"). f = 1 is always the display itself. */
export function countUp(display: string, value: number, f: number): string {
  const m = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/.exec(display);
  if (!m || f >= 1 || Math.abs(Number(m[2].replace(/,/g, '')) - value) > 1e-9) return display;
  const dec = m[2].split('.')[1]?.length ?? 0;
  const n = (value * Math.max(0, f)).toFixed(dec);
  const grouped = m[2].includes(',') ? Number(n).toLocaleString('en-US', { minimumFractionDigits: dec }) : n;
  return m[1] + grouped + m[3];
}
