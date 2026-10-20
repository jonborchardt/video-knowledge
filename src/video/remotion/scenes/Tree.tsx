import type { FC } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cue, lastWord, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { Box, Coin } from '../glyphs';
import { GUTTER, ramp, theme } from '../theme';

const Arrow: FC<{ x1: number; y1: number; x2: number; y2: number; p: number; color: string; w?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  p,
  color,
  w = 5,
}) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x1 + (x2 - x1) * p;
  const hy = y1 + (y2 - y1) * p;
  const head = (d: number) => `${hx - 22 * Math.cos(a - d)},${hy - 22 * Math.sin(a - d)}`;
  return (
    <g opacity={p > 0 ? 1 : 0}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - p)}
      />
      <polygon points={`${hx},${hy} ${head(0.45)} ${head(-0.45)}`} fill={color} opacity={ramp(p, 0.6, 0.4)} />
    </g>
  );
};

const Node: FC<{ x: number; y: number; r: number; s: number; color: string; label?: string }> = ({
  x,
  y,
  r,
  s,
  color,
  label,
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r={r} fill={theme.raised} stroke={color} strokeWidth={r > 40 ? 5 : 3} />
    {label ? (
      <text textAnchor="middle" dominantBaseline="central" fill={theme.fg} fontSize={r * 0.55} fontWeight={600}>
        {label}
      </text>
    ) : (
      <>
        <circle r={r * 0.3} cy={-r * 0.15} fill={color} opacity={0.8} />
        <path d={`M ${-r * 0.56} ${r * 0.6} Q 0 ${-r * 0.08} ${r * 0.56} ${r * 0.6} Z`} fill={color} opacity={0.8} />
      </>
    )}
  </g>
);

/** The recruiting tree. `tree` (sc02): YOU, an arrow in from what you sell, a second tier whose arrows flow up on the
 *  `tier2` cue. `tree-coins` (sc09): three tiers with coins travelling up, caption in amber. `tree-customer` (sc26): a
 *  quote card, then the tree with one recruit labelled as the customer holding a product box. `tree-base`
 *  (sc27, sc39, sc42): many tiers, the base tinted red, the top node amber; labels from the on-screen lines. */
export const Tree: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const s = scene.sentences[0];
  const lines = lineFrames(scene);
  const pop = (at: number) => spring({ frame: t - at, fps, config: { damping: 14, stiffness: 120 } });

  if (scene.kind === 'tree') {
    const tier2 = scene.cues.tier2;
    const sell = cue(scene, 'sell', s.start + Math.round((tier2 - s.start) * 0.5));
    const [sellLabel, tierLabel] = scene.onScreenText;
    const below = [520, 813, 1107, 1400];
    return (
      <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
        <svg width={1920} height={1080}>
          <g opacity={ramp(t, scene.start, 10) * (1 - 0.7 * ramp(t, sell, 15))} transform="translate(700 120)">
            <rect width={520} height={110} rx={28} fill={theme.raised} stroke={theme.line} strokeWidth={2} />
            <rect x={34} y={30} width={300} height={14} rx={7} fill="rgba(236,233,226,.55)" filter="url(#blur)" />
            <rect x={34} y={64} width={420} height={14} rx={7} fill="rgba(236,233,226,.35)" filter="url(#blur)" />
          </g>
          <defs>
            <filter id="blur">
              <feGaussianBlur stdDeviation={4} />
            </filter>
          </defs>
          <Arrow x1={520} y1={400} x2={870} y2={400} p={ramp(t, sell, 9)} color={theme.amber} />
          <text x={695} y={366} textAnchor="middle" fill={theme.amber} fontSize={34} opacity={ramp(t, sell, 9)}>
            {sellLabel}
          </text>
          <Node x={960} y={400} r={74} s={pop(s.start + 6)} color={theme.amber} label="YOU" />
          {below.map((x, i) => {
            const at = tier2 + i * 9;
            return (
              <g key={x}>
                <Arrow
                  x1={x}
                  y1={780 - 62}
                  x2={960 + (x - 960) * 0.14}
                  y2={490}
                  p={ramp(t, at + 4, 9)}
                  color={theme.slate}
                />
                <Node x={x} y={780} r={54} s={pop(at)} color={theme.slate} />
              </g>
            );
          })}
          <text x={960} y={900} textAnchor="middle" fill={theme.slate} fontSize={34} opacity={ramp(t, tier2 + 12, 9)}>
            {tierLabel}
          </text>
        </svg>
      </AbsoluteFill>
    );
  }

  if (scene.kind === 'tree-coins') {
    const tiers = [[960], [640, 960, 1280], [480, 640, 800, 960, 1120, 1280, 1440]];
    const ys = [260, 520, 780];
    const loop = ((t - scene.start) % 60) / 60;
    return (
      <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
        <svg width={1920} height={1080}>
          {tiers.map((xs, k) =>
            xs.map((x, i) => {
              const parentX = k === 0 ? x : (tiers[k - 1][Math.floor(i / (k === 1 ? 1 : 2.34))] ?? 960);
              const at = scene.start + 6 + k * 12 + i * 2;
              return (
                <g key={`${k}-${i}`}>
                  {k > 0 ? (
                    <Arrow
                      x1={x}
                      y1={ys[k] - 50}
                      x2={parentX}
                      y2={ys[k - 1] + 50}
                      p={ramp(t, at, 10)}
                      color={theme.slate}
                      w={3}
                    />
                  ) : null}
                  {k > 0 ? (
                    <Coin
                      x={x + (parentX - x) * loop}
                      y={ys[k] - 50 + (ys[k - 1] + 50 - (ys[k] - 50)) * loop}
                      r={10}
                      opacity={ramp(t, at + 10, 10) * (1 - Math.abs(loop - 0.5) * 0.6)}
                    />
                  ) : null}
                  <Node
                    x={x}
                    y={ys[k]}
                    r={k === 0 ? 60 : k === 1 ? 46 : 36}
                    s={pop(at)}
                    color={k === 0 ? theme.amber : theme.slate}
                    label={k === 0 ? 'YOU' : undefined}
                  />
                </g>
              );
            }),
          )}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 930,
            textAlign: 'center',
            fontSize: 48,
            color: theme.amber,
            opacity: ramp(t, lines[0], 12),
          }}
        >
          {scene.onScreenText[0]}
        </div>
      </AbsoluteFill>
    );
  }

  if (scene.kind === 'tree-customer') {
    const [quote, caption] = scene.onScreenText;
    const turn = cue(scene, 'tree', scene.sentences[1]?.start ?? s.start + 90);
    const label = cue(scene, 'customer', lines[1] ?? turn + 30);
    const q = ramp(t, s.start + 4, 12) * (1 - ramp(t, turn, 14));
    const tr = ramp(t, turn, 14);
    const below = [640, 960, 1280];
    return (
      <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
        <div
          style={{
            position: 'absolute',
            left: GUTTER + 60,
            right: GUTTER + 60,
            top: 300,
            fontFamily: theme.serif,
            fontSize: 60,
            lineHeight: 1.35,
            color: theme.amber,
            opacity: q,
            transform: `translateY(${(1 - q) * 20}px)`,
          }}
        >
          {quote}
        </div>
        <svg width={1920} height={1080} style={{ opacity: tr }}>
          <Node x={960} y={330} r={64} s={pop(turn)} color={theme.amber} label="YOU" />
          {below.map((x, i) => (
            <g key={x}>
              <Arrow
                x1={x}
                y1={700 - 56}
                x2={960 + (x - 960) * 0.12}
                y2={400}
                p={ramp(t, turn + 10 + i * 6, 10)}
                color={theme.slate}
              />
              <Node x={x} y={700} r={50} s={pop(turn + 8 + i * 6)} color={i === 1 ? theme.amber : theme.slate} />
            </g>
          ))}
          <g opacity={ramp(t, label, 12)}>
            <Box x={1040} y={740} s={44} />
            <rect x={840} y={560} width={240} height={52} rx={26} fill={theme.amber} />
            <text x={960} y={595} textAnchor="middle" fill={theme.bg} fontSize={30} fontWeight={700}>
              customer
            </text>
            <Coin x={960 + (960 - 960) * 0} y={640 - 230 * ramp(t, label + 10, 20)} r={12} />
          </g>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 900,
            textAlign: 'center',
            fontSize: 44,
            color: theme.slate,
            opacity: ramp(t, label + 6, 12),
          }}
        >
          {caption}
        </div>
      </AbsoluteFill>
    );
  }

  // tree-base: tiers of 1, 3, 9, 27 (and a 60-wide base row), the base tinted red, the top amber.
  const widths = [1, 3, 9, 27, 60];
  const ys = [180, 340, 500, 660, 840];
  // options.baseLines: how many trailing on-screen lines label the base (default one when there are two or more).
  const baseCount = Number(scene.options.baseLines ?? (scene.onScreenText.length >= 2 ? 1 : 0));
  const topLine = baseCount < scene.onScreenText.length ? scene.onScreenText[0] : undefined;
  const baseLine = scene.onScreenText.slice(scene.onScreenText.length - baseCount).join('  ·  ');
  const topAt = cue(scene, 'top', (topLine !== undefined ? lines[0] : undefined) ?? s.start + 20);
  const baseAt = cue(scene, 'base', lines[scene.onScreenText.length - baseCount] ?? lastWord(scene) - 40);
  const pulse = 1 + 0.08 * Math.sin((t - scene.start) / 6);
  const flood = ramp(t, baseAt, 20);
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        <rect x={0} y={ys[3] - 40} width={1920} height={1080 - ys[3] + 40} fill={theme.red} opacity={0.14 * flood} />
        {widths.map((n, k) =>
          Array.from({ length: n }, (_, i) => {
            const spread = Math.min(1700, n * (k === 4 ? 28 : 62));
            const x = n === 1 ? 960 : 960 - spread / 2 + (i * spread) / (n - 1);
            const at = scene.start + 6 + k * 10 + (i * 8) / n;
            const r = k === 0 ? 34 : k === 1 ? 24 : k === 2 ? 16 : k === 3 ? 11 : 8;
            const color = k === 0 ? theme.amber : k >= 3 ? theme.red : theme.slate;
            const parentX =
              k === 0
                ? x
                : 960 -
                  Math.min(1700, widths[k - 1] * (k - 1 === 4 ? 28 : 62)) / 2 +
                  (Math.floor((i * widths[k - 1]) / n) * Math.min(1700, widths[k - 1] * 62)) /
                    Math.max(1, widths[k - 1] - 1);
            return (
              <g key={`${k}-${i}`}>
                {k > 0 && k < 4 ? (
                  <line
                    x1={x}
                    y1={ys[k] - r}
                    x2={widths[k - 1] === 1 ? 960 : parentX}
                    y2={ys[k - 1] + (k === 1 ? 34 : k === 2 ? 24 : 16)}
                    stroke={theme.line}
                    strokeWidth={2}
                    opacity={ramp(t, at, 8)}
                  />
                ) : null}
                <g
                  opacity={ramp(t, at, 8)}
                  transform={
                    k === 0 ? `translate(${x} ${ys[k]}) scale(${pulse}) translate(${-x} ${-ys[k]})` : undefined
                  }
                >
                  <circle
                    cx={x}
                    cy={ys[k]}
                    r={r}
                    fill={k >= 3 ? theme.red : theme.raised}
                    stroke={color}
                    strokeWidth={k === 0 ? 5 : 2}
                    opacity={k >= 3 ? 0.55 + 0.45 * flood : 1}
                  />
                </g>
              </g>
            );
          }),
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 150,
          fontSize: 40,
          color: theme.amber,
          opacity: ramp(t, topAt, 12),
        }}
      >
        {topLine}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 930,
          textAlign: 'center',
          fontSize: 44,
          color: theme.red,
          opacity: ramp(t, baseAt, 12),
        }}
      >
        {baseLine}
      </div>
    </AbsoluteFill>
  );
};
