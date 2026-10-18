import type { FC } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { cue, lastWord } from '../../cues';
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

/** The phone on the dark table. `phone` (sc01): screen off, it lights with one blurred message on the `notify` cue,
 *  slow push-in, no text. `phone-reply` (sc37): the same framing, the reply box open with a blinking cursor, nothing
 *  typed. `phone-end` (sc43): the reply box still empty; the screen and the room dim to black on the `dim` cue (the
 *  last word), then the on-screen line, small. */
export const Phone: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = scene.start + frame;
  const reply = scene.kind !== 'phone';
  const notify = reply ? scene.start : cue(scene, 'notify', scene.sentences[0].start + 12);
  const lit = reply ? 1 : ramp(t, notify, 12);
  const card = spring({ frame: t - notify - 4, fps, config: { damping: 16, stiffness: 140 } });
  const push = interpolate(frame, [0, scene.duration], [1, 1.08]);
  const dimAt = scene.kind === 'phone-end' ? cue(scene, 'dim', lastWord(scene)) : Infinity;
  const dim = ramp(t, dimAt, 20);
  const blink = Math.floor(t / 16) % 2 === 0;
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
              top: reply ? 110 : 150,
              padding: 20,
              borderRadius: 26,
              background: 'rgba(236,233,226,0.13)',
              opacity: reply ? 1 : card,
              transform: reply ? undefined : `translateY(${(1 - card) * -50}px)`,
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
          {reply ? (
            <div
              style={{
                position: 'absolute',
                left: 22,
                right: 22,
                bottom: 40,
                height: 64,
                borderRadius: 32,
                border: '2px solid rgba(236,233,226,.35)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 24px',
                fontFamily: theme.sans,
                fontSize: 30,
                color: theme.amber,
                opacity: ramp(t, scene.start + 10, 12),
              }}
            >
              <span style={{ opacity: blink ? 1 : 0.1 }}>|</span>
            </div>
          ) : null}
        </div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: dim }} />
      {scene.kind === 'phone-end' ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 90,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.muted,
            letterSpacing: 3,
            opacity: ramp(t, dimAt + 30, 16),
          }}
        >
          {scene.onScreenText[0]}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
