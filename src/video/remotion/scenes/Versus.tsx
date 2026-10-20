import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, easeBack, easeOut, grow, ramp, theme } from '../theme';

type Pace = 'fast' | 'slow';

/** A pace pictogram, drawn on over `d` (0..1) and ticking with `t`: fast is a stopwatch whose hand whips round beside
 *  a line that falls off a cliff; slow is a calendar flipping its pages beside a line that sinks gently over a long
 *  run. Shapes only, no figures. */
const Picto: FC<{ pace: Pace; d: number; t: number; color: string; x: number; y: number }> = ({
  pace,
  d,
  t,
  color,
  x,
  y,
}) => {
  const W = 380;
  const H = 180;
  // the curve: y as a fraction of H at u in 0..1
  const at = (u: number) => (pace === 'fast' ? 1 - Math.exp(-u * 9) * 0.95 : 0.05 + 0.6 * u);
  const steps = 40;
  const n = Math.max(1, Math.round(steps * d));
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / steps;
    return `${(u * W).toFixed(1)},${(at(u) * H).toFixed(1)}`;
  });
  const tipU = n / steps;
  const glow = theme.motion ? 'url(#vs-glow)' : undefined;
  const spin = pace === 'fast' ? t * 14 : t * 0.8; // degrees per frame
  const page = Math.floor(t / 45) % 4; // calendar flips a page every 1.5s
  const flip = (t % 45) / 45;
  return (
    <g transform={`translate(${x} ${y})`} opacity={clamp01(d * 3)}>
      {/* icon */}
      <g transform={`translate(-150 ${H / 2}) scale(${0.6 + 0.4 * easeBack(d * 2)})`}>
        {pace === 'fast' ? (
          <g>
            <rect x={-12} y={-92} width={24} height={16} rx={4} fill={color} />
            <circle r={72} fill={theme.raised} stroke={color} strokeWidth={8} filter={glow} />
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1={0}
                y1={-60}
                x2={0}
                y2={i % 3 ? -54 : -48}
                stroke={color}
                strokeWidth={4}
                transform={`rotate(${i * 30})`}
              />
            ))}
            <line
              x1={0}
              y1={8}
              x2={0}
              y2={-58}
              stroke={color}
              strokeWidth={6}
              strokeLinecap="round"
              transform={`rotate(${spin})`}
            />
            <circle r={8} fill={color} />
          </g>
        ) : (
          <g>
            <rect x={-70} y={-62} width={140} height={130} rx={10} fill={theme.raised} stroke={color} strokeWidth={6} />
            <rect x={-70} y={-62} width={140} height={32} rx={8} fill={color} />
            {[-40, 40].map((rx) => (
              <rect key={rx} x={rx - 5} y={-78} width={10} height={28} rx={5} fill={color} />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <rect
                key={i}
                x={-54 + (i % 4) * 30}
                y={-16 + Math.floor(i / 4) * 26}
                width={18}
                height={16}
                rx={3}
                fill={color}
                opacity={i === (page * 3 + 2) % 12 ? 0.95 : 0.3}
              />
            ))}
            {/* the turning page */}
            <rect
              x={-70}
              y={-30}
              width={140}
              height={98}
              rx={8}
              fill={color}
              opacity={0.25 * (1 - flip)}
              transform={`translate(0 -30) scale(1 ${1 - flip}) translate(0 30)`}
            />
          </g>
        )}
      </g>
      {/* axes */}
      <line x1={0} y1={H} x2={W} y2={H} stroke={theme.line} strokeWidth={4} />
      <line x1={0} y1={0} x2={0} y2={H} stroke={theme.line} strokeWidth={4} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={glow}
      />
      <circle
        cx={tipU * W}
        cy={at(tipU) * H}
        r={13 + (theme.motion ? 4 * Math.sin(t / 6) : 0)}
        fill={color}
        filter={glow}
      />
    </g>
  );
};

/** sc07, sc17: two lines face off on a split screen. The frame splits on a drifting diagonal seam; line 1 slams into
 *  the left half (amber) on its line frame, line 2 into the right half (slate) on its own, with a jolt; a "VS" badge
 *  crashes into the seam with a flash when the second lands. Each half carries a pace pictogram (options.pace, e.g.
 *  "fast,slow", the default, or "slow,fast"). The side last landed is lit, the other dimmed. A line "label: rest"
 *  shows the label small above the rest. */
