// Which storyboard scenes the renderer can draw. The mapping is closed and deterministic: a scene that matches no kind is
// reported with the reason, never replaced by a placeholder. A generic kind follows from the storyboard category, chart
// type and registered assets; a bespoke kind (one scene's own diagram or animation) is named in render.json `kinds` and
// must accept the scene's category. Browser-safe.
import type { Scene, VisualCategory } from '../lib/storyboard';

export const KINDS = [
  'phone', // animation + phone-ui: a message arrives
  'phone-reply', // the phone again, reply box open (bespoke)
  'phone-end', // the phone dims to black, end card line (bespoke)
  'tree', // diagram + node-tree: YOU, what you sell, a second tier
  'tree-coins', // three tiers, coins travelling up (bespoke)
  'tree-customer', // a quote, then the recruit as the customer (bespoke)
  'tree-base', // many tiers, red base, amber top, labels from on-screen text (bespoke)
  'quote', // typography: quoted lines appear as spoken, one citation per line
  'title', // typography: one line, large
  'question', // typography: a question, typed on
  'list', // typography: lines build one per cue or sentence
  'pair', // typography: two words with an arrow (bespoke)
  'evidence-cards', // diagram + evidence-cards: three source cards
  'transition', // split field, wipe
  'disclosures', // document-excerpt + disclosure-thumbnails: 70 thumbnails, one opens
  'excerpt', // document-excerpt: the cited passage with the highlight
  'stat-tiles', // data-chart/stat-tiles
  'fine-print', // push into unreadable fine print (bespoke)
  'person-grid', // diagram + person-grid: who leaves the table
  'waterfall', // paid out, expenses unknown, kept unknown (bespoke)
  'rank-table', // data-chart/table: a rank table two ways
  'dot-plot', // data-chart/dot-plot + dot-plot-601
  'bar', // data-chart/bar: horizontal bars, count points as dots
  'commission-icons', // diagram + commission-icons
  'waffle', // data-chart/waffle
  'pyramid', // levels overflowing the globe (bespoke)
  'three-measures', // data-chart/composite: three panels (bespoke)
  'base-rate', // data-chart/stacked-bar whose first two segments sum (bespoke)
  'closing', // data-chart/composite: ring, tile, three dots (bespoke)
  'stacked-bar', // data-chart/stacked-bar
] as const;
export type SceneKind = (typeof KINDS)[number];

/** The component file each kind is drawn by (src/video/remotion/scenes/<file>); part of the render cache key. */
export const COMPONENT_FILE: Record<SceneKind, string> = {
  phone: 'Phone.tsx',
  'phone-reply': 'Phone.tsx',
  'phone-end': 'Phone.tsx',
  tree: 'Tree.tsx',
  'tree-coins': 'Tree.tsx',
  'tree-customer': 'Tree.tsx',
  'tree-base': 'Tree.tsx',
  quote: 'Quote.tsx',
  title: 'Text.tsx',
  question: 'Text.tsx',
  list: 'Text.tsx',
  pair: 'Text.tsx',
  'evidence-cards': 'EvidenceCards.tsx',
  transition: 'Transition.tsx',
  disclosures: 'Excerpt.tsx',
  excerpt: 'Excerpt.tsx',
  'stat-tiles': 'StatTiles.tsx',
  'fine-print': 'FinePrint.tsx',
  'person-grid': 'PersonGrid.tsx',
  waterfall: 'Waterfall.tsx',
  'rank-table': 'RankTable.tsx',
  'dot-plot': 'DotPlot.tsx',
  bar: 'Bar.tsx',
  'commission-icons': 'CommissionIcons.tsx',
  waffle: 'Waffle.tsx',
  pyramid: 'Pyramid.tsx',
  'three-measures': 'Composite.tsx',
  'base-rate': 'StackedBar.tsx',
  closing: 'Composite.tsx',
  'stacked-bar': 'StackedBar.tsx',
};

