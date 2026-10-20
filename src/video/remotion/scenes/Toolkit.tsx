import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames, spokenAt } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { clamp01, grow, ramp, theme } from '../theme';

const N = 5;
const W = 290; // card
const GAP = 42;
const X0 = (1920 - (N * W + (N - 1) * GAP)) / 2;
const TOP = 230; // cards' top; the heading sits above
const FLIP = 14; // frames for a card to turn over
const STRIKE = 10; // frames for the strike to draw

/** Line icons, one per card in on-screen order: raised hand, pen at a signature line, fringed flag, scroll, contract
 *  page. Drawn in a 120 x 120 box. */
const ICONS: ReactNode[] = [
  <g key="hand">
    {[30, 44, 58, 72].map((x, i) => {
      const top = [30, 18, 16, 26][i];
      return <path key={x} d={`M ${x} 66 V ${top + 6.5} A 6.5 6.5 0 0 1 ${x + 13} ${top + 6.5} V 66`} />;
    })}
    <path d="M 30 66 V 90 Q 30 112 54 112 H 62 Q 85 112 85 90 V 66" />
    <path d="M 30 90 L 16 72 Q 12 64 20 62 L 30 72" />
  </g>,
  <g key="pen">
    <line x1={12} y1={100} x2={108} y2={100} />
    <path d="M 16 88 q 10 -18 20 0 t 20 0 t 16 -6" />
    <g transform="rotate(40 82 50)">
      <rect x={76} y={8} width={14} height={66} rx={3} />
      <path d="M 76 74 L 83 92 L 90 74" />
    </g>
  </g>,
  <g key="flag">
    <line x1={18} y1={8} x2={18} y2={114} />
    <rect x={18} y={16} width={78} height={52} />
    {[24, 34, 44, 54, 64, 74, 84, 94].map((x) => (
      <line key={x} x1={x} y1={68} x2={x} y2={80} />
    ))}
    {[22, 32, 42, 52, 62].map((y) => (
      <line key={y} x1={96} y1={y} x2={106} y2={y} />
    ))}
  </g>,
  <g key="scroll">
    <rect x={30} y={22} width={60} height={76} />
    <ellipse cx={60} cy={18} rx={36} ry={8} />
    <ellipse cx={60} cy={102} rx={36} ry={8} />
    {[40, 52, 64, 76].map((y) => (
      <line key={y} x1={40} y1={y} x2={80} y2={y} />
    ))}
  </g>,
  <g key="contract">
    <path d="M 26 8 H 76 L 96 28 V 112 H 26 Z" />
    <path d="M 76 8 V 28 H 96" />
    {[42, 54, 66, 78].map((y) => (
      <line key={y} x1={38} y1={y} x2={84} y2={y} />
    ))}
    <path d="M 38 100 l 8 -8 m -8 0 l 8 8" />
    <line x1={52} y1={100} x2={84} y2={100} />
  </g>,
];

/** The movement's toolkit as a row of five cards under the line "A court needs your consent", in three states, one
 *  per kind. `sc-toolkit-down`: the five empty places are laid from the first frame, the line writes on as it is
 *  spoken (`lineFrames`), then five blank cards, face down, spring up into their places on the `deal` cue.
 *  `sc-toolkit-flip`: the row is face down and each card turns over on its
 *  `card:<n>` cue (n is the card's place in onScreenText) to show its icon and label in amber, the pitch's colour.
 *  `sc-toolkit-strike`: the row is face up and each card is struck through in red and dims on its `strike:<n>` cue, in
 *  whatever order the narration names them. Cues missing fall back to an even spread over the sentence. The heading is
 *  drawn only when it is the scene's on-screen text (the face-down state); the cards keep one place in all three, and
 *  end above the citations. Under pulse the cards bob, glow as they land and flip, and the strike glows. */
