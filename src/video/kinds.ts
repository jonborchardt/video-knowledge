// Which storyboard scenes the renderer can draw. The mapping is closed and deterministic: a scene that matches no kind
// is reported with the reason, never replaced by a placeholder. Browser-safe.
import type { Scene } from '../lib/storyboard';

export const KINDS = ['phone', 'tree', 'quote', 'stacked-bar'] as const;
export type SceneKind = (typeof KINDS)[number];

/** Cues each kind must get from render.json; every other cue a component reads has a fallback. */
export const REQUIRED_CUES: Record<SceneKind, string[]> = {
  phone: [],
  tree: ['tier2'],
  quote: [],
  'stacked-bar': [],
};
export const SUPPORTED_ASSETS = new Set(['phone-ui', 'node-tree']);

export function kindOf(s: Pick<Scene, 'visual'>): SceneKind | null {
  const v = s.visual;
  const assets = v.assetIds ?? [];
  if (v.category === 'animation' && assets.includes('phone-ui')) return 'phone';
  if (v.category === 'diagram' && assets.includes('node-tree')) return 'tree';
  if (v.category === 'typography' && assets.length === 0 && v.onScreenText?.length) return 'quote';
  if (v.category === 'data-chart' && v.chart?.type === 'stacked-bar') return 'stacked-bar';
  return null;
}

/** Why a scene is unsupported, for the report. */
export function unsupportedWhy(s: Pick<Scene, 'id' | 'visual'>): string {
  const v = s.visual;
  const what = v.category === 'data-chart' ? `${v.category}/${v.chart?.type ?? 'no chart'}` : v.category;
  const assets = v.assetIds?.length ? ` with assets ${v.assetIds.join(', ')}` : '';
  return `${s.id}: no renderer for ${what}${assets}`;
}
