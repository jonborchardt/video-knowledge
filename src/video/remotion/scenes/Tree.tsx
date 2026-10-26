import type { FC } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { alpha, ramp, theme } from '../theme';

const Arrow: FC<{ x1: number; y1: number; x2: number; y2: number; p: number; color: string }> = ({
  x1,
  y1,
  x2,
  y2,
  p,
  color,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x1 + (x2 - x1) * p;
  const hy = y1 + (y2 - y1) * p;
  const head = (d: number) => `${hx - 22 * Math.cos(a - d)},${hy - 22 * Math.sin(a - d)}`;
  return (
    <g opacity={p > 0 ? 1 : 0}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - p)}
      />
      <polygon points={`${hx},${hy} ${head(0.45)} ${head(-0.45)}`} fill={color} opacity={ramp(p, 0.6, 0.4)} />
    </g>
  );
};

const Node: FC<{ x: number; y: number; r: number; s: number; color: string; label?: string }> = ({
  x,
  y,
  r,
  s,
  color,
  label,
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r={r} fill={theme.raised} stroke={color} strokeWidth={5} />
    {label ? (
      <text textAnchor="middle" dominantBaseline="central" fill={theme.fg} fontSize={r * 0.55} fontWeight={600}>
        {label}
      </text>
    ) : (
      <>
        <circle r={r * 0.3} cy={-r * 0.15} fill={color} opacity={0.8} />
        <path d={`M ${-r * 0.56} ${r * 0.6} Q 0 ${-r * 0.08} ${r * 0.56} ${r * 0.6} Z`} fill={color} opacity={0.8} />
      </>
    )}
  </g>
);

/** The recruiting tree (`tree`): YOU, an arrow in from what you sell, a second tier whose arrows flow up on the `tier2`
 *  cue. */
export const Tree: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const s = scene.sentences[0];
  const pop = (at: number) => spring({ frame: t - at, fps, config: { damping: 14, stiffness: 120 } });

  const tier2 = scene.cues.tier2;
  const sell = cue(scene, 'sell', s.start + Math.round((tier2 - s.start) * 0.5));
  const [sellLabel, tierLabel] = scene.onScreenText;
  const below = [520, 813, 1107, 1400];
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <g opacity={ramp(t, scene.start, 10) * (1 - 0.7 * ramp(t, sell, 15))} transform="translate(700 120)">
          <rect width={520} height={110} rx={28} fill={theme.raised} stroke={theme.line} strokeWidth={2} />
          <rect x={34} y={30} width={300} height={14} rx={7} fill={alpha(theme.paper, 0.55)} filter="url(#blur)" />
          <rect x={34} y={64} width={420} height={14} rx={7} fill={alpha(theme.paper, 0.35)} filter="url(#blur)" />
        </g>
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation={4} />
          </filter>
        </defs>
        <Arrow x1={520} y1={400} x2={870} y2={400} p={ramp(t, sell, 9)} color={theme.glow} />
        <text x={695} y={366} textAnchor="middle" fill={theme.glow} fontSize={34} opacity={ramp(t, sell, 9)}>
          {sellLabel}
        </text>
        <Node x={960} y={400} r={74} s={pop(s.start + 6)} color={theme.glow} label="YOU" />
        {below.map((x, i) => {
          const at = tier2 + i * 9;
          return (
            <g key={x}>
              <Arrow
                x1={x}
                y1={780 - 62}
                x2={960 + (x - 960) * 0.14}
                y2={490}
                p={ramp(t, at + 4, 9)}
                color={theme.data}
              />
              <Node x={x} y={780} r={54} s={pop(at)} color={theme.data} />
            </g>
          );
        })}
        <text x={960} y={900} textAnchor="middle" fill={theme.data} fontSize={34} opacity={ramp(t, tier2 + 12, 9)}>
          {tierLabel}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
