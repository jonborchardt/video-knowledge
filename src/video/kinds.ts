// Which storyboard scenes the renderer can draw. The mapping is closed and deterministic: a scene that matches no kind is
// reported with the reason, never replaced by a placeholder. A generic kind follows from the storyboard category, chart
// type and registered assets; a bespoke kind (one scene's own diagram or animation) is named in render.json `kinds`,
// must belong to that video's registry (src/video/bespoke/) and must accept the scene's category. Browser-safe.
//
// One record per kind says everything about it: the component that draws it (a key of COMPONENTS, drawn by
// src/video/remotion/scenes/<component>.tsx, part of the render cache key), the categories it may be assigned to, and
// the rules that infer it or constrain it.
import type { Scene, VisualCategory } from '../lib/storyboard';
import type { COMPONENTS } from './remotion/scenes';
import { BESPOKE } from './bespoke';

export interface KindSpec {
  component: keyof typeof COMPONENTS;
  accepts: VisualCategory[]; // the storyboard categories it may draw
  assets?: string[]; // registered assets that infer this kind (generic kinds only)
  chart?: string; // the data-chart type that infers this kind (generic kinds only)
  cues?: string[]; // cues it must get from render.json; every other cue a component reads has a fallback
  percent?: boolean; // draws percentages: every point is a percent and the points total at most 100
  fadesOut?: boolean; // ends on an intentional fade to black, which QA's blank check allows at the end
}

export const GENERIC = {
  phone: { component: 'Phone', accepts: ['animation'], assets: ['phone-ui'] }, // a message arrives
  tree: { component: 'Tree', accepts: ['diagram'], assets: ['node-tree'], cues: ['tier2'] }, // YOU, what you sell, a second tier
  quote: { component: 'Quote', accepts: ['typography'] }, // quoted lines appear as spoken, one citation per line
  title: { component: 'Text', accepts: ['typography'] }, // one line, large
  question: { component: 'Text', accepts: ['typography'] }, // a question, typed on
  list: { component: 'Text', accepts: ['typography'] }, // lines build one per cue or sentence
  'evidence-cards': { component: 'EvidenceCards', accepts: ['diagram'], assets: ['evidence-cards'] }, // three source cards
  transition: { component: 'Transition', accepts: ['transition'] }, // split field, wipe
  disclosures: { component: 'Excerpt', accepts: ['document-excerpt'], assets: ['disclosure-thumbnails'] }, // thumbnails, one opens
  excerpt: { component: 'Excerpt', accepts: ['document-excerpt'] }, // the cited passage with the highlight
  'stat-tiles': { component: 'StatTiles', accepts: ['data-chart'], chart: 'stat-tiles' },
  'person-grid': { component: 'PersonGrid', accepts: ['diagram'], assets: ['person-grid'] }, // who leaves the table
  'rank-table': { component: 'RankTable', accepts: ['data-chart'], chart: 'table' }, // a rank table two ways
  'dot-plot': {
    component: 'DotPlot',
    accepts: ['data-chart'],
    chart: 'dot-plot',
    assets: ['dot-plot-601'],
    percent: true,
  },
  bar: { component: 'Bar', accepts: ['data-chart'], chart: 'bar' }, // horizontal bars, count points as dots
  'commission-icons': { component: 'CommissionIcons', accepts: ['diagram'], assets: ['commission-icons'] },
  waffle: { component: 'Waffle', accepts: ['data-chart'], chart: 'waffle' },
  'stacked-bar': { component: 'StackedBar', accepts: ['data-chart'], chart: 'stacked-bar', percent: true },
  // diagrams named per scene in render.json `kinds` (never inferred: they redraw a chart or list the storyboard typed)
  curve: { component: 'Curve', accepts: ['data-chart'] }, // a series over time drawn as a line, zooming to each point
  cohort: { component: 'Cohort', accepts: ['data-chart'] }, // 100 icons, each 1% of a group; a series puts them out
  columns: { component: 'Columns', accepts: ['data-chart'] }, // vertical columns rising on their cues
  funnel: { component: 'Funnel', accepts: ['data-chart'] }, // a shrinking series as stacked funnel bands
  gauge: { component: 'Gauge', accepts: ['data-chart'] }, // one percent as a dial, the needle sweeping to it
  dumbbell: { component: 'Dumbbell', accepts: ['data-chart'] }, // points in pairs, the gap between each pair drawn
  versus: { component: 'Versus', accepts: ['typography'] }, // two lines face off, split screen
  scorecard: { component: 'Scorecard', accepts: ['typography'] }, // "claim: verdict" lines, each stamped with a mark
  steps: { component: 'Steps', accepts: ['typography'] }, // numbered stops along a path that draws between them
  stamp: { component: 'Stamp', accepts: ['typography'] }, // one line slammed on as a rubber stamp
  choices: { component: 'Choices', accepts: ['typography'] }, // a question's alternatives as chips, each on its word
} as const satisfies Record<string, KindSpec>;

export type GenericKind = keyof typeof GENERIC;
export type BespokeKind = { [V in keyof typeof BESPOKE]: keyof (typeof BESPOKE)[V] }[keyof typeof BESPOKE];
export type SceneKind = GenericKind | BespokeKind;
export type KindRegistry = Readonly<Record<string, KindSpec>>;

/** Every kind any video registers, for the renderer: a scene's kind was already checked against its own video. */
export const ALL_KINDS: Record<SceneKind, KindSpec> = Object.assign({}, GENERIC, ...Object.values(BESPOKE));
/** The bespoke kinds registered for one video (<topic>/<story slug>); empty when it has none. */
export const bespokeFor = (videoKey: string): KindRegistry => (BESPOKE as Record<string, KindRegistry>)[videoKey] ?? {};

const GENERIC_SPECS: [GenericKind, KindSpec][] = Object.entries(GENERIC) as [GenericKind, KindSpec][];
export const SUPPORTED_ASSETS = new Set(GENERIC_SPECS.flatMap(([, k]) => k.assets ?? []));
/** The assets no renderer draws for a scene of this kind: a bespoke kind is the scene's own graphic and draws the
 *  assets the storyboard registered for it; a generic kind draws only the supported ones. */
export const unsupportedAssets = (kind: string, assets: string[]) =>
  Object.hasOwn(GENERIC, kind) ? assets.filter((a) => !SUPPORTED_ASSETS.has(a)) : [];

/** The kind for a scene: the render.json override when this video knows it and it accepts the category, else the
 *  generic inference. */
export function kindOf(s: Pick<Scene, 'visual'>, override?: string, bespoke: KindRegistry = {}): SceneKind | null {
  const v = s.visual;
  if (override) {
    const own = (r: KindRegistry) => (Object.hasOwn(r, override) ? r[override] : undefined);
    const spec = own(GENERIC) ?? own(bespoke);
    return spec?.accepts.includes(v.category) ? (override as SceneKind) : null;
  }
  for (const a of v.assetIds ?? []) {
    const hit = GENERIC_SPECS.find(([, k]) => k.assets?.includes(a) && k.accepts.includes(v.category));
    if (hit) return hit[0];
  }
  if (v.category === 'data-chart')
    return (v.chart?.type && GENERIC_SPECS.find(([, k]) => k.chart === v.chart!.type)?.[0]) || null;
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
  if (override)
    return `${s.id}: render.json names kind "${override}", which is unknown to this video or does not draw ${what}`;
  return `${s.id}: no renderer for ${what}${assets}; name a bespoke kind in render.json`;
}
