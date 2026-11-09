// The companion article: prose blocks over the script's sentences, so the script validator judges it unchanged.
import { join } from 'node:path';
import { readJson, ROOT, sha, scriptDir } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import { approverProblem } from '../../shared/approver';
import { validationFingerprint } from '../../shared/sentence-validation';
import { sentenceFingerprint } from '../../shared/sentences';
import type {
  ChartPoint,
  ChartSpec,
  DataTable,
  Revision,
  Script,
  ScriptValidation,
  SectionName,
  Sentence,
} from '../../shared/types';

/** What a figure draws, as released: a storyboard chart or an evidence dataset, copied so a later edit of either never
 *  reaches the page unapproved. */
export type FigureData = { chart: ChartSpec } | { table: DataTable };

export const ARTICLE_FILES = {
  request: 'article-request.json',
  article: 'article.json',
  review: 'article-review.json',
  validation: 'article-validation.json',
  md: 'article.md',
  release: 'article-release.json',
  pageReview: 'page-review.json', // the rendered-page reviewer's verdict, keyed by the article fingerprint
  pageIndex: 'page/index.json', // what `frames` photographed: the same key, or the review counts for nothing
} as const;

/** One finding of the rendered-page review. `scope` says who can act: the writer (`article`, a unit id), an
 *  engineer (`renderer`, a shared component) or an editor (`matter`, the page around the article). */
export interface PageFinding {
  scope: 'article' | 'renderer' | 'matter';
  unit: string; // a sentence, table, figure or heading id, or `page`
  severity: 'blocking' | 'warning' | 'info';
  text: string;
  where?: { width: number; theme: 'light' | 'dark'; tile: number };
}
export interface PageReview {
  key: string;
  verdict: 'approved' | 'changes';
  findings: PageFinding[];
  reviewer: string;
  date: string;
}

/** The page review that counts for the current article.json: one whose key, the tiles' key and the article's
 *  fingerprint agree. Null when there is none at this text; `{ invalid }` when the file contradicts itself (an
 *  approval with a blocking finding, a `changes` without one, an unknown verdict or scope): the reviewer's say-so is
 *  never trusted over its own findings. */
export function pageReviewOf(topic: string, storyId: string, root = ROOT): PageReview | { invalid: string } | null {
  const dir = scriptDir(topic, storyId, root);
  const a = readJson<Article>(join(dir, ARTICLE_FILES.article));
  const r = readJson<PageReview>(join(dir, ARTICLE_FILES.pageReview));
  if (!a || !r || r.key !== articleFingerprint(a)) return null;
  const index = readJson<{ key: string }>(join(dir, ARTICLE_FILES.pageIndex));
  if (index?.key !== r.key) return { invalid: `the tiles under page/ are of ${index?.key ?? 'no text'}, not this one` };
  if (r.verdict !== 'approved' && r.verdict !== 'changes') return { invalid: `verdict ${JSON.stringify(r.verdict)}` };
  if (!Array.isArray(r.findings)) return { invalid: 'findings is not a list' };
  const bad = r.findings.find((f) => !['article', 'renderer', 'matter'].includes(f.scope));
  if (bad) return { invalid: `finding on ${bad.unit} has scope ${JSON.stringify(bad.scope)}` };
  const blocking = r.findings.filter((f) => f.severity === 'blocking');
  if (r.verdict === 'approved' && blocking.length)
    return { invalid: `approved with ${blocking.length} blocking finding(s): ${blocking[0].unit}` };
  if (r.verdict === 'changes' && !blocking.length) return { invalid: 'changes with no blocking finding' };
  return r;
}

/** The approved page review the lock needs, or a refusal saying what is missing. */
export function approvedPageReview(topic: string, storyId: string, root = ROOT): PageReview {
  const r = pageReviewOf(topic, storyId, root);
  const how = `run npm run article -- frames ${topic} ${storyId}, then a fresh src/modules/article/briefs/page-review.md agent`;
  if (!r) throw new Refusal(`no page review approved at this text: ${how}`);
  if ('invalid' in r) throw new Refusal(`${ARTICLE_FILES.pageReview} is invalid (${r.invalid}): ${how}`);
  if (r.verdict !== 'approved') throw new Refusal(`the page review asks for changes: the writer revises, then ${how}`);
  return r;
}

