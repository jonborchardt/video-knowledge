import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lastWord } from '../../cues';
import type { TimelineScene } from '../../types';
import { ramp, theme } from '../theme';

/** sc11: a split field, amber left and slate right (labels from options.left / options.right, else the scene's two
 *  on-screen lines), wiping to the field from the centre on the `wipe` cue. Without the cue the wipe ends on the scene's
 *  last frame (and not before the last word), so the field is never left empty before the next scene. */
export const Transition: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const wipe = ramp(t, cue(scene, 'wipe', Math.max(lastWord(scene) - 10, scene.start + scene.duration - 16)), 16);
  const a = ramp(t, scene.start, 10);
  const half = 960 * (1 - wipe);
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: half,
          background: `${theme.amber}26`, // the pitch's gold, tinted over the backdrop
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', right: 80, top: 480, fontSize: 80, color: theme.amber, whiteSpace: 'nowrap' }}
        >
          {String(scene.options.left ?? scene.onScreenText[0] ?? '')}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: half,
          background: `${theme.slate}26`, // the data's cyan, tinted over the backdrop
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', left: 80, top: 480, fontSize: 80, color: theme.slate, whiteSpace: 'nowrap' }}
        >
          {String(scene.options.right ?? scene.onScreenText[1] ?? '')}
        </div>
      </div>
    </AbsoluteFill>
  );
};
