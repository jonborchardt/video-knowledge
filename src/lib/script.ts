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
import { sha } from '../shared/io';

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
