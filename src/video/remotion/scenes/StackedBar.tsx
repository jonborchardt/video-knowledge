import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import type { TimelineScene } from '../../types';
import { GUTTER, easeOut, ramp, theme } from '../theme';

const COLORS = [theme.red, theme.slate, theme.green];

/** sc04: a big number counts up (cue `count`), then one bar fills left to right, each segment on its `point:<label>`
 *  cue. Widths are the published percentages of the full bar, so a total under 100 leaves the remainder visibly empty. */
export const StackedBar: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const s0 = scene.sentences[0];
  const count = scene.cues.count ?? s0.start + 10;
  const [big, ...rest] = (scene.onScreenText[0] ?? '').split(/\s+/);
  const target = Number(big.replace(/[^0-9.]/g, ''));
  const shown = Number.isFinite(target) ? Math.round(target * easeOut((t - count) / 24)) : null;
  const fills = pointFrames(scene);
  const W = 1920 - 2 * GUTTER;
  const title = ramp(t, fills[0] - 10, 10);
  let x = 0;
  const note = (chart.note ?? '').split(/(?<=\.)\s/)[0];
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans, padding: `0 ${GUTTER}px` }}>
      <div style={{ position: 'absolute', top: 120, left: GUTTER, opacity: ramp(t, count, 8) }}>
        <div
          style={{
            fontSize: 210,
            fontWeight: 700,
            lineHeight: 1,
            color: theme.fg,
            letterSpacing: -6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {shown}
        </div>
        <div style={{ fontSize: 38, color: theme.muted, marginTop: 8 }}>{rest.join(' ')}</div>
      </div>
      <div style={{ position: 'absolute', top: 500, left: GUTTER, width: W }}>
        <div style={{ fontSize: 36, color: theme.fg, marginBottom: 26, opacity: title }}>{chart.title}</div>
        <div
          style={{
            position: 'relative',
            height: 120,
            borderRadius: 10,
            background: theme.raised,
            border: `2px solid ${theme.line}`,
            overflow: 'hidden',
            opacity: title,
          }}
        >
          {chart.points.map((p, i) => {
            const full = (p.value / 100) * W;
            const w = full * ramp(t, fills[i], 20);
            const left = x;
            x += full;
            return (
              <div
                key={p.label}
                style={{
                  position: 'absolute',
                  left,
                  top: 0,
                  bottom: 0,
                  width: w,
                  background: COLORS[i % COLORS.length],
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 58,
                    fontWeight: 700,
                    color: theme.bg,
                    opacity: ramp(t, fills[i] + 10, 8),
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {p.display}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'relative', height: 60, marginTop: 18 }}>
          {chart.points.map((p, i) => {
            const left = (chart.points.slice(0, i).reduce((n, q) => n + q.value, 0) / 100) * W;
            return (
              <div
                key={p.label}
                style={{
                  position: 'absolute',
                  left,
                  top: 0,
                  fontSize: 32,
                  color: COLORS[i % COLORS.length],
                  opacity: ramp(t, fills[i] + 8, 8),
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 700 }}>{p.display}</span> {p.label}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 26, color: theme.muted, marginTop: 24, opacity: ramp(t, fills[0] + 20, 10) }}>
          {note} Segments are drawn to the published percentages.
        </div>
      </div>
    </AbsoluteFill>
  );
};
