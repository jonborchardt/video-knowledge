// The storyboard's palette: near-black field, off-white type, amber for the pitch, slate for the data, red only for
// losses. Fonts are system fonts so a render needs no network. ponytail: bundle a webfont when renders must match
// across machines.
export const theme = {
  bg: '#111318',
  raised: '#1A1D24',
  line: '#2B2F39',
  fg: '#ECE9E2',
  muted: '#8E939C',
  amber: '#E3A33A',
  slate: '#6F8FB3',
  red: '#C9473D',
  green: '#6FA06C',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;
export const GUTTER = 120;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** 0 before `from`, eased to 1 over `len` frames. */
export const ramp = (frame: number, from: number, len: number) => easeOut((frame - from) / len);
