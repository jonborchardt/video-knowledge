import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { DocStack, PeopleGrid, Spreadsheet } from '../glyphs';
import { GUTTER, ramp, theme } from '../theme';

const GLYPHS = [DocStack, PeopleGrid, Spreadsheet];

/** sc07: three source cards slide in as each is named; the text is the storyboard's on-screen lines. */
export const EvidenceCards: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const frames = lineFrames(scene);
  const W = (1920 - 2 * GUTTER - 2 * 40) / 3;
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      {scene.onScreenText.map((line, i) => {
        const a = ramp(t, frames[i], 14);
        const G = GLYPHS[i % GLYPHS.length];
        const [head, ...tail] = line.split(/,\s*/);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: GUTTER + i * (W + 40),
              top: 300,
              width: W,
              height: 440,
              borderRadius: 18,
              background: theme.raised,
              border: `2px solid ${theme.line}`,
              opacity: a,
              transform: `translateX(${(1 - a) * -40}px)`,
              padding: 36,
              boxSizing: 'border-box',
            }}
          >
            <svg width={W - 72} height={150}>
              <G x={(W - 72) / 2} y={75} scale={1.2} color={i === 2 ? theme.amber : theme.slate} />
            </svg>
            <div style={{ fontSize: 40, color: theme.fg, marginTop: 30, lineHeight: 1.2 }}>{head}</div>
            <div style={{ fontSize: 30, color: theme.muted, marginTop: 14, lineHeight: 1.3 }}>{tail.join(', ')}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