/** The storyboard categories a kind may be assigned to through render.json. */
export const ACCEPTS: Record<SceneKind, VisualCategory[]> = {
  phone: ['animation'],
  'phone-reply': ['animation'],
  'phone-end': ['animation'],
  tree: ['diagram'],
  'tree-coins': ['diagram'],
  'tree-customer': ['diagram'],
  'tree-base': ['diagram'],
  quote: ['typography'],
  title: ['typography'],
  question: ['typography'],
  list: ['typography'],
  pair: ['typography'],
  'evidence-cards': ['diagram'],
  transition: ['transition'],
  disclosures: ['document-excerpt'],
  excerpt: ['document-excerpt'],
  'stat-tiles': ['data-chart'],
  'fine-print': ['animation'],
  'person-grid': ['diagram'],
  waterfall: ['diagram'],
  'rank-table': ['data-chart'],
  'dot-plot': ['data-chart'],
  bar: ['data-chart'],
  'commission-icons': ['diagram'],
  waffle: ['data-chart'],
  pyramid: ['animation'],
  'three-measures': ['data-chart'],
  'base-rate': ['data-chart'],
  closing: ['data-chart'],
  'stacked-bar': ['data-chart'],
};

/** Cues each kind must get from render.json; every other cue a component reads has a fallback. */
export const REQUIRED_CUES: Partial<Record<SceneKind, string[]>> = { tree: ['tier2'] };
export const SUPPORTED_ASSETS = new Set([
  'phone-ui',
  'node-tree',
  'evidence-cards',
  'disclosure-thumbnails',
  'person-grid',
  'dot-plot-601',
  'commission-icons',
]);

const ASSET_KIND: Record<string, SceneKind> = {
  'phone-ui': 'phone',
  'node-tree': 'tree',
  'evidence-cards': 'evidence-cards',
  'disclosure-thumbnails': 'disclosures',
  'person-grid': 'person-grid',
  'dot-plot-601': 'dot-plot',
  'commission-icons': 'commission-icons',
};
const CHART_KIND: Record<string, SceneKind> = {
  'stacked-bar': 'stacked-bar',
  bar: 'bar',
  'stat-tiles': 'stat-tiles',
  waffle: 'waffle',
  table: 'rank-table',
  'dot-plot': 'dot-plot',
};

/** The kind for a scene: the render.json override when it accepts the category, else the generic inference. */
export function kindOf(s: Pick<Scene, 'visual'>, override?: SceneKind): SceneKind | null {
  const v = s.visual;
  if (override) return ACCEPTS[override]?.includes(v.category) ? override : null;
  for (const a of v.assetIds ?? [])
    if (ASSET_KIND[a] && ACCEPTS[ASSET_KIND[a]].includes(v.category)) return ASSET_KIND[a];
  if (v.category === 'data-chart') return CHART_KIND[v.chart?.type ?? ''] ?? null;
  if (v.category === 'document-excerpt') return v.excerpt ? 'excerpt' : null;
  if (v.category === 'transition') return 'transition';
  if (v.category === 'typography') {
    const lines = v.onScreenText ?? [];
    if (!lines.length) return null;
    if (lines.every((l) => /^["“]/.test(l))) return 'quote';
    if (lines.length === 1) return /\?\s*$/.test(lines[0]) ? 'question' : 'title';
    return 'list';
  }
  return null;
}

/** Why a scene is unsupported, for the report. */
export function unsupportedWhy(s: Pick<Scene, 'id' | 'visual'>, override?: string): string {
  const v = s.visual;
  const what = v.category === 'data-chart' ? `${v.category}/${v.chart?.type ?? 'no chart'}` : v.category;
  const assets = v.assetIds?.length ? ` with assets ${v.assetIds.join(', ')}` : '';
  if (override) return `${s.id}: render.json names kind "${override}", which is unknown or does not draw ${what}`;
  return `${s.id}: no renderer for ${what}${assets}; name a bespoke kind in render.json`;
}
