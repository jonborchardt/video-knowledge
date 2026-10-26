import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, spokenAt } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, clamp01, grow, ramp, theme } from '../theme';

type P = { x: number; y: number };
const GAP = 56; // between chips in the row
/** The alternatives a question offers: split on ", or ", " or " and ", ", the "?" and a leading "or " dropped. */
const alternatives = (q: string) =>
  q
    .replace(/\?\s*$/, '')
    .split(/,\s*or\s+|\s+or\s+|,\s+/)
    .map((s) => s.replace(/^or\s+/i, '').trim())
    .filter(Boolean);
const smooth = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
const mix = (a: P, b: P, u: number): P => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

/** A question's alternatives as chips. The question types on small at the top from the `type` cue; a "?" node waits
 *  on the left, and each alternative pops in as a big pill on the frame it is spoken (`spokenAt`; unspoken ones fall
 *  back to the `type` cue for the first and an even spread for the rest), a branch drawing out to it from the node,
 *  the newest chip glowing. A second and a half after the last, the fan swings round: the node rises to the middle
 *  and the chips line up side by side beneath it while a soft pulse cycles across them. Reads no options. Chips are
 *  gradient-filled in their own accents and glow. */
export const Choices: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const q = scene.onScreenText[0] ?? '';
  const alts = alternatives(q);
  const n = alts.length;
  const first = scene.sentences[0]?.start ?? scene.start;
  const typeAt = cue(scene, 'type', first);
  const last = scene.sentences.at(-1);
  const spread = ((last ? last.start + last.duration : scene.start + scene.duration) - first) / (n + 1);
  const at: number[] = [];
  alts.forEach((a, i) => {
    const s = spokenAt(scene, a)?.frame;
    const fb = i === 0 ? typeAt + 20 : first + (i + 1) * spread;
    at.push(Math.max(s ?? fb, i ? at[i - 1] + 6 : scene.start));
  });
  const accents = [theme.data, theme.glow, theme.gain, theme.accent2];
  const accent = (i: number) => accents[i % accents.length];

  // chip size: big type, shrunk so the row fits the frame
  const est = (s: string, f: number) => s.length * f * 0.6 + f * 1.6;
  const font = Math.min(70, (70 * (1920 - 2 * GUTTER - (n - 1) * GAP)) / alts.reduce((w, a) => w + est(a, 70), 0));
  const widths = alts.map((a) => est(a, font));

  // the fan: node left, chips stacked to its right; the row: node up top, chips side by side below
  const nodeFan: P = { x: GUTTER + 170, y: 580 };
  const nodeRow: P = { x: 960, y: 400 };
  const step = Math.min(170, 560 / Math.max(1, n - 1));
  const fan = alts.map((_, i) => ({ x: 760 + widths[i] / 2, y: 580 + (i - (n - 1) / 2) * step }));
  const rowW = widths.reduce((w, x) => w + x, 0) + (n - 1) * GAP;
  let rx = 960 - rowW / 2;
  const row = widths.map((w) => {
    const p = { x: rx + w / 2, y: 720 };
    rx += w + GAP;
    return p;
  });
  const swingAt = Math.max(at[n - 1] + 15, Math.min(at[n - 1] + 45, scene.start + scene.duration - 50));
  const u = smooth((t - swingAt) / 26);
  const node = mix(nodeFan, nodeRow, u);
  const float = (i: number) => 6 * Math.sin(t / 26 + i * 1.7);
  const chip = alts.map((_, i) => {
    const p = mix(fan[i], row[i], smooth((t - swingAt - i * 4) / 26));
    return { x: p.x, y: p.y + float(i) };
  });
  let active = -1;
  for (let i = 0; i < n; i++) if (t >= at[i]) active = i;
  const cycle = u >= 1 ? Math.floor((t - swingAt - 26) / 30) % n : -1;
  const lit = (i: number) => (u >= 1 ? i === cycle : i === active);

  // a branch from the node to a chip's near edge: rightward while fanned, downward once in a row
  const branch = (i: number) => {
    const c = chip[i];
    const ex = mix({ x: c.x - widths[i] / 2, y: c.y }, { x: c.x, y: c.y - 60 }, u);
    const d1 = mix({ x: node.x + 220, y: node.y }, { x: node.x, y: node.y + 160 }, u);
    const d2 = mix({ x: ex.x - 200, y: ex.y }, { x: ex.x, y: ex.y - 140 }, u);
    return `M ${node.x} ${node.y} C ${d1.x} ${d1.y} ${d2.x} ${d2.y} ${ex.x} ${ex.y}`;
  };
  const chars = Math.floor(clamp01((t - typeAt) / Math.max(20, q.length * 1.1)) * q.length);

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          right: GUTTER,
          top: 130,
          textAlign: 'center',
          fontSize: 48,
          color: theme.muted,
          lineHeight: 1.25,
        }}
      >
        <span>{q.slice(0, chars)}</span>
        <span style={{ opacity: 0 }}>{q.slice(chars)}</span>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="choices-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={8} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {alts.map((a, i) => {
          const d = ramp(t, at[i] - 12, 14);
          return (
            <g key={a}>
              <path
                d={branch(i)}
                pathLength={1}
                fill="none"
                stroke={lit(i) ? accent(i) : theme.line}
                strokeWidth={lit(i) ? 7 : 5}
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset={1 - d}
                opacity={d > 0 ? 1 : 0}
                filter={lit(i) ? 'url(#choices-glow)' : undefined}
              />
              {u >= 1 ? (
                <path
                  d={branch(i)}
                  fill="none"
                  stroke={accent(i)}
                  strokeWidth={4}
                  strokeDasharray="4 26"
                  strokeDashoffset={-t * 1.4}
                  strokeLinecap="round"
                  opacity={0.6}
                />
              ) : null}
            </g>
          );
        })}
        <g transform={`translate(${node.x} ${node.y})`} opacity={ramp(t, typeAt, 14)}>
          <circle
            r={92}
            fill="none"
            stroke={theme.accent2}
            strokeWidth={4}
            strokeDasharray="14 12"
            transform={`rotate(${t * 0.8})`}
            opacity={0.7}
          />
          <circle
            r={70 * Math.max(0, grow(t, typeAt, 16))}
            fill={theme.accent2}
            stroke={theme.accent2}
            strokeWidth={5}
            filter="url(#choices-glow)"
          />
          <text
            y={4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={92}
            fontWeight={800}
            fill={theme.ground}
            transform={`rotate(${6 * Math.sin(t / 30)})`}
          >
            ?
          </text>
        </g>
      </svg>
      {alts.map((a, i) => {
        const pop = grow(t, at[i], 14);
        const on = ramp(t, at[i], 8);
        const c = accent(i);
        const hot = lit(i);
        const pulse = hot ? 0.5 + 0.5 * Math.sin(((t - at[i]) / 30) * Math.PI * 2) : 0;
        return (
          <div
            key={a}
            style={{
              position: 'absolute',
              left: chip[i].x,
              top: chip[i].y,
              transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * pop) * (1 + 0.04 * pulse)})`,
              opacity: on,
              whiteSpace: 'nowrap',
              fontSize: font,
              fontWeight: 700,
              lineHeight: 1,
              padding: `${font * 0.42}px ${font * 0.8}px`,
              borderRadius: 999,
              color: theme.ground,
              background: `linear-gradient(135deg, ${c}, ${c}AA)`,
              border: `4px solid ${c}`,
              boxShadow: `0 0 ${20 + 40 * pulse}px ${c}${hot ? 'AA' : '44'}`,
            }}
          >
            {a}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
