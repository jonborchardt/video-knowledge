// The duration contract (Milestone 2, spec §5.7). A story's optional `targetDurationSeconds` is the authoritative
// constraint; a band is the set of editorial defaults it selects (what counts as an appropriate narrative), never a
// format and never a validation exception: evidence, provenance, fingerprints, QA and publishing are the same whatever
// the target. A story without a target keeps today's rules (`bandOf` is null). Pure and shared: every check reads
// the target from the artifact it already validates (the package, the script, the storyboard, the timeline).
import type { SectionName } from './types';

export type Band = 'micro' | 'short' | 'standard' | 'long';
export type PacingCheck = 'slow-start' | 'number-dense' | 'repetition';
export const PACING_CHECKS: readonly PacingCheck[] = ['slow-start', 'number-dense', 'repetition'];

export interface BandRules {
  maxSeconds: number; // the band's upper bound (long has none)
  sections: SectionName[] | 'all'; // required sections of the plain (non-chain, non-Short) form
  optionalSections: SectionName[]; // allowed beside the required ones; any other plain section is out of the band
  sentences: [number, number] | null; // null: bounded by the words budget alone
  scenes: [number, number] | ((target: number) => [number, number]);
  pacing: PacingCheck[] | 'all';
  article: 'paragraph' | 'brief' | 'full';
  shorts: { max: number; targetOf: (parent: number) => number | null }; // null: today's rules (no target)
}

export const TOLERANCE = { share: 0.35, minSeconds: 3 } as const;
const SHORT_TARGET_CAP = 8; // the micro Short: the smaller of 8 s and half the parent, always shorter than the parent

export const BANDS: Record<Band, BandRules> = {
  micro: {
    maxSeconds: 20,
    sections: ['answer'],
    optionalSections: ['hook'],
    sentences: [1, 4],
    scenes: [1, 2],
    pacing: ['number-dense'],
    article: 'paragraph',
    shorts: { max: 1, targetOf: (parent) => Math.min(SHORT_TARGET_CAP, parent / 2) },
  },
  short: {
    maxSeconds: 90,
    sections: ['hook', 'answer', 'takeaway'],
    optionalSections: ['setup', 'investigation'],
    sentences: [3, 12],
    scenes: [2, 8],
    pacing: ['slow-start', 'number-dense'],
    article: 'brief',
    shorts: { max: Infinity, targetOf: (parent) => parent / 2 },
  },
  standard: {
    maxSeconds: 480,
    sections: 'all',
    optionalSections: [],
    sentences: null,
    scenes: (target) => [1, Math.max(1, Math.floor(target / 4))],
    pacing: 'all',
    article: 'full',
    shorts: { max: Infinity, targetOf: () => null },
  },
  long: {
    maxSeconds: Infinity,
    sections: 'all',
    optionalSections: [],
    sentences: null,
    scenes: (target) => [1, Math.max(1, Math.floor(target / 4))],
    pacing: 'all',
    article: 'full',
    shorts: { max: Infinity, targetOf: () => null },
  },
};

export function bandOf(seconds: number | undefined | null): Band | null {
  if (seconds === undefined || seconds === null || !(seconds > 0)) return null;
  if (seconds <= BANDS.micro.maxSeconds) return 'micro';
  if (seconds <= BANDS.short.maxSeconds) return 'short';
  if (seconds <= BANDS.standard.maxSeconds) return 'standard';
  return 'long';
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Spoken words the target allows at the given pace, ±35%. */
export function wordsBudget(target: number, wpm: number): [number, number] {
  const w = (target * wpm) / 60;
  return [Math.round(w * (1 - TOLERANCE.share)), Math.round(w * (1 + TOLERANCE.share))];
}

/** The measured runtime must land within the larger of ±35% and ±3 s of the target. */
export function runtimeWindow(target: number): [number, number] {
  const slack = Math.max(target * TOLERANCE.share, TOLERANCE.minSeconds);
  return [round2(target - slack), round2(target + slack)];
}

export function runtimeProblem(measured: number, target: number | undefined | null): string | null {
  if (target === undefined || target === null) return null;
  const [lo, hi] = runtimeWindow(target);
  if (measured >= lo && measured <= hi) return null;
  return `${measured.toFixed(1)} s narrated against a ${target} s target (allowed ${lo} to ${hi} s)`;
}

export const sceneRange = (band: Band, target: number): [number, number] => {
  const r = BANDS[band].scenes;
  return typeof r === 'function' ? r(target) : r;
};

export const pacingAllowed = (band: Band | null, category: string): boolean =>
  !band || BANDS[band].pacing === 'all' || (BANDS[band].pacing as string[]).includes(category);

export interface ScriptShape {
  sections: SectionName[]; // in script order
  sentences: number;
  spokenWords: number;
  plain: boolean; // the five-section form (not a chain, not a Short): the band's section rules apply
}
export interface ProportionProblem {
  category: 'sections' | 'sentences' | 'words';
  explanation: string;
}

/** What the band says about a script's shape; empty without a target. Correctness is never judged here. */
export function scriptProportion(shape: ScriptShape, target: number | undefined, wpm: number): ProportionProblem[] {
  const band = bandOf(target);
  if (!band || target === undefined) return [];
  const rules = BANDS[band];
  const out: ProportionProblem[] = [];
  if (shape.plain && rules.sections !== 'all') {
    const allowed = new Set<string>([...rules.sections, ...rules.optionalSections]);
    const extra = shape.sections.filter((s) => !allowed.has(s));
    const missing = rules.sections.filter((s) => !shape.sections.includes(s));
    if (extra.length)
      out.push({
        category: 'sections',
        explanation: `a ${band} story (${target} s) has no ${extra.map((s) => `"${s}"`).join(', ')} section: ${rules.sections.map((s) => `"${s}"`).join(', ')}${rules.optionalSections.length ? ` (${rules.optionalSections.map((s) => `"${s}"`).join(', ')} optional)` : ''}`,
      });
    if (missing.length)
      out.push({
        category: 'sections',
        explanation: `a ${band} story (${target} s) needs ${missing.map((s) => `"${s}"`).join(', ')}`,
      });
  }
  if (rules.sentences) {
    const [lo, hi] = rules.sentences;
    if (shape.sentences < lo || shape.sentences > hi)
      out.push({
        category: 'sentences',
        explanation: `${shape.sentences} sentences; a ${band} story (${target} s) has ${lo} to ${hi}`,
      });
  }
  const [lo, hi] = wordsBudget(target, wpm);
  if (shape.spokenWords < lo || shape.spokenWords > hi)
    out.push({
      category: 'words',
      explanation: `${shape.spokenWords} spoken words; a ${target} s target at ${wpm} wpm allows ${lo} to ${hi}`,
    });
  return out;
}

/** What the band says about an article's shape: prose paragraphs and tables. Empty without a target. */
export function articleProportion(
  shape: { paragraphs: number; tables: number },
  target: number | undefined,
): string | null {
  const band = bandOf(target);
  if (!band) return null;
  const rule = BANDS[band].article;
  if (rule === 'paragraph') {
    if (shape.paragraphs !== 1)
      return `${shape.paragraphs} paragraphs; a ${band} article (${target} s) is one paragraph: the claim and its evidence`;
    if (shape.tables) return `a ${band} article (${target} s) has no table`;
  }
  if (rule === 'brief' && (shape.paragraphs < 2 || shape.paragraphs > 4))
    return `${shape.paragraphs} paragraphs; a ${band} article (${target} s) is two to four`;
  return null;
}
