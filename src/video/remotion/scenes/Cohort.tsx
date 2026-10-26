import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { spokenAt } from '../../cues';
import { citationTop } from '../Citation';
import type { TimelineScene } from '../../types';
import { alpha, countUp, grow, GUTTER, ramp, theme } from '../theme';

const N = 100; // icons in the class, one per percent

/** Each icon's closing rank, a fixed scatter: icon i closes once fewer than rank[i] + 1 of the class remain. */
const RANK = (() => {
  const h = (i: number) => {
    let x = Math.imul(i + 1, 2654435761) >>> 0;
    x ^= x >>> 15;
    return Math.imul(x, 2246822519) >>> 0;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => h(a) - h(b));
  const rank: number[] = [];
  order.forEach((icon, r) => (rank[icon] = r));
  return rank;
})();

/** A shop front in a 48-unit box: scalloped awning, two windows, a door. */
const Shop: FC<{ color: string; lit: number }> = ({ color, lit }) => (
  <g>
    <path
      d="M4 6 H44 V16 a4 4 0 0 1 -8 0 a4 4 0 0 1 -8 0 a4 4 0 0 1 -8 0 a4 4 0 0 1 -8 0 a4 4 0 0 1 -8 0 Z"
      fill={color}
    />
    <rect x={7} y={19} width={34} height={24} rx={2} fill={theme.raised} stroke={color} strokeWidth={2.5} />
    <rect x={11} y={23} width={8} height={7} rx={1} fill={color} opacity={0.35 + 0.5 * lit} />
    <rect x={29} y={23} width={8} height={7} rx={1} fill={color} opacity={0.35 + 0.5 * lit} />
    <rect x={20} y={29} width={8} height={14} rx={1} fill={color} />
  </g>
);

/** The class of new businesses as a class photo: 100 shop fronts in a 10 x 10 grid, each 1% of the class (a legend
 *  says so). One count point (sc10): the shops cascade in corner to corner, the figure counts up beside them on its
 *  `point:<label>` cue, and on the spoken "class photo" a flash goes off and a viewfinder frames the grid. A percent
 *  series (sc14): all 100 open, then on each point's frame the shops beyond round(value) close in a fixed scatter
 *  (flash red, drop, fade to a dim ghost), the point's label and display update big beside the grid, and the grid
 *  pushes in as the class thins. The open shops glow and their windows flicker. No options. */
