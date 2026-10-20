import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, countUp, grow, ramp, theme } from '../theme';

const YEAR = /\b(\d{4})\b/;

/** Vertical columns on an honest scale (0..100 for percent, else 0..1.15 x the largest value), one per chart point:
 *  each rises on its `point:<label>` frame (or the fallback) with its display riding its top and its label (the
 *  4-digit year when every label has one) beneath; a trend line joins the tops, drawing as they rise; the newest column
 *  is lit green. The camera stretches the row sideways and drifts along it to the newest column, then eases back to
 *  the whole row; it never scales the value axis, so heights stay true. Reads no cues beyond the points, no options. */
export const Columns: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const n = pts.length;
  const fills = pointFrames(scene);
  const years = pts.map((p) => YEAR.exec(p.label)?.[1]);
  const label = (i: number) => (years.every(Boolean) ? years[i]! : pts[i].label);
  const top = pts.every((p) => p.unit === 'percent') ? 100 : Math.max(...pts.map((p) => p.value)) * 1.15;
  const L = GUTTER + 20;
  const R = 1920 - GUTTER - 20;
  const T = 290;
  const B = citationTop(scene) - 76;
  const H = B - T;
  const pitch = (R - L) / n;
  const wx = (i: number) => L + pitch * (i + 0.5);

  let k = 0; // the newest column that has started rising
  for (let i = 0; i < n; i++) if (t >= fills[i]) k = i;
  const done = fills[n - 1] + 24;
  // camera: horizontal stretch only, focus easing from column to column
  const sMax = n > 4 ? 1.6 : 1.25;
  const z = ramp(t, fills[0] - 10, 24) * (1 - ramp(t, done + 20, 60));
  const s = 1 + (sMax - 1) * z;
  const want = k ? wx(k - 1) + (wx(k) - wx(k - 1)) * ramp(t, fills[k], 22) : wx(0);
  const hw = (R - L) / (2 * s);
  const fx = Math.min(R - hw, Math.max(L + hw, want));
  const cx = (L + R) / 2;
  const sx = (x: number) => cx + s * (x - fx);
  const inView = (x: number) => clamp01(1 - Math.max(0, L - 8 - x, x - R - 8) / 12);

  const axisIn = ramp(t, scene.start + 4, 14);
  const pulse = 0.5 + 0.5 * Math.sin((t - scene.start) / 9);
  const h = pts.map((p, i) => (p.value / top) * H * Math.max(0, grow(t, fills[i], 20)));
  const tops = pts.map((_, i) => ({ x: sx(wx(i)), y: B - h[i] }));
  // trend: through the tops that have started, the newest segment drawing toward its column
  const trend: { x: number; y: number }[] = [];
  for (let i = 0; i <= k && t >= fills[0]; i++) {
    if (i === 0) trend.push(tops[0]);
    else {
      const f = ramp(t, fills[i] + 10, 14); // once the column is mostly up
      trend.push({
        x: tops[i - 1].x + (tops[i].x - tops[i - 1].x) * f,
        y: tops[i - 1].y + (tops[i].y - tops[i - 1].y) * f,
      });
    }
  }
  const path = trend.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const colW = pitch * 0.62 * s;
  const fs = n > 6 ? 34 : 42;
  const id = `columns-${scene.id}`;

  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 150,
          fontSize: 38,
          color: theme.fg,
          opacity: axisIn,
          transform: `translateX(${(1 - axisIn) * -24}px)`,
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={L - 10} y={0} width={R - L + 20} height={1080} />
          </clipPath>
          <linearGradient id={`${id}-col`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.slate} />
            <stop offset="1" stopColor={theme.violet} stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id={`${id}-hot`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.green} />
            <stop offset="1" stopColor={theme.green} stopOpacity={0.45} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={14} />
          </filter>
        </defs>
        <g opacity={axisIn}>
          {[0.25, 0.5, 0.75, 1].map((q) => (
            <line
              key={q}
              x1={L}
              x2={R}
              y1={B - q * H}
              y2={B - q * H}
              stroke={theme.line}
              strokeWidth={2}
              strokeDasharray="4 10"
            />
          ))}
        </g>
        <g clipPath={`url(#${id}-clip)`}>
          {tops.map((p, i) => {
            const hot = i === k && t >= fills[i];
            return t >= fills[i] ? (
              <g key={pts[i].label}>
                {hot ? (
                  <rect
                    x={p.x - colW / 2 - 6}
                    y={p.y - 6}
                    width={colW + 12}
                    height={h[i] + 6}
                    rx={10}
                    fill={theme.green}
                    opacity={0.55 * (0.6 + 0.4 * pulse)}
                    filter={`url(#${id}-glow)`}
                  />
                ) : null}
                <rect
                  x={p.x - colW / 2}
                  y={p.y}
                  width={colW}
                  height={h[i]}
                  rx={8}
                  fill={`url(#${id}-${hot ? 'hot' : 'col'})`}
                />
              </g>
            ) : null;
          })}
          <path d={path} fill="none" stroke={theme.amber} strokeWidth={12} opacity={0.45} filter={`url(#${id}-glow)`} />
          <path
            d={path}
            fill="none"
            stroke={theme.amber}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke={theme.fg}
            strokeWidth={3}
            strokeDasharray="6 40"
            strokeDashoffset={-(t - scene.start) * 2}
            opacity={0.7}
          />
          {trend.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === k ? 10 : 7}
              fill={theme.amber}
              stroke={theme.bg}
              strokeWidth={3}
            />
          ))}
        </g>
        <line x1={L} x2={R} y1={B} y2={B} stroke={theme.muted} strokeWidth={3} opacity={axisIn} />
        {tops.map((p, i) => {
          const lit = t >= fills[i];
          return (
            <text
              key={pts[i].label}
              x={p.x}
              y={B + 48}
              textAnchor="middle"
              fontSize={n > 6 ? 28 : 32}
              fill={i === k && lit ? theme.green : lit ? theme.fg : theme.muted}
              fontWeight={i === k && lit ? 700 : 400}
              opacity={axisIn * inView(p.x)}
            >
              {label(i)}
            </text>
          );
        })}
      </svg>
      {tops.map((p, i) => {
        const hot = i === k;
        const a = ramp(t, fills[i] + 4, 8) * inView(p.x);
        return (
          <div
            key={pts[i].label}
            style={{
              position: 'absolute',
              left: p.x - 120,
              width: 240,
              top: p.y - 26 - fs,
              textAlign: 'center',
              fontSize: fs,
              fontWeight: 700,
              lineHeight: 1,
              color: hot ? theme.green : theme.fg,
              opacity: a,
              textShadow: hot ? `0 0 18px ${theme.green}` : undefined,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {countUp(pts[i].display, pts[i].value, ramp(t, fills[i], 20))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
