import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { HEIGHT, SHORT_LAYOUT, WIDTH, type TimelineScene } from '../types';
import { GUTTER, brand, ramp, theme } from './theme';

const BOTTOM = 56;
const ROW = 72; // label 30px x 1.2 + detail 23px x 1.3 + 6px gap
const MAX = WIDTH - 2 * GUTTER - 23; // the frame between the gutters, less the bar and its gap
// portrait (a Short): the block ends above YouTube's overlay, label 34px sans, detail 24px mono
const ROW_P = 76;
const MAX_P = SHORT_LAYOUT.width - SHORT_LAYOUT.gutter - SHORT_LAYOUT.right - 23;
const isPortrait = (frame?: { width: number; height: number }) => !!frame && frame.height > frame.width;
/** A phone has no room for the file name beside the document's name: keep the name and the lines. */
const shortDetail = (detail: string) => detail.replace(/ \(([^()]*\.txt), lines ([^)]*)\)$/, ', lines $2');
// ponytail: width estimated at 0.5em a character (Segoe UI averages under that); measure when a font runs wider.
/** One unwrapped line that fits MAX: the font shrinks for a long line (never below `min`, never taller than ROW
 *  allows), and an ellipsis clips whatever still does not fit. */
const fit = (text: string, size: number, min: number) => ({
  fontSize: Math.max(min, Math.min(size, MAX / (text.length * 0.5))),
  maxWidth: MAX,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

/** Where the citation block starts (y, in frame pixels): what a scene draws must end above it. In a portrait frame
 *  (a Short) the block ends above YouTube's overlay, at SHORT_LAYOUT.citationBottom. */
export const citationTop = (scene: TimelineScene, gap = 28, frame?: { width: number; height: number }) => {
  const n = scene.citations.length;
  if (isPortrait(frame)) return n ? SHORT_LAYOUT.citationBottom - ROW_P * n - gap : SHORT_LAYOUT.citationBottom;
  return n ? HEIGHT - BOTTOM - ROW * n - gap : HEIGHT - BOTTOM;
};

/** On-screen source: the storyboard label large enough to read at YouTube sizes, the document or channel beneath.
 *  Portrait draws the brand's citation (gold rule, sans label, mono detail) inside the Short's layout. */
export const Citation: FC<{ scene: TimelineScene; frame: number }> = ({ scene, frame }) => {
  const { width, height } = useVideoConfig();
  if (!scene.citations.length) return null;
  const o = ramp(frame, scene.start + 12, 10);
  if (height > width) {
    const fitP = (text: string, size: number, min: number) => ({
      fontSize: Math.max(min, Math.min(size, MAX_P / (text.length * 0.55))),
      maxWidth: MAX_P,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    return (
      <div
        data-citation
        style={{
          position: 'absolute',
          left: SHORT_LAYOUT.gutter,
          bottom: SHORT_LAYOUT.height - SHORT_LAYOUT.citationBottom,
          display: 'flex',
          gap: 18,
          opacity: o,
          transform: `translateY(${(1 - o) * 10}px)`,
        }}
      >
        <div style={{ width: 3, background: brand.gold, borderRadius: 2 }} />
        <div>
          {scene.citations.map((c) => (
            <div key={c.label} style={{ marginBottom: 6, whiteSpace: 'nowrap' }}>
              <div style={{ ...fitP(c.label, 34, 26), fontFamily: brand.sans, color: brand.fg, lineHeight: 1.2 }}>
                {c.label}
              </div>
              <div
                style={{
                  ...fitP(shortDetail(c.detail), 24, 18),
                  fontFamily: brand.mono,
                  color: brand.muted,
                  lineHeight: 1.3,
                }}
              >
                {shortDetail(c.detail)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
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
