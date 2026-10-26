// The look: the owning institution's kit (brand/<key>/kit.json, carried on the timeline as `palette`) filled into one
// set of roles, lifted for the screen: the kit's ground as the field, its accent glowing, its paper as the text, and
// restrained semantic data colours bright enough on that ground (brand/design.md 1.2, 2.3). Over it a drifting
// gradient backdrop, a camera that pushes in, punches on every cue and zooms between scenes (Video.tsx), and glowing
// springy charts. The Commonwealth faces are embedded by fonts.ts.
import type { KitPalette } from '../types';

export type Theme = {
  ground: string; // the field, and dark ink on coloured shapes
  paper: string;
  ink: string; // the kit's annotation slate
  text: string; // text on paper
  fg: string; // text on the ground
  muted: string;
  rule: string;
  raised: string;
  line: string;
  accent: string; // the kit's accent as drawn on paper (rules, seal)
  glow: string; // the accent lifted for the screen: the pitch, the highlight
  accent2: string; // the kit ground's hue lifted for the screen: the institution's second colour
  data: string;
  loss: string;
  gain: string;
  serif: string;
  sans: string;
  mono: string;
};

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const hexOf = (rgb: number[]) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
function hslOf(hex: string): [number, number, number] {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l];
}
function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return hexOf([0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
}
const luminance = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** A screen tone of hue `h`: saturation `s`, lightness raised from `l` until it reads on the ground at 4.5:1. */
function onGround(h: number, s: number, l: number, ground: string): string {
  const floor = luminance(ground);
  let c = fromHsl(h, s, l);
  while ((luminance(c) + 0.05) / (floor + 0.05) < 4.5 && l < 0.95) c = fromHsl(h, s, (l += 0.02));
  return c;
}
/** A colour (#RRGGBB) at an opacity, for tints, shadows and fades. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex).map((c) => Math.round(c * 255));
  return `rgba(${r},${g},${b},${a})`;
}

/** Every role from the four kit colours: ground, paper and accent kept, the rest derived (hue stays the kit's). */
export function themeOf(p: KitPalette): Theme {
  const [h, s] = hslOf(p.accent);
  const [gh, gs] = hslOf(p.ground);
  return {
    ground: p.ground,
    paper: p.paper,
    ink: p.ink,
    text: fromHsl(gh, gs, 0.12),
    fg: p.paper,
    muted: alpha(p.paper, 0.68),
    rule: alpha(p.accent, 0.55),
    raised: alpha(p.paper, 0.08),
    line: alpha(p.paper, 0.16),
    accent: p.accent,
    glow: onGround(h, Math.max(s + 0.3, 0.8), 0.6, p.ground),
    accent2: onGround(gh, Math.max(gs, 0.6), 0.6, p.ground),
    // semantic colour outweighs brand uniformity (design.md 2.3): fixed hues, lifted for the screen
    data: onGround(203, 0.75, 0.66, p.ground),
    loss: onGround(12, 0.8, 0.6, p.ground),
    gain: onGround(100, 0.55, 0.58, p.ground),
    serif: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    sans: '"IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif',
    mono: '"IBM Plex Mono", Consolas, "Courier New", monospace',
  };
}

/** The Commonwealth's own kit (brand/cor/kit.json): the look before a timeline sets its institution's. */
export const COR_PALETTE: KitPalette = { ground: '#14181F', accent: '#B8975A', paper: '#EFE8DA', ink: '#3D434B' };
/** The theme every scene reads at render time (never copied into a module-level constant); `Video` fills it from the
 *  timeline's palette before any scene renders. */
export const theme: Theme = themeOf(COR_PALETTE);
export function setTheme(t: Theme): void {
  Object.assign(theme, t);
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
