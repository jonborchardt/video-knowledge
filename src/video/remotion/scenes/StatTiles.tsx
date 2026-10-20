import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import type { TimelineScene } from '../../types';
import { GUTTER, countUp, grow, ramp, theme } from '../theme';

/** sc13: one tile per chart point, revealed on its `point:<label>` cue; the tile at options.alert turns red. Under the
 *  pulse brand each tile springs up in its own accent, glowing, its figure counting up. */
export const StatTiles: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const chart = scene.chart!;
  const fills = pointFrames(scene, 40);
  const n = chart.points.length;
  const W = (1920 - 2 * GUTTER - (n - 1) * 36) / n;
  const alert = Number(scene.options.alert ?? -1);
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: 150,
          fontSize: 36,
          color: theme.muted,
          opacity: ramp(t, fills[0] - 10, 10),
        }}
      >
        {chart.title}
      </div>
      {chart.points.map((p, i) => {
        const a = ramp(t, fills[i], 14);
        const red = i === alert ? ramp(t, fills[i] + 14, 12) : 0;
        const accent = red ? theme.red : [theme.slate, theme.green, theme.amber, theme.violet][i % 4];
        const pop = grow(t, fills[i], 14);
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: GUTTER + i * (W + 36),
              top: 300,
              width: W,
              height: 420,
              borderRadius: 18,
              background: theme.motion ? `linear-gradient(160deg, ${accent}33, ${theme.raised} 60%)` : theme.raised,
              border: `3px solid ${theme.motion ? accent : red ? `rgba(201,71,61,${red})` : theme.line}`,
              boxShadow: theme.motion ? `0 0 40px ${accent}55` : undefined,
              opacity: a,
              transform: theme.motion ? `scale(${0.8 + 0.2 * pop})` : `translateY(${(1 - a) * 30}px)`,
              padding: 40,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 84,
                fontWeight: 700,
                color: theme.motion ? accent : red ? theme.red : theme.fg,
                textShadow: theme.motion ? `0 0 24px ${accent}88` : undefined,
                lineHeight: 1.05,
                letterSpacing: -1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {theme.motion ? countUp(p.display, p.value, ramp(t, fills[i], 24)) : p.display}
            </div>
            <div style={{ fontSize: 34, color: theme.muted, marginTop: 24, lineHeight: 1.3 }}>{p.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