export const Versus: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = scene.onScreenText.slice(0, 2);
  const at = lineFrames(scene);
  const paces = String(scene.options.pace ?? 'fast,slow').split(',') as Pace[];
  const bottom = Math.min(citationTop(scene), 1000);
  const colors = [theme.amber, theme.slate];
  const seam = 960 + 26 * Math.sin(t / 37); // the seam's midpoint drifts
  const tilt = 130 + 20 * Math.sin(t / 53);
  const land = at.map((f) => ramp(t, f, 10));
  const active = land[1] > 0.5 ? 1 : 0;
  const lit = (i: number) => (land[1] <= 0 ? 1 : i === active ? 1 : 0.42 + 0.58 * (1 - ramp(t, at[1], 16)));
  // the jolt: a decaying shake after each landing
  const shake = at.reduce((s, f) => {
    const x = t - f;
    return x >= 0 && x < 18 ? s + Math.sin(x * 2.4) * 14 * (1 - x / 18) : s;
  }, 0);
  const vs = at[1] ?? at[0];
  const badge = grow(t, vs, 12);
  const flash = t >= vs ? Math.max(0, 1 - (t - vs) / 10) : 0;
  // text column centres: left half and right half, inside the seam
  const cx = [500, 1420];
  const textTop = 470;
  const textH = Math.min(330, bottom - 40 - textTop);
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="vs-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {colors.map((c, i) => (
              <linearGradient key={i} id={`vs-half-${i}`} x1={i ? 1 : 0} y1={0} x2={i ? 0 : 1} y2={1}>
                <stop offset="0" stopColor={c} stopOpacity={theme.motion ? 0.42 : 0.2} />
                <stop offset="1" stopColor={c} stopOpacity={theme.motion ? 0.08 : 0.04} />
              </linearGradient>
            ))}
          </defs>
          {/* the halves slide in from their own edges */}
          <polygon
            points={`0,0 ${seam + tilt},0 ${seam - tilt},1080 0,1080`}
            fill="url(#vs-half-0)"
            opacity={lit(0)}
            transform={`translate(${-1100 * (1 - easeBack(ramp(t, at[0] - 8, 12)))} 0)`}
          />
          <polygon
            points={`${seam + tilt},0 1920,0 1920,1080 ${seam - tilt},1080`}
            fill="url(#vs-half-1)"
            opacity={at[1] === undefined ? 0 : lit(1)}
            transform={`translate(${1100 * (1 - easeBack(ramp(t, (at[1] ?? 1e9) - 8, 12)))} 0)`}
          />
          {/* the seam */}
          <line
            x1={seam + tilt}
            y1={0}
            x2={seam + tilt - (2 * tilt * bottom) / 1080}
            y2={bottom} // stops above the citation
            stroke={theme.fg}
            strokeWidth={6}
            opacity={0.25 + 0.6 * badge}
            strokeDasharray={1200}
            strokeDashoffset={1200 * (1 - ramp(t, at[0], 20))}
            filter={theme.motion ? 'url(#vs-glow)' : undefined}
          />
          {lines.map((_, i) => (
            <g key={i} opacity={lit(i)}>
              <Picto
                pace={paces[i] === 'slow' ? 'slow' : 'fast'}
                d={ramp(t, at[i] + 4, 40)}
                t={t}
                color={colors[i]}
                x={cx[i] - 90}
                y={200}
              />
            </g>
          ))}
          {/* the VS badge crashes into the seam */}
          <g
            transform={`translate(${seam} 440) scale(${0.001 + badge * (1 + 0.05 * Math.sin(t / 8))}) rotate(${(1 - badge) * -90 - 8})`}
          >
            <circle
              r={92}
              fill={theme.bg}
              stroke={theme.fg}
              strokeWidth={8}
              filter={theme.motion ? 'url(#vs-glow)' : undefined}
            />
            <circle r={78} fill={theme.motion ? theme.red : theme.raised} />
            <text
              y={26}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontWeight={900}
              fontSize={76}
              fill={theme.fg}
              fontStyle="italic"
            >
              VS
            </text>
          </g>
          {/* the ring the badge throws out */}
          {t >= vs && t < vs + 24 ? (
            <circle
              cx={seam}
              cy={440}
              r={92 + 260 * easeOut((t - vs) / 24)}
              fill="none"
              stroke={theme.fg}
              strokeWidth={10 * (1 - (t - vs) / 24)}
              opacity={1 - (t - vs) / 24}
            />
          ) : null}
        </svg>
        {lines.map((line, i) => {
          const colon = line.indexOf(':');
          const label = colon > 0 ? line.slice(0, colon) : null;
          const rest = colon > 0 ? line.slice(colon + 1).trim() : line;
          const a = ramp(t, at[i], 8);
          // the slam: drops in from above, oversized, and lands (springing under pulse)
          const e = theme.motion ? easeBack((t - at[i]) / 12) : easeOut((t - at[i]) / 8);
          const big = rest.length > 24 ? 64 : 80;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cx[i] - 330,
                top: textTop,
                width: 660,
                height: textH,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: i ? 'flex-start' : 'flex-end',
                textAlign: i ? 'left' : 'right',
                opacity: a * lit(i),
                transform: `translateY(${-160 * (1 - e)}px) scale(${1 + 0.12 * (1 - e)})`,
                transformOrigin: i ? '0% 50%' : '100% 50%',
              }}
            >
              {label ? (
                <div
                  style={{
                    fontSize: 36,
                    color: colors[i],
                    textTransform: 'uppercase',
                    letterSpacing: 4,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  {label}
                </div>
              ) : null}
              <div
                style={{
                  fontSize: big,
                  fontWeight: 800,
                  lineHeight: 1.08,
                  color: theme.motion ? theme.fg : label ? theme.fg : colors[i],
                  textShadow: theme.motion ? `0 0 30px ${colors[i]}aa` : undefined,
                  letterSpacing: -1,
                }}
              >
                {rest}
              </div>
              <div
                style={{
                  marginTop: 22,
                  height: 8,
                  width: 220 * ramp(t, at[i] + 4, 16),
                  borderRadius: 4,
                  background: colors[i],
                  boxShadow: theme.motion ? `0 0 18px ${colors[i]}` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* the flash as the badge hits */}
      <AbsoluteFill style={{ background: theme.fg, opacity: 0.35 * flash, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
