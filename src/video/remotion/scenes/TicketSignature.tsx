import type { FC } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { cue, lineFrames } from '../../cues';
import type { TimelineScene } from '../../types';
import { citationTop } from '../Citation';
import { grow, ramp, theme } from '../theme';

const FORM = { x: 300, y: 60, w: 760 };
const SEAL = { x: FORM.x + FORM.w - 120, y: FORM.y + 120, r: 72 };
const SCRIBBLE_LEN = 45; // frames the handwriting takes to write itself

/** Loopy, illegible handwriting: a cycloid along a line with seeded wobble. */
function scribblePath(x0: number, y0: number, len: number): string {
  const pts: string[] = [];
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = u * Math.PI * 2 * 11;
    const r = 16 + 9 * Math.sin(u * 23.7) + 6 * Math.sin(u * 61.3);
    const x = x0 + u * len + r * 0.8 * Math.cos(a);
    const y = y0 + r * Math.sin(a) * (0.7 + 0.5 * Math.sin(u * 7.1)) + 8 * Math.sin(u * 4.3);
    pts.push(`${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

/** A generic ticket form in line art (abstract bars for words, no agency, no details). A signature line near the
 *  bottom; on the `scribble` cue illegible handwriting writes itself in beneath it, in amber (the pitch). On the `seal`
 *  cue the court seal at the top of the form glows; on line 1 ("the law") a connector runs from the seal to that label;
 *  on line 2 ("not your signature") the scribble greys out and the label sits beside it. Reads no options. */
export const TicketSignature: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const [lawText = '', notText = ''] = scene.onScreenText;
  const [lawAt, notAt] = lineFrames(scene);
  const scribbleAt = cue(scene, 'scribble', scene.sentences[0]?.start ?? scene.start);
  const sealAt = cue(scene, 'seal', scene.sentences[1]?.start ?? lawAt);
  const bottom = citationTop(scene);
  const H = bottom - FORM.y - 20;
  const sigY = FORM.y + H - 170;
  const scrY = sigY + 80;
  const ink = theme.muted;
  const glow = theme.motion;

  const drawIn = ramp(t, scene.start, 24);
  const write = Math.min(1, Math.max(0, (t - scribbleAt) / SCRIBBLE_LEN));
  const seal = ramp(t, sealAt, 18);
  const sealPop = grow(t, sealAt, 14);
  const link = ramp(t, lawAt - 6, 18);
  const law = grow(t, lawAt, 14);
  const grey = ramp(t, notAt, 16);
  const not = grow(t, notAt, 14);
  const pulse = glow ? 0.6 + 0.4 * Math.sin((t - sealAt) / 6) : 1;

  const rows = [0, 1, 2, 3, 4];
  const rowY = (i: number) => FORM.y + 250 + i * ((sigY - FORM.y - 300) / rows.length);
  const sigPath = scribblePath(FORM.x + 150, scrY, 420);
  const labelX = FORM.x + FORM.w + 80;
  const font = 58;

  return (
    <AbsoluteFill style={{ background: theme.field, overflow: 'hidden' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="ticket-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={10} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* the form */}
        <g opacity={drawIn} transform={`translate(0 ${(1 - drawIn) * 20})`}>
          <rect
            x={FORM.x}
            y={FORM.y}
            width={FORM.w}
            height={H}
            rx={12}
            fill={theme.raised}
            stroke={ink}
            strokeWidth={3}
          />
          {/* header: title bar and number box */}
          <rect x={FORM.x + 60} y={FORM.y + 70} width={360} height={30} rx={15} fill={ink} opacity={0.7} />
          <rect x={FORM.x + 60} y={FORM.y + 125} width={240} height={18} rx={9} fill={ink} opacity={0.45} />
          <line
            x1={FORM.x + 40}
            y1={FORM.y + 210}
            x2={FORM.x + FORM.w - 40}
            y2={FORM.y + 210}
            stroke={ink}
            strokeWidth={2}
            opacity={0.6}
          />
          {/* field rows: a small label bar, an empty box */}
          {rows.map((i) => (
            <g key={i}>
              <rect
                x={FORM.x + 60}
                y={rowY(i)}
                width={120 + ((i * 47) % 70)}
                height={14}
                rx={7}
                fill={ink}
                opacity={0.5}
              />
              <rect
                x={FORM.x + 260}
                y={rowY(i) - 14}
                width={FORM.w - 320 - ((i * 83) % 160)}
                height={42}
                rx={6}
                fill="none"
                stroke={ink}
                strokeWidth={2}
                opacity={0.55}
              />
            </g>
          ))}
          {/* signature line */}
          <text x={FORM.x + 70} y={sigY - 12} fontFamily={theme.sans} fontSize={44} fill={ink}>
            ×
          </text>
          <line x1={FORM.x + 120} y1={sigY} x2={FORM.x + 620} y2={sigY} stroke={ink} strokeWidth={3} />
          <rect x={FORM.x + 120} y={sigY + 16} width={150} height={12} rx={6} fill={ink} opacity={0.45} />
          {/* a plain signature on the line */}
          <path
            d={scribblePath(FORM.x + 160, sigY - 26, 230)}
            fill="none"
            stroke={ink}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.6}
            transform={`translate(0 ${sigY - 26}) scale(1 0.6) translate(0 ${-(sigY - 26)})`}
          />
        </g>

        {/* the court seal */}
        <g
          opacity={drawIn}
          transform={`translate(${SEAL.x} ${SEAL.y}) scale(${1 + 0.12 * sealPop - 0.12 * seal})`}
          filter={glow && seal > 0 ? 'url(#ticket-glow)' : undefined}
        >
          <circle
            r={SEAL.r}
            fill="none"
            stroke={seal > 0 ? theme.slate : ink}
            strokeWidth={4}
            opacity={0.6 + 0.4 * seal * pulse}
          />
          <circle
            r={SEAL.r - 14}
            fill="none"
            stroke={seal > 0 ? theme.slate : ink}
            strokeWidth={2}
            opacity={0.6 + 0.4 * seal}
          />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={(SEAL.r - 22) * Math.cos(a)}
                y1={(SEAL.r - 22) * Math.sin(a)}
                x2={(SEAL.r - 30) * Math.cos(a)}
                y2={(SEAL.r - 30) * Math.sin(a)}
                stroke={seal > 0 ? theme.slate : ink}
                strokeWidth={2}
              />
            );
          })}
          {/* a column, the courthouse sign */}
          <path
            d="M -26 -18 L 0 -34 L 26 -18 Z M -22 -12 h 44 M -16 -8 v 30 M 0 -8 v 30 M 16 -8 v 30 M -26 26 h 52"
            fill="none"
            stroke={seal > 0 ? theme.slate : ink}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          {seal > 0 ? <circle r={SEAL.r - 14} fill={theme.slate} opacity={0.18 * seal * pulse} /> : null}
        </g>

        {/* the scribble under the signature: amber while written, grey once it is not the authority */}
        {write > 0 ? (
          <g>
            <path
              d={sigPath}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - write}
              fill="none"
              stroke={theme.amber}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={1 - grey * 0.85}
              filter={glow && grey < 1 ? 'url(#ticket-glow)' : undefined}
            />
            <path
              d={sigPath}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - write}
              fill="none"
              stroke={ink}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={grey * 0.5}
            />
          </g>
        ) : null}

        {/* connector: seal -> "the law" */}
        {link > 0 ? (
          <line
            x1={SEAL.x + SEAL.r + 8}
            y1={SEAL.y}
            x2={SEAL.x + SEAL.r + 8 + (labelX - 24 - SEAL.x - SEAL.r - 8) * link}
            y2={SEAL.y}
            stroke={theme.slate}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ) : null}
        {t >= lawAt ? (
          <text
            x={labelX}
            y={SEAL.y}
            dominantBaseline="central"
            fontFamily={theme.sans}
            fontWeight={700}
            fontSize={font * 1.25}
            fill={theme.fg}
            opacity={Math.min(1, law)}
            transform={`translate(${(1 - law) * 30} 0)`}
            filter={glow ? 'url(#ticket-glow)' : undefined}
          >
            {lawText}
          </text>
        ) : null}

        {/* "not your signature", beside the greyed scribble */}
        {t >= notAt ? (
          <g opacity={Math.min(1, not)} transform={`translate(${(1 - not) * 30} 0)`}>
            <line
              x1={labelX - 24}
              y1={scrY}
              x2={FORM.x + 150 + 440}
              y2={scrY}
              stroke={ink}
              strokeWidth={3}
              strokeDasharray="10 10"
            />
            <text
              x={labelX}
              y={scrY}
              dominantBaseline="central"
              fontFamily={theme.sans}
              fontWeight={600}
              fontSize={font}
              fill={theme.fg}
            >
              {notText}
            </text>
          </g>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};
