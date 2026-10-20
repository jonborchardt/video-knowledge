import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, grow, ramp, theme } from '../theme';

const STRIPES = 13;
const DROP = 7; // frames from lifted to inked; each stamp lands on its word
// where each label lands, around the flag: centre x, y offset from the flag's middle (in flag heights), tilt
const SPOTS = [
  { x: 560, dy: -0.52, rot: -8 },
  { x: 1380, dy: 0.12, rot: 6 },
  { x: 900, dy: 0.62, rot: -3 },
];

/** A simplified US flag in outline on the field: the border, then the stripes and a canton of stars draw on from the
 *  scene's start, then a gold fringe runs along the top, fly and bottom edges. Each on-screen line stamps on around
 *  the flag on its frame (`lineFrames`: its `line:<n>` cue or when it is spoken), red and double-bordered, dropping
 *  from large and settling. Reads no options. Pulse springs the stamps and shakes the frame on each landing. */
export const FlagStamps: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lands = lineFrames(scene);
  const s = scene.start;

  // the flag, sized to leave room for the bottom stamp above the citation
  const H = Math.min(440, (citationTop(scene) - 120) * 0.56);
  const W = H * 1.9;
  const X = 960 - W / 2;
  const Y = 90 + (citationTop(scene) - 90 - H) * 0.38;
  const cw = W * 0.4;
  const ch = (H / STRIPES) * 7;

  const draw = (from: number, len: number) => clamp01((t - from) / len);
  const border = draw(s + 4, 24);
  const stripes = draw(s + 14, 30);
  const fringe = draw(s + 36, 30);

  // shake on each landing (pulse only)
  const amp = theme.motion
    ? lands.reduce((a, l) => {
        const k = t - l;
        return k >= 0 && k < 18 ? a + 9 * (1 - k / 18) : a;
      }, 0)
    : 0;
  const shake = { x: amp * Math.sin(t * 2.3), y: amp * Math.cos(t * 3.1) };

  // fringe tassels along top, fly and bottom, in order around the edge
  const tassels: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const step = 16;
  const L = 16;
  for (let x = X; x <= X + W; x += step) tassels.push({ x1: x, y1: Y, x2: x, y2: Y - L });
  for (let y = Y + step; y < Y + H; y += step) tassels.push({ x1: X + W, y1: y, x2: X + W + L, y2: y });
  for (let x = X + W; x >= X; x -= step) tassels.push({ x1: x, y1: Y + H, x2: x, y2: Y + H + L });
  const shown = Math.round(tassels.length * fringe);

  const stars: { cx: number; cy: number }[] = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++) stars.push({ cx: X + (cw / 6) * (c + 0.5), cy: Y + (ch / 5) * (r + 0.5) });

  return (
    <AbsoluteFill style={{ background: theme.field, overflow: 'hidden' }}>
      <svg
        width={1920}
        height={1080}
        style={{ position: 'absolute', inset: 0, transform: `translate(${shake.x}px, ${shake.y}px)` }}
      >
        {/* stripes: every other one outlined as a band */}
        {Array.from({ length: STRIPES }, (_, i) => {
          if (i % 2) return null;
          const y = Y + (H / STRIPES) * i;
          const x0 = i < 7 ? X + cw : X;
          const w = (X + W - x0) * clamp01(stripes * 1.3 - i * 0.025);
          return (
            <rect
              key={i}
              x={x0}
              y={y}
              width={w}
              height={H / STRIPES}
              fill={theme.red}
              fillOpacity={0.14}
              stroke={theme.fg}
              strokeOpacity={0.55}
              strokeWidth={2}
            />
          );
        })}
        {/* the canton */}
        <rect
          x={X}
          y={Y}
          width={cw}
          height={ch}
          fill={theme.slate}
          fillOpacity={0.28 * stripes}
          stroke={theme.slate}
          strokeWidth={3}
          opacity={ramp(t, s + 10, 16)}
        />
        {stars.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={5} fill={theme.fg} opacity={clamp01(stripes * 2 - i / stars.length)} />
        ))}
        {/* the border, drawn on */}
        <rect
          x={X}
          y={Y}
          width={W}
          height={H}
          fill="none"
          stroke={theme.fg}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - border}
        />
        {/* the gold fringe */}
        <g stroke={theme.amber} strokeWidth={4} strokeLinecap="round">
          {tassels.slice(0, shown).map((l, i) => (
            <line key={i} {...l} />
          ))}
        </g>
        {theme.motion && fringe >= 1 ? (
          <path
            d={`M ${X} ${Y - L / 2} H ${X + W + L / 2} V ${Y + H + L / 2} H ${X}`}
            fill="none"
            stroke={theme.amber}
            strokeWidth={10}
            opacity={0.18 + 0.08 * Math.sin(t / 10)}
          />
        ) : null}

        {/* the stamps */}
        {scene.onScreenText.map((text, i) => {
          const spot = SPOTS[i % SPOTS.length];
          const k = t - lands[i];
          if (k < -DROP) return null;
          const lift = clamp01(-k / DROP);
          const settle = k < 0 ? 1 : grow(t, lands[i], 10);
          const scale = 1 + 1.2 * lift * lift + (theme.motion ? 0.12 * (1 - settle) : 0);
          const font = 64;
          const tw = text.length * font * 0.64;
          const bw = tw + 90;
          const bh = font + 60;
          const cy = Y + H / 2 + spot.dy * H;
          return (
            <g
              key={i}
              transform={`translate(${spot.x} ${cy}) rotate(${spot.rot}) scale(${scale})`}
              opacity={k < 0 ? 1 - lift * 0.7 : 0.95}
            >
              <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={14} fill={theme.bg} fillOpacity={0.85} />
              <rect
                x={-bw / 2}
                y={-bh / 2}
                width={bw}
                height={bh}
                rx={14}
                fill="none"
                stroke={theme.red}
                strokeWidth={8}
              />
              <rect
                x={-bw / 2 + 14}
                y={-bh / 2 + 14}
                width={bw - 28}
                height={bh - 28}
                rx={8}
                fill="none"
                stroke={theme.red}
                strokeWidth={3}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={theme.sans}
                fontWeight={900}
                fontSize={font}
                letterSpacing={2}
                textLength={tw}
                lengthAdjust="spacingAndGlyphs"
                fill={theme.red}
              >
                {text.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
