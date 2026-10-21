import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, grow, ramp, theme } from '../theme';

const OUTER = { x: 600, r: 360 };
const INNER = { x: 535, r: 285 }; // touching the outer circle's left edge, leaving a crescent on the right
const LABEL_X = 1100;

/** A paper form with a fold and four lines, in a 100 x 120 box. */
const FORM = (
  <g>
    <path d="M 10 6 H 66 L 90 30 V 114 H 10 Z" />
    <path d="M 66 6 V 30 H 90" />
    {[48, 64, 80, 96].map((y) => (
      <line key={y} x1={24} y1={y} x2={76} y2={y} />
    ))}
  </g>
);

/** An island: a mound on a wave line with a palm. */
const ISLAND = (
  <g>
    <path d="M 14 70 Q 50 44 86 70" />
    <path d="M 4 82 q 8 -6 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0" />
    <path d="M 52 58 Q 50 36 56 20" />
    <path d="M 56 20 Q 40 14 30 24 M 56 20 Q 72 12 82 22 M 56 20 Q 52 6 40 6" />
  </g>
);

/** Nationals and citizens (sc30 of courts-and-jurisdiction). onScreenText, in order: the outer circle's label
 *  ("national"), the inner circle's ("citizen"), the crescent's ("non-citizen"), its note, and the form's line; each
 *  appears on its line (`lineFrames`). The inner circle draws on its line, the outer one closes round it on its; the
 *  crescent left over lights with an island icon. On the last line a form slides in from the right and bounces off the
 *  outer edge on `bounce`. No options. */
export const NationalCircles: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const L = lineFrames(scene);
  const txt = scene.onScreenText;
  const cy = Math.min(460, citationTop(scene) - OUTER.r - 40);
  const formY = cy + 200;
  const hitX = OUTER.x + Math.sqrt(OUTER.r ** 2 - (formY - cy) ** 2); // where the form's path meets the outer edge
  const bounceAt = cue(scene, 'bounce', L[4] + 30);

  const inner = ramp(t, L[1], 24);
  const outer = ramp(t, L[0], 24);
  const crescent = ramp(t, L[2], 14);
  const island = grow(t, L[2] + 6, 12);

  // the form: in from the right edge, meeting the circle on `bounce`, then knocked back and settling
  const inAt = Math.min(L[4], bounceAt - 20);
  const approach = ramp(t, inAt, Math.max(8, bounceAt - inAt));
  const back = ramp(t, bounceAt, 18);
  const formX = 1980 + (hitX - 1980) * approach + 260 * back;
  const tilt = -25 * back + 10 * Math.sin(back * Math.PI);
  const flash = t >= bounceAt ? Math.max(0, 1 - (t - bounceAt) / 14) : 0;

  const circumference = (r: number) => 2 * Math.PI * r;

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans, overflow: 'hidden' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="sc-crescent">
            <circle cx={OUTER.x} cy={cy} r={OUTER.r} fill="white" />
            <circle cx={INNER.x} cy={cy} r={INNER.r} fill="black" />
          </mask>
        </defs>
        {/* the crescent: nationals who are not citizens */}
        <circle
          cx={OUTER.x}
          cy={cy}
          r={OUTER.r}
          fill={theme.amber}
          opacity={0.28 * crescent}
          mask="url(#sc-crescent)"
        />
        {/* the citizen circle */}
        <circle cx={INNER.x} cy={cy} r={INNER.r} fill={theme.slate} opacity={0.16 * inner} />
        <circle
          cx={INNER.x}
          cy={cy}
          r={INNER.r}
          fill="none"
          stroke={theme.slate}
          strokeWidth={8}
          strokeDasharray={circumference(INNER.r)}
          strokeDashoffset={circumference(INNER.r) * (1 - inner)}
          transform={`rotate(-90 ${INNER.x} ${cy})`}
          style={{ filter: `drop-shadow(0 0 14px ${theme.slate})` }}
        />
        {/* the national circle */}
        <circle
          cx={OUTER.x}
          cy={cy}
          r={OUTER.r}
          fill="none"
          stroke={flash > 0 ? theme.red : theme.amber}
          strokeWidth={8 + 6 * flash}
          strokeDasharray={circumference(OUTER.r)}
          strokeDashoffset={circumference(OUTER.r) * (1 - outer)}
          transform={`rotate(-90 ${OUTER.x} ${cy})`}
          style={{ filter: `drop-shadow(0 0 ${14 + 20 * flash}px ${flash > 0 ? theme.red : theme.amber})` }}
        />
        {/* leaders from the labels into the circles */}
        <line
          x1={LABEL_X - 20}
          y1={cy - 300}
          x2={OUTER.x + OUTER.r * 0.62}
          y2={cy - OUTER.r * 0.78}
          stroke={theme.amber}
          strokeWidth={4}
          opacity={ramp(t, L[0] + 10, 10)}
        />
        <line
          x1={LABEL_X - 20}
          y1={cy - 60}
          x2={OUTER.x + OUTER.r - 50}
          y2={cy - 40}
          stroke={theme.amber}
          strokeWidth={4}
          opacity={crescent}
        />
        {/* the island in the crescent */}
        <g
          transform={`translate(${OUTER.x + OUTER.r - 72} ${cy + 10}) scale(${0.95 * Math.max(0, island)}) translate(-50 -50)`}
          fill="none"
          stroke={theme.green}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={clamp01(island * 1.5)}
        >
          {ISLAND}
        </g>
        {/* the form */}
        <g
          transform={`translate(${formX + 40} ${formY}) rotate(${tilt}) translate(-50 -60)`}
          fill={theme.bg}
          stroke={theme.fg}
          strokeWidth={5}
          strokeLinejoin="round"
          opacity={approach > 0 ? 1 : 0}
        >
          {FORM}
        </g>
      </svg>

      {/* citizen, inside its circle */}
      <div
        style={{
          position: 'absolute',
          left: INNER.x - 240,
          top: cy - 45,
          width: 480,
          textAlign: 'center',
          fontSize: 76,
          fontWeight: 800,
          color: theme.fg,
          opacity: ramp(t, L[1] + 6, 10),
        }}
      >
        {txt[1]}
      </div>

      {/* national */}
      <div
        style={{
          position: 'absolute',
          left: LABEL_X,
          top: cy - 340,
          width: 700,
          fontSize: 68,
          fontWeight: 800,
          color: theme.amber,
          opacity: ramp(t, L[0], 10),
          transform: `translateX(${(1 - ramp(t, L[0], 14)) * 40}px)`,
        }}
      >
        {txt[0]}
      </div>

      {/* non-citizen and where it comes from */}
      <div
        style={{
          position: 'absolute',
          left: LABEL_X,
          top: cy - 100,
          width: 700,
          opacity: crescent,
          transform: `translateX(${(1 - crescent) * 40}px)`,
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 800, color: theme.amber }}>{txt[2]}</div>
        <div
          style={{
            marginTop: 10,
            fontSize: 44,
            fontStyle: 'italic',
            lineHeight: 1.2,
            color: theme.fg,
            opacity: ramp(t, L[3], 10),
          }}
        >
          {txt[3]}
        </div>
      </div>

      {/* the form's line */}
      <div
        style={{
          position: 'absolute',
          left: LABEL_X,
          top: formY + 90,
          width: 700,
          fontSize: 44,
          fontWeight: 700,
          lineHeight: 1.2,
          color: theme.red,
          opacity: ramp(t, L[4], 10),
        }}
      >
        {txt[4]}
      </div>
    </AbsoluteFill>
  );
};
