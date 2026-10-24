import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames, spokenAt } from '../../cues';
import { SHORT_LAYOUT as L, type TimelineScene } from '../../types';
import { brand, clamp01, grow, ramp } from '../theme';

const W = L.width - L.gutter - L.right;

/** A Short's typography (brand/design.md 2.3: measured, deliberate): `short-title` sets one line in the display
 *  serif, word by word, over a gold rule; `short-question` types a question on its cue; `short-list` rules lines in
 *  one per cue or sentence; `short-quote` sets quoted lines in the italic serif with a gold mark. */
export const ShortText: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = scene.onScreenText;
  const frames = lineFrames(scene);
  const band = { position: 'absolute' as const, left: L.gutter, top: L.top, width: W, height: L.contentBottom - L.top };
  if (scene.kind === 'short-title') {
    const line = lines[0] ?? '';
    const size = line.length > 60 ? 60 : line.length > 36 ? 72 : 84;
    return (
      <AbsoluteFill>
        <div style={{ ...band, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: brand.serif, fontWeight: 700, fontSize: size, lineHeight: 1.18, color: brand.fg }}>
            {line.split(' ').map((w, k) => {
              const g = grow(t, scene.start + 6 + k * 3, 12);
              return (
                <span
                  key={k}
                  style={{
                    display: 'inline-block',
                    marginRight: '0.28em',
                    opacity: ramp(t, scene.start + 6 + k * 3, 8),
                    transform: `translateY(${(1 - g) * 18}px)`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
          <div
            style={{
              width: 180 * ramp(t, scene.start + 20, 16),
              height: 3,
              background: brand.gold,
              marginTop: 36,
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }
  if (scene.kind === 'short-question') {
    const line = lines[0] ?? '';
    const spoken = spokenAt(scene, line);
    const from = cue(scene, 'type', spoken?.frame ?? scene.sentences[0].start);
    const until = spoken?.end ?? from + 45;
    const shown = Math.round(line.length * clamp01((t - from) / Math.max(1, until - from)));
    const blink = Math.floor(t / 15) % 2 === 0;
    return (
      <AbsoluteFill>
        <div style={{ ...band, display: 'flex', alignItems: 'center' }}>
          <div
            style={{ fontFamily: brand.serif, fontSize: line.length > 50 ? 60 : 72, lineHeight: 1.25, color: brand.fg }}
          >
            {line.slice(0, shown)}
            <span style={{ color: brand.gold, opacity: blink ? 1 : 0.15 }}>|</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  if (scene.kind === 'short-quote') {
    return (
      <AbsoluteFill>
        <div style={{ ...band, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
          <div
            style={{
              fontFamily: brand.serif,
              fontSize: 140,
              lineHeight: 0.6,
              color: brand.gold,
              opacity: ramp(t, scene.start + 4, 10),
            }}
          >
            &ldquo;
          </div>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                fontFamily: brand.serif,
                fontStyle: 'italic',
                fontSize: l.length > 60 ? 44 : 54,
                lineHeight: 1.3,
                color: brand.fg,
                opacity: ramp(t, frames[i], 10),
                transform: `translateY(${(1 - ramp(t, frames[i], 12)) * 14}px)`,
              }}
            >
              {l.replace(/^["“]|["”]$/g, '')}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    );
  }
  // short-list
  const n = Math.max(1, lines.length);
  const size = n > 3 ? 44 : 52;
  return (
    <AbsoluteFill>
      <div style={{ ...band, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 }}>
        {lines.map((l, i) => {
          const a = ramp(t, frames[i], 10);
          const later = i < lines.length - 1 ? ramp(t, frames[i + 1], 10) : 0;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 26,
                opacity: a * (1 - 0.4 * later),
                transform: `translateX(${(1 - grow(t, frames[i], 12)) * -40}px)`,
              }}
            >
              <div style={{ width: 14, height: 14, background: brand.gold, marginTop: size * 0.45, flexShrink: 0 }} />
              <div style={{ fontFamily: brand.sans, fontSize: size, lineHeight: 1.25, color: brand.fg }}>{l}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
