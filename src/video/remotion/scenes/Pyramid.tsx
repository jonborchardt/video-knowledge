import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, clamp01, ramp, theme } from '../theme';

/** sc30: levels of dots, each several times the last, growing until they spill over a small globe; a counter ticks
 *  the cycles up to the figure in the first on-screen line on the `cycles` cue. Labelled as the critics' arithmetic. */
export const Pyramid: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [cyclesLine, label] = scene.onScreenText;
  const target = Number((cyclesLine ?? '').replace(/[^0-9]/g, '')) || 13;
  const frames = lineFrames(scene);
  const at = cue(scene, 'cycles', frames[0]);
  const from = scene.start + 10;
  const grow = clamp01((t - from) / Math.max(30, at - from));
  const level = Math.max(1, Math.round(grow * target));
  const levels = Array.from({ length: Math.min(level, 7) }, (_, k) => Math.min(60, Math.pow(3, k)));
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <circle cx={960} cy={1120} r={300} fill="none" stroke={theme.slate} strokeWidth={4} opacity={0.6} />
        <path
          d="M 760 990 q 60 -40 120 0 t 120 0 t 120 0 t 120 0"
          fill="none"
          stroke={theme.slate}
          strokeWidth={3}
          opacity={0.5}
        />
        {levels.map((count, k) => {
          const y = 820 - k * 90;
          const spread = Math.min(1500, count * 36);
          return Array.from({ length: count }, (_, i) => (
            <circle
              key={`${k}-${i}`}
              cx={960 - spread / 2 + (count === 1 ? spread / 2 : (i * spread) / (count - 1))}
              cy={y + (k > 4 ? (i % 3) * 14 : 0)}
              r={k > 4 ? 7 : 11}
              fill={theme.amber}
              opacity={ramp(t, from + (k * (at - from)) / target, 8) * (k > 4 ? 0.7 : 1)}
            />
          ));
        })}
      </svg>
      <div style={{ position: 'absolute', right: GUTTER, top: 200, textAlign: 'right' }}>
        <div
          style={{ fontSize: 160, fontWeight: 700, color: theme.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {level}
        </div>
        <div style={{ fontSize: 36, color: theme.muted, marginTop: 10 }}>
          {(cyclesLine ?? '').replace(/[0-9,]+\s*/, '')}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 200,
          fontSize: 40,
          color: theme.slate,
          opacity: ramp(t, frames[1] ?? scene.start + 10, 10),
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};
