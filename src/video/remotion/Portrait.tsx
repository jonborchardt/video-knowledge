import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SHORT_LAYOUT as L, type Timeline, type TimelineScene } from '../types';
import { brand, ramp } from './theme';

/** The Short's field (brand/design.md 1.1, 2.3): Treasury Navy with a faint lift behind the content band and the
 *  formal inset rule, drawn once under every scene so cuts stay quiet. */
export const PortraitBackdrop: FC = () => (
  <AbsoluteFill style={{ background: brand.navy }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 900px 700px at 50% 38%, rgba(242,235,221,0.06), transparent 70%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 36,
        width: L.width - 72,
        height: L.citationBottom + 30 - 36,
        border: `1.5px solid ${brand.rule}`,
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    />
  </AbsoluteFill>
);

/** The Commonwealth seal, as the site's logo.svg draws it (the parent seal is OPEN in brand/design.md). */
export const Seal: FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Commonwealth of Reason">
    <circle cx="32" cy="32" r="31" fill={brand.navy} />
    <circle cx="32" cy="32" r="28.5" fill="none" stroke={brand.gold} strokeWidth="1.5" />
    <circle cx="32" cy="32" r="24.5" fill="none" stroke={brand.gold} strokeWidth="0.75" />
    <g fill="none" stroke={brand.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 18v24M24 42h16M18 26h28" />
      <path d="M18 26l-5 9h10zM46 26l-5 9h10z" />
    </g>
    <circle cx="32" cy="18" r="2.2" fill={brand.gold} />
  </svg>
);

/** The smallest institutional badge (brand/design.md 2.6): the seal, the publisher, the institution, a gold rule and
 *  the format eyebrow, in the band above the content. Static: it is the frame, not a scene. */
export const PortraitBadge: FC<{ short: NonNullable<Timeline['short']> }> = ({ short }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: L.gutter, top: 88, display: 'flex', alignItems: 'center', gap: 22 }}>
      <Seal size={72} />
      <div>
        <div style={{ fontFamily: brand.mono, fontSize: 21, letterSpacing: 4, color: brand.gold }}>
          COMMONWEALTH OF REASON
        </div>
        <div style={{ fontFamily: brand.serif, fontSize: 30, color: brand.fg, marginTop: 6, whiteSpace: 'nowrap' }}>
          {short.commission}
        </div>
      </div>
    </div>
    <div
      style={{
        position: 'absolute',
        left: L.gutter,
        top: 192,
        width: L.width - L.gutter - L.right,
        height: 1.5,
        background: brand.rule,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: L.gutter,
        top: 214,
        fontFamily: brand.mono,
        fontSize: 24,
        letterSpacing: 5,
        color: brand.gold,
        whiteSpace: 'nowrap',
      }}
    >
      {short.format}
    </div>
  </AbsoluteFill>
);

const CARD_WORDS = 6;
const MIN_BREAK = 3; // a card breaks early at punctuation only once it holds this many words
type Word = { text: string; frame: number; end: number };
/** Caption cards: a sentence's spoken words in groups of at most six, breaking early after a comma, colon or full
 *  stop once a card holds three words; a token the provider split at a hyphen ("oil-" + "heated") is rejoined. Each
 *  card is shown from its first word's frame until the next card's, the spoken word in gold. */
export function captionCards(scene: TimelineScene): { words: Word[] }[] {
  const cards: { words: Word[] }[] = [];
  for (const s of scene.sentences) {
    const ws: Word[] = [];
    for (const w of s.words) {
      const prev = ws.at(-1);
      if (prev && /-$/.test(prev.text)) ws[ws.length - 1] = { text: prev.text + w.text, frame: prev.frame, end: w.end };
      else ws.push({ text: w.text, frame: w.frame, end: w.end });
    }
    let card: Word[] = [];
    for (const w of ws) {
      card.push(w);
      if (card.length >= CARD_WORDS || (card.length >= MIN_BREAK && /[.,;:?!]$/.test(w.text))) {
        cards.push({ words: card });
        card = [];
      }
    }
    if (card.length) cards.push({ words: card });
  }
  return cards;
}

/** Burned-in captions in the caption band: Shorts are watched muted, so the words are drawn from the measured timings
 *  and the spoken word is marked. Inside the fit-checked root, so a card that reaches the citation fails the render. */
export const Captions: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const cards = captionCards(scene);
  const i = cards.findLastIndex((c) => c.words[0].frame <= t);
  if (i < 0) return null;
  const card = cards[i];
  const until = cards[i + 1]?.words[0].frame ?? card.words.at(-1)!.end + 20;
  if (t >= until) return null;
  const a = ramp(t, card.words[0].frame, 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: L.gutter,
        top: L.captionTop,
        width: L.width - L.gutter - L.right,
        height: L.captionBottom - L.captionTop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: brand.sans,
        fontWeight: 600,
        fontSize: 42,
        lineHeight: 1.15,
        color: brand.fg,
        opacity: a,
      }}
    >
      <div style={{ maxWidth: '100%' }}>
        {card.words.map((w, k) => (
          <span key={k} style={{ color: t >= w.frame && t < w.end + 3 ? brand.gold : brand.fg, marginRight: 12 }}>
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
};
