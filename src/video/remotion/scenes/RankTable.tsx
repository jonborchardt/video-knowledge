import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

const share = (label: string) => Number(label.replace(/[^0-9.]/g, '')) || 0.01; // "<0.01%" -> 0.01

/** sc18: one rank table two ways. Left, as the company shows it: equal rows, label (share) and average. Right, as the
 *  people are distributed: each row's height is its share, built from the bottom on the `shape` cue; the thinnest row
 *  gets a magnifier callout on the `top` cue; the third on-screen line overlays on the `half` cue. */
export const RankTable: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const n = pts.length;
  const s0 = scene.sentences[0].start;
  const shape = cue(scene, 'shape', s0 + 30);
  const top = cue(scene, 'top', s0 + 150);
  const half = cue(scene, 'half', lineFrames(scene)[2] ?? s0 + 240);
  const H = 640;
  const y0 = 220;
  const total = pts.reduce((a, p) => a + share(p.label), 0);
  const rowH = H / n;
  let yAcc = y0 + H;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 120,
          fontSize: 34,
          color: theme.muted,
          opacity: ramp(t, s0, 10),
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080}>
        <text x={GUTTER} y={y0 - 24} fill={theme.fg} fontSize={30} opacity={ramp(t, s0, 10)}>
          as the company shows it
        </text>
        <text x={GUTTER + 300} y={y0 - 24} fill={theme.muted} fontSize={24} opacity={ramp(t, s0, 10)}>
          share of participants
        </text>
        <text x={GUTTER + 880} y={y0 - 24} textAnchor="end" fill={theme.muted} fontSize={24} opacity={ramp(t, s0, 10)}>
          average earnings
        </text>
        {[...pts].reverse().map((p, k) => {
          const a = ramp(t, s0 + 6 + k * 4, 8);
          const y = y0 + k * rowH;
          return (
            <g key={p.label + k} opacity={a}>
              <rect x={GUTTER} y={y} width={880} height={rowH - 4} rx={4} fill={theme.raised} />
              <text x={GUTTER + 20} y={y + rowH / 2 + 10} fill={theme.muted} fontSize={26}>{`rank ${n - k}`}</text>
              <text x={GUTTER + 300} y={y + rowH / 2 + 10} fill={theme.fg} fontSize={28}>
                {p.label}
              </text>
              <text
                x={GUTTER + 860}
                y={y + rowH / 2 + 10}
                textAnchor="end"
                fill={theme.fg}
                fontSize={28}
                fontVariant="tabular-nums"
              >
                {p.display}
              </text>
            </g>
          );
        })}
        <text x={1040} y={y0 - 24} fill={theme.fg} fontSize={30} opacity={ramp(t, shape, 10)}>
          as the people are distributed
        </text>
        {pts.map((p, i) => {
          const h = (H * share(p.label)) / total;
          yAcc -= h;
          const a = ramp(t, shape + i * 5, 10);
          const hot = i === n - 1 ? ramp(t, top, 10) : 0;
          return (
            <g key={p.label + i} opacity={a}>
              <rect
                x={1040}
                y={yAcc}
                width={700}
                height={Math.max(1.5, h - (h > 6 ? 3 : 0))}
                fill={i === 0 ? theme.red : i === n - 1 ? theme.amber : theme.slate}
                opacity={i === 0 ? 0.9 : 0.8}
              />
              {h > 40 ? (
                <text
                  x={1060}
                  y={yAcc + h / 2 + 10}
                  fill={theme.bg}
                  fontSize={30}
                  fontWeight={700}
                >{`${p.label}: ${p.display} average`}</text>
              ) : null}
              {i === n - 1 && hot > 0 ? (
                <g opacity={hot} transform={`translate(1760 ${yAcc})`}>
                  <circle r={40} fill="none" stroke={theme.amber} strokeWidth={5} />
                  <line x1={28} y1={28} x2={60} y2={60} stroke={theme.amber} strokeWidth={6} strokeLinecap="round" />
                  <text
                    x={-50}
                    y={-56}
                    textAnchor="end"
                    fill={theme.amber}
                    fontSize={26}
                  >{`${p.label}: ${p.display}`}</text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 870,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 48,
          color: theme.fg,
          opacity: ramp(t, half, 12),
          textShadow: '0 4px 30px rgba(0,0,0,.9)',
        }}
      >
        {scene.onScreenText[2]}
      </div>
    </AbsoluteFill>
  );
};
