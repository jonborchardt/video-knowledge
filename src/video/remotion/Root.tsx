import type { FC } from 'react';
import { Composition } from 'remotion';
import { FPS, HEIGHT, type Timeline, WIDTH } from '../types';
import { Video } from './Video';

export const COMPOSITION = 'segment';
const EMPTY: Timeline = {
  topic: '',
  story: '',
  title: '',
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: 1,
  fingerprints: { script: '', storyboard: '', narration: '', config: '' },
  narration: { provider: '', voice: '', rate: '' },
  scenes: [],
};

/** The props are a Timeline (video/timeline.json), passed as --props to the studio and as inputProps to the renderer. */
export const Root: FC = () => (
  <Composition
    id={COMPOSITION}
    component={Video}
    defaultProps={EMPTY}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    durationInFrames={1}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, props.durationInFrames),
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
