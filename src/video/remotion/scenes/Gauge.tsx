import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { lineFrames } from '../../cues';
import { citationTop } from '../Citation';
import type { TimelineScene } from '../../types';
import { GUTTER, countUp, ramp, theme } from '../theme';

/** A damped spring from 0 to 1 over the frames since `from`: overshoots, swings back, settles. For the pointer only. */
const swing = (frame: number, from: number) => {
  const x = frame - from;
  if (x <= 0) return 0;
  return 1 - Math.exp(-x / (theme.motion ? 9 : 6)) * Math.cos(x / 5);
};

/** One percent point on a semicircle dial, 0 to 100: the ticks draw on round the rim, then on the point's
 *  `point:<label>` cue the arc sweeps to the value while the pointer overshoots and settles, the display counting up
 *  in the dial's middle, the point label and the chart's note beneath. The on-screen line (its `line:1` cue or when it
 *  is spoken) is a caption card beside the dial, set apart from it; a line that states a claim ("Claimed: ...") or
 *  options.caption = 'claim' makes the card amber, dashed, in the serif. Under pulse the arc is a glowing gradient,
 *  the pointer tip pulses and the card glows. */
export const Gauge: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const p = chart.points[0];
  const at = pointFrames(scene, 30)[0];
  const lines = lineFrames(scene);
  const caption = scene.onScreenText[0];
  const claim = scene.options.caption !== undefined ? scene.options.caption === 'claim' : /^claim/i.test(caption ?? '');
  const bottom = citationTop(scene);
  const R = Math.min(330, bottom - 345 - 130); // rim labels clear the title; label and note clear the citation
  const cx = GUTTER + R + 110;
  const cy = 345 + R;
  const fill = ramp(t, at, 34);
  const v = Math.max(0, Math.min(100, p.value));
  const needle = (180 * v * swing(t, at)) / 100 + (theme.motion ? 0.6 * Math.sin(t / 7) : 0);
  const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const accent = theme.green;
  const pos = (u: number, r: number) => {
    const a = Math.PI * (1 - u / 100);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const capAt = lines[0] ?? Infinity;
  const ink = claim ? theme.amber : theme.fg;
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 150,
          fontSize: 40,
          color: theme.fg,
          opacity: ramp(t, scene.start + 4, 12),
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }} viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="gauge-arc" gradientUnits="userSpaceOnUse" x1={cx - R} x2={cx + R} y1={0} y2={0}>
            <stop offset="0" stopColor={theme.motion ? theme.violet : accent} />
            <stop offset="0.3" stopColor={accent} />
          </linearGradient>
          <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g opacity={ramp(t, scene.start + 4, 14)}>
          <path d={arc} pathLength={100} fill="none" stroke={theme.raised} strokeWidth={56} strokeLinecap="butt" />
        </g>
        {Array.from({ length: 21 }, (_, k) => {
          const u = k * 5;
          const major = k % 5 === 0;
          const [x1, y1] = pos(u, R + 40);
          const [x2, y2] = pos(u, R + (major ? 70 : 56));
          return (
            <line
              key={k}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? theme.fg : theme.muted}
              strokeWidth={major ? 4 : 2}
              strokeLinecap="round"
              opacity={ramp(t, scene.start + 8 + k * 1.5, 8)}
            />
          );
        })}
        {[0, 25, 50, 75, 100].map((u, k) => {
          const [x, y] = pos(u, R + 104);
          return (
            <text
              key={u}
              x={x}
              y={y + 10}
              textAnchor="middle"
              fontSize={28}
              fill={theme.muted}
              fontFamily={theme.sans}
              opacity={ramp(t, scene.start + 10 + k * 7, 10)}
            >
              {u}
            </text>
          );
        })}
        <path
          d={arc}
          pathLength={100}
          fill="none"
          stroke="url(#gauge-arc)"
          strokeWidth={56}
          strokeDasharray={`${v * fill} 200`}
          filter={theme.motion ? 'url(#gauge-glow)' : undefined}
        />
        <g transform={`rotate(${needle} ${cx} ${cy})`} opacity={ramp(t, scene.start + 10, 10)}>
          {/* a pointer across the rim, clear of the figure in the middle: the dial turns about its centre */}
          <path
            d={`M ${cx - R * 0.66} ${cy} L ${cx - R + 40} ${cy - 13} L ${cx - R - 36} ${cy} L ${cx - R + 40} ${cy + 13} Z`}
            fill={theme.fg}
            filter={theme.motion ? 'url(#gauge-glow)' : undefined}
          />
          <circle
            cx={cx - R - 36}
            cy={cy}
            r={theme.motion ? 9 + 3 * Math.sin(t / 6) : 7}
            fill={theme.motion ? accent : theme.fg}
          />
        </g>
        <line x1={cx - R * 0.6} x2={cx + R * 0.6} y1={cy} y2={cy} stroke={theme.line} strokeWidth={3} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: cx - R,
          width: 2 * R,
          top: cy - R * 0.44,
          textAlign: 'center',
          fontSize: Math.round(R * 0.38),
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: -2,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          opacity: ramp(t, at, 6),
          textShadow: theme.motion ? `0 0 ${26 + 8 * Math.sin(t / 10)}px ${accent}99` : undefined,
        }}
      >
        {countUp(p.display, p.value, fill)}
        {p.unit === 'percent' && !p.display.includes('%') ? (
          <span style={{ fontSize: '0.45em', color: theme.muted, marginLeft: 6 }}>%</span>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: cx - R - 60,
          width: 2 * R + 120,
          top: cy + 40,
          textAlign: 'center',
          opacity: ramp(t, at + 10, 12),
        }}
      >
        <div style={{ fontSize: 36, color: theme.fg }}>{p.label}</div>
        {chart.note ? <div style={{ fontSize: 26, color: theme.muted, marginTop: 10 }}>{chart.note}</div> : null}
      </div>
      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: cx + R + 170,
            right: GUTTER,
            top: 330,
            maxHeight: bottom - 330,
            boxSizing: 'border-box',
            padding: '36px 44px',
            borderRadius: 18,
            border: claim ? `4px dashed ${theme.amber}` : `2px solid ${theme.line}`,
            borderLeft: claim ? `4px dashed ${theme.amber}` : `10px solid ${theme.slate}`,
            background: claim && theme.motion ? `${theme.amber}14` : theme.raised,
            boxShadow: theme.motion
              ? `0 0 ${36 + 10 * Math.sin(t / 11)}px ${claim ? theme.amber : theme.slate}55`
              : undefined,
            opacity: ramp(t, capAt, 12),
            transform: `translateX(${(1 - ramp(t, capAt, 16)) * 60}px)`,
          }}
        >
          <div
            style={{
              fontSize: 52,
              lineHeight: 1.25,
              color: ink,
              fontFamily: claim ? theme.serif : theme.sans,
              fontStyle: claim ? 'italic' : 'normal',
            }}
          >
            {caption}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
