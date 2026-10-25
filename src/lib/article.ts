// The companion article: prose blocks over the script's sentences, so the script validator judges it unchanged.
import { join } from 'node:path';
import { readJson, ROOT, sha } from './io';
import type { Revision } from './public-record';
import { Refusal } from './publish';
import { approverProblem, validationFingerprint } from './release';
import {
  type Script,
  type ScriptValidation,
  type SectionName,
  type Sentence,
  scriptDir,
  sentenceFingerprint,
} from './script';
import type { ChartPoint } from './storyboard';

export const ARTICLE_FILES = {
  article: 'article.json',
  review: 'article-review.json',
  validation: 'article-validation.json',
  md: 'article.md',
  release: 'article-release.json',
} as const;

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
  | { kind: 'figure'; ref: string; caption: string };

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

export const articleFingerprint = (a: Article) => sha(JSON.stringify({ meta: a.meta, sections: a.sections }));

/** What the site renders: the article as approved, with every correction since. */
export interface ArticleRelease {
  topic: string;
  story: string;
  approvedBy: string;
  date: string;
  revision: number;
  fingerprints: { article: string; package: string; validation: string };
  article: Article;
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

export const loadArticleRelease = (topic: string, storyId: string, root = ROOT) =>
  readJson<ArticleRelease>(join(scriptDir(topic, storyId, root), ARTICLE_FILES.release));

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

/** The first release. Locking the released text again changes nothing; a changed text is a correction. */
export function lockArticle(
  prev: ArticleRelease | null,
  a: Article,
  v: ScriptValidation,
  approvedBy: string,
  date: string,
): ArticleRelease {
  releasable(v, approvedBy);
  const fp = articleFingerprint(a);
  if (prev?.fingerprints.article === fp) return prev;
  if (prev) throw new Refusal(`released at revision ${prev.revision} with other text: use correct, with a note`);
  return { ...snapshot(a, v, approvedBy, date, 1), history: [{ revision: 1, date, approvedBy, fingerprint: fp }] };
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

/** A new release of changed text, and the noted revision it adds to the topic's public record. */
export function correctArticle(
  prev: ArticleRelease,
  a: Article,
  v: ScriptValidation,
  approvedBy: string,
  note: string,
  date: string,
): { release: ArticleRelease; revision: Extract<Revision, { kind: 'article' }> } {
  if (!note.trim()) throw new Refusal('a correction needs a --note');
  releasable(v, approvedBy);
  const fp = articleFingerprint(a);
  if (prev.fingerprints.article === fp) throw new Refusal('the article is unchanged since its release');
  const before = new Map(unitsOf(prev.article));
  const now = unitsOf(a);
  const ids = new Set(now.map(([id]) => id));
  const sentences = [
    ...now.filter(([id, print]) => before.get(id) !== print).map(([id]) => id),
    ...[...before.keys()].filter((id) => !ids.has(id)),
  ];
  if (!sentences.length) throw new Refusal('the text changed but no sentence, heading, table or figure did');
  const revision = prev.revision + 1;
  return {
    release: {
      ...snapshot(a, v, approvedBy, date, revision),
      history: [...prev.history, { revision, date, approvedBy, fingerprint: fp, note: note.trim(), sentences }],
    },
    revision: { at: date, kind: 'article', id: a.story, from: null, to: null, sentences, note: note.trim() },
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
  if (prev.fingerprints.article !== fp) throw new Refusal('the article changed since its release: use correct');
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
