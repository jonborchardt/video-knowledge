// Short discovery: which findings of a produced video can stand on their own as a vertical Short, and the Short's
// evidence package. Deterministic: candidates come from the parent's validated script and storyboard (one per scene in
// a finding section whose sentences are all verified and approved and that asserts a fact), and a rerun of discover
// is byte-identical. The reviewer's file (shorts-review.json, scripts/briefs/shorts.md) supplies what code cannot
// judge: whether the finding stands alone, the hook, the format, and how each qualification the parent carried
// elsewhere is said inside the Short. A candidate is never ready without it.
import { join } from 'node:path';
import { readJson, sha, toJson, ROOT } from './io';
import { nums } from './numbers';
import { storyboardFingerprint, validationFingerprint } from './release';
import {
  type EvidencePackage,
  FILES,
  MAX_SHORTS,
  type Release,
  SHORT_FORMATS,
  SHORT_MAX_SECONDS,
  type Script,
  type ScriptValidation,
  type SectionName,
  type ShortFormat,
  isStudyRef,
  scriptDir,
  sentences,
} from './script';
import type { ChartSpec, Storyboard } from './storyboard';

export const SHORTS_FILE = 'shorts.json';
export const SHORTS_REVIEW_FILE = 'shorts-review.json';
export const shortsPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), SHORTS_FILE);
export const shortsReviewPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), SHORTS_REVIEW_FILE);

export type ShortReadiness = 'ready' | 'needs-review' | 'rejected';
export interface ShortCandidate {
  key: string; // the scene's first sentence id: stable across revisions, like sentence ids
  scene: string;
  section: SectionName;
  sentences: string[];
  claims: string[]; // the review's list when it gives one, else what the sentences' assertions name
  cites: string[]; // study passages the assertions rest on
  figures: string[]; // figures spoken in the sentences
  chart: ChartSpec | null; // the parent scene's chart, reusable as is (its points already cite passages)
  /** Qualifications the parent's assertions name; `carriedBy` are the parent sentences outside this scene that carry
   *  them, which the Short must say in its own words (the review's `carries`). */
  qualifications: { assertion: string; text: string; carriedBy: string[] }[];
  reviewed: boolean;
  slug: string | null;
  format: ShortFormat | null;
  hook: string | null;
  carries: string[];
  readiness: ShortReadiness;
  blocking: string[];
}
/** One candidate's entry in shorts-review.json. */
export interface ShortReview {
  keep?: boolean;
  reject?: string;
  slug?: string; // the folder: shorts/<slug>/
  format?: ShortFormat;
  hook?: string; // the line the writer opens from
  carries?: string[]; // one per qualification: how it is said inside the Short
  claims?: string[]; // prune or widen, within the parent's package
}
export interface ShortsReviewFile {
  candidates: Record<string, ShortReview>;
}
export interface ShortsFile {
  topic: string;
  story: string;
  parentFingerprints: {
    script: string;
    validation: string;
    storyboard: string;
    package: string;
    release: string | null; // sha of release.json's fingerprints, null when the parent is not locked
  };
  candidates: ShortCandidate[];
  rejected: { key: string; reason: string }[];
}
/** What discovery reads from the parent's folder. */
export interface ShortParent {
  script: Script;
  v: ScriptValidation;
  sb: Storyboard;
  pkg: EvidencePackage;
  release: Release | null;
}

const FINDING_SECTIONS = /^(investigation|question-\d+|answer)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const releaseFingerprint = (release: Release | null) => (release ? sha(toJson(release.fingerprints)) : null);
const isFormat = (x: unknown): x is ShortFormat => (SHORT_FORMATS as readonly unknown[]).includes(x);