export const Toolkit: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const kind = String(scene.kind);
  const down = kind === 'sc-toolkit-down';
  const strike = kind === 'sc-toolkit-strike';
  const labels = down ? [] : scene.onScreenText;
  const s0 = scene.sentences[0];
  const spread = (i: number) => (s0 ? s0.start + Math.round(((i + 1) / (N + 1)) * s0.duration) : scene.start + 30 * i);
  const H = Math.min(360, citationTop(scene) - TOP);
  const motion = theme.motion;

  // the heading, written on as it is spoken
  const heading = down ? (scene.onScreenText[0] ?? '') : '';
  const hFrom = heading ? lineFrames(scene)[0] : 0;
  const hEnd = heading ? (spokenAt(scene, heading)?.end ?? hFrom + 40) : 0;
  const shown = Math.round(heading.length * clamp01((t - hFrom) / Math.max(10, hEnd - hFrom)));
  const deal = cue(scene, 'deal', hEnd + 10);

  return (
    <AbsoluteFill style={{ background: theme.field, overflow: 'hidden' }}>
      {heading ? (
        <div
          style={{
            position: 'absolute',
            top: 92,
            left: 0,
            width: 1920,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 68,
            color: theme.fg,
            whiteSpace: 'pre',
          }}
        >
          {heading.slice(0, shown)}
          <span style={{ opacity: 0 }}>{heading.slice(shown)}</span>
        </div>
      ) : null}
      {Array.from({ length: N }, (_, i) => {
        // slide in (face-down state only)
        const g = down ? grow(t, deal + i * 4, 16) : 1;
        const lift = (1 - g) * 520;
        // flip: 0 face down, 1 face up
        const flipAt = cue(scene, `card:${i + 1}`, spread(i));
        const f = down ? 0 : strike ? 1 : ramp(t, flipAt, FLIP);
        const faceUp = f >= 0.5;
        const sx = Math.abs(Math.cos(Math.PI * f));
        // strike
        const strikeAt = cue(scene, `strike:${i + 1}`, spread(i));
        const k = strike ? ramp(t, strikeAt, STRIKE) : 0;
        const dim = strike ? ramp(t, strikeAt + STRIKE, 12) : 0;
        // pulse: a slow bob, a glow when it lands or turns
        const bob = motion ? 6 * Math.sin(t / 24 + i * 1.3) : 0;
        const flash = motion ? clamp01(1 - Math.abs(t - (down ? deal + i * 4 + 10 : flipAt + FLIP / 2)) / 14) : 0;
        const ink = faceUp ? theme.amber : theme.line;
        // face-down state: the card's empty place is laid from the first frame, so the field is never blank before
        // the deal; it fades as the card lands in it
        const slot = down ? (
          <div
            key={`slot${i}`}
            style={{
              position: 'absolute',
              left: X0 + i * (W + GAP),
              top: TOP,
              width: W,
              height: H,
              borderRadius: 18,
              background: theme.raised,
              border: `3px dashed ${theme.line}`,
              opacity: 1 - g,
            }}
          />
        ) : null;
        return [
          slot,
          <div
            key={i}
            style={{
              position: 'absolute',
              left: X0 + i * (W + GAP),
              top: TOP + lift + bob,
              width: W,
              height: H,
              opacity: down ? clamp01(g * 1.5) : 1,
              transform: `scaleX(${Math.max(0.02, sx)})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 18,
                background: theme.raised,
                border: `3px solid ${faceUp ? theme.amber : theme.muted}`,
                boxShadow: flash ? `0 0 ${40 * flash}px ${faceUp ? theme.amber : theme.violet}` : 'none',
                opacity: 1 - 0.6 * dim,
              }}
            >
              {faceUp ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '42px 22px 0',
                    gap: 30,
                  }}
                >
                  <svg
                    width={130}
                    height={130}
                    viewBox="0 0 120 120"
                    fill="none"
                    stroke={theme.amber}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {ICONS[i]}
                  </svg>
                  <div
                    style={{
                      fontFamily: theme.sans,
                      fontWeight: 600,
                      fontSize: 36,
                      lineHeight: 1.2,
                      color: theme.fg,
                      textAlign: 'center',
                    }}
                  >
                    {labels[i] ?? ''}
                  </div>
                </div>
              ) : (
                <div style={{ position: 'absolute', inset: 18, borderRadius: 10, border: `2px solid ${ink}` }} />
              )}
            </div>
            {k > 0 ? (
              <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                <line
                  x1={16}
                  y1={H * 0.78}
                  x2={16 + (W - 32) * k}
                  y2={H * 0.78 - H * 0.56 * k}
                  stroke={theme.red}
                  strokeWidth={10}
                  strokeLinecap="round"
                  style={motion ? { filter: `drop-shadow(0 0 10px ${theme.red})` } : undefined}
                />
              </svg>
            ) : null}
          </div>,
        ];
      })}
    </AbsoluteFill>
  );
};
