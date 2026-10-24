import type { FC } from 'react';
import { AbsoluteFill, getInputProps, useCurrentFrame } from 'remotion';
import { SHORT_LAYOUT as L, type Timeline, type TimelineScene } from '../../types';
import { Mark } from '../Portrait';
import { brand, easeOut, ramp } from '../theme';

const W = L.width - L.gutter - L.right;

/** A Short's close (brand/design.md 2.6: a clear link to the long-form inquiry): the institution's seal and name, the
 *  full inquiry's question, the scene's own lines, and the call to action to tap the video linked below the player.
 *  `init` names this kind for every typography scene whose sentences are all in the `close` section. */
export const ShortEndCard: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const short = (getInputProps() as Timeline).short;
  const a = (from: number, len = 12) => ramp(t, scene.start + from, len);
  const bob = 10 * Math.sin((t - scene.start) / 9); // the chevron breathes
  const question = short?.question ?? '';
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: L.gutter,
          top: L.top,
          width: W,
          height: L.contentBottom - L.top,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 22,
        }}
      >
        <div style={{ opacity: a(0), transform: `scale(${0.9 + 0.1 * easeOut((t - scene.start) / 14)})` }}>
          {short ? <Mark short={short} size={200} /> : null}
        </div>
        <div style={{ opacity: a(6) }}>
          <div style={{ fontFamily: brand.mono, fontSize: 22, letterSpacing: 5, color: brand.gold }}>
            COMMONWEALTH OF REASON
          </div>
          <div style={{ fontFamily: brand.serif, fontSize: 40, color: brand.fg, marginTop: 8 }}>
            {short?.commission}
          </div>
        </div>
        <div style={{ width: 140 * a(12, 16), height: 2, background: brand.gold }} />
        <div style={{ opacity: a(16) }}>
          <div style={{ fontFamily: brand.mono, fontSize: 22, letterSpacing: 5, color: brand.gold, marginBottom: 14 }}>
            THE FULL INQUIRY
          </div>
          <div
            style={{
              fontFamily: brand.serif,
              fontSize: question.length > 70 ? 40 : 48,
              lineHeight: 1.25,
              color: brand.fg,
              maxWidth: W,
            }}
          >
            {question}
          </div>
        </div>
        {scene.onScreenText.slice(0, 2).map((l, i) => (
          <div key={i} style={{ fontFamily: brand.sans, fontSize: 32, color: brand.muted, opacity: a(24 + i * 8) }}>
            {l}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            opacity: a(30),
          }}
        >
          <div style={{ fontFamily: brand.sans, fontWeight: 600, fontSize: 38, color: brand.gold }}>
            Tap the video linked below
          </div>
          <svg width={48} height={34} viewBox="0 0 48 34" style={{ transform: `translateY(${bob}px)` }}>
            <path d="M4 6 L24 28 L44 6" fill="none" stroke={brand.gold} strokeWidth={4} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
