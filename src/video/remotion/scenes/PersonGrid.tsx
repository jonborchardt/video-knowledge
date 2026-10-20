import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { Person } from '../glyphs';
import { GUTTER, ramp, theme } from '../theme';

/** sc15: a 10 by 10 grid inside "the table". On the first on-screen line's cue the $0-tagged people slide out of
 *  the frame; on the second, the "inactive" ones follow; an unlabelled average bar rises as they go. The number of
 *  icons that leave (options.zero, options.inactive) is a visual proportion, not a figure from the evidence. */
export const PersonGrid: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [l1, l2] = lineFrames(scene);
  const zero = Number(scene.options.zero ?? 30);
  const inactive = Number(scene.options.inactive ?? 20);
  const out1 = ramp(t, l1, 24);
  const out2 = ramp(t, l2, 24);
  const cell = 62;
  const ox = GUTTER + 40;
  const oy = 220;
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <rect
          x={ox - 30}
          y={oy - 30}
          width={cell * 10 + 60}
          height={cell * 10 + 60}
          rx={12}
          fill="none"
          stroke={theme.muted}
          strokeWidth={3}
          strokeDasharray="12 10"
          opacity={ramp(t, scene.start + 6, 12)}
        />
        <text x={ox - 30} y={oy - 46} fill={theme.muted} fontSize={28}>
          the table
        </text>
        {Array.from({ length: 100 }, (_, i) => {
          const r = Math.floor(i / 10);
          const c = i % 10;
          const idx = (i * 37) % 100; // scattered, not a block
          const isZero = idx < zero;
          const isInactive = !isZero && idx < zero + inactive;
          const leave = isZero ? out1 : isInactive ? out2 : 0;
          const x = ox + c * cell + cell / 2 + leave * (2100 - c * cell + (idx % 7) * 90);
          const y = oy + r * cell + cell / 2 + leave * 60 * Math.sin(i);
          const a = ramp(t, scene.start + 4 + i * 0.3, 6) * (1 - leave * 0.6);
          return (
            <g key={i}>
              <Person
                x={x}
                y={y}
                r={22}
                color={isZero ? theme.red : isInactive ? theme.amber : theme.slate}
                opacity={a}
              />
              {isZero || isInactive ? (
                <text
                  x={x}
                  y={y + 38}
                  textAnchor="middle"
                  fill={isZero ? theme.red : theme.amber}
                  fontSize={14}
                  opacity={a}
                >
                  {isZero ? '$0' : 'inactive'}
                </text>
              ) : null}
            </g>
          );
        })}
        {/* the average, direction only */}
        <g transform={`translate(1560 ${oy - 30})`}>
          <rect y={0} width={160} height={cell * 10 + 60} rx={8} fill="none" stroke={theme.line} strokeWidth={2} />
          <rect
            y={(cell * 10 + 60) * (1 - (0.25 + 0.25 * out1 + 0.3 * out2))}
            width={160}
            height={(cell * 10 + 60) * (0.25 + 0.25 * out1 + 0.3 * out2)}
            rx={8}
            fill={theme.amber}
            opacity={0.85}
          />
          <text x={80} y={-16} textAnchor="middle" fill={theme.muted} fontSize={28}>
            average
          </text>
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 300,
          width: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {scene.onScreenText.map((l, i) => (
          <div
            key={i}
            style={{
              fontSize: 40,
              lineHeight: 1.3,
              color: i ? theme.amber : theme.red,
              opacity: ramp(t, [l1, l2][i], 12),
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
