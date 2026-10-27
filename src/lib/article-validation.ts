// Article validation: the script validator over the article's sentences (articleAsScript, no pacing), plus the checks
// only an article needs: every qualified or unresolved claim carried, metadata within its limits, no URL in the
// prose, table cells that state their cited values, figures that name a chart the story has, and prose that is not
// the narration read back.
import { join } from 'node:path';
import {
  ARTICLE_FILES,
  type Article,
  type FigureData,
  articleAsScript,
  articleReviewUnits,
  articleSentences,
  proseOf,
} from './article';
import type { Corpus, Verdict } from './corpus';
import { dataRef, loadDatasets } from './datasets';
import type { PassageReader } from './evidence';
import { findingLabel } from './finding-label';
import { readJson, ROOT } from './io';
import {
  type EvidencePackage,
  type Issue,
  MAX_REVISIONS,
  norm,
  revisionsInPass,
  type Script,
  type ScriptReviewFile,
  type ScriptValidation,
  type Severity,
  FILES,
  scriptDir,
  sentenceFingerprint,
  sentences,
  storySlug,
} from './script';
import { type ValidateOptions, validateScript } from './script-validation';
import { pointProblems, type StoryboardPlan } from './storyboard';

export const LIMITS = { headline: 90, seoTitle: 60, description: 155 } as const;
export const OVERLAP = { n: 8, share: 0.3 } as const;

const issue = (sentence: string, category: string, severity: Severity, explanation: string): Issue => ({
  sentence,
  category,
  severity,
  explanation,
  by: 'deterministic',
});
const grams = (text: string) => {
  const w = norm(text).split(' ').filter(Boolean);
  return Array.from({ length: Math.max(w.length - OVERLAP.n + 1, 0) }, (_, i) => w.slice(i, i + OVERLAP.n).join(' '));
};