export type Callout = 'qualification' | 'unresolved';
export type Block =
  | { kind: 'prose'; sentences: Sentence[]; callout?: Callout; claim?: string; gap?: number }
  | {
      kind: 'table';
      id: string;
      caption: string;
      columns: string[];
      rows: { label: string; cells: ChartPoint[] }[];
    }
  // `as` draws the storyboard's cited points as a comparison instead of the scene's own form; the validator allows it
  // only over points that share one unit, with no ratio and no qualifier, and the release keeps the storyboard's chart
  | { kind: 'figure'; ref: string; caption: string; as?: 'bar' | 'dot-plot' };

export interface ArticleSection {
  name: SectionName;
  heading: string;
  blocks: Block[];
}
export interface Article {
  topic: string;
  story: string;
  revision: number;
  passStartRevision?: number;
  generation: Script['generation'];
  meta: { headline: string; seoTitle: string; dek: Sentence; description: Sentence };
  sections: ArticleSection[];
}

export const proseOf = (s: ArticleSection) => s.blocks.flatMap((b) => (b.kind === 'prose' ? b.sentences : []));

export const articleSentences = (a: Article): Sentence[] => [
  a.meta.dek,
  a.meta.description,
  ...a.sections.flatMap(proseOf),
];

export function articleAsScript(a: Article): Script {
  const head = [a.meta.dek, a.meta.description];
  return {
    topic: a.topic,
    story: a.story,
    title: a.meta.headline,
    revision: a.revision,
    ...(a.passStartRevision === undefined ? {} : { passStartRevision: a.passStartRevision }),
    generation: a.generation,
    sections: a.sections.map((s, i) => ({
      name: s.name,
      title: s.heading,
      sentences: [...(i === 0 ? head : []), ...proseOf(s)],
    })),
  };
}

/** The release fingerprint: the units a correction names, so an edit no reader sees (a writer's note, a sentence type,
 *  an assertion's id or qualifications, whitespace) is no change. Compare against articleFingerprint(release.article),
 *  never the stored one: releases before this fingerprint stored a hash of the raw JSON. */
export const articleFingerprint = (a: Article) => sha(JSON.stringify(unitsOf(a)));

/** What the site renders: the article as approved, with every correction since. */
export interface ArticleRelease {
  topic: string;
  story: string;
  approvedBy: string;
  date: string;
  revision: number;
  recordSeen?: number; // how many public-record revisions existed at release: any at a later index is newer
  fingerprints: { article: string; package: string; validation: string };
  article: Article;
  figures?: Record<string, FigureData>; // by figure ref; a release locked before snapshots has none
  history: {
    revision: number;
    date: string;
    approvedBy: string;
    fingerprint: string;
    note?: string;
    sentences?: string[];
    reaffirmed?: true; // the text stands unchanged after a finding it relies on was revised
  }[];
}

/** When the released text last changed: the newest history entry that is not a reaffirmation. */
export const articleModified = (r: ArticleRelease) => r.history.findLast((h) => !h.reaffirmed)?.date;

export const loadArticleRelease = (topic: string, storyId: string, root = ROOT) =>
  readJson<ArticleRelease>(join(scriptDir(topic, storyId, root), ARTICLE_FILES.release));

/** The validated, unreleased article.json as a release-shaped snapshot for the dev preview and the page review:
 *  revision 0, approved by nobody, no history. Null unless the stored validation passed for this revision. The site
 *  never builds from it; `frames` and the lock check the live validation themselves. */
export function previewRelease(topic: string, storyId: string, root = ROOT): ArticleRelease | null {
  const dir = scriptDir(topic, storyId, root);
  const a = readJson<Article>(join(dir, ARTICLE_FILES.article));
  const v = readJson<ScriptValidation>(join(dir, ARTICLE_FILES.validation));
  if (!a || !v || v.status !== 'passed' || v.revision !== a.revision) return null;
  return { ...snapshot(a, v, 'preview', v.date ?? '', 0), history: [] };
}

function releasable(v: ScriptValidation, approvedBy: string) {
  const why = approverProblem(approvedBy);
  if (why) throw new Refusal(why);
  if (v.status !== 'passed') throw new Refusal(`validation is ${v.status}, not passed`);
}
const snapshot = (a: Article, v: ScriptValidation, approvedBy: string, date: string, revision: number) => ({
  topic: a.topic,
  story: a.story,
  approvedBy,
  date,
  revision,
  fingerprints: {
    article: articleFingerprint(a),
    package: v.packageFingerprint ?? '',
    validation: validationFingerprint(v),
  },
  article: a,
});

const figureRefs = (a: Article) =>
  a.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'figure' ? [b.ref] : [])));

