import type { FC } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { Timeline, TimelineScene } from '../types';
import { Citation } from './Citation';
import { SCENES } from './scenes';
import { theme } from './theme';

const FADE = 8;

/** One scene in its own time: a short fade in and out over the background, the citation overlay on top. */
const SceneView: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const Component = SCENES[scene.kind];
  const opacity = interpolate(frame, [0, FADE, scene.duration - FADE, scene.duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <Component scene={scene} />
      <Citation scene={scene} frame={scene.start + frame} />
    </AbsoluteFill>
  );
};

/** The whole segment: scenes and their narration placed by the timeline's measured frames. */
export const Video: FC<Timeline> = (tl) => (
  <AbsoluteFill style={{ background: theme.bg }}>
    {tl.scenes.map((s) => (
      <Sequence key={s.id} name={s.id} from={s.start} durationInFrames={s.duration}>
        <SceneView scene={s} />
      </Sequence>
    ))}
    {tl.scenes
      .flatMap((s) => s.sentences)
      .map((x) => (
        <Sequence key={x.id} name={`narration ${x.id}`} from={x.start} durationInFrames={x.duration}>
          <Audio src={staticFile(x.audio)} />
        </Sequence>
      ))}
  </AbsoluteFill>
);
