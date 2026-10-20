import type { FC } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { cue, lineFrames, spokenAt } from '../../cues';
import { excerptWindow } from '../../excerpt';
import type { TimelineScene } from '../../types';
import { BlurLines } from '../glyphs';
import { GUTTER, ramp, theme } from '../theme';

/** The cited passage as a document page: the window around the highlight, which underlines on its cue (or as it is
 *  spoken); a second highlight from options.highlight2; a caption line from the second on-screen line. `disclosures`
 *  opens with a grid of thumbnails (options.count) that counts up before one of them enlarges into the page. */
export const Excerpt: FC<{ scene: TimelineScene }> = ({ scene }) => {
  const t = scene.start + useCurrentFrame();
  const ex = scene.excerpt;
  if (!ex) return null;
  const win = excerptWindow(ex.text, ex.highlight);
  const accent = scene.options.accent === 'slate' ? theme.slate : theme.amber;
  const spoken = ex.highlight ? spokenAt(scene, ex.highlight) : null;
  const hl = ramp(t, cue(scene, 'highlight', spoken?.frame ?? scene.sentences[0].start + 30), 14);
  const h2 = String(scene.options.highlight2 ?? '');
  const h2At = h2 ? cue(scene, 'highlight2', spokenAt(scene, h2)?.frame ?? scene.sentences[0].start + 90) : Infinity;
  const open = scene.kind === 'disclosures' ? cue(scene, 'open', scene.sentences[0].start + 60) : scene.start;
  const page = ramp(t, open, 16);
  const drift = interpolate(t, [open, scene.start + scene.duration], [1, 1.03], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const frames = lineFrames(scene);
  const caption = scene.onScreenText[1];
  const dim = caption ? ramp(t, frames[1], 12) : 0;
  const mark = (text: string, at: number) => {
    const i = h2 ? text.toLowerCase().indexOf(h2.toLowerCase()) : -1;
    if (i < 0) return text;
    const a = ramp(t, at, 12);
    return (
      <>
        {text.slice(0, i)}
        <span style={{ background: `rgba(111,143,179,${0.35 * a})`, borderBottom: `4px solid rgba(111,143,179,${a})` }}>
          {text.slice(i, i + h2.length)}
        </span>
        {text.slice(i + h2.length)}
      </>
    );
  };
  return (
    <AbsoluteFill>
      {scene.kind === 'disclosures' ? <Thumbnails t={t} scene={scene} until={open} /> : null}
      <div
        style={{
          position: 'absolute',
          left: GUTTER + 60,
          top: 110,
          width: 1920 - 2 * GUTTER - 120,
          height: 760,
          borderRadius: 8,
          background: '#F4F1EA',
          color: '#1c1c1c',
          boxShadow: '0 40px 120px rgba(0,0,0,.6)',
          opacity: page * (1 - 0.55 * dim),
          transform: `scale(${page < 1 ? 0.9 + 0.1 * page : drift})`,
          transformOrigin: '50% 40%',
          padding: '54px 72px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 24,
            color: '#6b6b6b',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          {ex.doc} &middot; lines {ex.lines}
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 38, lineHeight: 1.45 }}>
          {mark(win.before, h2At)}{' '}
          {win.match ? (
            <span
              style={{
                background: `rgba(227,163,58,${0.3 * hl})`,
                borderBottom: `5px solid ${accent}`,
                borderBottomColor: `rgba(${accent === theme.amber ? '227,163,58' : '111,143,179'},${hl})`,
                fontWeight: 600,
              }}
            >
              {win.match}
            </span>
          ) : null}{' '}
          {mark(win.after, h2At)}
        </div>
      </div>
      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: GUTTER + 60,
            top: 470,
            width: 1920 - 2 * GUTTER - 120,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 54,
            color: theme.slate,
            opacity: dim,
            transform: `translateY(${(1 - dim) * 20}px)`,
            textShadow: '0 4px 30px rgba(0,0,0,.9)',
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** A grid of generic statement thumbnails tiling in with a counter, before the page opens. */
const Thumbnails: FC<{ t: number; scene: TimelineScene; until: number }> = ({ t, scene, until }) => {
  const n = Number(scene.options.count ?? 70);
  const cols = 14;
  const from = scene.start + 6;
  const perTile = Math.max(1, Math.floor((until - from - 20) / n));
  const shown = Math.min(n, Math.floor((t - from) / perTile));
  const fade = 1 - ramp(t, until, 12);
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: fade }}>
      {Array.from({ length: n }, (_, i) => {
        const x = GUTTER + (i % cols) * 120;
        const y = 150 + Math.floor(i / cols) * 150;
        const a = ramp(t, from + i * perTile, 8);
        return (
          <g key={i} transform={`translate(${x} ${y})`} opacity={a}>
            <rect width={96} height={124} rx={5} fill={theme.raised} stroke={theme.line} strokeWidth={2} />
            <BlurLines x={12} y={18} w={70} rows={7} gap={13} seed={i} />
          </g>
        );
      })}
      <text
        x={1920 - GUTTER}
        y={1080 - 100}
        textAnchor="end"
        fill={theme.fg}
        fontFamily={theme.sans}
        fontSize={120}
        fontWeight={700}
      >
        {shown}
      </text>
    </svg>
  );
};
