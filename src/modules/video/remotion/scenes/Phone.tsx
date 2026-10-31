import type { FC } from 'react';
import { AbsoluteFill, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cue } from '../../cues';
import type { TimelineScene } from '../../types';
import { alpha, ramp, theme } from '../theme';

const Blur: FC<{ w: number; h: number; o?: number; mt?: number }> = ({ w, h, o = 0.55, mt = 0 }) => (
  <div
    style={{
      width: w,
      height: h,
      marginTop: mt,
      borderRadius: h,
      background: alpha(theme.paper, o),
      filter: 'blur(5px)',
    }}
  />
);

/** The phone on the dark table (`phone`): screen off, it lights with one blurred message on the `notify` cue, slow
 *  push-in, no text. */
export const Phone: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const notify = cue(scene, 'notify', scene.sentences[0].start + 12);
  const lit = ramp(t, notify, 12);
  const card = spring({ frame: t - notify - 4, fps, config: { damping: 16, stiffness: 140 } });
  const push = interpolate(frame, [0, scene.duration], [1, 1.08]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${alpha(theme.paper, 0.1)} 0%, ${theme.ground} 45%, ${theme.text} 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 130,
          width: 400,
          height: 820,
          borderRadius: 58,
          background: theme.text,
          border: `4px solid ${theme.ink}`,
          boxShadow: `0 50px 120px ${alpha(theme.text, 0.8)}, inset 0 0 0 2px ${alpha(theme.paper, 0.06)}, 0 0 ${90 * lit}px ${alpha(theme.data, 0.3 * lit)}`,
          transform: `scale(${push}) rotate(-7deg)`,
          transformOrigin: '50% 55%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: 46,
            background: interpolateColors(lit, [0, 1], [theme.text, theme.ground]),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              opacity: lit,
            }}
          >
            <div style={{ width: 110, height: 30, borderRadius: 15, background: theme.text }} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 22,
              right: 22,
              top: 150,
              padding: 20,
              borderRadius: 26,
              background: alpha(theme.paper, 0.13),
              opacity: card,
              transform: `translateY(${(1 - card) * -50}px)`,
              display: 'flex',
              gap: 16,
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 16, background: theme.glow, flexShrink: 0 }} />
            <div>
              <Blur w={150} h={16} o={0.8} mt={4} />
              <Blur w={260} h={13} mt={16} />
              <Blur w={210} h={13} mt={10} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