/** The candidates, judged against the review; pure. */
export function discoverShorts(parent: ShortParent, review: ShortsReviewFile | null): ShortsFile {
  const { script, v, sb, pkg, release } = parent;
  const all = sentences(script);
  const byId = new Map(all.map((s) => [s.id, s]));
  const vById = new Map(v.sentences.map((s) => [s.id, s]));
  const pkgClaims = new Set(pkg.claims.map((c) => c.id));
  const candidates: ShortCandidate[] = [];
  const rejected: ShortsFile['rejected'] = [];
  const slugs = new Map<string, string>();
  let ready = 0;
  for (const sc of sb.scenes) {
    const ids = sc.sentences;
    const first = ids[0] && byId.get(ids[0]);
    if (!first || !FINDING_SECTIONS.test(first.section)) continue;
    const assertions = ids.flatMap((id) => byId.get(id)?.assertions ?? []);
    if (!assertions.some((a) => a.kind === 'fact')) continue; // not a finding (a quote, a transition, an attribution)
    const key = ids[0];
    const unverified = ids.filter((id) => {
      const r = vById.get(id);
      return !r || r.status !== 'verified' || !r.approved;
    });
    if (unverified.length) {
      rejected.push({ key, reason: `${unverified.join(', ')} not verified and approved in the parent` });
      continue;
    }
    const r = review?.candidates[key];
    if (r?.reject) {
      rejected.push({ key, reason: r.reject });
      continue;
    }
    const qualifications = assertions.flatMap((a) =>
      (a.qualifications ?? []).map((text) => ({
        assertion: a.id,
        text,
        carriedBy: uniq([...text.matchAll(/\bs\d+\b/g)].map((m) => m[0])).filter((x) => !ids.includes(x)),
      })),
    );
    const blocking: string[] = [];
    const carries = (r?.carries ?? []).filter((c) => c.trim());
    if (!r) blocking.push('no entry in shorts-review.json (scripts/briefs/shorts.md)');
    else {
      if (r.keep !== true) blocking.push('not kept by the review');
      if (!r.slug || !SLUG.test(r.slug)) blocking.push('the review gives no slug (lowercase words joined by -)');
      else if (slugs.has(r.slug)) blocking.push(`slug ${r.slug} is already ${slugs.get(r.slug)}'s`);
      else slugs.set(r.slug, key);
      if (!r.hook?.trim()) blocking.push('the review gives no hook');
      if (!isFormat(r.format)) blocking.push(`the review names no format (one of ${SHORT_FORMATS.join(', ')})`);
      if (carries.length < qualifications.length)
        blocking.push(
          `${qualifications.length} qualification${qualifications.length === 1 ? '' : 's'}, ${carries.length} carried: say each inside the Short (carries)`,
        );
      for (const c of r.claims ?? []) if (!pkgClaims.has(c)) blocking.push(`claim ${c} is not in the parent's package`);
      if (r.claims && !r.claims.length) blocking.push('the review prunes every claim');
    }
    if (!release) blocking.push('the parent is not locked (no release.json)');
    if (!blocking.length && ready >= MAX_SHORTS) blocking.push(`over the cap of ${MAX_SHORTS} ready shorts per video`);
    const readiness: ShortReadiness = blocking.length ? 'needs-review' : 'ready';
    if (readiness === 'ready') ready++;
    candidates.push({
      key,
      scene: sc.id,
      section: first.section,
      sentences: ids,
      claims: r?.claims?.length ? r.claims : uniq(assertions.flatMap((a) => a.claims.map((c) => c.id))),
      cites: uniq(assertions.flatMap((a) => a.evidence.filter(isStudyRef).map((x) => x.cite))),
      figures: uniq(ids.flatMap((id) => nums(byId.get(id)!.text))),
      chart: sc.visual.chart ?? null,
      qualifications,
      reviewed: !!r,
      slug: r?.slug && SLUG.test(r.slug) ? r.slug : null,
      format: isFormat(r?.format) ? r.format : null,
      hook: r?.hook?.trim() || null,
      carries,
      readiness,
      blocking,
    });
  }
  return {
    topic: script.topic,
    story: script.story,
    parentFingerprints: {
      script: v.scriptFingerprint,
      validation: validationFingerprint(v),
      storyboard: storyboardFingerprint(sb),
      package: pkg.fingerprint,
      release: releaseFingerprint(release),
    },
    candidates,
    rejected,
  };
}

