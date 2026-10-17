// Storyboard: scenes over the validated script. The planner agent (scripts/briefs/storyboard.md) writes
// <topic>/scripts/<slug>/storyboard.json with scenes that reference sentence ids and describe visuals; this module fills
// in the narration from script.json (so the storyboard cannot reword it), computes timing from the narration speed,
// and checks that every chart figure and on-screen citation comes from a passage in the evidence package.
import { type PassageReader } from './evidence';
import { hasFigure, nums } from './numbers';
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

export interface ChartSpec {
  type: string; // bar, stacked-bar, waterfall, table, ...
  title?: string;
  series: { label: string; value: string; cite: string }[]; // every value must be in the cited passage
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
    assets?: string[]; // what has to be made or found
  };
  citations?: { label: string; cite?: string; source?: string }[]; // shown on screen, tied to this scene's claim
  direction?: string; // transition, animation, timing guidance
  pauseSeconds?: number; // intentional silence added to the narration time
  narration?: string; // optional: if present it must equal the script's words exactly
}
export interface StoryboardPlan {
  topic: string;
  story: string;
  scriptFingerprint: string; // of the script the scenes were planned against
  generation: { model: string; brief: string; date: string; notes?: string };
  scenes: ScenePlan[];
}
export interface Scene extends Omit<ScenePlan, 'narration'> {
  order: number;
  narration: string;
  words: number;
  start: number; // seconds
  duration: number;
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
  const known = new Set(pkg.documents.flatMap((d) => d.cites));
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
    for (const c of p.citations ?? []) {
      if (c.cite && !known.has(c.cite))
        issue(p.id, 'citation', 'blocking', `on-screen citation ${c.cite} is not a passage in the evidence package`);
      if (c.source && !sourceIds.has(c.source))
        issue(p.id, 'citation', 'blocking', `on-screen source ${c.source} is not among the story's sources`);
      if (!c.cite && !c.source) issue(p.id, 'citation', 'blocking', `citation "${c.label}" names no passage or source`);
    }
    if (p.visual?.chart) {
      if (!p.visual.chart.series?.length) issue(p.id, 'chart', 'blocking', 'a chart with no series');
      for (const s of p.visual.chart.series ?? []) {
        if (!known.has(s.cite))
          issue(
            p.id,
            'chart',
            'blocking',
            `chart value "${s.value}" cites ${s.cite}, which is not in the evidence package`,
          );
        else {
          const passage = read(s.cite);
          for (const n of nums(s.value))
            if (passage === null || !hasFigure(passage, n))
              issue(p.id, 'chart-data', 'blocking', `chart value "${n}" is not in ${s.cite}`);
        }
      }
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
      ...(p.visual?.chart?.series ?? []).map((s) => s.cite),
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
    const w = words(narration);
    const duration = Math.round(((w / wpm) * 60 + (p.pauseSeconds ?? 0)) * 10) / 10;
    const { narration: _drop, ...rest } = p;
    void _drop;
    const scene: Scene = {
      ...rest,
      order: i + 1,
      narration,
      words: w,
      start: Math.round(t * 10) / 10,
      duration,
      end: Math.round((t + duration) * 10) / 10,
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
      out.push('| Label | Value | Source |', '|---|---|---|');
      for (const x of c.series) out.push(`| ${x.label} | ${x.value} | ${label(x.cite)} |`);
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
    if (s.visual.assets?.length) out.push(`**Assets.** ${s.visual.assets.join('; ')}`, '');
    if (s.citations?.length)
      out.push(
        `**On-screen citations.** ${s.citations.map((c) => `${c.label}${c.cite ? ` (${label(c.cite)})` : ''}`).join('; ')}`,
        '',
      );
    if (s.direction) out.push(`**Direction.** ${s.direction}`, '');
  }
  return out.join('\n');
}
