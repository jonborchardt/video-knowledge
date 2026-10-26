import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { SHORT_LAYOUT as L, type TimelineScene } from '../../types';
import { countUp, grow, ramp, theme } from '../theme';

const W = L.width - L.gutter - L.right;

/** Horizontal bars for percent points, label over bar, value at the end, each filling on its `point:<label>` cue
 *  against `options.max`; a count point is drawn as that many dots. Rows shrink to fit the content band
 *  (brand/design.md 2.3: ranges and units legible, no scale cut for drama). */
export const ShortBar: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const bars = chart.points.filter((p) => p.unit === 'percent');
  const dots = chart.points.filter((p) => p.unit === 'count');
  const max = Number(scene.options.max ?? Math.max(...bars.map((p) => p.value), 1) * 1.2);
  const fills = pointFrames(scene, 36);
  const titleH = chart.title ? 80 : 0;
  const rows = bars.length + dots.length;
  const band = L.contentBottom - L.top;
  const rowH = Math.min(150, (band - titleH) / Math.max(1, rows));
  const k = Math.min(1, rowH / 150);
  const track = W - 160;
  const top0 = L.top + (band - titleH - rows * rowH) / 2; // the chart block sits centred in the band
  return (
    <AbsoluteFill>
      {chart.title ? (
        <div
          style={{
            position: 'absolute',
            left: L.gutter,
            top: top0,
            width: W,
            fontFamily: theme.sans,
            fontSize: 34,
            color: theme.fg,
            opacity: ramp(t, scene.start + 6, 10),
            lineHeight: 1.2,
          }}
        >
          {chart.title}
        </div>
      ) : null}
      {bars.map((p, i) => {
        const f = ramp(t, fills[chart.points.indexOf(p)], 18);
        const w = Math.max(0, (p.value / max) * track * grow(t, fills[chart.points.indexOf(p)], 18));
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: L.gutter,
              top: top0 + titleH + i * rowH,
              width: W,
              opacity: ramp(t, scene.start + 10 + i * 6, 10),
            }}
          >
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 32 * k,
                color: theme.muted,
                marginBottom: 12 * k,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {p.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', width: track, height: 40 * k }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: theme.raised,
                    border: `1px solid ${theme.rule}`,
                  }}
                />
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w, background: theme.accent }} />
              </div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontWeight: 600,
                  fontSize: 40 * k,
                  color: theme.fg,
                  opacity: ramp(t, fills[chart.points.indexOf(p)], 6),
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {countUp(p.display, p.value, f)}
              </div>
            </div>
          </div>
        );
      })}
      {dots.map((p, j) => {
        const i = bars.length + j;
        const at = fills[chart.points.indexOf(p)];
        const r = 14 * k;
        const perRow = Math.max(1, Math.floor(W / (r * 2 + 10)));
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: L.gutter,
              top: top0 + titleH + i * rowH,
              width: W,
              opacity: ramp(t, at, 14),
            }}
          >
            <svg width={W} height={Math.ceil(p.value / perRow) * (r * 2 + 10)}>
              {Array.from({ length: Math.min(p.value, 200) }, (_, q) => (
                <circle
                  key={q}
                  cx={r + (q % perRow) * (r * 2 + 10)}
                  cy={r + Math.floor(q / perRow) * (r * 2 + 10)}
                  r={r}
                  fill={theme.accent}
                  opacity={ramp(t, at + q * 2, 6)}
                />
              ))}
            </svg>
            <div style={{ fontFamily: theme.sans, fontSize: 32 * k, color: theme.fg, marginTop: 10 }}>
              <span style={{ fontWeight: 600 }}>{p.display}</span> {p.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
