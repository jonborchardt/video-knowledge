import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

/** sc16: paid by the company (solid), expenses not reported (hatched, unknown height, a question mark), what you keep
 *  (dashed outline, unknown). Counters from the on-screen lines. No bar carries a number. */
export const Waterfall: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const frames = lineFrames(scene);
  const paid = ramp(t, scene.start + 8, 18);
  const exp = ramp(t, cue(scene, 'expenses', frames[0]), 18);
  const keep = ramp(t, cue(scene, 'keep', frames[1]), 18);
  const base = 820;
  const H = 480;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <defs>
          <pattern id="hatch" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={16} height={16} fill={theme.raised} />
            <line x1={0} y1={0} x2={0} y2={16} stroke={theme.red} strokeWidth={5} />
          </pattern>
        </defs>
        <g transform={`translate(${GUTTER + 60} 0)`}>
          <rect x={0} y={base - H * paid} width={260} height={H * paid} rx={8} fill={theme.slate} />
          <text x={130} y={base + 50} textAnchor="middle" fill={theme.fg} fontSize={32} opacity={paid}>
            paid by the company
          </text>
          <rect
            x={380}
            y={base - H + H * 0.55 * (1 - exp) - 40}
            width={260}
            height={H * 0.55 * exp}
            rx={8}
            fill="url(#hatch)"
            stroke={theme.red}
            strokeWidth={3}
            opacity={exp}
          />
          <text
            x={510}
            y={base - H - 60}
            textAnchor="middle"
            fill={theme.red}
            fontSize={110}
            fontWeight={700}
            opacity={exp}
          >
            ?
          </text>
          <text x={510} y={base + 50} textAnchor="middle" fill={theme.red} fontSize={32} opacity={exp}>
            expenses: not reported
          </text>
          <rect
            x={760}
            y={base - H * 0.45}
            width={260}
            height={H * 0.45}
            rx={8}
            fill="none"
            stroke={theme.amber}
            strokeWidth={4}
            strokeDasharray="14 12"
            opacity={keep}
          />
          <text x={890} y={base - H * 0.45 - 30} textAnchor="middle" fill={theme.amber} fontSize={40} opacity={keep}>
            ?
          </text>
          <text x={890} y={base + 50} textAnchor="middle" fill={theme.amber} fontSize={32} opacity={keep}>
            what you keep: unknown
          </text>
          <line x1={-20} y1={base} x2={1060} y2={base} stroke={theme.line} strokeWidth={3} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1260,
          top: 330,
          width: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {scene.onScreenText.map((l, i) => (
          <div
            key={i}
            style={{
              fontSize: 38,
              lineHeight: 1.3,
              color: theme.fg,
              opacity: ramp(t, frames[i], 12),
              borderLeft: `5px solid ${i ? theme.amber : theme.red}`,
              paddingLeft: 22,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
