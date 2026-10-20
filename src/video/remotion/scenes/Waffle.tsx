import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

/** sc29: a grid of as many squares as the count point's denominator implies (996 of 1,000); the count turns red row by
 *  row on its cue, the rest stay green. Labels are the first on-screen lines; the last line is the caption that
 *  prints across the top (the chart's note says it is part of the chart). */
export const Waffle: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const count = chart.points.find((p) => p.unit === 'count');
  const total = Number((count?.display ?? '').replace(/^[\d,]+\s+out of\s+/, '').replace(/[^0-9]/g, '')) || 1000;
  const red = count?.value ?? 0;
  const fills = pointFrames(scene);
  const at = fills[count ? chart.points.indexOf(count) : 0];
  const lines = lineFrames(scene);
  const cols = 40;
  const rows = Math.ceil(total / cols);
  const cell = 19;
  const fill = ramp(t, at, 60);
  const caption = scene.onScreenText.at(-1);
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 100,
          fontSize: 34,
          color: theme.fg,
          opacity: ramp(t, scene.start + 6, 10),
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080}>
        {Array.from({ length: total }, (_, i) => {
          const r = Math.floor(i / cols);
          const rowFrac = r / rows;
          const isRed = i < red && fill >= rowFrac;
          return (
            <rect
              key={i}
              x={GUTTER + (i % cols) * cell}
              y={240 + r * cell}
              width={cell - 3}
              height={cell - 3}
              rx={2}
              fill={isRed ? theme.red : theme.green}
              opacity={ramp(t, scene.start + 4 + i * 0.02, 6) * (i < red ? (isRed ? 0.95 : 0.35) : 1)}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 1020, top: 300, display: 'flex', flexDirection: 'column', gap: 50 }}>
        {scene.onScreenText.slice(0, -1).map((l, i) => (
          <div
            key={i}
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: i === 0 ? theme.red : theme.green,
              opacity: ramp(t, lines[i], 12),
              lineHeight: 1.1,
            }}
          >
            {l}
          </div>
        ))}
      </div>
      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: GUTTER,
            right: GUTTER,
            top: 160,
            fontSize: 32,
            color: theme.slate,
            opacity: ramp(t, lines[scene.onScreenText.length - 1], 12),
            borderTop: `2px solid ${theme.slate}`,
            paddingTop: 10,
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
