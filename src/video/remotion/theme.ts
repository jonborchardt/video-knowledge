// The brands. `classic`, the storyboard's palette: near-black field, off-white type, amber for the pitch, slate for the
// data, red only for losses, no motion beyond each scene's own. `pulse`: the same roles in saturated colour (pink for
// losses, cyan for data, lime for gains, gold for the pitch) over a drifting gradient backdrop, with a camera that
// pushes in, punches on every cue and zooms between scenes (Video.tsx), glowing springy charts. Fonts are system fonts
// so a render needs no network. ponytail: bundle a webfont when renders must match across machines.
const classic = {
  bg: '#111318', // the field colour, and dark ink on coloured shapes
  field: '#111318', // what a scene paints behind itself; transparent where the backdrop shows through
  raised: '#1A1D24',
  line: '#2B2F39',
  fg: '#ECE9E2',
  muted: '#8E939C',
  amber: '#E3A33A',
  slate: '#6F8FB3',
  red: '#C9473D',
  green: '#6FA06C',
  violet: '#6F8FB3',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
  motion: false, // backdrop, camera and springy charts
};
export type Theme = typeof classic;
const pulse: Theme = {
  ...classic,
  bg: '#0B0820',
  field: 'transparent',
  raised: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.16)',
  fg: '#F7F4FF',
  muted: '#B4ABD9',
  amber: '#FFB020',
  slate: '#22D3EE',
  red: '#FF3D7F',
  green: '#B6F23A',
  violet: '#8B5CF6',
  motion: true,
};
export const BRANDS = { classic, pulse } as const;
export type Brand = keyof typeof BRANDS;
export const isBrand = (b: string): b is Brand => Object.hasOwn(BRANDS, b);

// ponytail: one mutable theme per page; a render tab draws one timeline, so one brand. A React context when one page
// must show two brands at once.
export const theme: Theme = { ...classic };
/** Make `brand` the theme every scene reads; called by the composition before any scene draws. */
export function setBrand(brand: string = 'classic') {
  if (!isBrand(brand)) throw new Error(`unknown brand ${brand}; known: ${Object.keys(BRANDS).join(', ')}`);
  Object.assign(theme, BRANDS[brand]);
}
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
/** `ramp`, springing past 1 and back under the pulse brand; plain `ramp` under classic. */
export const grow = (frame: number, from: number, len: number) =>
  theme.motion ? easeBack((frame - from) / (len * 1.4)) : ramp(frame, from, len);
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
