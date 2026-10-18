import type { FC } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimelineScene } from '../../types';
import { ramp, theme } from '../theme';

const Blur: FC<{ w: number; h: number; o?: number; mt?: number }> = ({ w, h, o = 0.55, mt = 0 }) => (
  <div
    style={{
      width: w,
      height: h,
      marginTop: mt,
      borderRadius: h,
      background: `rgba(236,233,226,${o})`,
      filter: 'blur(5px)',
    }}
  />
);

/** sc01: a phone on a dark table lights with one message; sender and preview are blurred; slow push-in; no text. */
export const Phone: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const notify = scene.cues.notify ?? scene.sentences[0].start + 12;
  const lit = ramp(t, notify, 12);
  const card = spring({ frame: t - notify - 4, fps, config: { damping: 16, stiffness: 140 } });
  const push = interpolate(frame, [0, scene.duration], [1, 1.08]);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #2a2e38 0%, #16181e 45%, #0c0d11 100%)' }}>
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 130,
          width: 400,
          height: 820,
          borderRadius: 58,
          background: '#07080c',
          border: '4px solid #4a505c',
          boxShadow: `0 50px 120px rgba(0,0,0,.8), inset 0 0 0 2px rgba(255,255,255,.06), 0 0 ${90 * lit}px rgba(140,170,220,${0.3 * lit})`,
          transform: `scale(${push}) rotate(-7deg)`,
          transformOrigin: '50% 55%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            borderRadius: 46,
            background: `rgb(${8 + 14 * lit}, ${9 + 16 * lit}, ${12 + 24 * lit})`,
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
            <div style={{ width: 110, height: 30, borderRadius: 15, background: '#000' }} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 22,
              right: 22,
              top: 150,
              padding: 20,
              borderRadius: 26,
              background: 'rgba(236,233,226,0.13)',
              opacity: card,
              transform: `translateY(${(1 - card) * -50}px)`,
              display: 'flex',
              gap: 16,
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 16, background: theme.amber, flexShrink: 0 }} />
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
