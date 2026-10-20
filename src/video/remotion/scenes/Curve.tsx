import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, countUp, grow, ramp, theme } from '../theme';

const YEAR = /\b(\d{4})\b/;
type P = { x: number; y: number };

/** The colour an on-screen line speaks in: red for a loss, green for survival, amber otherwise. */
const tone = (line: string) =>
  /clos|gone|lost|fail|dead|died/i.test(line)
    ? theme.red
    : /operat|surviv|still|open/i.test(line)
      ? theme.green
      : theme.amber;

/** Does the segment a-b pass through the rectangle (sampled; good enough at screen scale)? */
const hits = (a: P, b: P, r: { x: number; y: number; w: number; h: number }) => {
  for (let k = 0; k <= 24; k++) {
    const x = a.x + ((b.x - a.x) * k) / 24;
    const y = a.y + ((b.y - a.y) * k) / 24;
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  }
  return false;
};

/** A survival curve: the points placed on x by the 4-digit year in each label when every label has a distinct one
 *  (else evenly by index), on y 0..100 for percent (else 0..1.15 x the largest value). The axis carries one tick per
 *  point (its year, or its label). Segment i draws from point i-1 to point i on point i's `point:<label>` frame (or
 *  the fallback), a glowing head dot riding its end, a gradient area beneath and the lost share above tinted red;
 *  each point's display pops beside its dot as the head arrives. The view zooms in on the head while the line draws
 *  and eases out to the whole curve once the last point lands. onScreenText lines appear as callouts on their
 *  lineFrames, in the first plot corner where neither the line nor a display sits. Reads no options. */
