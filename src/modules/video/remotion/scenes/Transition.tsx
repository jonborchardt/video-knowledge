import type { FC } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { cue, lastWord } from '../../cues';
import type { TimelineScene } from '../../types';
import { alpha, ramp, theme } from '../theme';

const SEAL = 220;

/** sc11: a split field, glow left and data right (labels from options.left / options.right, else the scene's two
 *  on-screen lines), wiping to the field from the centre on the `wipe` cue. Without the cue the wipe ends on the scene's
 *  last frame (and not before the last word), so the field is never left empty before the next scene. */
export const Transition: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const wipe = ramp(t, cue(scene, 'wipe', Math.max(lastWord(scene) - 10, scene.start + scene.duration - 16)), 16);
  const a = ramp(t, scene.start, 10);
  const half = 960 * (1 - wipe);
  return (
    <AbsoluteFill style={{ fontFamily: theme.sans }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: half,
          background: alpha(theme.glow, 0.15), // the pitch's accent, tinted over the backdrop
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', right: 80, top: 480, fontSize: 80, color: theme.glow, whiteSpace: 'nowrap' }}
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
          background: alpha(theme.data, 0.15), // the data's colour, tinted over the backdrop
          opacity: a,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ position: 'absolute', left: 80, top: 480, fontSize: 80, color: theme.data, whiteSpace: 'nowrap' }}
        >
          {String(scene.options.right ?? scene.onScreenText[1] ?? '')}
        </div>
      </div>
      {/* the institution's seal on the seam, above the labels: it settles in with the field and lifts away as the
          wipe opens (its slot is in kitSlots, render.ts) */}
      <Img
        src={staticFile('brand/seal.png')}
        alt=""
        style={{
          position: 'absolute',
          left: 960 - SEAL / 2,
          top: 330 - SEAL / 2,
          width: SEAL,
          height: SEAL,
          opacity: ramp(t, scene.start + 4, 14) * (1 - wipe),
          transform: `scale(${0.8 + 0.2 * ramp(t, scene.start + 4, 18) + 0.25 * wipe}) rotate(${-8 * (1 - a)}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};
