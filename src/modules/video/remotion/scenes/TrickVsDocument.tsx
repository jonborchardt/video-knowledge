import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { alpha, grow, GUTTER, ramp, theme } from '../theme';

/** A two-column board: onScreenText is [left header, right header, then left/right pairs]. The headers appear on
 *  `line:1`/`line:2`; each row on its left line's cue (`line:3`, `line:5`, ...), the right box a beat later. Each
 *  right box is drawn narrower than its left one, a dashed ghost of the left box's width behind it showing the gap.
 *  Left is the pitch (glow), right the document (data). No options. */
export const TrickVsDocument: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const at = lineFrames(scene);
  const [lh, rh, ...cells] = scene.onScreenText;
  const rows = Array.from({ length: Math.floor(cells.length / 2) }, (_, i) => [cells[2 * i], cells[2 * i + 1]]);
  const top = 250;
  const bottom = citationTop(scene) - 10;
  const pitch = (bottom - top) / rows.length;
  const boxH = Math.min(140, pitch - 24);
  const gap = 90;
  const W = 1920 - 2 * GUTTER - gap;
  const lw = W / 2;
  const rx = GUTTER + lw + gap;
  const rw = lw * 0.64; // narrower: what the document actually says
  const head = (i: number) => ramp(t, at[i], 12);

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      {[lh, rh].map((h, i) => (
        <div
          key={h}
          style={{
            position: 'absolute',
            left: i ? rx : GUTTER,
            top: 160,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: i ? theme.data : theme.glow,
            opacity: head(i),
            transform: `translateY(${(1 - head(i)) * -16}px)`,
          }}
        >
          {h}
        </div>
      ))}
      {rows.map(([trick, real], r) => {
        const y = top + r * pitch + (pitch - boxH) / 2;
        const from = at[2 + 2 * r];
        const a = grow(t, from, 14);
        const b = grow(t, from + 14, 16);
        const ghost = ramp(t, from + 26, 14);
        const arrow = ramp(t, from + 8, 10);
        return (
          <div key={trick}>
            <div
              style={{
                position: 'absolute',
                left: GUTTER,
                top: y,
                width: lw,
                height: boxH,
                boxSizing: 'border-box',
                padding: '0 32px',
                display: 'flex',
                alignItems: 'center',
                background: theme.raised,
                border: `3px solid ${theme.glow}`,
                borderRadius: 14,
                boxShadow: `0 0 26px ${alpha(theme.glow, 0.33)}`,
                fontSize: 46,
                fontWeight: 600,
                color: theme.fg,
                opacity: Math.min(1, Math.max(0, a)),
                transform: `scale(${0.85 + 0.15 * a})`,
                transformOrigin: 'left center',
              }}
            >
              {trick}
            </div>
            <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
              <line
                x1={GUTTER + lw + 14}
                x2={GUTTER + lw + 14 + (gap - 40) * arrow}
                y1={y + boxH / 2}
                y2={y + boxH / 2}
                stroke={theme.muted}
                strokeWidth={4}
                opacity={arrow}
              />
              <path
                d={`M ${rx - 26} ${y + boxH / 2 - 10} L ${rx - 14} ${y + boxH / 2} L ${rx - 26} ${y + boxH / 2 + 10}`}
                fill="none"
                stroke={theme.muted}
                strokeWidth={4}
                opacity={arrow >= 0.99 ? 1 : 0}
              />
              {/* the trick's width, dashed, behind the narrower document */}
              <rect
                x={rx}
                y={y}
                width={lw}
                height={boxH}
                rx={14}
                fill="none"
                stroke={theme.loss}
                strokeWidth={3}
                strokeDasharray="10 10"
                opacity={0.6 * ghost}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: rx,
                top: y,
                width: rw * Math.max(0, b),
                height: boxH,
                boxSizing: 'border-box',
                padding: '0 26px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                background: theme.data,
                borderRadius: 14,
                boxShadow: `0 0 26px ${alpha(theme.data, 0.4)}`,
                fontSize: 32,
                fontWeight: 600,
                lineHeight: 1.2,
                color: theme.ground,
                opacity: Math.min(1, Math.max(0, b * 2)),
              }}
            >
              <div style={{ width: rw - 52, flexShrink: 0 }}>{real}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
