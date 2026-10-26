import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, grow, ramp, theme } from '../theme';

const EVERY = 26; // frames between boxes leaving the truck
const TRIP = 70; // frames a box takes from the truck to the stack
const STACK = 6; // boxes in the full stack; later ones vanish into it
const FROM_X = 1330; // the truck's tailgate
const TO_X = 880; // the stack, inside the door
const CARD = { x: GUTTER, y: 190, w: 820 };
const RIGHT_X = 1040;

/** A cardboard box, 70 square, its bottom-left at the origin. */
const Box: FC = () => (
  <g stroke={theme.glow} strokeWidth={4} strokeLinejoin="round">
    <rect x={0} y={-70} width={70} height={70} rx={4} fill={theme.ground} />
    <line x1={0} y1={-48} x2={70} y2={-48} />
    <line x1={35} y1={-70} x2={35} y2={-48} />
  </g>
);

/** sc09 of courts-and-jurisdiction: a shop seen side-on, a delivery truck at its door dropping boxes that keep being
 *  carried in to a stack behind the counter. On `invoice` a bill slides onto the counter, and on `stamp` a red protest
 *  stamp (abstract bars, no words) slams onto it while the boxes keep coming. At on-screen line 1 the whole picture
 *  shrinks into a card on the left labelled with it; on `absent` lines 2..n appear greyed on the right, and each is
 *  struck through as it is spoken (line:<n>). No options. */
