import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, grow, ramp, theme } from '../theme';

const N = 4;
const W = 280; // card
const GAP = 36;
const X0 = 540; // first card; the case sits left of the row
const TOP = 150;
const CASE = { x: 130, y: 300, w: 320, h: 230 };

/** Flat line icons in a 120 x 120 box, one per card: a signature line with a pencilled note beside it, a fringed flag
 *  edge, a rolled parchment, a contract page with its signature line. */
const ICONS: ReactNode[] = [
  <g key="sig">
    <line x1={8} y1={84} x2={76} y2={84} />
    <path d="M 12 74 q 8 -18 16 0 t 16 0 t 14 -6" />
    <path d="M 84 40 h 28 M 84 52 h 22 M 84 64 h 26" strokeWidth={3} strokeDasharray="4 4" />
    <g transform="rotate(35 96 92)">
      <rect x={90} y={70} width={10} height={40} rx={2} />
    </g>
  </g>,
  <g key="flag">
    <line x1={18} y1={8} x2={18} y2={114} />
    <rect x={18} y={16} width={78} height={52} />
    {[24, 34, 44, 54, 64, 74, 84, 94].map((x) => (
      <line key={x} x1={x} y1={68} x2={x} y2={80} />
    ))}
    {[22, 32, 42, 52, 62].map((y) => (
      <line key={y} x1={96} y1={y} x2={106} y2={y} />
    ))}
  </g>,
  <g key="scroll">
    <rect x={30} y={22} width={60} height={76} />
    <ellipse cx={60} cy={18} rx={36} ry={8} />
    <ellipse cx={60} cy={102} rx={36} ry={8} />
    {[40, 52, 64, 76].map((y) => (
      <line key={y} x1={40} y1={y} x2={80} y2={y} />
    ))}
  </g>,
  <g key="contract">
    <path d="M 26 8 H 76 L 96 28 V 112 H 26 Z" />
    <path d="M 76 8 V 28 H 96" />
    {[42, 54, 66, 78].map((y) => (
      <line key={y} x1={38} y1={y} x2={84} y2={y} />
    ))}
    <path d="M 38 100 l 8 -8 m -8 0 l 8 8" />
    <line x1={52} y1={100} x2={84} y2={100} />
  </g>,
];

/** The promoters' kit (sc04 of courts-and-jurisdiction): an open case on the left, and four cards (onScreenText 1-4)
 *  sliding out of it into a row, each on its `card:<n>` cue. On `ground` each card drops a thin line to a ground strip
 *  labelled onScreenText[4], then a gavel appears beside the case on `gavel`. Cues missing fall back to an even spread
 *  over the first sentence and the start of the second. No options. */
export const CourtsKit: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [s0, s1] = scene.sentences;
  const spread = (i: number) => (s0 ? s0.start + Math.round(((i + 1) / (N + 1)) * s0.duration) : scene.start + 40 * i);
  const groundAt = cue(scene, 'ground', s1 ? s1.start + 20 : scene.start + 200);
  const gavelAt = cue(scene, 'gavel', groundAt + 60);
  const bottom = citationTop(scene);
  const groundY = bottom - 150;
  const H = 400;
  const g = ramp(t, groundAt, 18);
  const gv = grow(t, gavelAt, 16);
  const lid = ramp(t, scene.start, 20);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* the case, opened */}
      <svg
        width={CASE.w + 40}
        height={CASE.h + 160}
        viewBox={`-20 -140 ${CASE.w + 40} ${CASE.h + 160}`}
        style={{ position: 'absolute', left: CASE.x - 20, top: CASE.y - 140, overflow: 'visible' }}
        fill="none"
        stroke={theme.accent2}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <g transform={`rotate(${-50 * lid} 0 0)`}>
          <rect x={0} y={-36} width={CASE.w} height={36} rx={8} fill={theme.raised} />
        </g>
        <rect x={0} y={0} width={CASE.w} height={CASE.h} rx={14} fill={theme.raised} />
        <line x1={0} y1={60} x2={CASE.w} y2={60} stroke={theme.line} />
        <rect x={CASE.w / 2 - 22} y={48} width={44} height={24} rx={4} fill={theme.ground} />
      </svg>
      {/* the gavel, beside the case */}
      <svg
        width={240}
        height={200}
        viewBox="0 0 120 100"
        style={{
          position: 'absolute',
          left: CASE.x + 40,
          top: CASE.y + CASE.h + 50,
          opacity: clamp01(gv * 1.5),
          transform: `scale(${Math.max(0, gv)}) rotate(${(1 - clamp01(gv)) * -30}deg)`,
          transformOrigin: '50% 80%',
        }}
        fill="none"
        stroke={theme.data}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <g transform="rotate(-30 52 40)">
          <rect x={26} y={22} width={52} height={24} rx={4} fill={theme.raised} />
          <line x1={52} y1={46} x2={52} y2={92} strokeWidth={6} />
        </g>
        <rect x={62} y={78} width={46} height={12} rx={3} fill={theme.raised} />
      </svg>
      {/* the ground strip */}
      <div
        style={{
          position: 'absolute',
          left: X0 - 20,
          top: groundY,
          width: N * W + (N - 1) * GAP + 40,
          height: 96,
          borderRadius: 14,
          background: `repeating-linear-gradient(135deg, ${theme.gain}22 0 14px, transparent 14px 28px)`,
          border: `3px solid ${theme.gain}`,
          boxShadow: `0 0 ${30 * g}px ${theme.gain}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontWeight: 700,
          fontSize: 44,
          color: theme.gain,
          opacity: g,
          transform: `translateY(${(1 - g) * 30}px)`,
        }}
      >
        {scene.onScreenText[N] ?? ''}
      </div>
      {Array.from({ length: N }, (_, i) => {
        const at = cue(scene, `card:${i + 1}`, spread(i));
        const k = grow(t, at, 16);
        const x = X0 + i * (W + GAP);
        const fromX = CASE.x + CASE.w / 2 - W / 2;
        const left = fromX + (x - fromX) * k;
        const top = CASE.y + (TOP - CASE.y) * k;
        const drop = ramp(t, groundAt + i * 6, 16);
        const flash = clamp01(1 - Math.abs(t - (at + 12)) / 14);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: x + W / 2 - 2,
                top: TOP + H,
                width: 4,
                height: (groundY - TOP - H) * drop,
                background: theme.gain,
                boxShadow: `0 0 10px ${theme.gain}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left,
                top,
                width: W,
                height: H,
                boxSizing: 'border-box',
                borderRadius: 18,
                background: theme.raised,
                border: `3px solid ${theme.glow}`,
                boxShadow: flash ? `0 0 ${40 * flash}px ${theme.glow}` : 'none',
                opacity: clamp01(k * 1.5),
                transform: `scale(${0.4 + 0.6 * Math.max(0, k)})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '44px 22px 0',
                gap: 34,
              }}
            >
              <svg
                width={140}
                height={140}
                viewBox="0 0 120 120"
                fill="none"
                stroke={theme.glow}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[i]}
              </svg>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontWeight: 600,
                  fontSize: 38,
                  lineHeight: 1.2,
                  color: theme.fg,
                  textAlign: 'center',
                }}
              >
                {scene.onScreenText[i] ?? ''}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
