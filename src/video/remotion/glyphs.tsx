// Small SVG glyphs shared by scenes: no logos, no faces, no brands.
import type { FC } from 'react';
import { theme } from './theme';

export const Person: FC<{ x: number; y: number; r?: number; color?: string; opacity?: number }> = ({
  x,
  y,
  r = 26,
  color = theme.slate,
  opacity = 1,
}) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r} fill={theme.raised} stroke={color} strokeWidth={r / 13} />
    <circle r={r * 0.3} cy={-r * 0.15} fill={color} opacity={0.85} />
    <path d={`M ${-r * 0.56} ${r * 0.6} Q 0 ${-r * 0.08} ${r * 0.56} ${r * 0.6} Z`} fill={color} opacity={0.85} />
  </g>
);

export const DocStack: FC<{ x: number; y: number; color?: string; scale?: number }> = ({
  x,
  y,
  color = theme.slate,
  scale = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {[16, 8, 0].map((d) => (
      <rect
        key={d}
        x={-40 + d}
        y={-50 - d}
        width={80}
        height={100}
        rx={6}
        fill={theme.raised}
        stroke={color}
        strokeWidth={3}
      />
    ))}
    {[-30, -12, 6, 24].map((ly) => (
      <rect key={ly} x={-26} y={ly} width={ly === 24 ? 30 : 52} height={6} rx={3} fill={color} opacity={0.7} />
    ))}
  </g>
);

export const PeopleGrid: FC<{ x: number; y: number; color?: string; scale?: number }> = ({
  x,
  y,
  color = theme.slate,
  scale = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {[-1, 0, 1].flatMap((i) =>
      [-1, 0, 1].map((j) => <Person key={`${i}${j}`} x={i * 34} y={j * 34} r={13} color={color} />),
    )}
  </g>
);

export const Spreadsheet: FC<{ x: number; y: number; color?: string; scale?: number }> = ({
  x,
  y,
  color = theme.slate,
  scale = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x={-50} y={-50} width={100} height={100} rx={6} fill={theme.raised} stroke={color} strokeWidth={3} />
    {[-25, 0, 25].map((ly) => (
      <line key={ly} x1={-50} y1={ly} x2={50} y2={ly} stroke={color} strokeWidth={2} opacity={0.6} />
    ))}
    {[-15, 20].map((lx) => (
      <line key={lx} x1={lx} y1={-50} x2={lx} y2={50} stroke={color} strokeWidth={2} opacity={0.6} />
    ))}
    <rect x={-50} y={-50} width={100} height={25} rx={6} fill={color} opacity={0.5} />
  </g>
);

export const Coin: FC<{ x: number; y: number; r?: number; opacity?: number }> = ({ x, y, r = 11, opacity = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r} fill={theme.amber} />
    <circle r={r * 0.6} fill="none" stroke={theme.bg} strokeWidth={r / 6} opacity={0.6} />
  </g>
);

export const Snowball: FC<{ x: number; y: number; r?: number; roll?: number }> = ({ x, y, r = 40, roll = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${roll})`}>
    <circle r={r} fill={theme.raised} stroke={theme.fg} strokeWidth={3} />
    <circle r={r * 0.25} cx={-r * 0.3} cy={-r * 0.2} fill={theme.fg} opacity={0.25} />
    <circle r={r * 0.15} cx={r * 0.35} cy={r * 0.3} fill={theme.fg} opacity={0.25} />
  </g>
);

export const Box: FC<{ x: number; y: number; s?: number; color?: string }> = ({
  x,
  y,
  s = 34,
  color = theme.amber,
}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={4} fill={theme.raised} stroke={color} strokeWidth={3} />
    <line x1={0} y1={-s / 2} x2={0} y2={s / 2} stroke={color} strokeWidth={3} />
    <line x1={-s / 2} y1={-s / 6} x2={s / 2} y2={-s / 6} stroke={color} strokeWidth={3} />
  </g>
);

/** Blurred text lines: a document nobody can read. */
export const BlurLines: FC<{
  x: number;
  y: number;
  w: number;
  rows: number;
  gap?: number;
  color?: string;
  seed?: number;
}> = ({ x, y, w, rows, gap = 14, color = 'rgba(236,233,226,.45)', seed = 1 }) => (
  <g transform={`translate(${x} ${y})`} filter="url(#blur-lines)">
    <defs>
      <filter id="blur-lines">
        <feGaussianBlur stdDeviation={3} />
      </filter>
    </defs>
    {Array.from({ length: rows }, (_, i) => (
      <rect
        key={i}
        y={i * gap}
        width={w * (0.55 + 0.45 * Math.abs(Math.sin(seed + i * 1.7)))}
        height={gap * 0.5}
        rx={gap / 4}
        fill={color}
      />
    ))}
  </g>
);
