import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, grow, ramp, theme } from '../theme';

const DC = { x: 160, y: 370, w: 860, h: 330 };
const US = { x: 360, y: 70, w: 1200, h: 170 };
const LABEL = { x: 1080, y: 450, w: 600 };
const X1871 = DC.x + DC.w / 2;
const X1874 = 1560;

/** Flat line icons in a 100 x 100 box: a contract page, a gavel, a street with its centre line. */
const ICONS: ReactNode[] = [
  <g key="contract">
    <path d="M 22 6 H 64 L 80 22 V 94 H 22 Z" />
    <path d="M 64 6 V 22 H 80" />
    {[36, 48, 60].map((y) => (
      <line key={y} x1={32} y1={y} x2={70} y2={y} />
    ))}
    <path d="M 32 80 q 6 -12 12 0 t 12 0" />
  </g>,
  <g key="gavel">
    <g transform="rotate(-30 46 36)">
      <rect x={22} y={20} width={48} height={22} rx={4} />
      <line x1={46} y1={42} x2={46} y2={86} strokeWidth={6} />
    </g>
    <rect x={54} y={78} width={40} height={12} rx={3} />
  </g>,
  <g key="street">
    <path d="M 36 6 L 8 94 M 64 6 L 92 94" />
    <path d="M 50 10 V 26 M 50 40 V 58 M 50 72 V 94" />
  </g>,
];

/** A crown: the sovereign power tag on the United States box. */
const CROWN = <path d="M 8 70 L 14 26 L 34 50 L 50 18 L 66 50 L 86 26 L 92 70 Z M 10 82 H 90" />;

/** The District of Columbia on a timeline, 1871 to 1874 (sc19 of courts-and-jurisdiction). onScreenText, in order:
 *  the 1871 year, the District's subtitle, its later label, the United States box, the 1874 year, "abolished"; each
 *  appears on its line (`lineFrames`). At 1871 a marker drops and the District box grows with a dome; its three icons
 *  (contract, gavel, street) appear on `icon:1..3`. On its label an arrow (`arrow`) climbs to the United States box,
 *  which wears a crown on `sovereign`. At 1874 a second marker drops, the span between fills, and the box is struck
 *  through and stamped. No options. */
