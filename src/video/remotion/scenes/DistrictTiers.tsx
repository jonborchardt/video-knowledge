import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { grow, ramp, theme } from '../theme';

const X = 380; // the column of boxes
const W = 840;
const MID = X + W / 2;
const TIERS = { top: { y: 90, h: 130 }, mid: { y: 330, h: 150 }, low: { y: 590, h: 190 } };
const TAG = { x: 1290, w: 440, h: 54, y: [594, 662, 730] };

/** Three tiers of sovereignty (sc-district-tiers). The bottom box (the District, "body corporate ...") builds first
 *  with its three tags beside it, then a stamp lands on it; the top box (the United States) and the middle (Congress,
 *  "supreme legislature") build down with arrows into the tier below. Every element appears on its on-screen line
 *  (`lineFrames`: line:<n> cues or when spoken). Lines, in order: District, its label, three tags, the stamp, the
 *  United States, Congress, its label. Reads no options. */
export const DistrictTiers: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const L = lineFrames(scene);
  const txt = scene.onScreenText;
  const glow = theme.motion;

  const box = (tier: { y: number; h: number }, at: number, color: string): CSSProperties => {
    const g = grow(t, at, 14);
    return {
      position: 'absolute',
      left: X,
      top: tier.y,
      width: W,
      height: tier.h,
      boxSizing: 'border-box',
      borderRadius: 22,
      background: theme.raised,
      border: `4px solid ${color}`,
      boxShadow: glow ? `0 0 ${36 * ramp(t, at, 14)}px ${color}66` : undefined,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: ramp(t, at, 10),
      transform: `scale(${0.85 + 0.15 * g})`,
    };
  };
  const title: CSSProperties = { fontSize: 54, fontWeight: 700, color: theme.fg };
  const sub = (at: number, color: string): CSSProperties => ({
    fontSize: 36,
    fontStyle: 'italic',
    color,
    opacity: ramp(t, at, 10),
  });

  // arrows: from the bottom of one tier to the top of the next, drawn once the lower box is there
  const arrow = (from: { y: number; h: number }, to: { y: number }, at: number) => {
    const y1 = from.y + from.h + 8;
    const y2 = to.y - 10;
    const p = ramp(t, at, 12);
    const tip = y1 + (y2 - y1) * p;
    return (
      <g opacity={p > 0 ? 1 : 0}>
        <line x1={MID} y1={y1} x2={MID} y2={tip} stroke={theme.muted} strokeWidth={5} strokeLinecap="round" />
        <polygon points={`${MID},${tip + 4} ${MID - 16},${tip - 22} ${MID + 16},${tip - 22}`} fill={theme.muted} />
      </g>
    );
  };

  const stampAt = L[5];
  const s = grow(t, stampAt, 10);

  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {arrow(TIERS.top, TIERS.mid, L[7] + 4)}
        {arrow(TIERS.mid, TIERS.low, L[7] + 14)}
      </svg>

      <div style={box(TIERS.top, L[6], theme.amber)}>
        <div style={title}>{txt[6]}</div>
      </div>
      <div style={box(TIERS.mid, L[7], theme.slate)}>
        <div style={title}>{txt[7]}</div>
        <div style={sub(L[8], theme.slate)}>{txt[8]}</div>
      </div>
      <div style={box(TIERS.low, Math.min(L[0], scene.start + 8), theme.fg)}>
        <div style={title}>{txt[0]}</div>
        <div style={sub(L[1], theme.muted)}>{txt[1]}</div>
      </div>

      {[2, 3, 4].map((i, k) => {
        const g = grow(t, L[i], 10);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: TAG.x,
              top: TAG.y[k],
              width: TAG.w,
              height: TAG.h,
              boxSizing: 'border-box',
              borderRadius: TAG.h / 2,
              border: `3px solid ${theme.line}`,
              background: theme.raised,
              color: theme.fg,
              fontSize: 32,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 28,
              opacity: ramp(t, L[i], 8),
              transform: `translateX(${(1 - g) * 40}px)`,
            }}
          >
            {txt[i]}
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 506,
          width: 380,
          textAlign: 'center',
          padding: '6px 0',
          border: `6px double ${theme.amber}`,
          borderRadius: 10,
          color: theme.amber,
          background: theme.bg,
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: 2,
          opacity: ramp(t, stampAt - 4, 4),
          transform: `rotate(-8deg) scale(${1.6 - 0.6 * s})`,
          boxShadow: glow ? `0 0 28px ${theme.amber}88` : undefined,
        }}
      >
        {txt[5]}
      </div>
    </AbsoluteFill>
  );
};
