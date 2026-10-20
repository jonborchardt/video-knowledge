import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { citationTop } from '../Citation';
import type { TimelineScene } from '../../types';
import { GUTTER, countUp, grow, ramp, theme } from '../theme';

/** Points in consecutive pairs, one row per pair on a shared 0..100 axis: on its `point:<label>` cue the pair's first
 *  dot drops in, then the second, and a bar stretches from the first to the second with the gap glowing. Each dot
 *  carries its display above and its label beside (the lower dot's to the left, the higher's to the right, wrapped to
 *  two lines by width, never reworded); an odd last point is drawn alone. A legend names the two series by the text
 *  before the first comma of the first pair's labels, and the chart's note sits under the title. The dots
 *  glow, the gap bar is a gradient that breathes. No options. */
export const Dumbbell: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const fills = pointFrames(scene, 36);
  const colors = [theme.amber, theme.slate];
  const rows = Math.ceil(pts.length / 2);
  const L = GUTTER + 40;
  const W = 1920 - 2 * GUTTER - 80;
  const x = (v: number) => L + (Math.max(0, Math.min(100, v)) / 100) * W;
  const top = chart.note ? 360 : 310;
  const axisY = citationTop(scene) - 50;
  const rowH = Math.min(230, (axisY - top - 20) / rows);
  const series = pts.slice(0, 2).map((p) => p.label.split(',')[0]);
  const intro = ramp(t, scene.start + 4, 12);
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div style={{ position: 'absolute', left: GUTTER, top: 150, opacity: intro }}>
        <div style={{ fontSize: 40, color: theme.fg }}>{chart.title}</div>
        {chart.note ? <div style={{ fontSize: 28, color: theme.muted, marginTop: 10 }}>{chart.note}</div> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          right: GUTTER,
          top: 156,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 30,
          color: theme.fg,
          opacity: ramp(t, scene.start + 14, 12),
        }}
      >
        {series.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: colors[i],
                boxShadow: `0 0 14px ${colors[i]}`,
              }}
            />
            {s}
          </div>
        ))}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }} viewBox="0 0 1920 1080">
        <defs>
          <filter id="dumbbell-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* gridlines and axis, drawn on left to right */}
        {[0, 25, 50, 75, 100].map((u, k) => (
          <g key={u} opacity={ramp(t, scene.start + 8 + k * 4, 10)}>
            <line
              x1={x(u)}
              x2={x(u)}
              y1={top - 20}
              y2={axisY}
              stroke={theme.line}
              strokeWidth={2}
              strokeDasharray="4 8"
            />
            <text x={x(u)} y={axisY + 40} textAnchor="middle" fontSize={28} fill={theme.muted} fontFamily={theme.sans}>
              {u}
            </text>
          </g>
        ))}
        <line
          x1={L}
          x2={L + W * ramp(t, scene.start + 6, 24)}
          y1={axisY}
          y2={axisY}
          stroke={theme.muted}
          strokeWidth={3}
        />
        {Array.from({ length: rows }, (_, r) => {
          const a = pts[2 * r];
          const b = pts[2 * r + 1];
          const cy = top + r * rowH + rowH * 0.55;
          const fa = fills[2 * r];
          const fb = b ? fills[2 * r + 1] : Infinity;
          const stretch = ramp(t, fb + 6, 20);
          const xa = x(a.value);
          const xb = b ? x(b.value) : xa;
          const breathe = 0.75 + 0.25 * Math.sin(t / 10 + r);
          return (
            <g key={a.label}>
              <line x1={L} x2={L + W} y1={cy} y2={cy} stroke={theme.line} strokeWidth={2} opacity={intro} />
              {b ? (
                // a horizontal line has no height, so its gradient is laid out in user space, first dot to second
                <linearGradient id={`dumbbell-gap-${r}`} gradientUnits="userSpaceOnUse" x1={xa} x2={xb} y1={0} y2={0}>
                  <stop offset="0" stopColor={colors[0]} />
                  <stop offset="1" stopColor={colors[1]} />
                </linearGradient>
              ) : null}
              {b ? (
                <line
                  x1={xa}
                  x2={xa + (xb - xa) * stretch}
                  y1={cy}
                  y2={cy}
                  stroke={`url(#dumbbell-gap-${r})`}
                  strokeWidth={18}
                  strokeLinecap="round"
                  opacity={stretch > 0 ? 0.85 * breathe : 0}
                  filter="url(#dumbbell-glow)"
                />
              ) : null}
              {[a, b].map((p, i) => {
                if (!p) return null;
                const f = i ? fb : fa;
                const drop = grow(t, f, 16);
                return (
                  <circle
                    key={p.label}
                    cx={i ? xb : xa}
                    cy={cy - (1 - Math.min(1, drop)) * 120}
                    r={24 * Math.max(0, drop)}
                    fill={colors[i]}
                    stroke={theme.bg}
                    strokeWidth={5}
                    opacity={ramp(t, f, 6)}
                    filter="url(#dumbbell-glow)"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {Array.from({ length: rows }, (_, r) => {
        const pair = [pts[2 * r], pts[2 * r + 1]].filter(Boolean);
        const cy = top + r * rowH + rowH * 0.55;
        const lo = pair.length === 2 && pair[1].value < pair[0].value ? 1 : 0;
        return pair.map((p, i) => {
          const f = fills[2 * r + i];
          const px = x(p.value);
          const left = pair.length === 2 && i === lo; // the lower dot's label sits to its left
          const room = left ? px - 40 - GUTTER : 1920 - GUTTER - px - 40;
          return (
            <div key={p.label}>
              <div
                style={{
                  position: 'absolute',
                  left: px - 100,
                  width: 200,
                  top: cy - 98,
                  textAlign: 'center',
                  fontSize: 48,
                  fontWeight: 700,
                  color: [theme.amber, theme.slate][i],
                  fontVariantNumeric: 'tabular-nums',
                  opacity: ramp(t, f + 4, 8),
                  textShadow: `0 0 18px ${[theme.amber, theme.slate][i]}99`,
                }}
              >
                {countUp(p.display, p.value, ramp(t, f, 24))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: cy,
                  transform: 'translateY(-50%)',
                  ...(left ? { right: 1920 - px + 40, textAlign: 'right' } : { left: px + 40 }),
                  maxWidth: Math.max(220, Math.min(420, room)),
                  fontSize: 30,
                  lineHeight: 1.2,
                  color: theme.fg,
                  opacity: ramp(t, f + 8, 10),
                }}
              >
                {p.label}
              </div>
            </div>
          );
        });
      })}
    </AbsoluteFill>
  );
};
