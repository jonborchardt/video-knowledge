import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lastWord } from '../../cues';
import type { TimelineScene } from '../../types';
import { ramp, theme } from '../theme';

/** sc11: a split field, amber left and slate right (labels from options.left / options.right), wiping to the field from
 *  the centre on the `wipe` cue. */
export const Transition: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const wipe = ramp(t, cue(scene, 'wipe', lastWord(scene) - 10), 16);
  const a = ramp(t, scene.start, 10);
  const half = 960 * (1 - wipe);
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: half,
          background: '#3a2b12',
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', right: 80, top: 480, fontSize: 80, color: theme.amber, whiteSpace: 'nowrap' }}
        >
          {String(scene.options.left ?? '')}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: half,
          background: '#1c2633',
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', left: 80, top: 480, fontSize: 80, color: theme.slate, whiteSpace: 'nowrap' }}
        >
          {String(scene.options.right ?? '')}
        </div>
      </div>
    </AbsoluteFill>
  );
};
