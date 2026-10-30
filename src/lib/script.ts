// Script stage: one reviewed story -> evidence package -> narration script with sentence-level provenance -> validation.
//
// Artifacts live in topics/<topic>/scripts/<story slug>/ (scriptDir). The code is deterministic; the writing and the semantic
// review are agent work driven by scripts/briefs/script.md and scripts/briefs/script-review.md:
//   evidence-package.json  built from stories.json, the report and the store (evidence-package.ts, buildPackage)
//   script.json            written by the writer agent (Script)
//   script-review.json     written by an independent reviewer agent (ScriptReviewFile)
//   validation.json        deterministic checks merged with the review (script-validation.ts, validateScript)
//   script.md, review.md   rendered by script-md.ts
//   release.json           the approved fingerprints (release.ts)
// This file holds the shared types, fingerprints and folder conventions; each stage's code lives in its own module.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type EvidenceRef,
  SECTIONS,
  SHORT_SECTIONS,
  type SectionName,
  type EvidencePackage,
  type Sentence,
  type Section,
  type Script,
} from '../shared/types';
import { sha, topicDir, TOPICS, ROOT } from './io';

/** The sections a script written from this package has, in order. */
export const sectionsFor = (pkg: Pick<EvidencePackage, 'questions' | 'short'> | null): readonly SectionName[] =>
  pkg?.short
    ? SHORT_SECTIONS
    : pkg?.questions
      ? ['hook', ...pkg.questions.map((_, i) => `question-${i + 1}` as SectionName), 'close']
      : SECTIONS;

// ---- evidence package -------------------------------------------------------------------------------------------

export const docOf = (cite: string) => cite.split('#')[0];
export const isStudyRef = (r: EvidenceRef): r is { kind: 'study'; claim: string; cite: string } => r.kind === 'study';

// ---- script ------------------------------------------------------------------------------------------------------

/** A section's viewer-facing title: its own (a question section's question), else its name capitalised. */
export const sectionTitle = (sec: Pick<Section, 'name' | 'title'>) =>
  sec.title ?? sec.name[0].toUpperCase() + sec.name.slice(1);
export const revisionsInPass = (s: Script) => s.revision - (s.passStartRevision ?? 0);

export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const minutes = (w: number, wpm: number) => Math.round((w / wpm) * 10) / 10;
export const sentenceFingerprint = (s: Sentence) =>
  sha(
    [
      s.text,
      ...(s.assertions ?? []).map((a) => JSON.stringify([a.text, a.kind, a.claims, a.evidence, a.quote, a.calc])),
    ]
      .join('\n')
      .replace(/\s+/g, ' '),
  );
export const scriptFingerprint = (s: Script) =>
  sha(s.sections.map((x) => x.sentences.map((y) => `${y.id}:${y.text}`).join('\n')).join('\n'));
export const sentences = (s: Script) => s.sections.flatMap((x) => x.sentences.map((y) => ({ ...y, section: x.name })));

/** Case, quote style, dashes and whitespace do not count; pdftotext's replacement characters are dropped. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---- files -------------------------------------------------------------------------------------------------------

export const storySlug = (storyId: string) => storyId.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
/** A Short's id is `<story-id>/shorts/<slug>`: the parent and the slug, or null for a story. */
export function shortOf(storyId: string): { parent: string; slug: string } | null {
  const m = /^(.+)\/shorts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(storyId);
  return m ? { parent: m[1], slug: m[2] } : null;
}
export const shortId = (parent: string, slug: string) => `${parent}/shorts/${slug}`;
/** A story's folder, or a Short's nested in its parent's: the id carries the nesting, so every CLI keyed by
 *  (topic, storyId) works on a Short unchanged. */
export const scriptDir = (topic: string, storyId: string, root = ROOT) => {
  const s = shortOf(storyId);
  return s
    ? join(topicDir(topic, root), 'scripts', storySlug(s.parent), 'shorts', s.slug)
    : join(topicDir(topic, root), 'scripts', storySlug(storyId));
};
export const FILES = {
  pkg: 'evidence-package.json',
  script: 'script.json',
  review: 'script-review.json',
  validation: 'validation.json',
  scriptMd: 'script.md',
  storyboard: 'storyboard.json',
  storyboardMd: 'storyboard.md',
  reviewMd: 'review.md',
  release: 'release.json',
} as const;
/** Every topics/<topic>/scripts/<slug> with a script.json, for the site and the tests. */
export function scriptDirs(root = ROOT): { topic: string; slug: string; dir: string }[] {
  const topics = readdirSync(join(root, TOPICS), { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !d.name.startsWith('.'),
  );
  return topics.flatMap(({ name: topic }) => {
    const base = join(topicDir(topic, root), 'scripts');
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(base, d.name, FILES.script)))
      .map((d) => ({ topic, slug: d.name, dir: join(base, d.name) }));
  });
}
