import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { TimelineScene } from '../../types';
import { alignLine } from '../../words';
import { GUTTER, ramp, theme } from '../theme';

/** sc03: the quoted words appear as they are spoken (aligned to the word boundaries); the `emphasis` cue's word turns
 *  amber and holds. Falls back to one fade when the line is not a run of the narration. */
export const Quote: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const s = scene.sentences[0];
  // The big quote glyph carries the quotation marks; the line's own straight quotes are stripped for display only.
  const line = (scene.onScreenText[0] ?? '').replace(/^["“”]+|["“”]+$/g, '');
  const aligned = alignLine(line, s.words);
  const words = line.split(/\s+/).filter(Boolean);
  const emphasis = scene.cues.emphasis;
  return (
    <AbsoluteFill style={{ background: theme.bg, padding: `0 ${GUTTER + 60}px`, justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 150,
          color: theme.amber,
          lineHeight: 0.6,
          opacity: 0.6 * ramp(t, scene.start, 12),
        }}
      >
        &ldquo;
      </div>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 68,
          lineHeight: 1.35,
          color: theme.fg,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0 0.3em',
          maxWidth: 1500,
        }}
      >
        {words.map((w, i) => {
          const at = aligned ? aligned[i].frame : s.start + i * 2;
          const o = ramp(t, at, 6);
          const hot = emphasis !== undefined && aligned?.[i].frame === emphasis;
          const e = hot ? ramp(t, emphasis, 8) : 0;
          return (
            <span
              key={i}
              style={{
                opacity: o,
                transform: `translateY(${(1 - o) * 14}px) scale(${1 + 0.06 * e})`,
                color: hot
                  ? `rgb(${236 + (227 - 236) * e}, ${233 + (163 - 233) * e}, ${226 + (58 - 226) * e})`
                  : theme.fg,
                fontWeight: hot ? 700 : 400,
                borderBottom: hot ? `4px solid rgba(227,163,58,${e})` : 'none',
                display: 'inline-block',
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
