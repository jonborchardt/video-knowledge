import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, easeOut, ramp, theme } from '../theme';

const COLORS = [theme.red, theme.slate, theme.green];
const NAMED: Record<string, string> = {
  red: theme.red,
  slate: theme.slate,
  green: theme.green,
  amber: theme.amber,
  muted: theme.muted,
};

/** One bar filling left to right (segment colours from options.colors when given), each segment on its `point:<label>` cue; widths are the published percentages of the
 *  full bar, so a total under 100 leaves the remainder visibly empty. `stacked-bar` (sc04) opens with a big number
 *  counting up (cue `count`) when its first on-screen line starts with one. `base-rate` (sc38) merges the first two segments under one label (the first on-screen
 *  line) on the `merge` cue, with the sum shown as its parts beneath; the third segment takes the third line. */
export const StackedBar: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const s0 = scene.sentences[0];
  const base = scene.kind === 'base-rate';
  const count = cue(scene, 'count', s0.start + 10);
  const [big, ...rest] = (scene.onScreenText[0] ?? '').split(/\s+/);
  const target = base || !/^[0-9]/.test(big) ? NaN : Number(big.replace(/[^0-9.]/g, ''));
  // options.colors: segment colours in point order, e.g. "slate,red,muted"; default red, slate, green.
  const colors = scene.options.colors
    ? String(scene.options.colors)
        .split(',')
        .map((c) => NAMED[c.trim()] ?? theme.muted)
    : COLORS;
  const shown = Number.isFinite(target) ? Math.round(target * easeOut((t - count) / 24)) : null;
  const fills = pointFrames(scene);
  const lines = lineFrames(scene);
  const merge = base ? ramp(t, cue(scene, 'merge', lines[0]), 14) : 0;
  const W = 1920 - 2 * GUTTER;
  const title = ramp(t, fills[0] - 10, 10);
  let x = 0;
  const note = (chart.note ?? '').split(/(?<=\.)\s/)[0];
  const top = base ? 380 : 500;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans, padding: `0 ${GUTTER}px` }}>
      {shown !== null ? (
        <div style={{ position: 'absolute', top: 120, left: GUTTER, opacity: ramp(t, count, 8) }}>
          <div
            style={{
              fontSize: 210,
              fontWeight: 700,
              lineHeight: 1,
              color: theme.fg,
              letterSpacing: -6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {shown}
          </div>
          <div style={{ fontSize: 38, color: theme.muted, marginTop: 8 }}>{rest.join(' ')}</div>
        </div>
      ) : null}
      <div style={{ position: 'absolute', top, left: GUTTER, width: W }}>
        <div style={{ fontSize: 36, color: theme.fg, marginBottom: 26, opacity: title }}>{chart.title}</div>
        <div
          style={{
            position: 'relative',
            height: 120,
            borderRadius: 10,
            background: theme.raised,
            border: `2px solid ${theme.line}`,
            overflow: 'hidden',
            opacity: title,
          }}
        >
          {chart.points.map((p, i) => {
            const full = (p.value / 100) * W;
            const w = full * ramp(t, fills[i], 20);
            const left = x;
            x += full;
            const merged = base && i < 2 ? merge : 0;
            const color = merged
              ? `rgb(${201 + (111 - 201) * merged * (i === 0 ? 0 : 1)}, ${71 + (143 - 71) * merged * (i === 0 ? 0 : 1)}, ${61 + (179 - 61) * merged * (i === 0 ? 0 : 1)})`
              : colors[i % colors.length];
            return (
              <div
                key={p.label}
                style={{
                  position: 'absolute',
                  left,
                  top: 0,
                  bottom: 0,
                  width: w,
                  background:
                    base && i === 1 ? `rgba(201,71,61,${0.6 + 0.4 * merge})` : base && i === 0 ? theme.red : color,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 58,
                    fontWeight: 700,
                    color: theme.bg,
                    opacity: ramp(t, fills[i] + 10, 8) * (base && i < 2 ? 1 - merge : 1),
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {p.display}
                </div>
              </div>
            );
          })}
          {base ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: ((chart.points[0].value + chart.points[1].value) / 100) * W,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 58,
                fontWeight: 700,
                color: theme.bg,
                opacity: merge,
                whiteSpace: 'nowrap',
              }}
            >
              {scene.onScreenText[0]}
            </div>
          ) : null}
        </div>
        <div style={{ position: 'relative', height: 120, marginTop: 18 }}>
          {chart.points.map((p, i) => {
            const left = (chart.points.slice(0, i).reduce((n, q) => n + q.value, 0) / 100) * W;
            if (base && i < 2)
              return i === 0 ? (
                <div
                  key={p.label}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    fontSize: 32,
                    color: theme.red,
                    opacity: merge,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 26, color: theme.muted }}>{scene.onScreenText[1]}</span>
                </div>
              ) : null;
            return (
              <div
                key={p.label}
                style={{
                  position: 'absolute',
                  left,
                  top: 0,
                  fontSize: 32,
                  color: colors[i % colors.length],
                  opacity: ramp(t, fills[i] + 8, 8),
                  whiteSpace: 'nowrap',
                  maxWidth: W - left,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ fontWeight: 700 }}>{p.display}</span> {base ? scene.onScreenText[2] : p.label}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 26, color: theme.muted, marginTop: 24, opacity: ramp(t, fills[0] + 20, 10) }}>
          {base ? note : `${note} Segments are drawn to the published percentages.`}
        </div>
      </div>
    </AbsoluteFill>
  );
};
