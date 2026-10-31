import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { clamp01, easeOut, ramp, theme } from '../theme';

const DROP = 7; // frames from lifted to inked; the impact lands on the line's frame
const ROWS = 14; // ruled lines on the page behind
const PAGE = { x: 440, y: 100, w: 1040, h: 880 };

/** The line as a rubber stamp. Before it, a page behind writes itself out row by row (abstract strokes, no words)
 *  under a dashed target where the stamp will land. On the line's frame (`lineFrames`: its `line:1` cue or when it is
 *  spoken) the stamp drops from large onto the page, squashes, shakes the frame and throws a ring of dust; it is
 *  double-bordered, tilted a few degrees and worn (a seeded turbulence eats specks out of the ink), in glow, the
 *  colour of a claim. Afterwards the view pushes in slowly, the wear shimmers and the page drifts. The line breaks at
 *  its first comma. Reads no options. */
export const Stamp: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const text = scene.onScreenText[0] ?? '';
  const land = lineFrames(scene)[0];
  const k = t - land; // frames since impact
  const end = scene.start + scene.duration;

  // stamp face: one or two lines, sized to fit
  const comma = text.indexOf(', ');
  const rows = comma > 0 ? [text.slice(0, comma + 1), text.slice(comma + 2)] : [text];
  const chars = Math.max(...rows.map((r) => r.length));
  const font = Math.min(150, 1200 / (chars * 0.66));
  const widths = rows.map((r) => r.length * font * 0.66);
  const bw = Math.max(...widths) + 180;
  const bh = rows.length * font * 1.08 + 130;

  // drop, squash, settle
  const lift = clamp01(-k / DROP); // 1 high above, 0 on the page
  const fall = 1 + 1.5 * lift * lift;
  const sq = k >= 0 && k < 12 ? Math.sin((Math.PI * k) / 12) * (1 - k / 12) : 0;
  const squash = 0.14;
  const visible = k > -DROP;
  // shake: decaying, inside the frame
  const amp = k >= 0 && k < 20 ? 13 * (1 - k / 20) : 0;
  const shake = { x: amp * Math.sin(k * 2.3), y: amp * Math.cos(k * 3.1) };
  // a slow push over the whole scene, faster once inked
  const push = 1 + 0.02 * ((t - scene.start) / scene.duration) + 0.07 * easeOut((t - land) / Math.max(30, end - land));
  // the wear moves a few pixels: the ink shimmers
  const shimmer = { x: 5 * Math.sin(t / 19), y: 4 * Math.cos(t / 27) };

  // the page writes out its rows before the stamp lands
  const writeFrom = scene.start + 10;
  const per = Math.max(6, (land - DROP - 20 - writeFrom) / ROWS);
  const drift = (t - scene.start) * 0.03;
  const ink = theme.glow;
  const dust = 28;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          transform: `translate(${shake.x}px, ${shake.y}px) scale(${push})`,
          transformOrigin: '50% 50%',
        }}
      >
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={2} seed={7} result="n" />
              <feOffset in="n" dx={shimmer.x} dy={shimmer.y} result="m" />
              <feColorMatrix
                in="m"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 14 -8.6"
                result="holes"
              />
              <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={1} seed={3} result="w" />
              <feColorMatrix
                in="w"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 5 -2.9"
                result="blot"
              />
              <feComposite in="holes" in2="blot" operator="arithmetic" k1={0} k2={1} k3={0.35} k4={0} result="wear" />
              <feComposite in="SourceGraphic" in2="wear" operator="out" result="worn" />
              <feGaussianBlur in="worn" stdDeviation={10 + 3 * Math.sin(t / 11)} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="worn" />
              </feMerge>
            </filter>
          </defs>

          {/* the page behind, drifting */}
          <g
            transform={`translate(${-drift * 0.6} ${-drift}) rotate(${1.5 + 0.6 * Math.sin(t / 90)} 960 540)`}
            opacity={0.55 * ramp(t, scene.start, 18)}
          >
            <rect
              x={PAGE.x}
              y={PAGE.y}
              width={PAGE.w}
              height={PAGE.h}
              rx={10}
              fill={theme.raised}
              stroke={theme.line}
              strokeWidth={3}
            />
            <path d={`M ${PAGE.x + PAGE.w - 90} ${PAGE.y} l 90 90 h -90 z`} fill={theme.line} opacity={0.8} />
            <rect x={PAGE.x + 80} y={PAGE.y + 70} width={360} height={26} rx={13} fill={theme.muted} opacity={0.6} />
            {Array.from({ length: ROWS }, (_, i) => {
              const full = (PAGE.w - 160) * (0.55 + ((i * 37) % 41) / 100);
              const w = full * ramp(t, writeFrom + i * per, per * 0.9);
              const y = PAGE.y + 160 + i * ((PAGE.h - 220) / ROWS);
              const head = t >= writeFrom + i * per && t < writeFrom + (i + 1) * per && k < 0;
              return (
                <g key={i}>
                  <rect x={PAGE.x + 80} y={y} width={w} height={14} rx={7} fill={theme.muted} opacity={0.45} />
                  {head ? <circle cx={PAGE.x + 80 + w} cy={y + 7} r={9} fill={theme.data} /> : null}
                </g>
              );
            })}
          </g>

          {/* the target, waiting for the stamp */}
          <g
            transform={`translate(960 540) rotate(${t * 0.4})`}
            opacity={ramp(t, scene.start + 30, 30) * (1 - ramp(t, land - DROP, DROP)) * (0.7 + 0.3 * Math.sin(t / 12))}
          >
            <rect
              x={-bw / 2 - 30}
              y={-bh / 2 - 30}
              width={bw + 60}
              height={bh + 60}
              rx={30}
              fill="none"
              stroke={ink}
              strokeWidth={3}
              strokeDasharray="22 18"
              transform={`rotate(${-t * 0.4 - 5})`}
            />
          </g>
          {/* the shadow of the stamp coming down */}
          {visible && k < 0 ? (
            <ellipse
              cx={960}
              cy={560}
              rx={(bw / 2) * (1.15 - 0.15 * lift)}
              ry={(bh / 2) * (1.15 - 0.15 * lift)}
              fill={theme.text}
              opacity={0.35 * (1 - lift)}
            />
          ) : null}

          {/* dust thrown out on impact */}
          {k >= 0 && k < 40 ? (
            <g opacity={1 - k / 40}>
              <ellipse
                cx={960}
                cy={540}
                rx={bw / 2 + 40 + 260 * easeOut(k / 30)}
                ry={bh / 2 + 30 + 150 * easeOut(k / 30)}
                fill="none"
                stroke={ink}
                strokeWidth={10 * (1 - k / 40) + 2}
                opacity={0.7}
              />
              {Array.from({ length: dust }, (_, i) => {
                const a = ((i / dust) * 360 + ((i * 37) % 13)) * (Math.PI / 180);
                const d = 1 + (((i * 53) % 70) / 100) * easeOut(k / 26);
                const r0 = { x: (bw / 2) * Math.cos(a), y: (bh / 2) * Math.sin(a) };
                return (
                  <circle
                    key={i}
                    cx={960 + r0.x * d + Math.cos(a) * 90 * easeOut(k / 26)}
                    cy={540 + r0.y * d + Math.sin(a) * 60 * easeOut(k / 26) + k * 0.8}
                    r={7 * (1 - k / 45) + ((i * 7) % 4)}
                    fill={i % 3 ? ink : theme.accent2}
                  />
                );
              })}
            </g>
          ) : null}

          {/* the stamp */}
          {visible ? (
            <g
              transform={`translate(960 540) rotate(-5) scale(${fall * (1 + squash * sq)} ${fall * (1 - squash * sq)})`}
              opacity={k < 0 ? 1 - lift * 0.7 : 0.92 + 0.08 * Math.sin(t / 15)}
            >
              <g filter="url(#stamp-ink)">
                <rect
                  x={-bw / 2}
                  y={-bh / 2}
                  width={bw}
                  height={bh}
                  rx={26}
                  fill="none"
                  stroke={ink}
                  strokeWidth={12}
                />
                <rect
                  x={-bw / 2 + 22}
                  y={-bh / 2 + 22}
                  width={bw - 44}
                  height={bh - 44}
                  rx={14}
                  fill="none"
                  stroke={ink}
                  strokeWidth={4}
                />
                {rows.map((r, i) => (
                  <text
                    key={r}
                    x={0}
                    y={(i - (rows.length - 1) / 2) * font * 1.08}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily={theme.sans}
                    fontWeight={900}
                    fontSize={font}
                    letterSpacing={2}
                    textLength={widths[i]}
                    lengthAdjust="spacingAndGlyphs"
                    fill={ink}
                  >
                    {r.toUpperCase()}
                  </text>
                ))}
              </g>
            </g>
          ) : null}
        </svg>
      </div>
    </AbsoluteFill>
  );
};
