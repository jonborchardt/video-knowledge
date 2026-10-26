import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { alpha, grow, GUTTER, ramp, theme } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A row of the BLS real-earnings table: "2026-04    11.254     -0.2   (    3.6,     3.8)" -> month and the
 *  year-on-year change (the third column). */
const ROW = /^\s*(\d{4})-(\d{2})\s+[\d.]+\s+(-?\d+(?:\.\d+)?)/;

/** Year-on-year change in real hourly pay, one column a month from the cited passage (sc12 of is-the-economy-booming;
 *  the figures are read from scene.excerpt, never typed here). A zero line runs across the middle; the first month
 *  rises green above it with the scene, and from the `april` cue each later month drops below it in red, left to
 *  right, one every few frames. Each column carries its month by the zero line and its signed change at its end.
 *  onScreenText[0] is the axis label. Reads no options. */
export const RealPayColumns: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const rows = (scene.excerpt?.text ?? '')
    .split('\n')
    .map((l) => ROW.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ month: MONTHS[Number(m[2]) - 1], raw: m[3], value: Number(m[3]) }));
  if (!rows.length) throw new Error(`${scene.id}: no monthly rows in the cited passage`);
  const n = rows.length;
  const s0 = scene.sentences[0];
  const firstAt = scene.start + 8;
  const dropAt = cue(scene, 'april', s0.start + Math.round(s0.duration / 3));
  const at = (i: number) => (i === 0 ? firstAt : dropAt + (i - 1) * 9);

  const L = GUTTER + 40;
  const R = 1920 - GUTTER - 40;
  const T = 300;
  const B = citationTop(scene) - 40;
  const zero = (T + B) / 2;
  const reach = (B - T) / 2 - 64; // room for the value label past the longest column
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)));
  const pitch = (R - L) / n;
  const cw = pitch * 0.52;
  const axisIn = ramp(t, scene.start + 2, 12);

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 170,
          fontSize: 44,
          color: theme.fg,
          opacity: axisIn,
        }}
      >
        {scene.onScreenText[0]}, %
      </div>
      <div
        style={{
          position: 'absolute',
          left: L - 20,
          top: zero - 2,
          height: 4,
          width: (R - L + 40) * axisIn,
          background: theme.fg,
          borderRadius: 2,
          boxShadow: `0 0 14px ${alpha(theme.fg, 0.53)}`,
        }}
      />
      {rows.map((r, i) => {
        const up = r.value >= 0;
        const color = up ? theme.gain : theme.loss;
        const h = (Math.abs(r.value) / maxAbs) * reach * Math.max(0, grow(t, at(i), 16));
        const x = L + pitch * i + (pitch - cw) / 2;
        const label = ramp(t, at(i) + 6, 10);
        const newest = t >= at(i) && (i === n - 1 || t < at(i + 1));
        return (
          <div key={r.month}>
            <div
              style={{
                position: 'absolute',
                left: x,
                width: cw,
                top: up ? zero - h : zero,
                height: h,
                borderRadius: up ? '8px 8px 0 0' : '0 0 8px 8px',
                background: up
                  ? `linear-gradient(0deg, ${theme.accent2}, ${color})`
                  : `linear-gradient(180deg, ${theme.accent2}, ${color})`,
                boxShadow: `0 0 ${newest ? 34 : 12}px ${alpha(color, newest ? 0.67 : 0.33)}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: x - 20,
                width: cw + 40,
                textAlign: 'center',
                top: up ? zero + 14 : zero - 54,
                fontSize: 34,
                color: theme.muted,
                opacity: ramp(t, scene.start + 4 + i * 3, 10),
              }}
            >
              {r.month}
            </div>
            <div
              style={{
                position: 'absolute',
                left: x - 30,
                width: cw + 60,
                textAlign: 'center',
                top: up ? zero - h - 56 : zero + h + 8,
                fontSize: 40,
                fontWeight: 700,
                color,
                opacity: label,
                textShadow: newest ? `0 0 18px ${color}` : undefined,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {up ? `+${r.raw}` : r.raw.replace('-', '−')}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