export const Curve: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const n = pts.length;
  const fills = pointFrames(scene);
  const lines = lineFrames(scene);
  const years = pts.map((p) => YEAR.exec(p.label)?.[1]);
  const byYear = years.every(Boolean) && new Set(years).size === n;
  const xs = byYear ? years.map(Number) : pts.map((_, i) => i);
  const x0 = Math.min(...xs);
  const span = Math.max(...xs) - x0 || 1;
  const top = pts.every((p) => p.unit === 'percent') ? 100 : Math.max(...pts.map((p) => p.value)) * 1.15;
  const L = GUTTER + 40;
  const R = 1920 - GUTTER - 70;
  const T = 280;
  const B = citationTop(scene) - 76;
  const world = pts.map((p, i): P => ({ x: L + ((xs[i] - x0) / span) * (R - L), y: B - (p.value / top) * (B - T) }));

  // drawing: segment i (ending on point i) runs over D[i] frames from fills[i]
  const D = fills.map((f, i) => Math.max(8, Math.min(26, (fills[i + 1] ?? Infinity) - f - 4)));
  const prog = fills.map((f, i) => (i ? ramp(t, f, D[i]) : t >= f ? 1 : 0));
  let k = 0; // the latest segment that has started
  for (let i = 1; i < n; i++) if (t >= fills[i]) k = i;
  const headW =
    k === 0
      ? world[0]
      : {
          x: world[k - 1].x + (world[k].x - world[k - 1].x) * prog[k],
          y: world[k - 1].y + (world[k].y - world[k - 1].y) * prog[k],
        };
  const done = fills[n - 1] + D[n - 1];

  // camera: push in on the head while drawing, ease out to the whole curve; focus clamped so the view stays inside
  const zMax = n <= 2 ? 1.3 : n <= 4 ? 1.5 : 1.75;
  const z = ramp(t, fills[0], 24) * (1 - ramp(t, done + 12, 45));
  const s = 1 + (zMax - 1) * z;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  const hw = (R - L) / (2 * s);
  const hh = (B - T) / (2 * s);
  const fx = Math.min(R - hw, Math.max(L + hw, headW.x));
  const fy = Math.min(B - hh, Math.max(T + hh, headW.y));
  const at = (w: P): P => ({ x: cx + s * (w.x - fx), y: cy + s * (w.y - fy) });
  const yAt = (v: number) => cy + s * (B - (v / top) * (B - T) - fy);
  const inView = (p: P) => clamp01(1 - Math.max(0, L - 8 - p.x, p.x - R - 8, T - 8 - p.y, p.y - B - 8) / 12);

  const screen = world.map(at);
  const head = at(headW);
  const drawn = [...screen.slice(0, k), head];
  const path = drawn.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const base = yAt(0);
  const ceil = yAt(top);
  const area = `${path} L ${head.x} ${base} L ${drawn[0].x} ${base} Z`;
  const lost = top === 100 ? `${path} L ${head.x} ${ceil} L ${drawn[0].x} ${ceil} Z` : '';
  const axisIn = ramp(t, scene.start + 4, 14);
  const lineIn = ramp(t, fills[0], 10);
  const arrive = fills.map((f, i) => (i ? f + D[i] * 0.8 : f));
  const fs = n > 6 ? 32 : 38;
  const textW = (d: string) => d.length * fs * 0.58;
  // a display sits above-right of its dot (the curve falls away below-right); flipped left at the right edge
  const dispBox = (p: P, d: string) => {
    const w = textW(d);
    const left = p.x + 16 + w > 1920 - 40;
    return { x: left ? p.x - 16 - w : p.x + 16, y: p.y - 22 - fs, w, h: fs + 8, left };
  };
  const newest = (() => {
    let j = 0;
    for (let i = 0; i < n; i++) if (t >= arrive[i]) j = i;
    return j;
  })();
  const id = `curve-${scene.id}`;
  const pulse = 0.5 + 0.5 * Math.sin((t - scene.start) / 9);

  // callouts: one block, placed against the whole-curve view
  const cfs = 46;
  const cw = Math.max(0, ...scene.onScreenText.map((l) => l.length * cfs * 0.56 + 80));
  const ch = scene.onScreenText.length * 78 + Math.max(0, scene.onScreenText.length - 1) * 14;
  const corners = [
    { x: R - cw, y: T + 10, right: true },
    { x: R - cw, y: B - ch - 24, right: true },
    { x: L + 24, y: B - ch - 24, right: false },
    { x: L + 24, y: T + 10, right: false },
  ];
  const score = (c: (typeof corners)[number]) => {
    const r = { x: c.x - 24, y: c.y - 24, w: cw + 48, h: ch + 48 };
    let bad = 0;
    for (let i = 1; i < n; i++) if (hits(world[i - 1], world[i], r)) bad += 2;
    for (let i = 0; i < n; i++) {
      const d = dispBox(world[i], pts[i].display);
      if (d.x < r.x + r.w && d.x + d.w > r.x && d.y < r.y + r.h && d.y + d.h > r.y) bad += 1;
    }
    return bad;
  };
  const spot = corners.reduce((a, c) => (score(c) < score(a) ? c : a));

  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 150,
          fontSize: 38,
          color: theme.fg,
          opacity: axisIn,
          transform: `translateX(${(1 - axisIn) * -24}px)`,
        }}
      >
        {chart.title}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={L - 40} y={T - 40} width={R - L + 80} height={B - T + 40} />
          </clipPath>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.slate} stopOpacity={0.55} />
            <stop offset="1" stopColor={theme.violet} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={theme.violet} />
            <stop offset="1" stopColor={theme.slate} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={9} />
          </filter>
        </defs>
        {/* grid: quarter lines, a solid baseline; ticks from the point labels */}
        <g opacity={axisIn}>
          {[0.25, 0.5, 0.75, 1].map((q) => {
            const y = yAt(q * top);
            return y > T - 4 && y < B + 4 ? (
              <line key={q} x1={L} x2={R} y1={y} y2={y} stroke={theme.line} strokeWidth={2} strokeDasharray="4 10" />
            ) : null;
          })}
          <line x1={L} x2={R} y1={B} y2={B} stroke={theme.muted} strokeWidth={3} />
          {screen.map((p, i) => {
            const o = inView({ x: p.x, y: B });
            const lit = t >= arrive[i];
            return (
              <g key={pts[i].label} opacity={o}>
                <line x1={p.x} x2={p.x} y1={B} y2={B + 12} stroke={lit ? theme.slate : theme.muted} strokeWidth={3} />
                <text
                  x={p.x}
                  y={B + 48}
                  textAnchor="middle"
                  fontSize={n > 6 ? 26 : 30}
                  fill={lit ? theme.fg : theme.muted}
                  fontWeight={i === newest && lit ? 700 : 400}
                >
                  {byYear ? years[i] : pts[i].label}
                </text>
              </g>
            );
          })}
        </g>
        <g clipPath={`url(#${id}-clip)`} opacity={lineIn}>
          {lost ? <path d={lost} fill={theme.red} opacity={0.16 + 0.05 * pulse} /> : null}
          <path d={area} fill={`url(#${id}-area)`} />
          <path d={path} fill="none" stroke={theme.slate} strokeWidth={14} opacity={0.6} filter={`url(#${id}-glow)`} />
          <path
            d={path}
            fill="none"
            stroke={`url(#${id}-stroke)`}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {screen.map((p, i) => {
            const g = grow(t, arrive[i], 12);
            return t >= arrive[i] ? (
              <circle
                key={pts[i].label}
                cx={p.x}
                cy={p.y}
                r={9 * g}
                fill={theme.bg}
                stroke={i === newest ? theme.amber : theme.slate}
                strokeWidth={4}
              />
            ) : null;
          })}
          {/* the head: a halo, a pulsing ring once it rests, the dot */}
          <circle cx={head.x} cy={head.y} r={26} fill={theme.slate} opacity={0.35} filter={`url(#${id}-glow)`} />
          <circle
            cx={head.x}
            cy={head.y}
            r={16 + 16 * pulse}
            fill="none"
            stroke={theme.amber}
            strokeWidth={3}
            opacity={0.7 * (1 - pulse)}
          />
          <circle cx={head.x} cy={head.y} r={11} fill={theme.amber} />
        </g>
      </svg>
      {screen.map((p, i) => {
        const a = ramp(t, arrive[i], 8) * inView(p);
        const d = dispBox(p, pts[i].display);
        const hot = i === newest;
        return (
          <div
            key={pts[i].label}
            style={{
              position: 'absolute',
              left: d.left ? undefined : d.x,
              right: d.left ? 1920 - (d.x + d.w) : undefined,
              top: d.y,
              fontSize: fs,
              fontWeight: 700,
              lineHeight: 1,
              color: hot ? theme.amber : theme.fg,
              opacity: a * (hot ? 1 : 0.85),
              transform: `scale(${0.6 + 0.4 * grow(t, arrive[i], 12)})`,
              transformOrigin: d.left ? 'right bottom' : 'left bottom',
              textShadow: hot ? `0 0 18px ${theme.amber}` : undefined,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {countUp(pts[i].display, pts[i].value, ramp(t, arrive[i], 12))}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: spot.right ? undefined : spot.x,
          right: spot.right ? 1920 - R : undefined,
          top: spot.y,
          display: 'flex',
          flexDirection: 'column',
          alignItems: spot.right ? 'flex-end' : 'flex-start',
          gap: 14,
        }}
      >
        {scene.onScreenText.map((line, j) => {
          const a = ramp(t, lines[j], 14);
          const c = tone(line);
          return (
            <div
              key={line}
              style={{
                fontSize: cfs,
                fontWeight: 700,
                lineHeight: '78px',
                height: 78,
                padding: '0 28px',
                whiteSpace: 'nowrap',
                color: theme.fg,
                borderLeft: `8px solid ${c}`,
                borderRadius: 10,
                background: `linear-gradient(90deg, ${c}44, ${theme.bg}DD)`,
                boxShadow: `0 0 ${24 + 12 * pulse}px ${c}66`,
                opacity: a,
                transform: `translateX(${(1 - a) * (spot.right ? 60 : -60)}px) scale(${0.9 + 0.1 * grow(t, lines[j], 14)})`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