export function articleIssues(
  a: Article,
  pkg: EvidencePackage,
  read: PassageReader,
  opts: { script: Script | null; figures: Set<string> },
): Issue[] {
  const out: Issue[] = [];
  const all = articleSentences(a);
  const blocks = a.sections.flatMap((s) => s.blocks);
  const prose = blocks.flatMap((b) => (b.kind === 'prose' ? [b] : []));

  // A claim the evidence only qualifies, or leaves open, is carried by a callout or a qualified assertion. A
  // qualification counts only when placed: it names a sentence of the article that carries it (as a Short's must).
  const ids = new Set(all.map((s) => s.id));
  const placed = (qs: string[] = []) => qs.some((q) => [...q.matchAll(/\bs\d+\b/g)].some((m) => ids.has(m[0])));
  for (const c of pkg.claims) {
    const label = findingLabel({ ...c, verdict: c.verdict as Verdict | null }); // the package keeps the verdict as a string
    if (label !== 'qualification' && label !== 'unresolved') continue;
    const covered =
      prose.some((b) => b.callout && b.claim === c.id) ||
      all.some((s) =>
        (s.assertions ?? []).some((x) => placed(x.qualifications) && x.claims.some((y) => y.id === c.id)),
      );
    if (!covered)
      out.push(
        issue(
          '-',
          'qualification-coverage',
          'blocking',
          `${c.id} is ${label}: no callout or qualified assertion carries it`,
        ),
      );
  }
  pkg.gaps.forEach((g, i) => {
    if (!prose.some((b) => b.callout === 'unresolved' && b.gap === i))
      out.push(issue('-', 'gap-coverage', 'warning', `no unresolved callout names gap ${i}: "${g}"`));
  });

  for (const [field, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    const m = a.meta[field];
    const text = typeof m === 'string' ? m : m.text;
    if (text.length > max)
      out.push(
        issue(`meta.${field}`, 'metadata', 'blocking', `${field} is ${text.length} characters; the limit is ${max}`),
      );
  }
  if (!a.meta.dek.text.trim()) out.push(issue('meta.dek', 'metadata', 'blocking', 'the dek is empty'));

  const URL = /https?:\/\/|www\./i;
  const shown: [string, string][] = [
    ...all.map((s): [string, string] => [s.id, s.text]),
    ['meta.headline', a.meta.headline],
    ['meta.seoTitle', a.meta.seoTitle],
    ...a.sections.map((x): [string, string] => ['-', x.heading]),
    ...blocks.flatMap((b): [string, string][] =>
      b.kind === 'prose'
        ? []
        : b.kind === 'figure'
          ? [[b.ref, b.caption]]
          : [
              b.caption,
              ...b.columns,
              ...b.rows.flatMap((r) => [r.label, ...r.cells.flatMap((c) => [c.label, c.display])]),
            ].map((text): [string, string] => [b.id, text]),
    ),
  ];
  for (const [id, text] of shown)
    if (URL.test(text)) out.push(issue(id, 'no-url', 'blocking', 'a URL in the article; links come from cites'));

  const known = new Set(pkg.documents.flatMap((d) => d.cites));
  for (const b of blocks) {
    if (b.kind === 'table')
      for (const r of b.rows)
        for (const cell of r.cells)
          for (const why of pointProblems(cell, known, read))
            out.push(
              issue(
                b.id,
                'table-data',
                'blocking',
                `table ${b.id} row "${r.label}"${known.has(cell.cite) ? ':' : ''} ${why}`,
              ),
            );
    if (b.kind === 'figure' && !opts.figures.has(b.ref))
      out.push(issue(b.ref, 'figure', 'blocking', `figure ${b.ref} is not a chart this story has`));
  }

  // Prose that reads the narration back: keyed on the section's first sentence, so a reviewer can disposition it.
  if (opts.script) {
    const spoken = new Set(
      grams(
        sentences(opts.script)
          .map((s) => s.text)
          .join(' '),
      ),
    );
    for (const sec of a.sections) {
      const ss = proseOf(sec);
      const g = grams(ss.map((s) => s.text).join(' '));
      const found = g.filter((x) => spoken.has(x)).length;
      if (g.length && found / g.length > OVERLAP.share)
        out.push(
          issue(
            ss[0].id,
            'transcript-overlap',
            'warning',
            `${Math.round((found / g.length) * 100)}% of section "${sec.name}" repeats the narration; write it for a reader`,
          ),
        );
    }
  }
  return out;
}

const RANK = ['blocking', 'warning', 'info'];

export function validateArticle(
  a: Article,
  t: Corpus,
  read: PassageReader,
  opts: ValidateOptions & { pkg: EvidencePackage; script: Script | null; figures: Set<string> },
): ScriptValidation {
  const script = articleAsScript(a);
  const v = validateScript(script, t, read, { ...opts, pacing: false });
  const own = articleIssues(a, opts.pkg, read, opts);
  // Dispositions as validateScript applies them: a current review retires a warning at the sentence's fingerprint.
  const review = opts.review ?? null;
  const current = !!review && review.packageFingerprint === opts.pkg.fingerprint;
  const prints = new Map(articleSentences(a).map((s) => [s.id, sentenceFingerprint(s)]));
  // The text that is not a sentence (headline, SEO title, headings, tables, figures) is approved by its own unit id,
  // at its fingerprint, as a sentence is: an edit after the review asks for it again.
  const unapproved = articleReviewUnits(a).filter(([id, fp]) => !current || review.approved?.[id] !== fp);
  own.push(
    ...unapproved.map(([id, fp]) =>
      issue(id, 'unreviewed', 'info', `${id} is not approved at fingerprint ${fp}; the reviewer approves it there`),
    ),
  );
  for (const i of own) {
    const d = [review?.dispositions?.[i.sentence] ?? []].flat().find((x) => x.category === i.category);
    if (current && i.severity === 'warning' && d && d.fingerprint === prints.get(i.sentence)) i.disposition = d.reason;
  }
  // An issue on a sentence joins that sentence's result; a blocking one blocks it, as validateScript's rule does.
  const results = v.sentences.map((r) => {
    const mine = own.filter((i) => i.sentence === r.id);
    if (!mine.some((i) => i.severity === 'blocking')) return mine.length ? { ...r, issues: [...r.issues, ...mine] } : r;
    const assertions = r.assertions.map((x) =>
      x.status === 'verified' ? { ...x, status: 'needs-review' as const } : x,
    );
    return { ...r, issues: [...r.issues, ...mine], status: 'blocked' as const, assertions };
  });
  const issues = [...v.issues, ...own].sort((x, y) => RANK.indexOf(x.severity) - RANK.indexOf(y.severity));
  const blocking = issues.filter((x) => x.severity === 'blocking').length;
  const warnings = issues.filter((x) => x.severity === 'warning' && !x.disposition).length;
  // v is blocked only when it has a blocking issue; an unapproved unit holds a passing article in review
  const status = blocking ? 'blocked' : unapproved.length ? 'needs-review' : v.status;
  return {
    ...v,
    status,
    issues,
    sentences: results,
    counts: {
      ...v.counts,
      verified: results.reduce((n, s) => n + s.assertions.filter((x) => x.status === 'verified').length, 0),
      blocking,
      warnings,
      dispositioned: issues.filter((x) => x.disposition).length,
      unreviewed: v.counts.unreviewed + unapproved.length,
    },
    history: [...v.history.slice(0, -1), { ...v.history[v.history.length - 1], status, blocking, warnings }],
    revisionLimitReached:
      status === 'blocked' &&
      revisionsInPass(script) >= MAX_REVISIONS &&
      !script.generation.corrective?.some((c) => c.revision === script.revision),
  };
}

/** validateArticle over the story's script folder: its article review, the previous validation and the figures it
 *  may name. */
export function validateArticleIn(
  topic: string,
  storyId: string,
  a: Article,
  t: Corpus,
  read: PassageReader,
  opts: Pick<ValidateOptions, 'judgments'> & { pkg: EvidencePackage; script: Script | null },
  root = ROOT,
): ScriptValidation {
  const p = (f: string) => join(scriptDir(topic, storyId, root), f);
  return validateArticle(a, t, read, {
    ...opts,
    review: readJson<ScriptReviewFile>(p(ARTICLE_FILES.review)),
    previous: readJson<ScriptValidation>(p(ARTICLE_FILES.validation)),
    figures: figuresOf(topic, storyId, root),
  });
}

/** What an article's figures may name, with the data each draws: `<story-slug>/<scene-id>` for every storyboard scene
 *  with a chart, and `data:<topic>/<id>` for every evidence dataset of the topic. */
export function figureData(topic: string, storyId: string, root = ROOT): Map<string, FigureData> {
  const sb = readJson<StoryboardPlan>(join(scriptDir(topic, storyId, root), FILES.storyboard));
  return new Map<string, FigureData>([
    ...(sb?.scenes ?? []).flatMap((s) =>
      s.visual?.chart ? [[`${storySlug(storyId)}/${s.id}`, { chart: s.visual.chart }] as const] : [],
    ),
    ...loadDatasets(topic, root).map((d) => [dataRef(topic, d.id), { table: d }] as const),
  ]);
}

export const figuresOf = (topic: string, storyId: string, root = ROOT): Set<string> =>
  new Set(figureData(topic, storyId, root).keys());
