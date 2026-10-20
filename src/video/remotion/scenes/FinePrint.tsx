import type { FC } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { BlurLines } from '../glyphs';
import { ramp, theme } from '../theme';

/** sc14: a slow push into the foot of a statement until unreadable fine print fills the frame; the on-screen line
 *  types over it in amber. */
export const FinePrint: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const z = interpolate(t, [scene.start, scene.start + scene.duration], [1, 2.6], { extrapolateRight: 'clamp' });
  const [at] = lineFrames(scene);
  const a = ramp(t, at, 12);
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ transform: `scale(${z})`, transformOrigin: '50% 85%' }}>
        <rect x={560} y={-200} width={800} height={1200} rx={10} fill="#F4F1EA" />
        <BlurLines x={620} y={-150} w={680} rows={60} gap={17} color="rgba(30,30,30,.55)" seed={3} />
        <BlurLines x={620} y={880} w={680} rows={8} gap={9} color="rgba(30,30,30,.6)" seed={7} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 440,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 96,
          color: theme.amber,
          opacity: a,
          textShadow: '0 6px 40px rgba(0,0,0,.9)',
          background: 'rgba(17,19,24,.82)',
          padding: '24px 0',
        }}
      >
        {scene.onScreenText[0]}
      </div>
    </AbsoluteFill>
  );
};
