import type { FC } from 'react';
import { AbsoluteFill, interpolateColors, useCurrentFrame } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { alignLine } from '../../words';
import { Citation } from '../Citation';
import { GUTTER, alpha, ramp, theme } from '../theme';

const strip = (s: string) => s.replace(/^["“”]+|["“”]+$/g, '');

/** Quoted lines, one card at a time. The card and its attribution slide in when the sentence that carries the quote
 *  begins; the words appear as they are spoken (aligned to the boundaries of whichever sentence carries them); the
 *  `emphasis` cue's word turns glow. With one citation per line, the attribution follows the line. */
export const Quote: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const emphasis = scene.cues.emphasis;
  const lines = scene.onScreenText.map((raw, i) => {
    const line = strip(raw);
    let aligned: { frame: number; end: number }[] | null = null;
    let carrier = scene.sentences[Math.min(i, scene.sentences.length - 1)];
    for (const s of scene.sentences)
      if (!aligned) {
        aligned = alignLine(line, s.words);
        if (aligned) carrier = s;
      }
    const fallback = cue(scene, `line:${i + 1}`, carrier.start + (i ? 0 : 6));
    const words = line.split(/\s+/).filter(Boolean);
    const at = words.map((_, k) => aligned?.[k]?.frame ?? fallback + k * 2);
    return { words, at, start: at[0], end: aligned?.at(-1)?.end ?? at[at.length - 1] + 20, carrier };
  });
  // A card opens when its carrier sentence starts (or the previous card's words are done), before the words; its whole
  // quote shows dim from then, so the card is never empty while the narration leads in.
  const intro = lines.map((l, i) =>
    i === 0 ? scene.start : Math.max(lines[i - 1].end + 6, Math.min(l.carrier.start, l.start - 30)),
  );
  const active = Math.max(
    0,
    intro.findLastIndex((f) => t >= f),
  );
  const perLine = scene.citations.length === lines.length && lines.length > 1;
  const size = lines.length > 1 ? 62 : 68;
  return (
    <AbsoluteFill>
      {lines.map((l, i) => {
        const next = intro[i + 1] ?? Infinity;
        const inA = ramp(t, intro[i], 12);
        const out = 1 - ramp(t, next - 8, 8);
        if (t < intro[i] - 1 || out <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: GUTTER,
              right: GUTTER,
              top: 250,
              bottom: 220,
              borderRadius: 24,
              background: theme.raised,
              border: `2px solid ${theme.line}`,
              opacity: inA * out,
              transform: `translateY(${(1 - inA) * 40 - (1 - out) * 30}px)`,
              padding: '70px 90px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 150,
                color: theme.glow,
                lineHeight: 0.6,
                opacity: 0.6,
                height: 70,
              }}
            >
              &ldquo;
            </div>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: size,
                lineHeight: 1.35,
                color: theme.fg,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0 0.3em',
                maxWidth: 1500,
              }}
            >
              {l.words.map((w, k) => {
                // the whole quote sits dim from the card's open and brightens word by word as it is spoken
                const o = 0.2 + 0.8 * ramp(t, l.at[k], 6);
                const hot = emphasis !== undefined && l.at[k] === emphasis;
                const e = hot ? ramp(t, emphasis, 8) : 0;
                return (
                  <span
                    key={k}
                    style={{
                      opacity: o,
                      transform: `scale(${1 + 0.06 * e})`,
                      color: hot ? interpolateColors(e, [0, 1], [theme.fg, theme.glow]) : theme.fg,
                      fontWeight: hot ? 700 : 400,
                      borderBottom: hot ? `4px solid ${alpha(theme.glow, e)}` : 'none',
                      display: 'inline-block',
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      {perLine ? (
        <Citation scene={{ ...scene, citations: [scene.citations[active]] }} frame={t - intro[active] + scene.start} />
      ) : null}
    </AbsoluteFill>
  );
};
