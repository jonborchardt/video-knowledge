// Segment selection: the storyboard scenes to render, checked against the validated script and the release before any
// audio or frame is produced. Fails closed: an unsupported scene, a cue on a word outside its scene, a sentence the
// validation did not approve, or a chart the renderer cannot draw faithfully is a problem, never a substitution.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storyboardFingerprint } from '../shared/release-check';
import { validationFingerprint } from '../shared/sentence-validation';
import { scriptFingerprint, sentenceFingerprint, sentences } from '../shared/sentences';
import { FILES, scriptDir, storySlug, readJson, ROOT } from '../shared/io';
import type { EvidencePackage, Release, Script, ScriptValidation } from '../shared/types';
import type { Scene, Storyboard } from '../lib/storyboard';
import {
  type KindRegistry,
  type SceneKind,
  bespokeFor,
  kindOf,
  registryFor,
  unsupportedAssets,
  unsupportedWhy,
} from './kinds';
import { VIDEO_DIR, VIDEO_FILES } from './files';
import type { Citation, RenderConfig } from './types';

export interface SegmentInputs {
  script: Script;
  storyboard: Storyboard;
  validation: ScriptValidation;
  release: Release | null;
  config: RenderConfig;
  pkg: EvidencePackage;
}
export interface SegmentSentence {
  id: string;
  text: string;
  fingerprint: string;
  scene: string;
}
export interface SegmentScene {
  scene: Scene;
  kind: SceneKind;
  citations: Citation[];
}
export interface Segment extends SegmentInputs {
  scenes: SegmentScene[];
  sentences: SegmentSentence[];
  fingerprints: { script: string; storyboard: string };
  problems: string[];
}

/** Resolve an on-screen citation to viewer-facing detail from the evidence package. */
export function citationDetail(c: NonNullable<Scene['citations']>[number], pkg: EvidencePackage): string | null {
  if (c.cite) {
    const [file, anchor] = c.cite.split('#');
    const doc = pkg.documents.find((d) => d.file === file);
    if (!doc) return null;
    return `${doc.name} (${file.split('/').pop()}, lines ${(anchor ?? '').replace(/L/g, '')})`;
  }
  if (c.source) {
    const st = pkg.claims.flatMap((x) => x.statements).find((s) => s.source === c.source);
    if (!st) return null;
    return `${st.channel}: "${st.title}" ${st.href.replace(/^https?:\/\/(www\.)?/, '')}`;
  }
  return null;
}

