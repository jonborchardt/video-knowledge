// Storyboard: scenes over the validated script. The planner agent (scripts/briefs/storyboard.md) writes
// <topic>/scripts/<slug>/storyboard.json with scenes that reference sentence ids and describe visuals; this module fills
// in the narration from script.json (so the storyboard cannot reword it), computes timing from the narration speed,
// and checks that every chart figure and on-screen citation comes from a passage in the evidence package.
import { type PassageReader } from './evidence';
import { hasFigure, nums, spokenWords } from './numbers';
import {
  type EvidencePackage,
  type Issue,
  type Script,
  type ScriptValidation,
  type Severity,
  scriptFingerprint,
  sentences,
  words,
} from './script';

export const VISUALS = [
  'data-chart',
  'diagram',
  'animation',
  'typography',
  'document-excerpt',
  'image',
  'footage',
  'transition',
] as const;
export type VisualCategory = (typeof VISUALS)[number];

// What a renderer can draw without reading English: a closed set of chart types and numeric points.
export const CHART_TYPES = ['bar', 'stacked-bar', 'dot-plot', 'waffle', 'table', 'stat-tiles'] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export type Unit = 'percent' | 'usd' | 'count' | 'ratio';
export interface ChartPoint {
  label: string;
  value: number; // the number to draw; for 'ratio' the denominator ("1 in 238" -> 238)
  unit: Unit;
  display: string; // as the passage states it ("$1,000 or less", "fourteen percent"); its figures must be in the passage
  qualifier?: 'lt' | 'lte' | 'gt' | 'gte' | 'about'; // "less than $84" -> lt
  cite: string; // the passage in the evidence package the point comes from
}
export interface ChartSpec {
  type: ChartType;
  title?: string;
  points: ChartPoint[];
  note?: string; // what the chart must not imply (e.g. "no distribution below $1,000 is known")
}
export interface ScenePlan {
  id: string;
  sentences: string[]; // sentence ids, in script order
  purpose: string;
  visual: {
    category: VisualCategory;
    description: string; // concrete enough to build without redesigning the narrative
    onScreenText?: string[];
    chart?: ChartSpec;
    excerpt?: { cite: string; highlight?: string }; // document-excerpt: the passage to show and the words to mark
    assetIds?: string[]; // ids in StoryboardPlan.assets: what has to be made or found for this scene
  };
  citations?: { label: string; cite?: string; source?: string }[]; // shown on screen, tied to this scene's claim
  direction?: string; // transition, animation, timing guidance
  pauseSeconds?: number; // intentional silence added to the narration time
  narration?: string; // optional: if present it must equal the script's words exactly
}
// Required assets, registered once and referenced by id, kept apart from the prose guidance in visual.description.
export type AssetKind = 'component' | 'animation' | 'image' | 'document-render';
export interface Asset {
  kind: AssetKind;
  description: string;
}
export interface StoryboardPlan {
  topic: string;
  story: string;
  scriptFingerprint: string; // of the script the scenes were planned against
  generation: { model: string; brief: string; date: string; notes?: string };
  assets: Record<string, Asset>;
  scenes: ScenePlan[];
}
/** One narration sentence on the timeline, in absolute seconds from the start of the video. */
export interface SentenceTiming {
  id: string;
  start: number;
  duration: number;
  end: number;
}
export interface Scene extends Omit<ScenePlan, 'narration'> {
  order: number;
  narration: string;
  words: number;
  spokenWords: number; // numeral-aware (src/lib/numbers.ts spokenWords); what the timing is computed from
  timing: SentenceTiming[]; // one entry per sentence in scene order; the scene's pause follows the last
  start: number; // seconds
  duration: number; // sum of the sentence durations plus pauseSeconds
  end: number;
}
export interface Storyboard {
  topic: string;
  story: string;
  title: string;
  scriptFingerprint: string;
  scriptStatus: string;
  wordsPerMinute: number;
  runtime: number; // seconds, including pauses
  generation: StoryboardPlan['generation'];
  assets: Record<string, Asset>;
  status: 'ok' | 'blocked';
  issues: Issue[];
  scenes: Scene[];
}

