import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

const color3 = (i: number) => [theme.red, theme.slate, theme.green][i % 3];

/** sc20: one dot per surveyed person (the count is the leading number of the first on-screen line); the dots recolour
 *  by group on each `point:<label>` cue, round(share x n) at a time; dots outside the stated groups stay neutral. */
export const DotPlot: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const n = Number((scene.onScreenText[0] ?? '').split(/\s+/)[0].replace(/[^0-9]/g, '')) || 100;
  const cols = 41;
  const cell = 32;
  const fills = pointFrames(scene);
  const counts = chart.points.map((p) => Math.round((p.value / 100) * n));
  const group = (i: number) => {
    let acc = 0;
    for (let g = 0; g < counts.length; g++) {
      acc += counts[g];
      if (i < acc) return g;
    }
    return -1;
  };
  const x0 = GUTTER;
  const y0 = 300;
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 130,
          fontSize: 36,
          color: theme.fg,
          opacity: ramp(t, scene.start + 6, 10),
        }}
      >
        {chart.title}
      </div>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 190,
          fontSize: 28,
          color: theme.muted,
          opacity: ramp(t, scene.start + 6, 10),
        }}
      >
        {scene.onScreenText[0]}
      </div>
      <svg width={1920} height={1080}>
        {Array.from({ length: n }, (_, i) => {
          const g = group(i);
          const start = g >= 0 ? fills[g] : Infinity;
          const within = g >= 0 ? (i - counts.slice(0, g).reduce((a, b) => a + b, 0)) / counts[g] : 0;
          const c = ramp(t, start + within * 24, 6);
          const base = ramp(t, scene.start + 4 + (i / n) * 30, 6);
          const color = g >= 0 ? color3(g) : theme.line;
          return (
            <circle
              key={i}
              cx={x0 + (i % cols) * cell + cell / 2}
              cy={y0 + Math.floor(i / cols) * cell + cell / 2}
              r={10}
              fill={c > 0 ? color : theme.line}
              opacity={base * (c > 0 ? 0.5 + 0.5 * c : 0.5)}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 1500, top: 320, display: 'flex', flexDirection: 'column', gap: 40 }}>
        {chart.points.map((p, i) => (
          <div key={p.label} style={{ opacity: ramp(t, fills[i] + 6, 10) }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: color3(i), lineHeight: 1 }}>{p.display}</div>
            <div style={{ fontSize: 30, color: theme.muted, marginTop: 6 }}>{p.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
