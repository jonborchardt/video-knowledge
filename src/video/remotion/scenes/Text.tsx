import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames, spokenAt } from '../../cues';
import type { TimelineScene } from '../../types';
import { DocStack, PeopleGrid, Snowball, Spreadsheet } from '../glyphs';
import { GUTTER, clamp01, grow, ramp, theme } from '../theme';

/** Typography scenes: `title` (one line, rule, optional subtitle), `question` (typed on, cursor), `list` (lines build
 *  on their cues or as spoken; `document` option draws a statement outline with callouts).
 *  Under the pulse brand a title pops in word by word in a gradient, and list lines slide in, each in its own accent,
 *  the newest bright and the earlier ones dimmed. */
export const Text: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = scene.onScreenText;
  const frames = lineFrames(scene);
  const o = scene.options;
  if (scene.kind === 'title') {
    const a = ramp(t, scene.start + 4, 14);
    return (
      <AbsoluteFill style={{ background: theme.field, justifyContent: 'center', padding: `0 ${GUTTER + 40}px` }}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 86,
            fontWeight: 600,
            lineHeight: 1.15,
            color: theme.fg,
            maxWidth: 1500,
            opacity: theme.motion ? 1 : a,
            transform: theme.motion ? undefined : `translateY(${(1 - a) * 20}px)`,
          }}
        >
          {theme.motion
            ? (lines[0] ?? '').split(' ').map((w, k) => {
                const g = grow(t, scene.start + 4 + k * 3, 10);
                return (
                  <span
                    key={k}
                    style={{
                      display: 'inline-block',
                      marginRight: '0.25em',
                      opacity: ramp(t, scene.start + 4 + k * 3, 6),
                      transform: `translateY(${(1 - g) * 40}px) scale(${0.85 + 0.15 * g})`,
                      backgroundImage: `linear-gradient(90deg, ${theme.fg}, ${theme.slate} 60%, ${theme.red})`,
                      backgroundSize: '1500px 100%',
                      backgroundPosition: `${-k * 140}px 0`,
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {w}
                  </span>
                );
              })
            : lines[0]}
        </div>
        <div
          style={{
            width: (theme.motion ? 420 : 160) * ramp(t, scene.start + 16, 14),
            height: theme.motion ? 8 : 4,
            borderRadius: 4,
            background: theme.motion
              ? `linear-gradient(90deg, ${theme.slate}, ${theme.violet}, ${theme.red})`
              : theme.slate,
            boxShadow: theme.motion ? `0 0 24px ${theme.violet}` : undefined,
            marginTop: 36,
          }}
        />
        {o.subtitle ? (
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 34,
              color: theme.slate,
              marginTop: 22,
              letterSpacing: 6,
              textTransform: 'uppercase',
              opacity: ramp(t, scene.start + 24, 12),
            }}
          >
            {String(o.subtitle)}
          </div>
        ) : null}
        {o.legend ? <Legend t={t} at={scene.start + 30} /> : null}
      </AbsoluteFill>
    );
  }
  if (scene.kind === 'question') {
    const line = lines[0] ?? '';
    const spoken = spokenAt(scene, line);
    const from = cue(scene, 'type', spoken?.frame ?? scene.sentences[0].start);
    const until = spoken?.end ?? from + 45;
    const shown = Math.round(line.length * clamp01((t - from) / Math.max(1, until - from)));
    const blink = Math.floor(t / 15) % 2 === 0;
    return (
      <AbsoluteFill style={{ background: theme.field, justifyContent: 'center', padding: `0 ${GUTTER + 40}px` }}>
        <div style={{ fontFamily: theme.serif, fontSize: 92, lineHeight: 1.2, color: theme.fg, maxWidth: 1500 }}>
          {line.slice(0, shown)}
          <span style={{ color: theme.amber, opacity: blink ? 1 : 0.15 }}>|</span>
        </div>
        {o.glyph === 'snowball' ? (
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <Snowball x={1500 - 500 * (1 - ramp(t, from, 40))} y={820} r={46} roll={-360 * ramp(t, from, 40)} />
          </svg>
        ) : null}
      </AbsoluteFill>
    );
  }
  // list
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      {o.legend ? <Legend t={t} at={scene.start} faint /> : null}
      {o.document ? <Outline t={t} at={scene.start + 6} /> : null}
      <div
        style={{
          position: 'absolute',
          left: GUTTER + 20,
          top: o.document ? 240 : 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 34,
          maxWidth: o.document ? 900 : 1500,
        }}
      >
        {lines.map((l, i) => {
          const a = ramp(t, frames[i], 10);
          const accent = theme.motion ? [theme.slate, theme.amber, theme.green, theme.red][i % 4] : theme.amber;
          const later = theme.motion && i < lines.length - 1 ? ramp(t, frames[i + 1], 10) : 0;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 26,
                opacity: a * (1 - 0.45 * later),
                transform: theme.motion
                  ? `translateX(${(1 - grow(t, frames[i], 12)) * -80}px)`
                  : `translateY(${(1 - a) * 16}px)`,
              }}
            >
              <div
                style={{
                  width: theme.motion ? 22 : 14,
                  height: 14,
                  borderRadius: 7,
                  background: accent,
                  boxShadow: theme.motion ? `0 0 18px ${accent}` : undefined,
                  flexShrink: 0,
                  position: 'relative',
                  top: -4,
                }}
              />
              <div style={{ fontSize: o.document ? 50 : 58, color: theme.fg, lineHeight: 1.25 }}>{l}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** The three evidence sources as small tiles, a legend beneath a title or faintly behind a list. */
const Legend: FC<{ t: number; at: number; faint?: boolean }> = ({ t, at, faint }) => (
  <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: faint ? 0.18 : 1 }}>
    {[DocStack, PeopleGrid, Spreadsheet].map((G, i) => (
      <g
        key={i}
        opacity={ramp(t, at + i * 8, 10)}
        transform={`translate(${faint ? 1500 : 560 + i * 400} ${faint ? 300 + i * 260 : 800})`}
      >
        <G x={0} y={0} scale={faint ? 1.6 : 1.1} />
      </g>
    ))}
  </svg>
);

/** A disclosure-statement outline (rows of blurred bars) to hang callouts on. */
const Outline: FC<{ t: number; at: number }> = ({ t, at }) => (
  <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
    <g opacity={ramp(t, at, 14)} transform="translate(1180 160)">
      <rect width={560} height={760} rx={10} fill={theme.raised} stroke={theme.line} strokeWidth={3} />
      <rect x={40} y={40} width={300} height={16} rx={8} fill={theme.muted} opacity={0.6} />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`translate(40 ${110 + i * 60})`}>
          <rect width={160} height={30} rx={4} fill={theme.line} />
          <rect x={200} width={110} height={30} rx={4} fill={theme.line} />
          <rect x={340} width={140} height={30} rx={4} fill={theme.line} />
        </g>
      ))}
    </g>
  </svg>
);