export function buildStoryboard(
  plan: StoryboardPlan,
  script: Script,
  v: ScriptValidation,
  pkg: EvidencePackage,
  read: PassageReader,
): Storyboard {
  const issues: Issue[] = [];
  const issue = (scene: string, category: string, severity: Severity, explanation: string) =>
    issues.push({ sentence: scene, category, severity, explanation, by: 'deterministic' });
  const wpm = v.wordsPerMinute;
  const all = sentences(script);
  const order = new Map(all.map((s, i) => [s.id, i]));
  const text = new Map(all.map((s) => [s.id, s.text]));
  const fp = scriptFingerprint(script);
  if (plan.scriptFingerprint !== fp)
    issue(
      '-',
      'stale-script',
      'blocking',
      `the storyboard was planned against script ${plan.scriptFingerprint}; the script is now ${fp}`,
    );
  if (v.status === 'blocked')
    issue('-', 'script-blocked', 'blocking', 'the script has open blocking issues; storyboard it after revision');
  if (v.packageFingerprint !== pkg.fingerprint)
    issue(
      '-',
      'stale-validation',
      'blocking',
      `the validation was run against evidence package ${v.packageFingerprint ?? '(none)'}; the package is now ${pkg.fingerprint}; re-run validate`,
    );
  const known = new Set(pkg.documents.flatMap((d) => d.cites));
  const assets = plan.assets ?? {};
  const usedAssets = new Set<string>();
  const sourceIds = new Set(pkg.claims.flatMap((c) => c.statements.map((s) => s.source)));

  const used = new Map<string, string>();
  let cursor = -1;
  let t = 0;
  const scenes: Scene[] = plan.scenes.map((p, i) => {
    const ids = p.sentences ?? [];
    for (const id of ids) {
      if (!order.has(id)) issue(p.id, 'unknown-sentence', 'blocking', `sentence ${id} is not in the script`);
      else {
        if (used.has(id))
          issue(p.id, 'duplicate-sentence', 'blocking', `sentence ${id} is already in scene ${used.get(id)}`);
        used.set(id, p.id);
        const k = order.get(id)!;
        if (k <= cursor)
          issue(
            p.id,
            'out-of-order',
            'blocking',
            `sentence ${id} comes before the previous scene's narration in the script`,
          );
        cursor = Math.max(cursor, k);
      }
    }
    const narration = ids.map((id) => text.get(id) ?? '').join(' ');
    if (p.narration !== undefined && p.narration.replace(/\s+/g, ' ').trim() !== narration)
      issue(
        p.id,
        'reworded-narration',
        'blocking',
        'the scene narration differs from the script; the script is the only source of words',
      );
    if (!(VISUALS as readonly string[]).includes(p.visual?.category))
      issue(p.id, 'visual', 'blocking', `unknown visual category "${p.visual?.category}"`);
    if (!p.visual?.description) issue(p.id, 'visual', 'blocking', 'no visual description');
    if (p.visual && 'assets' in p.visual)
      issue(p.id, 'asset', 'blocking', 'visual.assets was replaced by visual.assetIds and a top-level assets registry');
    for (const id of p.visual?.assetIds ?? []) {
      const a = assets[id];
      if (!a) issue(p.id, 'asset', 'blocking', `asset "${id}" is not in the assets registry`);
      else {
        usedAssets.add(id);
        if (a.kind === 'document-render' && !p.visual.excerpt)
          issue(p.id, 'asset', 'warning', `asset "${id}" renders a document but the scene names no excerpt to render`);
      }
    }
    for (const c of p.citations ?? []) {
      if (c.cite && !known.has(c.cite))
        issue(p.id, 'citation', 'blocking', `on-screen citation ${c.cite} is not a passage in the evidence package`);
      if (c.source && !sourceIds.has(c.source))
        issue(p.id, 'citation', 'blocking', `on-screen source ${c.source} is not among the story's sources`);
      if (!c.cite && !c.source) issue(p.id, 'citation', 'blocking', `citation "${c.label}" names no passage or source`);
    }
    if (p.visual?.chart) {
      const c = p.visual.chart;
      if (!(CHART_TYPES as readonly string[]).includes(c.type))
        issue(p.id, 'chart', 'blocking', `unknown chart type "${c.type}"; one of ${CHART_TYPES.join(', ')}`);
      if ('series' in c) issue(p.id, 'chart', 'blocking', 'series was replaced by points (value, unit, display, cite)');
      if (!c.points?.length) issue(p.id, 'chart', 'blocking', 'a chart with no points');
      for (const pt of c.points ?? []) {
        const bad = (why: string) => issue(p.id, 'chart-data', 'blocking', `chart point "${pt.label}": ${why}`);
        if (!known.has(pt.cite)) {
          issue(
            p.id,
            'chart',
            'blocking',
            `chart point "${pt.label}" cites ${pt.cite}, which is not in the evidence package`,
          );
          continue;
        }
        const passage = read(pt.cite);
        const figures = nums(pt.display ?? '');
        if (typeof pt.value !== 'number' || !Number.isFinite(pt.value)) bad('value is not a number');
        else if (pt.unit === 'ratio') {
          if (figures.length < 2 || Number(figures[1]) !== pt.value)
            bad(
              `a ratio displays two figures ("1 in 238") and value is the second; display "${pt.display}", value ${pt.value}`,
            );
        } else if (!figures.some((n) => Number(n) === pt.value))
          bad(`display "${pt.display}" does not state the value ${pt.value}`);
        if (pt.unit === 'percent' && (pt.value < 0 || pt.value > 100)) bad(`${pt.value} is not a percentage`);
        if (!['percent', 'usd', 'count', 'ratio'].includes(pt.unit)) bad(`unknown unit "${pt.unit}"`);
        for (const n of figures) if (passage === null || !hasFigure(passage, n)) bad(`"${n}" is not in ${pt.cite}`);
        for (const n of nums(pt.label ?? ''))
          if (passage === null || !hasFigure(passage, n)) bad(`label figure "${n}" is not in ${pt.cite}`);
      }
      // The title and note are drawn too: their figures must be in one of the points' passages.
      const chartText = (c.points ?? [])
        .filter((pt) => known.has(pt.cite))
        .map((pt) => read(pt.cite) ?? '')
        .join('\n');
      for (const [what, text] of [
        ['title', c.title],
        ['note', c.note],
      ] as const)
        for (const n of nums(text ?? ''))
          if (!hasFigure(chartText, n))
            issue(
              p.id,
              'chart-data',
              'blocking',
              `chart ${what} figure "${n}" is not in a cited passage of this chart`,
            );
    }
    if (p.visual?.excerpt) {
      const passage = known.has(p.visual.excerpt.cite) ? read(p.visual.excerpt.cite) : null;
      if (passage === null)
        issue(p.id, 'excerpt', 'blocking', `excerpt ${p.visual.excerpt.cite} is not a passage in the evidence package`);
      else if (
        p.visual.excerpt.highlight &&
        !passage
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .includes(p.visual.excerpt.highlight.replace(/\s+/g, ' ').toLowerCase())
      )
        issue(
          p.id,
          'excerpt',
          'blocking',
          `the highlight "${p.visual.excerpt.highlight}" is not in ${p.visual.excerpt.cite}`,
        );
    }
    // On-screen text may only carry figures the narration or a cited passage carries.
    const citedText = [
      ...(p.citations ?? []).map((c) => c.cite),
      ...(p.visual?.chart?.points ?? []).map((s) => s.cite),
      p.visual?.excerpt?.cite,
    ]
      .filter((c): c is string => !!c && known.has(c))
      .map((c) => read(c) ?? '')
      .join('\n');
    for (const line of p.visual?.onScreenText ?? [])
      for (const n of nums(line))
        if (!hasFigure(narration, n) && !hasFigure(citedText, n))
          issue(
            p.id,
            'on-screen-figure',
            'blocking',
            `on-screen text figure "${n}" is in neither the narration nor a cited passage of this scene`,
          );
    // Timing: each sentence by its spoken length at the narration speed, tiled from the scene start; the pause follows.
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const start = r2(t);
    let cursorT = t;
    const timing: SentenceTiming[] = ids
      .filter((id) => text.has(id))
      .map((id) => {
        const d = r2((spokenWords(text.get(id)!) / wpm) * 60);
        const entry = { id, start: r2(cursorT), duration: d, end: r2(cursorT + d) };
        cursorT += d;
        return entry;
      });
    const duration = r2(timing.reduce((n, x) => n + x.duration, 0) + (p.pauseSeconds ?? 0));
    // A filled storyboard is a valid plan: strip every derived field so rebuilding it is byte-for-byte idempotent.
    const {
      narration: _n,
      order: _o,
      words: _w,
      spokenWords: _s,
      timing: _t,
      start: _st,
      duration: _d,
      end: _e,
      ...rest
    } = p as ScenePlan & Partial<Scene>;
    void [_n, _o, _w, _s, _t, _st, _d, _e];
    const scene: Scene = {
      ...rest,
      order: i + 1,
      narration,
      words: words(narration),
      spokenWords: spokenWords(narration),
      timing,
      start,
      duration,
      end: r2(t + duration),
    };
    t += duration;
    return scene;
  });
  for (const s of all)
    if (!used.has(s.id)) issue('-', 'missing-sentence', 'blocking', `sentence ${s.id} is in no scene`);
  const dup = new Set<string>();
  for (const s of scenes) {
    if (dup.has(s.id)) issue(s.id, 'duplicate-scene', 'blocking', `scene id ${s.id} repeats`);
    dup.add(s.id);
  }
  for (const id of Object.keys(assets))
    if (!usedAssets.has(id)) issue('-', 'asset', 'warning', `asset "${id}" is registered but no scene uses it`);
  const chartScenes = scenes.filter(
    (s) => s.visual?.category === 'data-chart' || s.visual?.category === 'diagram',
  ).length;
  if (scenes.length && chartScenes === 0)
    issue('-', 'variety', 'warning', 'no chart or diagram scene; the evidence is numeric');
  const images = scenes.filter((s) => s.visual?.category === 'image').length;
  if (scenes.length && images / scenes.length > 0.5)
    issue(
      '-',
      'variety',
      'warning',
      `${images} of ${scenes.length} scenes are images; prefer programmatic graphics where the evidence is numeric`,
    );
  return {
    topic: plan.topic,
    story: plan.story,
    title: script.title,
    scriptFingerprint: fp,
    scriptStatus: v.status,
    wordsPerMinute: wpm,
    runtime: Math.round(t * 10) / 10,
    generation: plan.generation,
    assets,
    status: issues.some((i) => i.severity === 'blocking') ? 'blocked' : 'ok',
    issues,
    scenes,
  };
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export function renderStoryboardMd(sb: Storyboard, pkg: EvidencePackage, read: PassageReader): string {
  const name = new Map(pkg.documents.map((d) => [d.file, d.name]));
  const label = (cite: string) =>
    `${name.get(cite.split('#')[0]) ?? cite.split('#')[0]}, lines ${cite.split('#L')[1] ?? ''}`;
  const out = [
    `# Storyboard: ${sb.title}`,
    '',
    `${sb.scenes.length} scenes, ${mmss(sb.runtime)} at ${sb.wordsPerMinute} wpm including pauses. Script ${sb.scriptFingerprint} (${sb.scriptStatus}). Storyboard status: **${sb.status}**.`,
    '',
  ];
  if (sb.issues.length) {
    out.push('## Issues', '');
    for (const i of sb.issues) out.push(`- **${i.severity}** ${i.sentence} ${i.category}: ${i.explanation}`);
    out.push('');
  }
  const assets = Object.entries(sb.assets ?? {});
  if (assets.length) {
    out.push('## Assets', '');
    for (const [id, a] of assets) out.push(`- \`${id}\` (${a.kind}): ${a.description}`);
    out.push('');
  }
  for (const s of sb.scenes) {
    out.push(
      `## ${s.order}. ${s.id} (${mmss(s.start)} to ${mmss(s.end)}, ${s.duration}s${s.pauseSeconds ? ` incl. ${s.pauseSeconds}s pause` : ''})`,
      '',
    );
    out.push(`**Purpose.** ${s.purpose}`, '');
    out.push(`**Narration** (${s.sentences.join(', ')}). ${s.narration}`, '');
    out.push(`**Visual** (${s.visual.category}). ${s.visual.description}`, '');
    if (s.visual.onScreenText?.length)
      out.push(`**On screen.** ${s.visual.onScreenText.map((t) => `"${t}"`).join(' / ')}`, '');
    if (s.visual.chart) {
      const c = s.visual.chart;
      out.push(`**Chart** (${c.type}${c.title ? `: ${c.title}` : ''}).`, '');
      out.push('| Label | Display | Value | Unit | Source |', '|---|---|---|---|---|');
      for (const x of c.points ?? [])
        out.push(
          `| ${x.label} | ${x.display} | ${x.qualifier ? `${x.qualifier} ` : ''}${x.value} | ${x.unit} | ${label(x.cite)} |`,
        );
      out.push('');
      if (c.note) out.push(`Note: ${c.note}`, '');
    }
    if (s.visual.excerpt) {
      const p = read(s.visual.excerpt.cite);
      out.push(
        `**Excerpt** from ${label(s.visual.excerpt.cite)}${s.visual.excerpt.highlight ? `, highlighting "${s.visual.excerpt.highlight}"` : ''}:`,
        '',
      );
      out.push(...(p ?? '(passage not found)').split('\n').map((l) => `> ${l}`), '');
    }
    if (s.visual.assetIds?.length) out.push(`**Assets.** ${s.visual.assetIds.map((id) => `\`${id}\``).join(', ')}`, '');
    if (s.citations?.length)
      out.push(
        `**On-screen citations.** ${s.citations.map((c) => `${c.label}${c.cite ? ` (${label(c.cite)})` : ''}`).join('; ')}`,
        '',
      );
    if (s.direction) out.push(`**Direction.** ${s.direction}`, '');
  }
  return out.join('\n');
}