/** `bespoke` is the video's own kinds; by default the registry entry for <topic>/<story slug>. */
export function checkSegment(
  inp: SegmentInputs,
  bespoke: KindRegistry = bespokeFor(`${inp.script.topic}/${storySlug(inp.script.story)}`),
): Segment {
  const { script, storyboard, validation, release, config, pkg } = inp;
  const generic = registryFor(pkg); // a Short draws with the portrait registry
  const specs: KindRegistry = { ...generic, ...bespoke };
  const problems: string[] = [];
  const bad = (p: string) => problems.push(p);
  const fp = { script: scriptFingerprint(script), storyboard: storyboardFingerprint(storyboard) };

  if (validation.status !== 'passed') bad(`validation is ${validation.status}, not passed`);
  if (storyboard.status !== 'ok') bad(`storyboard is ${storyboard.status}, not ok`);
  if (storyboard.scriptFingerprint !== fp.script)
    bad(`storyboard was built against script ${storyboard.scriptFingerprint}; the script is ${fp.script}`);
  if (validation.scriptFingerprint !== fp.script)
    bad(`validation is for script ${validation.scriptFingerprint}; the script is ${fp.script}`);
  if (release) {
    if (release.fingerprints.script !== fp.script) bad(`release approved script ${release.fingerprints.script}`);
    if (release.fingerprints.storyboard !== fp.storyboard)
      bad(`release approved storyboard ${release.fingerprints.storyboard}; it is now ${fp.storyboard}`);
    const vfp = validationFingerprint(validation);
    if (release.fingerprints.validation !== vfp) bad(`release approved validation ${release.fingerprints.validation}`);
  }

  // The selection: known, contiguous, in order.
  if (!config.scenes?.length) bad('render.json names no scenes');
  const index = new Map(storyboard.scenes.map((s, i) => [s.id, i]));
  const idx = (config.scenes ?? []).map((id) => index.get(id));
  idx.forEach((i, k) => {
    if (i === undefined) bad(`scene ${config.scenes[k]} is not in the storyboard`);
    else if (k > 0 && idx[k - 1] !== undefined && i !== idx[k - 1]! + 1)
      bad(`scenes must be contiguous in storyboard order: ${config.scenes[k - 1]} then ${config.scenes[k]}`);
  });
  const selected = idx.filter((i): i is number => i !== undefined).map((i) => storyboard.scenes[i]);
  for (const id of Object.keys(config.kinds ?? {}))
    if (!index.has(id)) bad(`render.json kinds names scene ${id}, which is not in the storyboard`);

  // Sentences: approved by the validation, text unchanged.
  const byId = new Map(sentences(script).map((s) => [s.id, s]));
  const vById = new Map(validation.sentences.map((s) => [s.id, s]));
  const known = new Set(pkg.documents.flatMap((d) => d.cites));
  const out: SegmentSentence[] = [];
  const scenes: SegmentScene[] = [];
  for (const scene of selected) {
    for (const id of scene.sentences) {
      const s = byId.get(id);
      const v = vById.get(id);
      if (!s) {
        bad(`${scene.id}: sentence ${id} is not in the script`);
        continue;
      }
      if (!v || v.status !== 'verified' || !v.approved) bad(`${scene.id}: sentence ${id} is not verified and approved`);
      else if (v.fingerprint !== sentenceFingerprint(s)) bad(`${scene.id}: sentence ${id} changed since validation`);
      out.push({ id, text: s.text, fingerprint: sentenceFingerprint(s), scene: scene.id });
    }
    const override = config.kinds?.[scene.id];
    const kind = kindOf(scene, override, bespoke, generic);
    if (!kind) {
      bad(unsupportedWhy(scene, override));
      continue;
    }
    const spec = specs[kind];
    for (const a of unsupportedAssets(kind, scene.visual.assetIds ?? []))
      bad(`${scene.id}: asset "${a}" has no renderer`);
    if (scene.visual.category === 'data-chart') {
      const pts = scene.visual.chart?.points ?? [];
      if (!pts.length) bad(`${scene.id}: a chart with no points`);
      for (const p of pts) {
        if (typeof p.value !== 'number' || !Number.isFinite(p.value))
          bad(`${scene.id}: chart point "${p.label}" has no numeric value`);
        if (!p.display) bad(`${scene.id}: chart point "${p.label}" has no display text`);
        if (!known.has(p.cite)) bad(`${scene.id}: chart point "${p.label}" cites ${p.cite}, not in the package`);
        if (spec.percent && p.unit !== 'percent')
          bad(`${scene.id}: ${kind} draws percentages; "${p.label}" is ${p.unit}`);
        if (spec.chart === 'bar' && p.unit !== 'percent' && p.unit !== 'count')
          bad(`${scene.id}: ${kind} draws percent and count points; "${p.label}" is ${p.unit}`);
      }
      if (spec.percent) {
        const total = pts.reduce((n, p) => n + (Number.isFinite(p.value) ? p.value : 0), 0);
        if (total > 100) bad(`${scene.id}: ${kind} segments total ${total}%`);
      }
    }
    if (scene.visual.excerpt && !known.has(scene.visual.excerpt.cite))
      bad(`${scene.id}: excerpt ${scene.visual.excerpt.cite} is not in the package`);
    const cues = config.cues?.[scene.id] ?? {};
    for (const name of spec.cues ?? []) if (!cues[name]) bad(`${scene.id}: ${kind} needs cue "${name}" in render.json`);
    for (const [name, c] of Object.entries(cues)) {
      if (!scene.sentences.includes(c.sentence))
        bad(`${scene.id}: cue "${name}" names sentence ${c.sentence}, which is not in the scene`);
      if (!c.word?.trim()) bad(`${scene.id}: cue "${name}" names no word`);
    }
    const citations: Citation[] = [];
    for (const c of scene.citations ?? []) {
      const detail = citationDetail(c, pkg);
      if (detail === null) bad(`${scene.id}: citation "${c.label}" does not resolve in the evidence package`);
      else citations.push({ label: c.label, detail });
    }
    scenes.push({ scene, kind, citations });
  }
  return { ...inp, scenes, sentences: out, fingerprints: fp, problems };
}

/** The segment's inputs from topics/<topic>/scripts/<slug>/ and its video/render.json; throws when a file is missing. */
export function loadInputs(topic: string, storyId: string, root = ROOT): SegmentInputs {
  const dir = scriptDir(topic, storyId, root);
  const need = <T>(name: string, hint: string): T => {
    const p = join(dir, name);
    const x = readJson<T>(p);
    if (!x) throw new Error(`no ${p}; ${hint}`);
    return x;
  };
  const configPath = join(dir, VIDEO_DIR, VIDEO_FILES.config);
  if (!existsSync(configPath)) throw new Error(`no ${configPath}: name the scenes, voice and cues to render`);
  return {
    script: need<Script>(FILES.script, 'write the script first'),
    storyboard: need<Storyboard>(FILES.storyboard, 'run npm run script -- storyboard'),
    validation: need<ScriptValidation>(FILES.validation, 'run npm run script -- validate'),
    release: readJson<Release>(join(dir, FILES.release)),
    pkg: need<EvidencePackage>(FILES.pkg, 'run npm run script -- package'),
    config: JSON.parse(readFileSync(configPath, 'utf8')) as RenderConfig,
  };
}

/** The segment from topics/<topic>/scripts/<slug>/ and its video/render.json; throws listing every problem. */
export function loadSegment(topic: string, storyId: string, root = ROOT): Segment {
  const seg = checkSegment(loadInputs(topic, storyId, root));
  if (seg.problems.length) throw new Error(`cannot render:\n  ${seg.problems.join('\n  ')}`);
  return seg;
}
