import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pointFrames } from '../../chart';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { GUTTER, ramp, theme } from '../theme';

const OUTCOME = [theme.red, theme.slate, theme.green];
const byLabel = (scene: TimelineScene, re: RegExp) => scene.chart!.points.find((p) => re.test(p.label));

/** Composite charts that reuse figures already shown, each panel labelled with its measure (the chart's note forbids one
 *  axis). `three-measures` (sc33): payouts tile, survey stacked bar, estimate tile. `closing` (sc41): survey ring,
 *  payouts tile, the three people. Text comes from the on-screen lines, numbers from the points. */
export const Composite: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = lineFrames(scene);
  const fills = pointFrames(scene, 20);
  const pts = scene.chart!.points;
  const survey = pts.filter((p) => /\(survey\)/.test(p.label) && !/5,000/.test(p.label)).slice(0, 3);
  const outcome =
    survey.length === 3 ? survey : pts.filter((p) => /^(lost money|broke even|made a profit)$/.test(p.label));
  const payout = byLabel(scene, /disclosures/);
  const under5k = byLabel(scene, /5,000/);
  const estimate = byLabel(scene, /Taylor/);
  const people = byLabel(scene, /100,000/);
  const title = (
    <div
      style={{
        position: 'absolute',
        left: GUTTER,
        top: 110,
        fontSize: 40,
        color: theme.fg,
        opacity: ramp(t, scene.start + 4, 10),
      }}
    >
      {scene.chart!.title}
    </div>
  );
  const panel = (i: number, head: string, body: React.ReactNode, at: number) => {
    const a = ramp(t, at, 14);
    const W = (1920 - 2 * GUTTER - 80) / 3;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: GUTTER + i * (W + 40),
          top: 240,
          width: W,
          height: 560,
          borderRadius: 18,
          background: theme.raised,
          border: `2px solid ${theme.line}`,
          padding: 36,
          boxSizing: 'border-box',
          opacity: a,
          transform: `translateY(${(1 - a) * 24}px)`,
        }}
      >
        <div style={{ fontSize: 28, color: theme.muted, letterSpacing: 2, textTransform: 'uppercase' }}>{head}</div>
        {body}
      </div>
    );
  };
  const heads = scene.onScreenText.map((l) => l.split(':')[0]);
  const tails = scene.onScreenText.map((l) => l.split(':').slice(1).join(':').trim());
  if (scene.kind === 'three-measures')
    return (
      <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
        {title}
        {panel(0, heads[0] ?? '', <Tile value={payout?.display ?? ''} note={tails[0]} />, lines[0])}
        {panel(
          1,
          heads[1] ?? '',
          <div>
            <StackedMini pts={outcome} t={t} at={lines[1]} />
            <div style={{ fontSize: 30, color: theme.muted, marginTop: 30, lineHeight: 1.3 }}>{tails[1]}</div>
            {under5k ? (
              <div
                style={{ fontSize: 30, color: theme.green, marginTop: 14 }}
              >{`${under5k.display} ${under5k.label.replace(/\s*\(survey\)/, '')}`}</div>
            ) : null}
          </div>,
          lines[1],
        )}
        {panel(2, heads[2] ?? '', <Tile value={estimate?.display ?? ''} note={tails[2]} color={theme.red} />, lines[2])}
      </AbsoluteFill>
    );
  // closing
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      {title}
      <svg width={1920} height={1080}>
        <Ring pts={outcome} cx={480} cy={500} t={t} fills={fills} />
      </svg>
      <div style={{ position: 'absolute', left: 820, top: 330, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {outcome.map((p, i) => (
          <div key={p.label} style={{ fontSize: 44, color: OUTCOME[i], opacity: ramp(t, fills[i] + 8, 10) }}>
            <span style={{ fontWeight: 700 }}>{p.display}</span>{' '}
            {scene.onScreenText[i]?.replace(/^[^\s]+\s/, '') ?? p.label}
          </div>
        ))}
      </div>
      {payout ? (
        <div
          style={{
            position: 'absolute',
            left: 1300,
            top: 330,
            width: 500,
            borderLeft: `5px solid ${theme.slate}`,
            paddingLeft: 30,
            opacity: ramp(t, lines[3] ?? fills[3], 12),
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: theme.fg, lineHeight: 1.05 }}>{payout.display}</div>
          <div style={{ fontSize: 30, color: theme.muted, marginTop: 12, lineHeight: 1.3 }}>
            {scene.onScreenText[3]?.replace(/^[^,]+,\s*/, '') ?? payout.label}
          </div>
        </div>
      ) : null}
      {people ? (
        <div
          style={{
            position: 'absolute',
            left: 820,
            top: 760,
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            opacity: ramp(t, fills[pts.indexOf(people)], 12),
          }}
        >
          <svg width={people.value * 44} height={44}>
            {Array.from({ length: people.value }, (_, k) => (
              <circle key={k} cx={22 + k * 44} cy={22} r={16} fill={theme.amber} />
            ))}
          </svg>
          <div style={{ fontSize: 34, color: theme.amber }}>
            <span style={{ fontWeight: 700 }}>{people.display}</span> {people.label}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Tile: FC<{ value: string; note?: string; color?: string }> = ({ value, note, color = theme.fg }) => (
  <div style={{ marginTop: 60 }}>
    <div style={{ fontSize: 86, fontWeight: 700, color, lineHeight: 1.05, letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 30, color: theme.muted, marginTop: 26, lineHeight: 1.3 }}>{note}</div>
  </div>
);

const StackedMini: FC<{ pts: { value: number; display: string }[]; t: number; at: number }> = ({ pts, t, at }) => {
  let x = 0;
  const W = 480;
  return (
    <div
      style={{
        position: 'relative',
        height: 90,
        marginTop: 60,
        borderRadius: 8,
        background: theme.bg,
        overflow: 'hidden',
      }}
    >
      {pts.map((p, i) => {
        const left = x;
        const w = (p.value / 100) * W;
        x += w;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top: 0,
              bottom: 0,
              width: w * ramp(t, at + i * 10, 14),
              background: OUTCOME[i],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
              color: theme.bg,
              overflow: 'hidden',
            }}
          >
            {p.display}
          </div>
        );
      })}
    </div>
  );
};

/** A donut of the outcome shares, each arc sweeping in on its cue; the gap left by rounding stays open. */
const Ring: FC<{ pts: { value: number; display: string }[]; cx: number; cy: number; t: number; fills: number[] }> = ({
  pts,
  cx,
  cy,
  t,
  fills,
}) => {
  const R = 190;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(-90)`}>
      <circle r={R} fill="none" stroke={theme.raised} strokeWidth={70} />
      {pts.map((p, i) => {
        const len = (p.value / 100) * C * ramp(t, fills[i], 20);
        const off = (acc / 100) * C;
        acc += p.value;
        return (
          <circle
            key={i}
            r={R}
            fill="none"
            stroke={OUTCOME[i]}
            strokeWidth={70}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-off}
          />
        );
      })}
    </g>
  );
};
