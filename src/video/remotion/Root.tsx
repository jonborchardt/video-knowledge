import type { FC } from 'react';
import { AbsoluteFill, Composition, Img, staticFile } from 'remotion';
import { FPS, HEIGHT, type Timeline, WIDTH } from '../types';
import { Video } from './Video';
import { COR_PALETTE, theme } from './theme';

export const COMPOSITION = 'segment';
export const CONTACT = 'contact';
const EMPTY: Timeline = {
  topic: '',
  story: '',
  title: '',
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: 1,
  fingerprints: { script: '', storyboard: '', narration: '', config: '' },
  narration: { provider: '', voice: '', rate: '', licence: '' },
  palette: COR_PALETTE,
  scenes: [],
};

/** The contact sheet: inspection frames (paths relative to the public dir) in a labelled grid, four to a row. */
type ContactProps = { frames: { file: string; label: string }[] };
const COLS = 4;
const CELL = { w: 480, h: 270 + 44 };
const ContactSheet: FC<ContactProps> = ({ frames }) => (
  <AbsoluteFill style={{ background: theme.ground, fontFamily: theme.sans }}>
    {frames.map((f, i) => (
      <div
        key={f.file}
        style={{
          position: 'absolute',
          left: (i % COLS) * CELL.w,
          top: Math.floor(i / COLS) * CELL.h,
          width: CELL.w,
          height: CELL.h,
          padding: 6,
          boxSizing: 'border-box',
        }}
      >
        <Img
          src={staticFile(f.file)}
          style={{ width: CELL.w - 12, height: 270 - 6, objectFit: 'cover', borderRadius: 4 }}
        />
        <div
          style={{
            fontSize: 18,
            color: theme.muted,
            marginTop: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {f.label}
        </div>
      </div>
    ))}
  </AbsoluteFill>
);

/** The props are a Timeline (video/timeline.json), passed as --props to the studio and as inputProps to the renderer. */
export const Root: FC = () => (
  <>
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
    <Composition
      id={CONTACT}
      component={ContactSheet}
      defaultProps={{ frames: [] } as ContactProps}
      fps={1}
      width={COLS * CELL.w}
      height={CELL.h}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({ height: Math.max(1, Math.ceil(props.frames.length / COLS)) * CELL.h })}
    />
  </>
);
