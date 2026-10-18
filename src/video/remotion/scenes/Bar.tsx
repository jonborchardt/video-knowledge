import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

const COLOR: Record<string, string> = { red: theme.red, green: theme.green, slate: theme.slate, amber: theme.amber };

/** Horizontal bars for the percent points: the labelled tracks appear with the chart, each bar fills on its
 *  `point:<label>` cue, drawn against options.max (so two charts can share a scale); a count point is drawn as that
 *  many dots, not a bar. options.caption names the on-screen line shown first; options.stamp names the line stamped
 *  across the chart on the `stamp` cue. */
export const Bar: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const color = COLOR[String(scene.options.color ?? 'slate')] ?? theme.slate;
  const bars = chart.points.filter((p) => p.unit === 'percent');
  const dots = chart.points.filter((p) => p.unit === 'count');
  const max = Number(scene.options.max ?? Math.max(...bars.map((p) => p.value)) * 1.25);
  const fills = pointFrames(scene, 36);
  const lines = lineFrames(scene);
  const captionIdx = scene.options.caption !== undefined ? Number(scene.options.caption) : -1;
  const stampIdx = scene.options.stamp !== undefined ? Number(scene.options.stamp) : -1;
  const captionAt = captionIdx >= 0 ? lines[captionIdx] : -1;
  const chartAt = captionIdx >= 0 ? Math.max(scene.start, Math.min(fills[0] - 20, captionAt + 60)) : scene.start + 6;
  const W = 1000;
  const rowH = 96;
  const top = 300;
  const stampAt = stampIdx >= 0 ? cue(scene, 'stamp', lines[stampIdx]) : Infinity;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      {captionIdx >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: GUTTER,
            top: 150,
            fontSize: 44,
            color: theme.amber,
            opacity: ramp(t, captionAt, 12),
          }}
        >
          {scene.onScreenText[captionIdx]}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: captionIdx >= 0 ? 220 : 170,
          fontSize: 36,
          color: theme.fg,
          opacity: ramp(t, chartAt, 10),
        }}
      >
        {chart.title}
      </div>
      {bars.map((p, i) => {
        const f = ramp(t, fills[i], 18);
        const w = Math.max(0, (p.value / max) * W * f);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: GUTTER,
              top: top + i * rowH,
              width: 1920 - 2 * GUTTER,
              opacity: ramp(t, chartAt + 6 + i * 6, 10),
            }}
          >
            <div style={{ fontSize: 30, color: theme.muted, marginBottom: 8 }}>{p.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ position: 'relative', width: W, height: 40 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 6,
                    background: theme.raised,
                    border: `1px solid ${theme.line}`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: w,
                    borderRadius: 6,
                    background: color,
                  }}
                />
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color, opacity: ramp(t, fills[i] + 12, 8) }}>
                {p.display}
              </div>
            </div>
          </div>
        );
      })}
      {dots.map((p) => {
        const i = bars.length;
        const at = fills[chart.points.indexOf(p)];
        const a = ramp(t, at, 14);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: GUTTER,
              top: top + i * rowH + 20,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              opacity: a,
            }}
          >
            <svg width={p.value * 44} height={44}>
              {Array.from({ length: p.value }, (_, k) => (
                <circle key={k} cx={22 + k * 44} cy={22} r={16} fill={theme.amber} opacity={ramp(t, at + k * 8, 8)} />
              ))}
            </svg>
            <div style={{ fontSize: 38, color: theme.amber }}>
              <span style={{ fontWeight: 700 }}>{p.display}</span> {p.label}
            </div>
          </div>
        );
      })}
      {stampIdx >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 1180,
            top: 420,
            transform: `rotate(-12deg) scale(${0.7 + 0.3 * ramp(t, stampAt, 10)})`,
            opacity: ramp(t, stampAt, 10),
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: 6,
            color: theme.red,
            border: `8px solid ${theme.red}`,
            borderRadius: 16,
            padding: '10px 30px',
            textTransform: 'uppercase',
          }}
        >
          {scene.onScreenText[stampIdx]}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
