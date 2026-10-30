import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { Box, Coin, Person } from '../glyphs';
import { GUTTER, ramp, theme } from '../theme';

/** sc24: one icon per on-screen line appearing as it is named, each with a coin arrow to a commission node; the last
 *  (retail to outsiders) is drawn dashed, as the FTC's "in some cases". */
export const CommissionIcons: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const frames = lineFrames(scene);
  const lines = scene.onScreenText;
  const n = lines.length;
  const W = (1920 - 2 * GUTTER) / n;
  const Icon: FC<{ i: number; x: number; y: number; dashed: boolean }> = ({ i, x, y, dashed }) => {
    const c = dashed ? theme.muted : theme.glow;
    if (i === 0) return <Box x={x} y={y} s={70} color={c} />;
    if (i === 1)
      return (
        <g>
          <Person x={x - 40} y={y} r={26} color={c} />
          <Box x={x + 40} y={y} s={44} color={c} />
        </g>
      );
    if (i === 2)
      return (
        <g>
          <Person x={x - 50} y={y - 20} r={22} color={c} />
          <Person x={x + 30} y={y + 20} r={22} color={c} />
          <Box x={x + 70} y={y - 30} s={34} color={c} />
        </g>
      );
    return (
      <g>
        <rect
          x={x - 46}
          y={y - 30}
          width={92}
          height={70}
          rx={6}
          fill="none"
          stroke={c}
          strokeWidth={3}
          strokeDasharray="8 6"
        />
        <path
          d={`M ${x - 56} ${y - 30} L ${x} ${y - 60} L ${x + 56} ${y - 30}`}
          fill="none"
          stroke={c}
          strokeWidth={3}
          strokeDasharray="8 6"
        />
      </g>
    );
  };
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <g opacity={ramp(t, scene.start + 4, 10)} transform="translate(960 250)">
          <circle r={70} fill={theme.raised} stroke={theme.glow} strokeWidth={5} />
          <text textAnchor="middle" dominantBaseline="central" fill={theme.fg} fontSize={28} fontWeight={600}>
            commission
          </text>
        </g>
        {lines.map((l, i) => {
          const a = ramp(t, frames[i], 14);
          const dashed = i === n - 1;
          const x = GUTTER + W * (i + 0.5);
          const y = 640;
          const p = ramp(t, frames[i] + 10, 16);
          return (
            <g key={i} opacity={a}>
              <line
                x1={x}
                y1={y - 90}
                x2={960 + (x - 960) * 0.1}
                y2={330}
                stroke={dashed ? theme.muted : theme.glow}
                strokeWidth={4}
                strokeDasharray={dashed ? '10 8' : undefined}
                opacity={0.7}
              />
              <Coin
                x={x + (960 + (x - 960) * 0.1 - x) * p}
                y={y - 90 + (330 - (y - 90)) * p}
                r={12}
                opacity={dashed ? 0.4 : 1}
              />
              <Icon i={i} x={x} y={y} dashed={dashed} />
              <foreignObject x={x - W / 2 + 20} y={y + 80} width={W - 40} height={160}>
                <div
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 32,
                    color: dashed ? theme.muted : theme.fg,
                    textAlign: 'center',
                    lineHeight: 1.25,
                  }}
                >
                  {l}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