export const DistrictTimeline: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const L = lineFrames(scene);
  const txt = scene.onScreenText;
  const axisY = citationTop(scene) - 130;
  const s0 = scene.sentences[0];
  const iconAt = (i: number) =>
    cue(scene, `icon:${i + 1}`, s0 ? s0.start + Math.round(((i + 2) / 5) * s0.duration) : L[1] + 30 * (i + 1));
  const arrowAt = cue(scene, 'arrow', L[2] + 20);
  const usAt = Math.min(L[3], arrowAt + 10);
  const crownAt = cue(scene, 'sovereign', L[3] + 20);
  const endAt = L[5];

  const box = grow(t, L[0] + 8, 14);
  const strike = ramp(t, endAt, 12);
  const stamp = grow(t, endAt, 10);
  const arrowP = ramp(t, arrowAt, 16);
  const span = ramp(
    t,
    scene.sentences[2]?.start ?? L[4] - 40,
    Math.max(10, L[4] - (scene.sentences[2]?.start ?? L[4] - 40)),
  );

  const marker = (x: number, at: number, label: string) => {
    const d = grow(t, at, 12);
    return (
      <>
        <div
          style={{
            position: 'absolute',
            left: x - 14,
            top: axisY - 14 - (1 - clamp01(d)) * 60,
            width: 28,
            height: 28,
            borderRadius: 14,
            background: theme.glow,
            boxShadow: `0 0 20px ${theme.glow}`,
            opacity: clamp01(d * 2),
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: x - 120,
            top: axisY + 30,
            width: 240,
            textAlign: 'center',
            fontSize: 48,
            fontWeight: 700,
            color: theme.glow,
            opacity: ramp(t, at, 10),
          }}
        >
          {label}
        </div>
      </>
    );
  };

  const boxStyle = (r: typeof DC, color: string, k: number): CSSProperties => ({
    position: 'absolute',
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    boxSizing: 'border-box',
    borderRadius: 22,
    background: theme.raised,
    border: `4px solid ${color}`,
    boxShadow: `0 0 ${36 * clamp01(k)}px ${color}66`,
    opacity: clamp01(k * 1.5),
    transform: `scale(${0.85 + 0.15 * Math.max(0, k)})`,
  });

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans, overflow: 'hidden' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {/* the axis, and the span the 1871 government lasted */}
        <line
          x1={DC.x}
          y1={axisY}
          x2={1760}
          y2={axisY}
          stroke={theme.line}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={ramp(t, scene.start, 12)}
        />
        <line
          x1={X1871}
          y1={axisY}
          x2={X1871 + (X1874 - X1871) * span}
          y2={axisY}
          stroke={theme.glow}
          strokeWidth={8}
          strokeLinecap="round"
          opacity={span > 0 ? 1 : 0}
        />
        {/* the stem from the 1871 marker up to the box */}
        <line
          x1={X1871}
          y1={axisY - 16}
          x2={X1871}
          y2={axisY - 16 - (axisY - 16 - DC.y - DC.h) * ramp(t, L[0] + 4, 10)}
          stroke={theme.muted}
          strokeWidth={4}
        />
        {/* the arrow from the District up to the United States */}
        <g opacity={arrowP > 0 ? 1 : 0}>
          <line
            x1={X1871}
            y1={DC.y - 10}
            x2={X1871}
            y2={DC.y - 10 - (DC.y - 10 - US.y - US.h - 14) * arrowP}
            stroke={theme.data}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {arrowP > 0.95 && (
            <polygon
              points={`${X1871},${US.y + US.h + 6} ${X1871 - 18},${US.y + US.h + 34} ${X1871 + 18},${US.y + US.h + 34}`}
              fill={theme.data}
            />
          )}
        </g>
      </svg>

      {marker(X1871, L[0], txt[0] ?? '')}
      {marker(X1874, L[4], txt[4] ?? '')}

      {/* the United States */}
      <div
        style={{
          ...boxStyle(US, theme.data, grow(t, usAt, 14)),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 700, color: theme.fg }}>{txt[3]}</div>
        <svg
          width={96}
          height={96}
          viewBox="0 0 100 100"
          fill="none"
          stroke={theme.glow}
          strokeWidth={6}
          strokeLinejoin="round"
          style={{
            opacity: ramp(t, crownAt, 10),
            transform: `scale(${Math.max(0, grow(t, crownAt, 12))})`,
            filter: `drop-shadow(0 0 12px ${theme.glow})`,
          }}
        >
          {CROWN}
        </svg>
      </div>

      {/* the District */}
      <div
        style={{
          ...boxStyle(DC, theme.fg, box),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '30px 36px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <svg width={90} height={90} viewBox="0 0 100 100" fill="none" stroke={theme.muted} strokeWidth={5}>
            <path d="M 20 56 Q 20 22 50 22 Q 80 22 80 56 Z M 50 22 V 8 M 12 56 H 88 M 26 56 V 84 M 42 56 V 84 M 58 56 V 84 M 74 56 V 84 M 10 90 H 90" />
          </svg>
          <div
            style={{
              width: 620,
              fontSize: 42,
              fontStyle: 'italic',
              lineHeight: 1.2,
              color: theme.fg,
              opacity: ramp(t, L[1], 10),
            }}
          >
            {txt[1]}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 90 }}>
          {ICONS.map((icon, i) => {
            const k = grow(t, iconAt(i), 12);
            return (
              <svg
                key={i}
                width={110}
                height={110}
                viewBox="0 0 100 100"
                fill="none"
                stroke={theme.gain}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: clamp01(k * 1.5), transform: `scale(${Math.max(0, k)})` }}
              >
                {icon}
              </svg>
            );
          })}
        </div>
      </div>

      {/* its label from the Court */}
      <div
        style={{
          position: 'absolute',
          left: LABEL.x,
          top: LABEL.y,
          width: LABEL.w,
          fontSize: 50,
          fontWeight: 700,
          lineHeight: 1.2,
          color: theme.data,
          opacity: ramp(t, L[2], 10),
          transform: `translateX(${(1 - ramp(t, L[2], 14)) * 40}px)`,
        }}
      >
        {txt[2]}
      </div>

      {/* struck through, and stamped */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line
          x1={DC.x - 10}
          y1={DC.y + DC.h + 10}
          x2={DC.x - 10 + (DC.w + 20) * strike}
          y2={DC.y + DC.h + 10 - (DC.h + 20) * strike}
          stroke={theme.loss}
          strokeWidth={10}
          strokeLinecap="round"
          opacity={strike > 0 ? 1 : 0}
          style={{ filter: `drop-shadow(0 0 10px ${theme.loss})` }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: X1871 - 220,
          top: DC.y + DC.h / 2 - 50,
          width: 440,
          textAlign: 'center',
          padding: '6px 0',
          border: `6px double ${theme.loss}`,
          borderRadius: 10,
          color: theme.loss,
          background: theme.ground,
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: 'uppercase',
          opacity: ramp(t, endAt - 4, 4),
          transform: `rotate(-8deg) scale(${1.6 - 0.6 * stamp})`,
          boxShadow: `0 0 28px ${theme.loss}88`,
        }}
      >
        {txt[5]}
      </div>
    </AbsoluteFill>
  );
};
