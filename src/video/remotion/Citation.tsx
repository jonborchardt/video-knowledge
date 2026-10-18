import type { FC } from 'react';
import type { TimelineScene } from '../types';
import { GUTTER, ramp, theme } from './theme';

/** On-screen source: the storyboard label large enough to read at YouTube sizes, the document or channel beneath. */
export const Citation: FC<{ scene: TimelineScene; frame: number }> = ({ scene, frame }) => {
  if (!scene.citations.length) return null;
  const o = ramp(frame, scene.start + 12, 10);
  return (
    <div
      style={{
        position: 'absolute',
        left: GUTTER,
        bottom: 56,
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
          <div key={c.label} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 30, color: theme.fg, lineHeight: 1.2 }}>{c.label}</div>
            <div style={{ fontSize: 23, color: theme.muted, lineHeight: 1.3 }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
