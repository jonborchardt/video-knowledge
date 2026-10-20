import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, easeOut, grow, ramp, theme } from '../theme';

type P = { x: number; y: number };
const R = 54; // stop radius
const smooth = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
/** The route between two stops: a cubic leaving and arriving level, so the road snakes up and down. */
const segPath = (a: P, b: P) => {
  const m = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${m} ${a.y} ${m} ${b.y} ${b.x} ${b.y}`;
};
const segAt = (a: P, b: P, u: number): P => {
  const m = (a.x + b.x) / 2;
  const v = 1 - u;
  return {
    x: v * v * v * a.x + 3 * v * v * u * m + 3 * v * u * u * m + u * u * u * b.x,
    y: v * v * v * a.y + 3 * v * v * u * a.y + 3 * v * u * u * b.y + u * u * u * b.y,
  };
};
/** Lines a greedy word wrap gives `text` at about half an em a character: for placing a card, never for fit. */
const wrapLines = (text: string, chars: number) => {
  let lines = 1;
  let len = 0;
  for (const w of text.split(/\s+/)) {
    if (len && len + 1 + w.length > chars) {
      lines++;
      len = w.length;
    } else len += (len ? 1 : 0) + w.length;
  }
  return lines;
};

/** A route map of the takeaways: numbered stops on a road that snakes across the frame, ghosted from the start. On
 *  each line's frame (`lineFrames`: its `line:<n>` cue or when it is spoken) the road draws itself from the previous
 *  stop, a glowing marker travels along it, the stop pops and its line lands in a card beside it. The camera pushes in
 *  and follows the marker, then settles back on the whole route a few seconds after the last stop, where a soft
 *  pulse cycles across the stops. Reads no options. The road is a gradient through the stops' accents, and everything
 *  glows. */
export const Steps: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = scene.onScreenText;
  const n = lines.length;
  const at = lineFrames(scene);
  const H = citationTop(scene);
  const end = scene.start + scene.duration;
  const accents = [theme.slate, theme.green, theme.amber, theme.violet];
  const accent = (i: number) => accents[i % accents.length];

  // stops alternate above and below the middle; cards sit on the outer side of their stop
  const left = GUTTER + 230;
  const right = 1920 - GUTTER - 230;
  const gap = n > 1 ? (right - left) / (n - 1) : 0;
  const A = Math.min(120, H * 0.13);
  const stops: P[] = lines.map((_, i) => ({ x: n > 1 ? left + i * gap : 960, y: H / 2 + 24 + (i % 2 ? A : -A) }));
  const font = n <= 3 ? 42 : 36;
  const cw = Math.min(640, n > 1 ? 1.85 * gap - 50 : 900);
  const cards = lines.map((line, i) => {
    const h = wrapLines(line, Math.floor((cw - 64) / (font * 0.52))) * font * 1.25 + 52;
    const x = Math.min(Math.max(stops[i].x - cw / 2, GUTTER), 1920 - GUTTER - cw);
    const y = i % 2 ? stops[i].y + R + 34 : stops[i].y - R - 34 - h;
    return { x, y, h };
  });

  // when each segment draws: the stretch before its stop pops
  const draw = (i: number) => {
    const len = Math.max(1, Math.min(40, at[i] - at[i - 1] - 4));
    return smooth((t - (at[i] - len)) / len);
  };
  let active = 0;
  for (let i = 0; i < n; i++) if (t >= at[i]) active = i;
  let marker = stops[active];
  for (let i = 1; i < n; i++) {
    const u = draw(i);
    if (u > 0 && u < 1) marker = segAt(stops[i - 1], stops[i], u);
  }

  // camera: push in on the marker just before the first stop, settle on the whole route after the last
  const settleAt = Math.max(at[n - 1] + 40, Math.min(at[n - 1] + 150, end - 75));
  const settle = smooth((t - settleAt) / 45);
  const b = smooth((t - scene.start - 10) / Math.max(40, at[0] - scene.start - 10)) * (1 - settle);
  const s = 1 + 0.32 * b;
  const C = { x: 960, y: H / 2 + 24 };
  const F = {
    x: C.x + (marker.x - C.x) * b,
    y: C.y + (marker.y + 6 * Math.sin(t / 40) - C.y) * b,
  };
  const screen = (x: number, y: number) => ({ x: C.x + s * (x - F.x), y: C.y + s * (y - F.y) });
  const cycle = settle >= 1 ? Math.floor((t - settleAt - 45) / 36) % n : -1;

  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: H, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: '0 0',
            transform: `translate(${C.x - s * F.x}px, ${C.y - s * F.y}px) scale(${s})`,
          }}
        >
          <svg width={1920} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="steps-road" gradientUnits="userSpaceOnUse" x1={left} y1={0} x2={right} y2={0}>
                {stops.map((_, i) => (
                  <stop key={i} offset={n > 1 ? i / (n - 1) : 0} stopColor={accent(i)} />
                ))}
              </linearGradient>
              <filter id="steps-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={9} result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* the ghost road, dashed, from the start */}
            {stops.slice(1).map((p, i) => (
              <path
                key={`g${i}`}
                d={segPath(stops[i], p)}
                fill="none"
                stroke={theme.line}
                strokeWidth={6}
                strokeDasharray="6 20"
                strokeDashoffset={-t * 0.6}
                strokeLinecap="round"
                opacity={ramp(t, scene.start + 4, 20)}
              />
            ))}
            {/* the road drawn so far */}
            {stops.slice(1).map((p, i) => (
              <path
                key={`r${i}`}
                d={segPath(stops[i], p)}
                pathLength={1}
                fill="none"
                stroke="url(#steps-road)"
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset={1 - draw(i + 1)}
                filter="url(#steps-glow)"
                opacity={draw(i + 1) > 0 ? 1 : 0}
              />
            ))}
            {stops.map((p, i) => {
              const pop = grow(t, at[i], 14);
              const on = t >= at[i];
              const live = i === active && settle < 1;
              const ring = live || i === cycle ? 0.5 + 0.5 * Math.sin((t - at[i]) / 7) : 0;
              const c = accent(i);
              return (
                <g key={`s${i}`} transform={`translate(${p.x} ${p.y})`}>
                  <circle
                    r={R}
                    fill={theme.field === 'transparent' ? theme.bg : theme.field}
                    stroke={theme.line}
                    strokeWidth={4}
                    strokeDasharray="10 10"
                    opacity={ramp(t, scene.start + 8 + i * 6, 16)}
                  />
                  <text
                    y={2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={44}
                    fontWeight={700}
                    fill={theme.muted}
                    opacity={0.6 * ramp(t, scene.start + 14 + i * 6, 16) * (1 - ramp(t, at[i], 6))}
                  >
                    {i + 1}
                  </text>
                  {on || pop > 0 ? (
                    <g transform={`scale(${Math.max(0, pop)})`}>
                      <circle
                        r={R + 14 + 22 * ring}
                        fill="none"
                        stroke={c}
                        strokeWidth={3}
                        opacity={(1 - ring) * (live || i === cycle ? 0.8 : 0)}
                      />
                      <circle r={R} fill={c} stroke={c} strokeWidth={5} filter="url(#steps-glow)" />
                      <text
                        y={2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={52}
                        fontWeight={800}
                        fill={theme.bg}
                      >
                        {i + 1}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
            {/* the travelling marker */}
            <g transform={`translate(${marker.x} ${marker.y})`} opacity={ramp(t, scene.start + 20, 20)}>
              <circle
                r={R + 26 + 6 * Math.sin(t / 9)}
                fill="none"
                stroke={theme.fg}
                strokeWidth={4}
                opacity={0.55}
                filter="url(#steps-glow)"
              />
            </g>
          </svg>
          {lines.map((line, i) => {
            const a = ramp(t, at[i], 16);
            // fade a card the camera has pushed partly off the frame
            const tl = screen(cards[i].x, cards[i].y);
            const br = screen(cards[i].x + cw, cards[i].y + cards[i].h);
            const out = Math.max(0, 24 - tl.x, br.x - 1896, 16 - tl.y, br.y - (H - 8));
            const live = (i === active && settle < 1) || i === cycle;
            const c = accent(i);
            return (
              <div
                key={line}
                style={{
                  position: 'absolute',
                  left: cards[i].x,
                  ...(i % 2 ? { top: cards[i].y } : { bottom: H - cards[i].y - cards[i].h }),
                  width: cw,
                  boxSizing: 'border-box',
                  padding: '26px 32px',
                  borderRadius: 18,
                  background: `linear-gradient(150deg, ${c}38, ${theme.raised} 65%)`,
                  borderLeft: `8px solid ${c}`,
                  boxShadow: live ? `0 0 44px ${c}66` : undefined,
                  fontSize: font,
                  lineHeight: 1.25,
                  color: theme.fg,
                  opacity: a * clamp01(1 - out / 50),
                  transform: `translateY(${(1 - easeOut((t - at[i]) / 16)) * (i % 2 ? -24 : 24)}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
