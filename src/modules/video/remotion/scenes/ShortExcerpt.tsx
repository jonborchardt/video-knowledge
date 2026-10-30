import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, spokenAt } from '../../cues';
import { excerptWindow } from '../../excerpt';
import { SHORT_LAYOUT as L, type TimelineScene } from '../../types';
import { alpha, ramp, theme } from '../theme';

const W = L.width - L.gutter - L.right;

/** The cited passage as a paper exhibit (brand/design.md 2.2): the document and lines in mono above, the window
 *  around the highlight in the serif, the highlight underlined in gold on its cue or as it is spoken. The card is
 *  clipped to the content band, so a long passage never reaches the captions. */
export const ShortExcerpt: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const ex = scene.excerpt;
  if (!ex) return null;
  const win = excerptWindow(ex.text, ex.highlight, 28);
  const spoken = ex.highlight ? spokenAt(scene, ex.highlight) : null;
  const hl = ramp(t, cue(scene, 'highlight', spoken?.frame ?? scene.sentences[0].start + 30), 14);
  const page = ramp(t, scene.start, 14);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: L.gutter,
          top: L.top,
          width: W,
          height: L.contentBottom - L.top,
          background: theme.paper,
          color: theme.text,
          boxShadow: `0 30px 80px ${alpha(theme.text, 0.45)}`,
          opacity: page,
          transform: `translateY(${(1 - page) * 24}px)`,
          padding: '44px 48px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.ink,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 28,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {ex.doc} &middot; lines {ex.lines}
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 32, lineHeight: 1.5 }}>
          {win.before}{' '}
          {win.match ? (
            <span
              style={{
                background: alpha(theme.accent, 0.35 * hl),
                borderBottom: `4px solid ${alpha(theme.accent, hl)}`,
                fontWeight: 700,
              }}
            >
              {win.match}
            </span>
          ) : null}{' '}
          {win.after}
        </div>
      </div>
    </AbsoluteFill>
  );
};
