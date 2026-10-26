import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { cue, lineFrames } from '../../cues';
import { citationTop } from '../Citation';
import type { TimelineScene } from '../../types';
import { alpha, countUp, grow, GUTTER, ramp, theme } from '../theme';

const COLORS = ['loss', 'gain', 'data', 'glow', 'accent2'] as const;
const named = (c: string) =>
  (COLORS as readonly string[]).includes(c) ? theme[c as (typeof COLORS)[number]] : theme.data;

/** Horizontal bars for the percent points: the labelled tracks appear with the chart, each bar fills on its
 *  `point:<label>` cue, drawn against options.max (so two charts can share a scale); a count point is drawn as that
 *  many dots, not a bar. options.caption names the on-screen line shown first; options.stamp names the line stamped
 *  across the chart on the `stamp` cue. Rows that would not fit above the citation stacked (label over bar) are laid
 *  out inline (label beside bar) and shrunk to fit, so a long series never runs off the screen. Bars spring in with a
 *  gradient and glow, the value counts up with the fill, and the newest bar glows brightest. */
export const Bar: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const color = named(String(scene.options.color ?? 'data'));
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
  const top = 300;
  const rows = bars.length + dots.length;
  const room = citationTop(scene) - top;
  const inline = rows * 96 > room;
  const rowH = inline ? Math.min(72, room / rows) : 96;
  const k = inline ? Math.min(1, rowH / 72) : 1; // type and bar scale
  // label column, sized to the longest label (about half an em a character), capped
  const LW = inline ? Math.min(520, Math.max(...bars.map((p) => p.label.length)) * 30 * k * 0.55 + 48) : 0;
  const stampAt = stampIdx >= 0 ? cue(scene, 'stamp', lines[stampIdx]) : Infinity;
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      {captionIdx >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: GUTTER,
            top: 150,
            fontSize: 44,
            color: theme.glow,
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
        const w = Math.max(0, (p.value / max) * W * grow(t, fills[i], 18));
        const newest = t >= fills[i] && !fills.some((g, j) => j !== i && g > fills[i] && t >= g);
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
            <div style={{ display: inline ? 'flex' : 'block', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: 30 * k,
                  color: theme.muted,
                  marginBottom: inline ? 0 : 8,
                  width: inline ? LW : undefined,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ position: 'relative', width: W, height: 40 * k }}>
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
                      background: `linear-gradient(90deg, ${theme.accent2}, ${color})`,
                      boxShadow: `0 0 ${newest ? 34 : 12}px ${alpha(color, newest ? 0.67 : 0.33)}`,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 40 * k,
                    fontWeight: 700,
                    color,
                    opacity: ramp(t, fills[i], 6),
                    textShadow: newest ? `0 0 18px ${color}` : undefined,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {countUp(p.display, p.value, f)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {dots.map((p) => {
        const i = bars.length + dots.indexOf(p); // one row per count point
        const at = fills[chart.points.indexOf(p)];
        const a = ramp(t, at, 14);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: GUTTER,
              top: top + i * rowH + (inline ? 0 : 20),
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              opacity: a,
            }}
          >
            <svg width={p.value * 44 * k} height={44 * k}>
              {Array.from({ length: p.value }, (_, j) => (
                <circle
                  key={j}
                  cx={(22 + j * 44) * k}
                  cy={22 * k}
                  r={16 * k}
                  fill={theme.glow}
                  opacity={ramp(t, at + j * 8, 8)}
                />
              ))}
            </svg>
            <div style={{ fontSize: 38 * k, color: theme.glow }}>
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
            color: theme.loss,
            border: `8px solid ${theme.loss}`,
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
