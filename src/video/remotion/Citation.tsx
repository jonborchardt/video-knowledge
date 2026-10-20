import type { FC } from 'react';
import { HEIGHT, WIDTH, type TimelineScene } from '../types';
import { GUTTER, ramp, theme } from './theme';

const BOTTOM = 56;
const ROW = 72; // label 30px x 1.2 + detail 23px x 1.3 + 6px gap
const MAX = WIDTH - 2 * GUTTER - 23; // the frame between the gutters, less the bar and its gap
// ponytail: width estimated at 0.5em a character (Segoe UI averages under that); measure when a font runs wider.
/** One unwrapped line that fits MAX: the font shrinks for a long line (never below `min`, never taller than ROW
 *  allows), and an ellipsis clips whatever still does not fit. */
const fit = (text: string, size: number, min: number) => ({
  fontSize: Math.max(min, Math.min(size, MAX / (text.length * 0.5))),
  maxWidth: MAX,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

/** Where the citation block starts (y, in frame pixels): what a scene draws must end above it. */
export const citationTop = (scene: TimelineScene, gap = 28) =>
  scene.citations.length ? HEIGHT - BOTTOM - ROW * scene.citations.length - gap : HEIGHT - BOTTOM;

/** On-screen source: the storyboard label large enough to read at YouTube sizes, the document or channel beneath. */
export const Citation: FC<{ scene: TimelineScene; frame: number }> = ({ scene, frame }) => {
  if (!scene.citations.length) return null;
  const o = ramp(frame, scene.start + 12, 10);
  return (
    <div
      data-citation
      style={{
        position: 'absolute',
        left: GUTTER,
        bottom: BOTTOM,
        display: 'flex',
        gap: 18,
        opacity: o,
        transform: `translateY(${(1 - o) * 10}px)`,
        fontFamily: theme.sans,
      }}
    >
      <div style={{ width: 5, background: theme.slate, borderRadius: 3 }} />
      <div>
        {scene.citations.map((c) => (
          <div key={c.label} style={{ marginBottom: 6, whiteSpace: 'nowrap' }}>
            <div style={{ ...fit(c.label, 30, 24), color: theme.fg, lineHeight: 1.2 }}>{c.label}</div>
            <div style={{ ...fit(c.detail, 23, 17), color: theme.muted, lineHeight: 1.3 }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
