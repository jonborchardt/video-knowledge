// The look a build is drawn with: the owning institution's kit palette, the kit cards scenes draw and the theme that
// fills its roles. The timeline records its fingerprint and the board compares it with the current one, so a packaged
// build drawn with an older kit or theme is re-rendered (video final) before anyone approves it. Read by path: the
// library never imports the video layer. Renderer code is not part of the look (the chunk cache re-renders an edited
// scene on the next final). ponytail: add the shared Remotion files only if a code change ever ships unnoticed.
import { join } from 'node:path';
import { commissionKey, commissionOf } from '../config/site';
import type { BuildSummary } from './build-report';
import { fileSha, readJson, ROOT, sha } from './io';

/** The kit folder a topic's videos draw from: its institution's, or the Commonwealth's when none claims it. */
export const brandKey = (topic: string): string => {
  const c = commissionOf(topic);
  return c ? commissionKey(c) : 'cor';
};

/** Every kit slot a scene can draw (kitSlots in src/video/render.ts; a test keeps the two in step). */
export const LOOK_SLOTS = ['close-card', 'endscreen-subscribe', 'seal', 'lockup-horizontal-ground'] as const;
export const THEME_FILE = 'src/video/remotion/theme.ts';

export interface LookPalette {
  ground: string;
  accent: string;
  paper: string;
  ink: string;
}
/** The four colour roles of the topic's kit, or null when `npm run brand` has not written it. */
export function kitPaletteOf(topic: string, root = ROOT): LookPalette | null {
  const kit = readJson<{ palette?: LookPalette }>(join(root, 'brand', brandKey(topic), 'kit.json'));
  if (!kit?.palette) return null;
  const { ground, accent, paper, ink } = kit.palette;
  return { ground, accent, paper, ink };
}

/** The look's fingerprint: only the palette roles, the slot SVGs and theme.ts count, never the rest of the kit. */
export function lookFingerprint(topic: string, root = ROOT): string {
  const brand = brandKey(topic);
  let palette: LookPalette | 'missing';
  try {
    palette = kitPaletteOf(topic, root) ?? 'missing';
  } catch {
    palette = 'missing'; // an unreadable kit.json never throws on the board
  }
  return sha(
    JSON.stringify({
      brand,
      palette,
      slots: LOOK_SLOTS.map((s) => fileSha(join(root, 'brand', brand, `${s}.svg`))),
      theme: fileSha(join(root, THEME_FILE)),
    }),
  );
}

/** Why a build's look is not the current one, or null when it is (or there is no build). */
export function lookStale(vr: Pick<BuildSummary, 'fingerprints'> | null, topic: string, root = ROOT): string | null {
  if (!vr) return null;
  const now = lookFingerprint(topic, root);
  const old = vr.fingerprints.look;
  if (old === now) return null;
  return old
    ? `rendered with look ${old}; the kit and theme are now ${now}`
    : 'rendered before builds recorded their look (kit palette, kit cards, theme): re-render it';
}
