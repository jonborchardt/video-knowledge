import type { FC } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimelineScene } from '../../types';
import { ramp, theme } from '../theme';

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

/** sc02: YOU, an arrow in from what you sell, then a second tier beneath whose arrows flow up (cue `tier2`). */
export const Tree: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const s = scene.sentences[0];
  const tier2 = scene.cues.tier2;
  const sell = scene.cues.sell ?? s.start + Math.round((tier2 - s.start) * 0.5);
  const you = spring({ frame: t - s.start - 6, fps, config: { damping: 14, stiffness: 120 } });
  const [sellLabel, tierLabel] = scene.onScreenText;
  const below = [520, 813, 1107, 1400];
  const yYou = 400;
  const yTier = 780;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        {/* the message, as a bubble, before the diagram grows out of it */}
        <g opacity={ramp(t, scene.start, 10) * (1 - 0.7 * ramp(t, sell, 15))} transform="translate(700 120)">
          <rect width={520} height={110} rx={28} fill={theme.raised} stroke={theme.line} strokeWidth={2} />
          <rect x={34} y={30} width={300} height={14} rx={7} fill="rgba(236,233,226,.55)" filter="url(#blur)" />
          <rect x={34} y={64} width={420} height={14} rx={7} fill="rgba(236,233,226,.35)" filter="url(#blur)" />
        </g>
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation={4} />
          </filter>
        </defs>
        {/* what you sell -> YOU */}
        <Arrow x1={520} y1={yYou} x2={870} y2={yYou} p={ramp(t, sell, 9)} color={theme.amber} />
        <text x={695} y={yYou - 34} textAnchor="middle" fill={theme.amber} fontSize={34} opacity={ramp(t, sell, 9)}>
          {sellLabel}
        </text>
        <g transform={`translate(960 ${yYou}) scale(${you})`}>
          <circle r={74} fill={theme.raised} stroke={theme.amber} strokeWidth={5} />
          <text textAnchor="middle" dominantBaseline="central" fill={theme.fg} fontSize={40} fontWeight={600}>
            YOU
          </text>
        </g>
        {/* the second tier: arrows flow up, 300 ms each */}
        {below.map((x, i) => {
          const at = tier2 + i * 9;
          const sc = spring({ frame: t - at, fps, config: { damping: 14, stiffness: 120 } });
          return (
            <g key={x}>
              <Arrow
                x1={x}
                y1={yTier - 62}
                x2={960 + (x - 960) * 0.14}
                y2={yYou + 90}
                p={ramp(t, at + 4, 9)}
                color={theme.slate}
              />
              <g transform={`translate(${x} ${yTier}) scale(${sc})`}>
                <circle r={54} fill={theme.raised} stroke={theme.slate} strokeWidth={4} />
                <circle r={16} cy={-8} fill={theme.slate} opacity={0.8} />
                <path d="M -30 32 Q 0 -4 30 32 Z" fill={theme.slate} opacity={0.8} />
              </g>
            </g>
          );
        })}
        <text
          x={960}
          y={yTier + 120}
          textAnchor="middle"
          fill={theme.slate}
          fontSize={34}
          opacity={ramp(t, tier2 + 12, 9)}
        >
          {tierLabel}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
