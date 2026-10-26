import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { SHORT_LAYOUT as L, type TimelineScene } from '../../types';
import { countUp, grow, ramp, theme } from '../theme';

const W = L.width - L.gutter - L.right;
const GAP = 24;

/** One ledger tile per chart point, stacked down the content band and revealed on its `point:<label>` cue: the figure
 *  in tabular sans counting up beside a gold rule, the label beneath (brand/design.md 2.2 exhibit card). At most four
 *  points fit; `options.alert` names the point drawn in the loss colour. */
export const ShortStatTiles: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const pts = chart.points.slice(0, 4);
  const fills = pointFrames(scene, 40);
  const titleH = chart.title ? 70 : 0;
  const band = L.contentBottom - L.top;
  // tiles share the band, never taller than a phone screen's third; the block sits centred in the band
  const H = Math.min(480, (band - titleH - GAP * (pts.length - 1)) / pts.length);
  const top0 = L.top + (band - (titleH + pts.length * H + GAP * (pts.length - 1))) / 2;
  const alert = Number(scene.options.alert ?? -1);
  const figure = Math.min(112, H * 0.5);
  return (
    <AbsoluteFill>
      {chart.title ? (
        <div
          style={{
            position: 'absolute',
            left: L.gutter,
            top: top0,
            width: W,
            fontFamily: theme.sans,
            fontSize: 32,
            color: theme.muted,
            opacity: ramp(t, fills[0] - 12, 10),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {chart.title}
        </div>
      ) : null}
      {pts.map((p, i) => {
        const a = ramp(t, fills[i], 12);
        const pop = grow(t, fills[i], 14);
        const accent = i === alert ? theme.loss : theme.accent;
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: L.gutter,
              top: top0 + titleH + i * (H + GAP),
              width: W,
              height: H,
              boxSizing: 'border-box',
              borderLeft: `4px solid ${accent}`,
              background: theme.raised,
              padding: `0 32px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              opacity: a,
              transform: `translateY(${(1 - pop) * 16}px)`,
            }}
          >
            <div
              style={{
                fontFamily: theme.sans,
                fontWeight: 600,
                fontSize: figure,
                lineHeight: 1.05,
                color: i === alert ? theme.loss : theme.fg,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {countUp(p.display, p.value, ramp(t, fills[i], 24))}
            </div>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: Math.min(34, H * 0.16),
                color: theme.muted,
                marginTop: 14,
                lineHeight: 1.25,
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