/** Review keys that name no current candidate (a renumbered scene, a typo): the review must name current ones. */
export const staleShortReviewKeys = (file: ShortsFile, review: ShortsReviewFile): string[] =>
  Object.keys(review.candidates).filter(
    (k) => !file.candidates.some((c) => c.key === k) && !file.rejected.some((r) => r.key === k),
  );

export const loadShorts = (topic: string, storyId: string, root = ROOT) =>
  readJson<ShortsFile>(shortsPath(topic, storyId, root));
export function loadShortsReview(topic: string, storyId: string, root = ROOT): ShortsReviewFile | null {
  const x = readJson<ShortsReviewFile>(shortsReviewPath(topic, storyId, root));
  if (x && (typeof x !== 'object' || typeof x.candidates !== 'object' || Array.isArray(x.candidates)))
    throw new Error(`${SHORTS_REVIEW_FILE}: expected { "candidates": { "<key>": { ... } } }`);
  return x;
}
/** The parent's artifacts discovery needs; throws naming the first missing one. */
export function loadShortParent(topic: string, storyId: string, root = ROOT): ShortParent {
  const dir = scriptDir(topic, storyId, root);
  const need = <T>(f: string, hint: string): T => {
    const x = readJson<T>(join(dir, f));
    if (!x) throw new Error(`no ${join(dir, f)}; ${hint}`);
    return x;
  };
  return {
    script: need<Script>(FILES.script, 'the parent has no script'),
    v: need<ScriptValidation>(FILES.validation, 'run npm run script -- validate'),
    sb: need<Storyboard>(FILES.storyboard, 'run npm run script -- storyboard'),
    pkg: need<EvidencePackage>(FILES.pkg, 'run npm run script -- package'),
    release: readJson<Release>(join(dir, FILES.release)),
  };
}

/** The Short's evidence package: the parent's documents and framing, the claims the candidate uses, and the `short`
 *  block that switches the script sections, the validator's rules, the storyboard cap, the frame and the kinds. The
 *  fingerprint covers the block, so a change to the parent's package, approved script or lock, or to the review, makes
 *  it stale. Throws on a candidate that is not ready. */
export function buildShortPackage(
  parent: EvidencePackage,
  candidate: ShortCandidate,
  shorts: ShortsFile,
): EvidencePackage {
  if (candidate.readiness !== 'ready')
    throw new Error(`candidate ${candidate.key} is ${candidate.readiness}: ${candidate.blocking.join('; ')}`);
  const claims = candidate.claims.map((id) => {
    const c = parent.claims.find((x) => x.id === id);
    if (!c) throw new Error(`claim ${id} is not in the parent's package`);
    return c;
  });
  const { fingerprint: _f, generatedAt: _g, questions: _q, chainWhy: _c, ...rest } = parent;
  void [_f, _g, _q, _c];
  const body: Omit<EvidencePackage, 'fingerprint' | 'generatedAt'> = {
    ...rest,
    story: `${shorts.story}/shorts/${candidate.slug}`,
    title: candidate.hook!,
    inputs: { parent: parent.fingerprint },
    claims,
    short: {
      parent: shorts.story,
      key: candidate.key,
      slug: candidate.slug!,
      format: candidate.format!,
      sentences: candidate.sentences,
      hook: candidate.hook!,
      carries: candidate.carries,
      maxSeconds: SHORT_MAX_SECONDS,
      parentFingerprints: {
        package: shorts.parentFingerprints.package,
        script: shorts.parentFingerprints.script,
        release: shorts.parentFingerprints.release ?? '',
      },
    },
  };
  return { ...body, fingerprint: sha(toJson(body)), generatedAt: new Date().toISOString() };
}
