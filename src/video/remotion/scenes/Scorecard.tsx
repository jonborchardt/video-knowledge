import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lineFrames, spokenAt } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { GUTTER, clamp01, easeOut, grow, ramp, theme } from '../theme';

type Mark = 'check' | 'cross' | 'question';
const markColor = (m: Mark) => (m === 'check' ? theme.green : m === 'cross' ? theme.red : theme.amber);

/** A verdict mark drawn in SVG, stroked on over `d` (0..1): a tick, a cross, or a question mark with its dot. */
const Glyph: FC<{ mark: Mark; d: number; color: string }> = ({ mark, d, color }) => {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 15, strokeLinecap: 'round' as const };
  const draw = (len: number, from = 0, to = 1) => ({
    strokeDasharray: len,
    strokeDashoffset: len * (1 - clamp01((d - from) / (to - from))),
  });
  if (mark === 'check') return <path d="M -34 2 L -10 28 L 38 -28" {...stroke} {...draw(110)} />;
  if (mark === 'cross')
    return (
      <g>
        <path d="M -28 -28 L 28 28" {...stroke} {...draw(80, 0, 0.5)} />
        <path d="M 28 -28 L -28 28" {...stroke} {...draw(80, 0.5, 1)} />
      </g>
    );
  return (
    <g>
      <path d="M -22 -18 Q -22 -42 0 -42 Q 24 -42 24 -20 Q 24 -6 8 2 Q 0 6 0 18" {...stroke} {...draw(130, 0, 0.8)} />
      <circle cy={38} r={9} fill={color} opacity={clamp01((d - 0.8) / 0.2)} />
    </g>
  );
};

/** sc28, sc35: a verdict board. Each "claim: verdict" line is a row card, the claim left, the verdict right (a line
 *  without a colon shows whole on the left). The row slides in on its line frame (its `line:<n>` cue, else when its
 *  claim is spoken, else the line's own frame); its mark from options.marks (check, cross, question; in line order,
 *  question when missing) stamps down when the verdict is spoken, else shortly after, with a squash and a ring burst.
 *  Earlier rows dim as the next lands. Rows scale to the line count to fit above the citation. */