/** The data of each figure the article names, from every chart and dataset the story has (figureData). */
export function releaseFigures(a: Article, all: Map<string, FigureData>): Record<string, FigureData> {
  return Object.fromEntries(
    figureRefs(a).map((ref) => {
      const d = all.get(ref);
      if (!d) throw new Refusal(`figure ${ref} is not a chart this story has`);
      return [ref, d];
    }),
  );
}

const figureSha = (d: FigureData | undefined) => sha(JSON.stringify(d ?? null));

/** What moved under a release since it was locked: its evidence package, then each figure whose data differs from
 *  the snapshot (every figure, for a release without one). [] when nothing did. */
export function articleDrift(r: ArticleRelease, now: { package: string; figures: Map<string, FigureData> }): string[] {
  return [
    ...(r.fingerprints.package === now.package ? [] : [`package ${r.fingerprints.package} -> ${now.package}`]),
    ...figureRefs(r.article)
      .filter((ref) => figureSha(now.figures.get(ref)) !== figureSha(r.figures?.[ref]))
      .map((ref) => `figure ${ref}`),
  ];
}

/** The first release. Locking the released text again changes nothing; a changed text is a correction. */
export function lockArticle(
  prev: ArticleRelease | null,
  a: Article,
  v: ScriptValidation,
  approvedBy: string,
  date: string,
  figures: Record<string, FigureData>,
): ArticleRelease {
  const fp = articleFingerprint(a);
  const same = !!prev && articleFingerprint(prev.article) === fp;
  releasable(v, approvedBy);
  if (same) return prev;
  if (prev) throw new Refusal(`released at revision ${prev.revision} with other text: use correct, with a note`);
  return {
    ...snapshot(a, v, approvedBy, date, 1),
    figures,
    history: [{ revision: 1, date, approvedBy, fingerprint: fp }],
  };
}

/** Every unit a correction can name, in reading order, with its fingerprint: the headline, SEO title, each sentence
 *  (with its block's callout), each section heading (`heading:<section>`), each table by id and figure by ref. */
function unitsOf(a: Article): [string, string][] {
  const out: [string, string][] = [
    ['meta.headline', sha(a.meta.headline)],
    ['meta.seoTitle', sha(a.meta.seoTitle)],
    [a.meta.dek.id, sentenceFingerprint(a.meta.dek)],
    [a.meta.description.id, sentenceFingerprint(a.meta.description)],
  ];
  for (const sec of a.sections) {
    out.push([`heading:${sec.name}`, sha(sec.heading)]);
    for (const b of sec.blocks)
      if (b.kind === 'prose') {
        const { sentences: _s, ...attrs } = b;
        void _s;
        for (const x of b.sentences) out.push([x.id, sha(sentenceFingerprint(x) + JSON.stringify(attrs))]);
      } else out.push([b.kind === 'table' ? b.id : b.ref, sha(JSON.stringify(b))]);
  }
  return out;
}

/** The units a reviewer approves besides sentences, with the fingerprint an approval names: the headline, SEO title,
 *  each section heading, each table and figure (the ids correctArticle names). */
export function articleReviewUnits(a: Article): [string, string][] {
  const ids = new Set(articleSentences(a).map((s) => s.id));
  return unitsOf(a).filter(([id]) => !ids.has(id));
}

/** A new release of changed text or figure data, and the noted revision it adds to the topic's public record. A
 *  figure whose data differs from the release's snapshot is named, so a release without one names every figure. */
export function correctArticle(
  prev: ArticleRelease,
  a: Article,
  v: ScriptValidation,
  approvedBy: string,
  note: string,
  date: string,
  figures: Record<string, FigureData>,
): { release: ArticleRelease; revision: Extract<Revision, { kind: 'article' }> } {
  if (!note.trim()) throw new Refusal('a correction needs a --note');
  // register D10: a correction of a released article is a person's act; automation may run the correction a person
  // decided (decide ok carries that person's name), never approve one in its own name
  if (/^automated:/i.test(approvedBy.trim()))
    throw new Refusal(
      'only a person releases a correction (register D10); automation requests one and the person decides',
    );
  releasable(v, approvedBy);
  const fp = articleFingerprint(a);
  const before = new Map(unitsOf(prev.article));
  const now = unitsOf(a);
  const ids = new Set(now.map(([id]) => id));
  const sentences = [
    ...new Set([
      ...now.filter(([id, print]) => before.get(id) !== print).map(([id]) => id),
      ...[...before.keys()].filter((id) => !ids.has(id)),
      ...Object.keys(figures).filter((ref) => figureSha(figures[ref]) !== figureSha(prev.figures?.[ref])),
    ]),
  ];
  if (!sentences.length) throw new Refusal('the article is unchanged since its release');
  const revision = prev.revision + 1;
  return {
    release: {
      ...snapshot(a, v, approvedBy, date, revision),
      figures,
      history: [...prev.history, { revision, date, approvedBy, fingerprint: fp, note: note.trim(), sentences }],
    },
    revision: {
      at: date,
      kind: 'article',
      id: a.story,
      from: null,
      to: null,
      sentences,
      note: note.trim(),
      release: revision,
    },
  };
}

