import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, countUp, easeOut, grow, ramp, theme } from '../theme';

/** A funnel: one band per chart point, stacked top to bottom, each as wide as its value against the largest. Band i
 *  arrives on its `point:<label>` frame (or the fallback) as a copy of the band above, drops into place and narrows to
 *  its own width; the trimmed edges blush red, break off and fall away, leaving a dashed red ghost of the slice lost.
 *  Labels sit left of each band, displays inside it. The onScreenText lines appear as captions beneath on their
 *  lineFrames; while they show, the first lost slice glows. The funnel pushes in a little on the newest band and
 *  settles back. Reads no options. */
export const Funnel: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const n = pts.length;
  const fills = pointFrames(scene);
  const lines = lineFrames(scene);
  const max = Math.max(...pts.map((p) => p.value));
  const capH = 80;
  const capTop = citationTop(scene) - scene.onScreenText.length * (capH + 12);
  const Y0 = 250;
  const gap = 26;
  const bh = Math.min(130, (capTop - 30 - Y0 - gap * (n - 1)) / n);
  const W = 1100;
  const cx = 1010;
  const w = pts.map((p) => (p.value / max) * W);
  const y = pts.map((_, i) => Y0 + i * (bh + gap));

  let k = 0; // newest band
  for (let i = 0; i < n; i++) if (t >= fills[i]) k = i;
  const z = ramp(t, fills[0], 20) * (1 - ramp(t, fills[n - 1] + 40, 50));
  const s = 1 + 0.08 * z;
  const float = 4 * Math.sin((t - scene.start) / 20);
  const pulse = 0.5 + 0.5 * Math.sin((t - scene.start) / 9);
  const capOn = lines.length ? ramp(t, lines[0], 14) : 0;
  const fs = bh > 100 ? 54 : 44;
  const id = `funnel-${scene.id}`;
  const titleIn = ramp(t, scene.start + 4, 14);

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 150,
          fontSize: 38,
          color: theme.fg,
          opacity: titleIn,
          transform: `translateX(${(1 - titleIn) * -24}px)`,
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={theme.violet} />
            <stop offset="0.5" stopColor={theme.slate} />
            <stop offset="1" stopColor={theme.violet} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
        </defs>
        <g transform={`translate(${cx} ${y[k] + bh / 2 + float}) scale(${s}) translate(${-cx} ${-(y[k] + bh / 2)})`}>
          {pts.map((p, i) => {
            if (t < fills[i]) return null;
            const m = i ? grow(t, fills[i], 18) : 1;
            const m0 = i ? ramp(t, fills[i], 18) : 1;
            const wp = i ? w[i - 1] : w[0];
            const bw = wp + (w[i] - wp) * m;
            const by = i ? y[i - 1] + (y[i] - y[i - 1]) * easeOut((t - fills[i]) / 12) : y[0];
            const a = i ? ramp(t, fills[i], 6) : grow(t, fills[0], 14);
            const sliver = (wp - w[i]) / 2;
            const fall = ramp(t, fills[i] + 18, 36);
            const hot = i === k;
            const ghostGlow = i === 1 ? capOn : 0;
            const bandW = i ? bw : w[0] * a;
            return (
              <g key={p.label}>
                {/* the neck joining this band to the one above */}
                {i ? (
                  <path
                    d={`M ${cx - w[i - 1] / 2} ${y[i - 1] + bh} L ${cx + w[i - 1] / 2} ${y[i - 1] + bh} L ${cx + bw / 2} ${by} L ${cx - bw / 2} ${by} Z`}
                    fill={theme.slate}
                    opacity={0.14 * a}
                  />
                ) : null}
                {/* the ghost of the slice lost */}
                {i && sliver > 0
                  ? [-1, 1].map((side) => (
                      <rect
                        key={side}
                        x={side < 0 ? cx - wp / 2 : cx + w[i] / 2}
                        y={y[i]}
                        width={sliver}
                        height={bh}
                        rx={6}
                        fill={theme.red}
                        fillOpacity={(0.1 + 0.25 * ghostGlow * (0.6 + 0.4 * pulse)) * m0}
                        stroke={theme.red}
                        strokeWidth={3}
                        strokeDasharray="10 8"
                        strokeOpacity={0.7 * m0}
                      />
                    ))
                  : null}
                {hot ? (
                  <rect
                    x={cx - bandW / 2}
                    y={by}
                    width={bandW}
                    height={bh}
                    rx={14}
                    fill={theme.slate}
                    opacity={0.6 * (0.6 + 0.4 * pulse)}
                    filter={`url(#${id}-glow)`}
                  />
                ) : null}
                <rect
                  x={cx - bandW / 2}
                  y={by}
                  width={bandW}
                  height={bh}
                  rx={14}
                  fill={`url(#${id}-band)`}
                  opacity={a}
                />
                {/* the trimmed edges: red while narrowing, then breaking off and falling */}
                {i && sliver > 0 && fall < 1
                  ? [-1, 1].map((side) => {
                      const edge = side < 0 ? cx - wp / 2 : cx + w[i] / 2;
                      const shrinking = (wp - bw) / 2; // red already exposed during the narrowing
                      return (
                        <rect
                          key={side}
                          x={side < 0 ? edge : edge + sliver - Math.min(sliver, Math.max(0, shrinking))}
                          y={by}
                          width={Math.min(sliver, Math.max(0, shrinking))}
                          height={bh}
                          rx={6}
                          fill={theme.red}
                          opacity={1 - fall}
                          transform={`translate(${side * 60 * fall} ${220 * fall * fall}) rotate(${side * 24 * fall} ${edge + sliver / 2} ${by + bh / 2})`}
                        />
                      );
                    })
                  : null}
                <text
                  x={cx - Math.max(bandW, i ? wp : 0) / 2 - 28}
                  y={by + bh / 2 + 11}
                  textAnchor="end"
                  fontSize={32}
                  fill={hot ? theme.fg : theme.muted}
                  fontWeight={hot ? 700 : 400}
                  opacity={a}
                >
                  {p.label}
                </text>
                <text
                  x={cx}
                  y={by + bh / 2 + fs * 0.36}
                  textAnchor="middle"
                  fontSize={fs}
                  fontWeight={800}
                  fill={theme.bg}
                  opacity={ramp(t, fills[i] + 4, 8)}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {countUp(p.display, p.value, ramp(t, fills[i], 18))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {scene.onScreenText.map((line, j) => {
        const a = ramp(t, lines[j], 14);
        return (
          <div
            key={line}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: capTop + j * (capH + 12),
              display: 'flex',
              justifyContent: 'center',
              opacity: a,
              transform: `translateY(${(1 - a) * 30}px) scale(${0.9 + 0.1 * grow(t, lines[j], 14)})`,
            }}
          >
            <div
              style={{
                fontSize: 46,
                fontWeight: 700,
                lineHeight: `${capH}px`,
                padding: '0 32px',
                whiteSpace: 'nowrap',
                color: theme.fg,
                borderLeft: `8px solid ${theme.red}`,
                borderRadius: 10,
                background: `linear-gradient(90deg, ${theme.red}44, ${theme.bg}DD)`,
                boxShadow: `0 0 ${24 + 12 * pulse}px ${theme.red}66`,
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
