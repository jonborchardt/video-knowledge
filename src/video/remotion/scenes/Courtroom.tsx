import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lastWord, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, grow, ramp, theme } from '../theme';

// Line-art courtroom, one path per stroke group; drawn left to right by each path's leftmost x.
const SHEET = { x: 1135, y: 676 }; // the push-in lands here
const PATHS: [number, string][] = [
  // back wall, floor and side walls
  [0, 'M0 610 L1920 610'],
  [0, 'M0 1080 L420 610 M1920 1080 L1500 610'],
  [60, 'M200 140 L200 610 M380 140 L380 610'],
  [1540, 'M1540 140 L1540 610 M1720 140 L1720 610'],
  [0, 'M0 140 L1920 140'],
  // judge's chair back, then the bench
  [870, 'M870 400 L870 250 Q960 205 1050 250 L1050 400'],
  [640, 'M640 400 L1280 400 L1280 610 L640 610 Z'],
  [620, 'M620 400 L1300 400 L1300 380 L620 380 Z'],
  [700, 'M700 440 L880 440 L880 570 L700 570 Z M1040 440 L1220 440 L1220 570 L1040 570 Z'],
  [905, 'M905 450 a55 55 0 1 0 110 0 a55 55 0 1 0 -110 0'],
  // the flag on its pole
  [1380, 'M1380 600 L1380 180 M1350 610 L1410 610 M1372 172 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'],
  [1380, 'M1380 195 Q1440 175 1500 200 T1600 205 L1600 330 Q1550 345 1500 325 T1380 320 Z'],
  [1380, 'M1380 236 Q1440 216 1500 241 T1600 246 M1380 278 Q1440 258 1500 283 T1600 288'],
  // the lectern in the foreground, its sheet
  [980, 'M1000 660 L1320 660 L1350 710 L970 710 Z'],
  [990, 'M995 710 L1025 1000 L1295 1000 L1325 710 M1060 760 L1260 760'],
  [960, 'M960 1000 L1360 1000'],
];
const SHEET_PATH =
  'M1090 664 L1182 664 L1192 694 L1080 694 Z M1098 672 L1172 672 M1096 680 L1176 680 M1094 687 L1150 687';

const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** sc01 (`sc-courtroom`): an empty courtroom in thin off-white line art draws on left to right over the sentence,
 *  then a slow push-in lands on the sheet on the lectern as the sentence ends; the caption fades in bottom-left on
 *  its `line:1` cue. */
export const Courtroom: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const end = lastWord(scene);
  const span = end - scene.start;
  const drawEnd = scene.start + span * 0.55;
  const draw = (x: number) => ramp(t, scene.start + 6 + (x / 1920) * (drawEnd - scene.start - 30), 30);
  const p = smooth((t - scene.start - span * 0.3) / (span * 0.7));
  const z = 1 + 2.6 * p; // screen-space stroke grows only with sqrt(z)
  const fade = 'linear-gradient(to top, transparent 110px, #000 300px)'; // strokes thin out under caption and citation
  const [capAt] = lineFrames(scene);
  const cap = grow(t, capAt, 14);
  const glow = theme.motion ? `drop-shadow(0 0 6px ${theme.slate})` : undefined;
  const stroke = (p: number) => ({
    fill: 'none',
    stroke: theme.fg,
    strokeWidth: 2.5 / Math.sqrt(z),
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: 1 - p,
  });
  return (
    <AbsoluteFill style={{ background: theme.field }}>
      <svg width={1920} height={1080} style={{ filter: glow, maskImage: fade, WebkitMaskImage: fade }}>
        <g
          transform={`translate(${SHEET.x + (960 - SHEET.x) * p} ${SHEET.y + (540 - SHEET.y) * p}) scale(${z}) translate(${-SHEET.x} ${-SHEET.y})`}
        >
          {PATHS.map(([x, d], i) => (
            <path key={i} d={d} {...stroke(draw(x))} opacity={0.85} />
          ))}
          <path
            d={SHEET_PATH}
            {...stroke(draw(1090))}
            stroke={theme.motion ? theme.amber : theme.fg}
            strokeWidth={2 / Math.sqrt(z)}
          />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          top: citationTop(scene) - 70,
          fontFamily: theme.sans,
          fontSize: 34,
          letterSpacing: 2,
          color: theme.fg,
          opacity: clamp01(cap),
          transform: `translateY(${(1 - cap) * 12}px)`,
        }}
      >
        {scene.onScreenText[0]}
      </div>
    </AbsoluteFill>
  );
};