/** A stale release whose text stands: the same text approved again with a note, its date moved to today so the
 *  revised finding no longer postdates it. No public-record revision: nothing the reader saw changed. */
export function reaffirmArticle(
  prev: ArticleRelease,
  stale: boolean,
  a: Article,
  v: ScriptValidation,
  approvedBy: string,
  note: string,
  date: string,
): ArticleRelease {
  if (!stale) throw new Refusal('the article is not stale: nothing it relies on was revised after its release');
  if (!note.trim()) throw new Refusal('a reaffirmation needs a --note saying why the text stands');
  releasable(v, approvedBy);
  const fp = articleFingerprint(a);
  if (articleFingerprint(prev.article) !== fp) throw new Refusal('the article changed since its release: use correct');
  return {
    ...prev,
    date,
    history: [
      ...prev.history,
      { revision: prev.revision, date, approvedBy, fingerprint: fp, note: note.trim(), reaffirmed: true },
    ],
  };
}

const MARK: Record<string, string> = { verified: 'ok', 'needs-review': 'review', blocked: 'BLOCKED' };

/** The article as a reader sees it, with each sentence's state, then the open issues (as script.md reads). */
export function renderArticleMd(a: Article, v: ScriptValidation): string {
  const by = new Map(v.sentences.map((s) => [s.id, s]));
  const units = new Map(articleReviewUnits(a));
  const unit = (id: string) => `[${id} fp=${units.get(id)}]`;
  const line = (s: Sentence) => {
    const r = by.get(s.id);
    const m = r && (r.assertions.length || r.issues.length || r.status !== 'verified') ? MARK[r.status] : '';
    return `${s.text} [${s.id}${m ? ` ${m}` : ''} fp=${r?.fingerprint ?? sentenceFingerprint(s)}]`;
  };
  const out = [
    `# ${a.meta.headline} ${unit('meta.headline')}`,
    '',
    `Story \`${a.story}\` (${a.topic}), revision ${a.revision}. SEO title: ${a.meta.seoTitle} ${unit('meta.seoTitle')}. Validation: **${v.status}**, ${v.counts.blocking} blocking, ${v.counts.warnings} warnings, ${v.counts.verified}/${v.counts.assertions} assertions verified.`,
    '',
    `> ${line(a.meta.dek)}`,
    '',
    `Description: ${line(a.meta.description)}`,
    '',
  ];
  for (const sec of a.sections) {
    out.push(`## ${sec.heading} ${unit(`heading:${sec.name}`)}`, '');
    for (const b of sec.blocks)
      if (b.kind === 'prose')
        out.push(
          `${b.callout ? `**${b.callout}${b.claim ? ` (${b.claim})` : ''}${b.gap === undefined ? '' : ` (gap ${b.gap})`}:** ` : ''}${b.sentences.map(line).join(' ')}`,
          '',
        );
      else if (b.kind === 'table')
        out.push(
          `Table ${b.id}: ${b.caption} ${unit(b.id)}`,
          '',
          `| | ${b.columns.join(' | ')} |`,
          `|---|${b.columns.map(() => '---').join('|')}|`,
          ...b.rows.map((r) => `| ${r.label} | ${r.cells.map((c) => c.display).join(' | ')} |`),
          '',
        );
      else out.push(`Figure ${b.ref}: ${b.caption} ${unit(b.ref)}`, '');
  }
  const open = v.issues.filter((i) => !i.disposition);
  if (open.length) {
    out.push('## Open issues', '');
    for (const i of open)
      out.push(
        `- **${i.severity}** ${i.sentence}${i.assertion ? ` (${i.assertion})` : ''} ${i.category} (${i.by}): ${i.explanation}${i.suggestion ? ` Suggestion: ${i.suggestion}` : ''}`,
      );
    out.push('');
  }
  return out.join('\n');
}
