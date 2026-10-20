import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

/** One store front: awning, two windows, a door. `dark` (0..1) puts the windows out. */
const Store: FC<{ x: number; y: number; dark: number; opacity: number }> = ({ x, y, dark, opacity }) => {
  const lit = 1 - dark;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity} fill="none" stroke={theme.fg} strokeWidth={4}>
      <path d="M -150 -150 L 150 -150 L 170 -90 L -170 -90 Z" />
      {[-110, -50, 10, 70, 130].map((sx) => (
        <line key={sx} x1={sx} y1={-150} x2={sx + 10} y2={-90} strokeWidth={3} />
      ))}
      <rect x={-140} y={-90} width={280} height={240} />
      {[-115, 25].map((wx) => (
        <rect
          key={wx}
          x={wx}
          y={-60}
          width={90}
          height={90}
          fill={theme.amber}
          fillOpacity={0.15 + 0.55 * lit}
          stroke={dark > 0.5 ? theme.muted : theme.fg}
        />
      ))}
      <rect x={-35} y={50} width={70} height={100} />
    </g>
  );
};

/** A company outline holding three identical stores. On the `dark` cue the middle store's windows go out and an amber
 *  'closing' tag drops onto it; on the `lit` cue the company outline pulses once in slate while the other two stay
 *  lit. Labels from onScreenText (company, closing). */
export const BranchClosing: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [company, closing] = scene.onScreenText;
  const dark = cue(scene, 'dark', scene.start + 90);
  const lit = cue(scene, 'lit', dark + 150);
  const out = ramp(t, dark, 12);
  const drop = ramp(t, dark + 12, 12);
  const pulse = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - lit) / 24)));
  const box = { x: GUTTER + 60, y: 170, w: 1920 - 2 * (GUTTER + 60), h: 640 };
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={36}
          fill="none"
          stroke={pulse > 0.01 ? theme.slate : theme.muted}
          strokeWidth={4 + 6 * pulse}
          opacity={ramp(t, scene.start + 4, 12)}
        />
        <text
          x={box.x + 40}
          y={box.y - 24}
          fill={pulse > 0.01 ? theme.slate : theme.muted}
          fontSize={44}
          opacity={ramp(t, scene.start + 4, 12)}
        >
          {company}
        </text>
        {[-1, 0, 1].map((k) => (
          <Store
            key={k}
            x={960 + k * 480}
            y={box.y + box.h / 2 + 50}
            dark={k === 0 ? out : 0}
            opacity={ramp(t, scene.start + 10 + (k + 1) * 6, 12)}
          />
        ))}
        <g transform={`translate(960 ${box.y + box.h / 2 - 140 - 120 * (1 - drop)})`} opacity={drop}>
          <rect x={-120} y={-40} width={240} height={80} rx={10} fill={theme.amber} />
          <text x={0} y={16} textAnchor="middle" fill={theme.bg} fontSize={44} fontWeight={600}>
            {closing}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