export const Cohort: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points;
  const fills = pointFrames(scene, 30);
  const series = pts.filter((p) => p.unit === 'percent').length === pts.length && pts.length > 1;
  const top = 260;
  const cell = Math.min(62, (citationTop(scene) - top - 60) / 10);
  const gridW = cell * 10;
  const gx = GUTTER + 20;
  const right = gx + gridW + 110;
  const cur = Math.max(0, fills.filter((f) => t >= f).length - 1);
  // the frame each icon closes on, or Infinity; staggered within its point so a batch ripples out
  const closeAt = RANK.map((r) => {
    if (!series) return Infinity;
    for (let j = 1; j < pts.length; j++) {
      const alive = Math.round(pts[j].value);
      const before = Math.round(pts[j - 1].value);
      if (r >= alive) return fills[j] + ((r - alive) / Math.max(1, before - alive)) * 14;
    }
    return Infinity;
  });
  const span = Math.max(1, fills.at(-1)! - fills[Math.min(1, fills.length - 1)] + 30);
  const zoom = series
    ? 1 + 0.1 * ramp(t, fills[Math.min(1, fills.length - 1)], span)
    : 1 + 0.03 * ramp(t, scene.start, scene.duration);
  const photo = series ? null : spokenAt(scene, 'class photo');
  const flash = photo ? Math.max(0, 1 - (t - photo.frame) / 14) * (t >= photo.frame ? 1 : 0) : 0;
  const finder = photo ? grow(t, photo.frame, 14) : 0;
  const p = pts[cur];
  const pop = series ? grow(t, fills[cur], 12) : 1;
  const color = theme.data;
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
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
      <svg
        width={1920}
        height={1080}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
        viewBox="0 0 1920 1080"
      >
        <defs>
          <filter id="cohort-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g
          transform={`translate(${gx + gridW / 2} ${top + gridW / 2}) scale(${zoom}) translate(${-gridW / 2} ${-gridW / 2})`}
        >
          <g filter="url(#cohort-glow)">
            {RANK.map((_, i) => {
              const row = Math.floor(i / 10);
              const col = i % 10;
              // cascade in along the diagonal, corner to corner
              const inAt = scene.start + 6 + (row + col) * (series ? 1.2 : 3);
              const a = grow(t, inAt, 12);
              const c = closeAt[i];
              const red = ramp(t, c, 6);
              const fall = ramp(t, c + 5, 16);
              const fill = red > 0 ? theme.loss : color;
              const lit = 0.5 + 0.5 * Math.sin(t / 9 + i * 1.7);
              const s = (cell / 48) * (0.92 - 0.12 * fall);
              return (
                <g
                  key={i}
                  opacity={Math.min(1, a) * (1 - 0.8 * fall)}
                  transform={`translate(${col * cell + cell / 2} ${row * cell + cell / 2 + (1 - Math.min(1, a)) * -40 + fall * 14}) scale(${s * Math.max(0.01, a)}) translate(-24 -24)`}
                >
                  <Shop color={fill} lit={red > 0 ? 0 : lit} />
                </g>
              );
            })}
          </g>
          {photo ? (
            // the viewfinder: four corner brackets that spring in round the grid
            <g opacity={Math.min(1, finder)} stroke={theme.fg} strokeWidth={5} fill="none" strokeLinecap="round">
              {[
                [0, 0, 1, 1],
                [1, 0, -1, 1],
                [0, 1, 1, -1],
                [1, 1, -1, -1],
              ].map(([x, y, dx, dy]) => {
                const m = 24 + (1 - finder) * 40;
                const px = x * gridW - dx * m;
                const py = y * gridW - dy * m;
                return <path key={`${x}${y}`} d={`M ${px} ${py + dy * 60} V ${py} H ${px + dx * 60}`} />;
              })}
            </g>
          ) : null}
          {flash > 0 ? (
            <rect x={-60} y={-60} width={gridW + 120} height={gridW + 120} fill={theme.fg} opacity={0.55 * flash} />
          ) : null}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: right,
          top: top + 40,
          width: 1920 - GUTTER - right,
          opacity: ramp(t, fills[0], 10),
        }}
      >
        {series ? (
          <div
            style={{
              fontSize: 56,
              color: theme.muted,
              transform: `translateY(${(1 - Math.min(1, pop)) * 16}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </div>
        ) : null}
        <div
          style={{
            fontSize: series ? 210 : 170,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -3,
            color: series && cur > 0 ? theme.fg : theme.data,
            fontVariantNumeric: 'tabular-nums',
            transform: `scale(${0.9 + 0.1 * pop})`,
            transformOrigin: 'left center',
            textShadow: `0 0 ${30 + 10 * Math.sin(t / 12)}px ${alpha(theme.data, 0.53)}`,
            whiteSpace: 'nowrap',
          }}
        >
          {series ? p.display : countUp(p.display, p.value, ramp(t, fills[0], 45))}
          {series && p.unit === 'percent' && !p.display.includes('%') ? (
            <span style={{ fontSize: 90, color: theme.muted, marginLeft: 10 }}>%</span>
          ) : null}
        </div>
        {series ? (
          // one tick per point, the passed ones filled red, the current one ringed
          <div style={{ display: 'flex', gap: 18, marginTop: 30 }}>
            {pts.map((q, j) => (
              <div
                key={q.label}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  boxSizing: 'border-box',
                  border: `3px solid ${j === cur ? theme.fg : theme.line}`,
                  background: j < cur ? theme.loss : j === cur ? theme.data : 'transparent',
                  boxShadow: j === cur ? `0 0 18px ${theme.data}` : undefined,
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 40, color: theme.muted, marginTop: 14 }}>{p.label}</div>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          left: right,
          top: top + gridW - 50,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 30,
          color: theme.muted,
          opacity: ramp(t, scene.start + 40, 12),
        }}
      >
        <svg width={44} height={44} viewBox="0 0 48 48">
          <Shop color={color} lit={1} />
        </svg>
        <span>1 shop = 1% of the class</span>
      </div>
    </AbsoluteFill>
  );
};