export const Scorecard: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const lines = scene.onScreenText;
  const n = lines.length;
  const fallback = lineFrames(scene);
  const marks = String(scene.options.marks ?? '')
    .split(',')
    .map((m) => m.trim());
  const rows = lines.map((line, i) => {
    const colon = line.indexOf(':');
    const claim = colon > 0 ? line.slice(0, colon).trim() : line;
    const verdict = colon > 0 ? line.slice(colon + 1).trim() : '';
    const cue = scene.cues[`line:${i + 1}`];
    const enter = cue ?? (colon > 0 ? spokenAt(scene, claim)?.frame : undefined) ?? fallback[i];
    const said = verdict ? spokenAt(scene, verdict)?.frame : undefined;
    const stamp = said !== undefined && said > enter ? said : enter + 30;
    const m = marks[i];
    const mark: Mark = m === 'check' || m === 'cross' ? m : 'question';
    return { claim, verdict, enter, stamp, mark };
  });
  // later rows never enter before earlier ones
  for (let i = 1; i < n; i++) rows[i].enter = Math.max(rows[i].enter, rows[i - 1].enter + 10);
  const top = 150;
  const gap = 28;
  const room = citationTop(scene) - 20 - top;
  const rowH = Math.min(210, (room - gap * (n - 1)) / n);
  const y0 = top + (room - n * rowH - (n - 1) * gap) / 2; // the board sits centred in its room
  const k = rowH / 210;
  const left = GUTTER;
  const width = 1920 - 2 * GUTTER;
  const markX = width - rowH / 2 - 10; // the mark's centre inside the card
  return (
    <AbsoluteFill style={{ background: theme.field, fontFamily: theme.sans }}>
      {rows.map((r, i) => {
        const a = ramp(t, r.enter - 8, 14);
        const st = t - r.stamp;
        const landed = st >= 0;
        const color = markColor(r.mark);
        const next = rows[i + 1];
        const dim = next ? 1 - 0.4 * ramp(t, next.stamp, 14) : 1;
        // the stamp: falls from 2.4x over 7 frames, squashes on impact, settles
        const fall = clamp01(st / 7);
        const sc = st < 7 ? 2.4 - 1.4 * fall * fall : 1;
        const squash = st >= 7 && st < 19 ? Math.sin(((st - 7) / 12) * Math.PI) * (1 - (st - 7) / 12) : 0;
        const breathe = landed ? 0.03 * Math.sin((t - r.stamp) / 9) : 0;
        const tint = ramp(t, r.stamp + 4, 12);
        const R = rowH * 0.36;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top: y0 + i * (rowH + gap),
              width,
              height: rowH,
              borderRadius: 20 * k + 6,
              background: `linear-gradient(90deg, ${theme.raised}, ${color}${tint > 0 ? '30' : '00'})`,
              border: `3px solid ${tint > 0.5 ? color : theme.line}`,
              boxShadow: tint > 0 ? `0 0 ${36 * tint}px ${color}55` : undefined,
              opacity: a * dim,
              transform: `translateX(${(1 - a) * -80}px)`,
              boxSizing: 'border-box',
            }}
          >
            {/* the colour strip that fills as the verdict lands */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 14,
                borderRadius: '18px 0 0 18px',
                background: color,
                opacity: 0.25 + 0.75 * tint,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 50,
                top: 0,
                height: '100%',
                width: r.verdict ? width * 0.4 : markX - R - 90,
                display: 'flex',
                alignItems: 'center',
                fontSize: 54 * k,
                fontWeight: 700,
                lineHeight: 1.12,
                color: theme.fg,
              }}
            >
              {r.claim}
            </div>
            {r.verdict ? (
              <div
                style={{
                  position: 'absolute',
                  right: rowH + 40,
                  top: 0,
                  height: '100%',
                  width: width * 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  fontSize: 46 * k,
                  lineHeight: 1.15,
                  color: landed ? color : theme.muted,
                  textShadow: landed ? `0 0 20px ${color}88` : undefined,
                  opacity: 0.55 + 0.45 * tint,
                }}
              >
                {r.verdict}
              </div>
            ) : null}
            <svg
              width={rowH * 1.6}
              height={rowH * 1.6}
              viewBox={`${-rowH * 0.8} ${-rowH * 0.8} ${rowH * 1.6} ${rowH * 1.6}`}
              style={{ position: 'absolute', left: markX - rowH * 0.8, top: -rowH * 0.3, overflow: 'visible' }}
            >
              {/* the empty socket waits for the stamp */}
              <circle
                r={R}
                fill="none"
                stroke={theme.line}
                strokeWidth={4}
                strokeDasharray="10 10"
                opacity={1 - tint}
              />
              {/* the ring burst on impact */}
              {st >= 6 && st < 30 ? (
                <circle
                  r={R + rowH * 0.5 * easeOut((st - 6) / 24)}
                  fill="none"
                  stroke={color}
                  strokeWidth={8 * (1 - (st - 6) / 24)}
                  opacity={1 - (st - 6) / 24}
                />
              ) : null}
              {landed ? (
                <g
                  transform={`scale(${(sc + breathe) * (1 + 0.22 * squash)} ${(sc + breathe) * (1 - 0.22 * squash)})`}
                  opacity={clamp01(st / 3)}
                >
                  <circle
                    r={R}
                    fill={`${color}26`}
                    stroke={color}
                    strokeWidth={8}
                    style={{ filter: `drop-shadow(0 0 14px ${color})` }}
                  />
                  <g transform={`scale(${(R / 60) * grow(t, r.stamp + 4, 10)})`}>
                    <Glyph mark={r.mark} d={ramp(t, r.stamp + 5, 14)} color={color} />
                  </g>
                </g>
              ) : null}
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
