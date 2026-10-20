import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, grow, ramp, theme } from '../theme';

/** sc38: two panels. Left, the broad reviews' countries named one by one; right, the United States as a stack of four
 *  court rulings, each stamped by on-screen line 6, landing on "again and again". Then a dashed, empty outline under
 *  the first country with the last line. Lines: header, three countries, header, stamp word, gap label. */
export const CourtsEvidence: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const f = lineFrames(scene);
  const [leftHead, c1, c2, c3, rightHead, stamp, gapLabel] = scene.onScreenText;
  const countries = [c1, c2, c3];
  const bottom = citationTop(scene) - 20;
  const top = 70;
  const mid = 960;
  const panelW = mid - GUTTER - 30;
  // pages: the first with the stamp word, the rest spread from the first "again" to the second
  const a1 = cue(scene, 'again', f[5] + 30);
  const a2 = Math.max(cue(scene, 'again2', a1 + 30), a1 + 12);
  const pageAt = [f[5], a1, (a1 + a2) / 2, a2];
  const gapAt = cue(scene, 'gap', f[6]);
  const colW = panelW / 3;
  const Panel: FC<{ x: number; head: string; at: number; color: string }> = ({ x, head, at, color }) => {
    return (
      <g>
        <rect
          x={x}
          y={top}
          width={panelW}
          height={bottom - top}
          rx={14}
          fill={theme.raised}
          stroke={theme.line}
          opacity={ramp(t, scene.start + 4, 12)}
        />
        <text
          x={x + panelW / 2}
          y={top + 62}
          textAnchor="middle"
          fill={color}
          fontSize={44}
          fontWeight={700}
          opacity={ramp(t, at, 12)}
        >
          {head}
        </text>
      </g>
    );
  };
  const pw = 200;
  const ph = bottom - top - 330;
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <svg width={1920} height={1080} style={{ fontFamily: theme.sans }}>
        <Panel x={GUTTER} head={leftHead} at={f[0]} color={theme.slate} />
        <Panel x={mid + 30} head={rightHead} at={f[4]} color={theme.amber} />
        {countries.map((c, i) => {
          const s = grow(t, f[i + 1], 14);
          const cx = GUTTER + colW * (i + 0.5);
          return (
            <g key={i} opacity={ramp(t, f[i + 1], 10)} transform={`translate(${cx} ${top + 160}) scale(${s})`}>
              <text textAnchor="middle" dominantBaseline="central" fill={theme.fg} fontSize={36} fontWeight={600}>
                {c}
              </text>
            </g>
          );
        })}
        {(() => {
          const o = ramp(t, gapAt, 14);
          const cx = GUTTER + colW / 2;
          const y0 = top + 210;
          const h = (bottom - 30 - y0) * (theme.motion ? grow(t, gapAt, 14) : 1);
          return (
            <g opacity={o}>
              <rect
                x={cx - colW / 2 + 24}
                y={y0}
                width={colW - 48}
                height={Math.max(0, h)}
                rx={10}
                fill="none"
                stroke={theme.muted}
                strokeWidth={4}
                strokeDasharray="14 10"
              />
              <foreignObject x={cx - colW / 2 + 40} y={y0} width={colW - 80} height={bottom - 30 - y0}>
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 32,
                    lineHeight: 1.25,
                    color: theme.fg,
                    opacity: ramp(t, f[6], 12),
                  }}
                >
                  {gapLabel}
                </div>
              </foreignObject>
            </g>
          );
        })()}
        {pageAt.map((at, i) => {
          const o = ramp(t, at, 10);
          const drop = (1 - grow(t, at, 14)) * -60;
          const x = mid + 30 + panelW / 2 - pw / 2 - 75 + i * 50;
          const y = top + 110 + i * 70 + drop;
          const sAt = at + 8;
          const ss = theme.motion ? 1 + (1 - grow(t, sAt, 10)) * 0.8 : 1;
          return (
            <g key={i} opacity={o} transform={`translate(${x} ${y})`}>
              <rect width={pw} height={ph} rx={6} fill={theme.fg} stroke={theme.bg} strokeWidth={3} />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <rect
                  key={k}
                  x={22}
                  y={86 + k * 26}
                  width={pw - 44 - (k % 3) * 24}
                  height={8}
                  rx={4}
                  fill={theme.muted}
                />
              ))}
              <g opacity={ramp(t, sAt, 8)} transform={`translate(${pw / 2} 38) rotate(-5) scale(${ss})`}>
                <rect x={-88} y={-28} width={176} height={56} rx={6} fill="none" stroke={theme.red} strokeWidth={5} />
                <text textAnchor="middle" dominantBaseline="central" fill={theme.red} fontSize={32} fontWeight={800}>
                  {stamp}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
