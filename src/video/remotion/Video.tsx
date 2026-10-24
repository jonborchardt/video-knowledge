import { type FC, useEffect, useLayoutEffect, useRef } from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { WIDTH, type Timeline, type TimelineScene } from '../types';
import { Citation } from './Citation';
import { FONT_FACES, fontCss } from './fonts';
import { Captions, PortraitBackdrop, PortraitBadge } from './Portrait';
import { SCENES } from './scenes';
import { easeOut, theme } from './theme';

const FADE = 8;
const TOL = 2; // px at full size

/** The first visible line of text that leaves the frame or runs into the citation block, or null. Opacity and
 *  overflow clipping are taken from the ancestors up to (not including) `root`, so a faded or clipped word is judged
 *  as the viewer sees it. Text in SVG is judged by its element's box, text in HTML by the glyphs' own box. */
export function misfit(root: HTMLElement, width = WIDTH): string | null {
  const frame = root.getBoundingClientRect();
  if (frame.width < 1) return null; // not laid out yet (the page is still mounting): nothing to judge
  const tol = (TOL * frame.width) / width;
  const cite = root.querySelector('[data-citation]')?.getBoundingClientRect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim();
    const el = n.parentElement;
    if (!text || !el) continue;
    let r: { left: number; top: number; right: number; bottom: number };
    if (el instanceof SVGElement) r = el.getBoundingClientRect();
    else {
      const range = document.createRange();
      range.selectNodeContents(n);
      r = range.getBoundingClientRect();
    }
    let alpha = 1;
    for (let a: Element | null = el; a && a !== root; a = a.parentElement) {
      const cs = getComputedStyle(a);
      alpha *= Number(cs.opacity);
      if (cs.visibility === 'hidden' || cs.display === 'none') alpha = 0;
      if (cs.overflow !== 'visible' && !(a instanceof SVGElement && a.tagName !== 'svg')) {
        const c = a.getBoundingClientRect();
        r = {
          left: Math.max(r.left, c.left),
          top: Math.max(r.top, c.top),
          right: Math.min(r.right, c.right),
          bottom: Math.min(r.bottom, c.bottom),
        };
      }
    }
    if (alpha < 0.05 || r.right - r.left < 1 || r.bottom - r.top < 1) continue;
    const k = width / frame.width; // report in frame pixels
    const at = `"${text.slice(0, 40)}" at x ${Math.round((r.left - frame.left) * k)}-${Math.round((r.right - frame.left) * k)}, y ${Math.round((r.top - frame.top) * k)}-${Math.round((r.bottom - frame.top) * k)}`;
    if (
      r.left < frame.left - tol ||
      r.top < frame.top - tol ||
      r.right > frame.right + tol ||
      r.bottom > frame.bottom + tol
    )
      return `${at} runs off the frame`;
    if (
      cite &&
      !el.closest('[data-citation]') &&
      r.left < cite.right - tol &&
      r.right > cite.left + tol &&
      r.top < cite.bottom - tol &&
      r.bottom > cite.top + tol
    )
      return `${at} runs into the citation`;
  }
  return null;
}

/** The camera, a scale about a point a little above centre: a slow push over the scene, a punch on each cue
 *  (in over 5 frames, back over 19), a zoom through on entry and a pull back on exit. Capped near 1.06 so the gutter
 *  and the citation stay on screen; the fit check judges the layout inside it. */
function camera(scene: TimelineScene, frame: number): number {
  const push = 0.03 * (frame / scene.duration);
  let punch = 0;
  for (const c of Object.values(scene.cues)) {
    const x = scene.start + frame - c;
    if (x >= 0 && x < 24) punch = Math.max(punch, x < 5 ? easeOut(x / 5) : 1 - easeOut((x - 5) / 19));
  }
  const enter = 0.04 * (1 - easeOut(frame / 14));
  const exit = -0.03 * easeOut((frame - (scene.duration - FADE)) / FADE);
  return 1 + push + 0.022 * punch + enter + exit;
}

/** One scene in its own time: a short fade in and out over the background, the citation overlay on top (a quote
 *  scene with one citation per line places its own); the camera moves both. Every frame is checked for
 *  text that does not fit, and a misfit fails the render: what is drawn must fit on the screen, the citation
 *  included. */
const SceneView: FC<{ scene: TimelineScene; short: Timeline['short'] }> = ({ scene, short }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bad = ref.current && misfit(ref.current, width);
    if (bad) throw new Error(`${scene.id} (${scene.kind}) frame ${frame}: ${bad}`);
  });
  const Component = SCENES[scene.kind];
  const opacity = interpolate(frame, [0, FADE, scene.duration - FADE, scene.duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ownCitations =
    scene.kind === 'quote' && scene.citations.length === scene.onScreenText.length && scene.onScreenText.length > 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill ref={ref} style={{ transform: `scale(${camera(scene, frame)})`, transformOrigin: '50% 40%' }}>
        <Component scene={scene} />
        {portrait ? <Captions scene={scene} /> : null}
        {ownCitations ? null : <Citation scene={scene} frame={scene.start + frame} />}
      </AbsoluteFill>
      {portrait && short ? <PortraitBadge short={short} /> : null}
    </AbsoluteFill>
  );
};

/** The pulse backdrop, in segment time so it flows across scene cuts: three soft colour fields drifting on slow
 *  loops over the ink, and a faint dot grid sliding up. */
const Backdrop: FC = () => {
  const f = useCurrentFrame() / 30;
  const blob = (color: string, x: number, y: number, r: number) =>
    `radial-gradient(circle ${r}px at ${x}% ${y}%, ${color}55, transparent 70%)`;
  return (
    <AbsoluteFill
      style={{
        background: [
          blob(theme.violet, 25 + 12 * Math.sin(f / 7), 30 + 14 * Math.cos(f / 9), 900),
          blob(theme.red, 80 + 10 * Math.cos(f / 8), 75 + 12 * Math.sin(f / 6), 750),
          blob(theme.slate, 60 + 18 * Math.sin(f / 11), 10 + 10 * Math.cos(f / 10), 650),
          theme.bg,
        ].join(', '),
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1.5px, transparent 1.5px)',
          backgroundSize: '48px 48px',
          backgroundPosition: `0 ${-(f * 12) % 48}px`,
        }}
      />
    </AbsoluteFill>
  );
};

/** The whole segment: scenes and their narration placed by the timeline's measured frames. The studio plays the
 *  narration from here; the renderer mutes it and lays one continuous track at assembly. */
export const Video: FC<Timeline> = (tl) => {
  const portrait = tl.height > tl.width;
  // the embedded brand faces: hold the render until the browser has them (a fallback face would shift every layout)
  useEffect(() => {
    const handle = delayRender('brand fonts');
    const families = [...new Set(FONT_FACES.map((f) => f.family))];
    Promise.all(families.map((f) => document.fonts.load(`16px "${f}"`)))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, []);
  return (
    <AbsoluteFill style={{ background: portrait ? '#172A45' : theme.bg }}>
      <style>{fontCss()}</style>
      {portrait ? <PortraitBackdrop /> : <Backdrop />}
      {tl.scenes.map((s) => (
        <Sequence key={s.id} name={s.id} from={s.start} durationInFrames={s.duration}>
          <SceneView scene={s} short={tl.short} />
        </Sequence>
      ))}
      {tl.scenes
        .flatMap((s) => s.sentences)
        .map((x) => (
          <Sequence key={x.id} name={`narration ${x.id}`} from={x.start} durationInFrames={x.duration}>
            <Audio src={staticFile(x.audio)} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