export const ShopProtest: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [label = '', ...absent] = scene.onScreenText;
  const frames = lineFrames(scene);
  const s0 = scene.sentences[0];
  const invoiceAt = cue(scene, 'invoice', s0 ? s0.start + Math.round(s0.duration * 0.45) : scene.start + 60);
  const stampAt = cue(scene, 'stamp', invoiceAt + 45);
  const splitAt = frames[0];
  const absentAt = cue(scene, 'absent', splitAt + 30);
  const bottom = citationTop(scene);
  const ground = bottom - 70;
  const top = 150;

  // the picture shrinks into the left card
  const split = ramp(t, splitAt, 28);
  const s = 1 - 0.54 * split;
  const tx = (CARD.x + 20 - 120 * s) * split;
  const ty = (CARD.y + 20 - top * s) * split;
  const cardH = (ground - top) * 0.46 + 150;

  // boxes on their way and the stack they build
  const since = t - scene.start;
  const sent = Math.floor(since / EVERY);
  const moving = [0, 1, 2].map((k) => sent - k).filter((n) => n >= 0 && since - n * EVERY < TRIP);
  const stacked = Math.max(0, Math.floor((since - TRIP) / EVERY) + 1);
  const shown = Math.min(STACK, stacked);

  const inv = ramp(t, invoiceAt, 18);
  const stamp = clamp01((t - stampAt) / 6);
  const thud = clamp01(1 - Math.abs(t - stampAt - 6) / 8);

  const rowsTop = CARD.y;
  const rowH = Math.min(200, (bottom - 40 - rowsTop) / Math.max(1, absent.length));

  return (
    <AbsoluteFill style={{ overflow: 'hidden', fontFamily: theme.sans }}>
      <svg width={1920} height={1080}>
        {/* the left card the picture settles into */}
        <g opacity={split}>
          <rect
            x={CARD.x}
            y={CARD.y}
            width={CARD.w}
            height={cardH}
            rx={22}
            fill={theme.raised}
            stroke={theme.gain}
            strokeWidth={4}
          />
          <text
            x={CARD.x + CARD.w / 2}
            y={CARD.y + cardH - 48}
            textAnchor="middle"
            fill={theme.gain}
            fontSize={52}
            fontWeight={700}
          >
            {label}
          </text>
        </g>
        <g transform={`translate(${tx} ${ty}) scale(${s})`}>
          <g transform={`translate(0 ${thud * 6})`}>
            {/* ground */}
            <line x1={120} y1={ground} x2={1800} y2={ground} stroke={theme.line} strokeWidth={4} />
            {/* the shop: wall, awning, open door on the right */}
            <g stroke={theme.accent2} strokeWidth={6} strokeLinejoin="round" fill="none">
              <rect x={220} y={top + 90} width={830} height={ground - top - 90} fill={theme.raised} />
              <path d={`M 190 ${top + 90} L 240 ${top} H 1030 L 1080 ${top + 90} Z`} fill={theme.ground} />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line key={i} x1={300 + i * 110} y1={top + 4} x2={280 + i * 116} y2={top + 86} strokeWidth={4} />
              ))}
              <rect x={940} y={ground - 260} width={110} height={260} fill={theme.ground} />
            </g>
            {/* the counter */}
            <g stroke={theme.data} strokeWidth={6} strokeLinejoin="round">
              <rect x={300} y={ground - 170} width={440} height={170} fill={theme.ground} />
              <rect x={280} y={ground - 190} width={480} height={22} rx={6} fill={theme.data} />
            </g>
            {/* the stack behind the door */}
            {Array.from({ length: shown }, (_, i) => (
              <g key={i} transform={`translate(${TO_X - (i % 2) * 78} ${ground - Math.floor(i / 2) * 74})`}>
                <Box />
              </g>
            ))}
            {/* boxes on the move, with a small hop over the threshold */}
            {moving.map((n) => {
              const u = (since - n * EVERY) / TRIP;
              const x = FROM_X + (TO_X - FROM_X) * u;
              const hop = Math.sin(Math.PI * clamp01((u - 0.4) / 0.3)) * 26;
              return (
                <g key={n} transform={`translate(${x} ${ground - hop})`} opacity={clamp01(u * 6)}>
                  <Box />
                </g>
              );
            })}
            {/* the truck, tailgate at the door */}
            <g stroke={theme.fg} strokeWidth={5} strokeLinejoin="round" fill={theme.ground}>
              <rect x={1340} y={ground - 300} width={300} height={240} rx={8} fill={theme.raised} />
              <path d={`M 1640 ${ground - 200} H 1720 L 1770 ${ground - 130} V ${ground - 60} H 1640 Z`} />
              <path d={`M 1660 ${ground - 185} H 1712 L 1748 ${ground - 135} H 1660 Z`} fill={theme.data} />
              <circle cx={1420} cy={ground - 40} r={38} />
              <circle cx={1690} cy={ground - 40} r={38} />
              <circle cx={1420} cy={ground - 40} r={12} fill={theme.fg} />
              <circle cx={1690} cy={ground - 40} r={12} fill={theme.fg} />
            </g>
            {/* the invoice on the counter, and the stamp */}
            <g transform={`translate(${520 - (1 - inv) * 420} ${ground - 320}) rotate(-6)`} opacity={clamp01(inv * 2)}>
              <rect x={-90} y={-110} width={180} height={230} rx={8} fill={theme.fg} />
              {[-80, -54, -28, -2].map((y, i) => (
                <rect key={y} x={-64} y={y} width={i === 3 ? 70 : 128} height={10} rx={4} fill={theme.muted} />
              ))}
              <rect x={10} y={80} width={60} height={14} rx={4} fill={theme.ground} />
              <g transform={`rotate(-14) scale(${1.8 - 0.8 * stamp})`} opacity={stamp}>
                <rect x={-96} y={-30} width={192} height={64} rx={6} fill="none" stroke={theme.loss} strokeWidth={7} />
                <rect x={-76} y={-14} width={152} height={10} rx={4} fill={theme.loss} />
                <rect x={-76} y={6} width={104} height={10} rx={4} fill={theme.loss} />
              </g>
            </g>
          </g>
        </g>
        {/* what the section does not touch */}
        {absent.map((word, i) => {
          const y = rowsTop + rowH * i;
          const k = grow(t, absentAt + i * 8, 14);
          const strike = ramp(t, frames[i + 1], 14);
          const w = 1800 - RIGHT_X;
          return (
            <g key={word} opacity={clamp01(k * 1.5)} transform={`translate(${(1 - clamp01(k)) * 60} 0)`}>
              <rect
                x={RIGHT_X}
                y={y + 14}
                width={w}
                height={rowH - 28}
                rx={18}
                fill={theme.raised}
                stroke={theme.line}
                strokeWidth={3}
              />
              <text x={RIGHT_X + 50} y={y + rowH / 2 + 19} fill={theme.muted} fontSize={54} fontWeight={600}>
                {word}
              </text>
              <line
                x1={RIGHT_X + 30}
                y1={y + rowH / 2}
                x2={RIGHT_X + 30 + (w - 60) * strike}
                y2={y + rowH / 2}
                stroke={theme.loss}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={strike > 0 ? 1 : 0}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
