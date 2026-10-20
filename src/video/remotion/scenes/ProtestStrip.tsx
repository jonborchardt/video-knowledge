import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, grow, ramp, theme } from '../theme';

/** A stack of planks. */
const Planks: FC = () => (
  <g fill={theme.raised} stroke={theme.fg} strokeWidth={4}>
    {[40, 0, -40].map((y, i) => (
      <g key={y}>
        <rect x={-90 + i * 8} y={y - 16} width={180} height={32} rx={4} />
        <line x1={-60 + i * 8} y1={y} x2={50 + i * 8} y2={y} stroke={theme.muted} strokeWidth={2} />
      </g>
    ))}
  </g>
);

/** An invoice with an amber stamp slammed across it at `stamp` (0..1). */
const Invoice: FC<{ stamp: number }> = ({ stamp }) => (
  <g>
    <rect x={-60} y={-80} width={120} height={160} rx={6} fill={theme.raised} stroke={theme.fg} strokeWidth={4} />
    {[-50, -28, -6, 16].map((y) => (
      <rect key={y} x={-40} y={y} width={y === 16 ? 44 : 80} height={7} rx={3} fill={theme.muted} />
    ))}
    <rect x={-6} y={48} width={46} height={10} rx={3} fill={theme.fg} />
    <g transform={`rotate(-14) scale(${1.6 - 0.6 * stamp})`} opacity={stamp}>
      <rect x={-78} y={-26} width={156} height={52} rx={6} fill="none" stroke={theme.amber} strokeWidth={6} />
      <rect x={-62} y={-10} width={124} height={8} rx={3} fill={theme.amber} />
      <rect x={-62} y={6} width={84} height={8} rx={3} fill={theme.amber} />
    </g>
  </g>
);

/** Two speech marks (open and close quote shapes). */
const SpeechMarks: FC = () => (
  <g fill={theme.fg}>
    {[-1, 1].map((s) => (
      <g key={s} transform={`translate(${s * 56} ${s < 0 ? 16 : 0}) scale(${-s} ${s})`}>
        <circle cx={-14} cy={-14} r={18} />
        <path d="M -32 -14 Q -32 34 6 46 Q -14 26 -10 -2 Z" />
        <circle cx={26} cy={-14} r={18} />
        <path d="M 8 -14 Q 8 34 46 46 Q 26 26 30 -2 Z" />
      </g>
    ))}
  </g>
);

/** sc15 (UCC 1-308): left, a three-step strip (timber delivered, paid under protest with an amber stamp, price argued
 *  later) drawn as the words are spoken, an arrow through it that keeps moving with on-screen line 1 beneath; right,
 *  on-screen lines 2..n greyed in a column, each getting a dashed empty "not mentioned" tag as it is spoken. Steps on
 *  cues step:1..3; lines on line:n. */
export const ProtestStrip: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [arrowLabel, ...absent] = scene.onScreenText;
  const frames = lineFrames(scene);
  const s21 = scene.sentences[0];
  const span = (s21?.words.at(-1)?.frame ?? scene.start + 300) - scene.start;
  const steps = [1, 2, 3].map((i) => cue(scene, `step:${i}`, scene.start + 10 + ((i - 1) * span) / 3));
  const bottom = citationTop(scene);
  const midY = Math.min(440, bottom - 380);
  const xs = [GUTTER + 130, GUTTER + 410, GUTTER + 690];
  const arrowIn = ramp(t, steps[0] + 6, 30);
  const arrowEnd = xs[0] - 130 + (xs[2] + 200 - (xs[0] - 130)) * arrowIn;
  const marching = theme.motion ? t * 2.4 : t * 1.6;
  const colTop = Math.max(200, midY - 180);
  const rowH = Math.min(190, (bottom - 40 - colTop) / Math.max(1, absent.length));
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        {xs.map((x, i) => {
          const g = grow(t, steps[i], 16);
          return (
            <g key={i} transform={`translate(${x} ${midY}) scale(${Math.max(0, g)})`} opacity={ramp(t, steps[i], 10)}>
              <circle r={118} fill="none" stroke={theme.line} strokeWidth={3} />
              {i === 0 && <Planks />}
              {i === 1 && <Invoice stamp={ramp(t, steps[1] + 12, 8)} />}
              {i === 2 && <SpeechMarks />}
            </g>
          );
        })}
        <g opacity={arrowIn > 0 ? 1 : 0}>
          <line
            x1={xs[0] - 130}
            y1={midY + 190}
            x2={arrowEnd}
            y2={midY + 190}
            stroke={theme.slate}
            strokeWidth={8}
            strokeDasharray="34 18"
            strokeDashoffset={-marching}
          />
          <path
            d={`M ${arrowEnd + 4} ${midY + 168} L ${arrowEnd + 40} ${midY + 190} L ${arrowEnd + 4} ${midY + 212} Z`}
            fill={theme.slate}
          />
        </g>
        <text
          x={(xs[0] + xs[2]) / 2}
          y={midY + 270}
          textAnchor="middle"
          fill={theme.fg}
          fontSize={46}
          fontWeight={600}
          opacity={ramp(t, frames[0], 14)}
        >
          {arrowLabel}
        </text>
        <line x1={1100} y1={colTop - 40} x2={1100} y2={bottom - 40} stroke={theme.line} strokeWidth={3} />
        {absent.map((word, i) => {
          const at = frames[i + 1];
          const y = colTop + rowH * (i + 0.5);
          const tag = grow(t, at + 8, 12);
          return (
            <g key={word} opacity={ramp(t, at, 12)}>
              <text x={1170} y={y + 16} fill={theme.muted} fontSize={50}>
                {word}
              </text>
              <g transform={`translate(1700 ${y}) scale(${Math.max(0, tag)})`}>
                <rect
                  x={-46}
                  y={-30}
                  width={92}
                  height={60}
                  rx={30}
                  fill="none"
                  stroke={theme.muted}
                  strokeWidth={4}
                  strokeDasharray="10 8"
                />
                <line x1={-18} y1={0} x2={18} y2={0} stroke={theme.muted} strokeWidth={5} strokeLinecap="round" />
              </g>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
