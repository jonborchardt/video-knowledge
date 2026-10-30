import type { FC } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { TimelineScene } from '../../types';

/** The unnarrated end of a landscape video (the timeline appends it as scene `end`): the institution's closing card
 *  ("The matter is now part of the public record.", the disclosure) from the staged brand kit for `options.closeFrames`,
 *  then its end-screen card, which YouTube's end-screen elements sit on for the rest of the scene. */
export const CloseCard: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const cut = Number(scene.options.closeFrames);
  const swap = interpolate(f, [cut - 15, cut], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const push = 1 + 0.02 * (f / scene.duration);
  const card = (slot: string, opacity: number) => (
    <AbsoluteFill style={{ opacity, transform: `scale(${push})` }}>
      <Img src={staticFile(`brand/${slot}.jpg`)} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      {card('close-card', 1)}
      {card('endscreen-subscribe', swap)}
    </AbsoluteFill>
  );
};
