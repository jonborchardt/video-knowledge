// The released article as the matter page shows it: the release's snapshot (never article.json), each sentence's
// source marks numbered in first-use order, the noted corrections and a revised finding it relies on.
import { type ArticleRelease, type Callout, articleSentences } from './article';
import { type PublicRecord, type Revision, isClaimRevision } from './public-record';
import type { Sentence } from './script';
import type { Topic } from './topics';
import { citeHref, citeLines } from './url';

export interface FigureTable {
  columns: string[];
  rows: { label: string; cells: string[] }[];
}
export type ViewBlock =
  | {
      kind: 'p';
      callout?: Callout;
      sentences: { id: string; text: string; refs: number[]; corrected: boolean; correctedOn?: string }[];
    }
  | { kind: 'table'; caption: string; columns: string[]; rows: { label: string; cells: string[] }[] }
  | { kind: 'figure'; ref: string; caption: string; table?: FigureTable }; // the chart's points until plan 3 draws it
export interface ArticleView {
  headline: string;
  dek: string;
  sections: { heading: string; blocks: ViewBlock[] }[];
  refs: { n: number; label: string; href: string }[];
  corrections: { date: string; note: string; sentences: string[] }[];
  stale: Revision | null;
}

/** The newest revision of a claim the release asserts, made after the release. */
export function articleStale(r: ArticleRelease, record: PublicRecord): Revision | null {
  const claims = new Set(
    articleSentences(r.article).flatMap((s) => (s.assertions ?? []).flatMap((a) => a.claims.map((c) => c.id))),
  );
  return (
    record.revisions
      .filter((v) => isClaimRevision(v) && claims.has(v.id) && v.at > r.date)
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1) ?? null
  );
}

export function articleView(
  r: ArticleRelease,
  t: Pick<Topic, 'sources' | 'docNames'>,
  record: PublicRecord,
  repo: string,
  figures?: Map<string, FigureTable>,
): ArticleView {
  const a = r.article;
  // each corrected sentence's newest correction date (history is oldest first)
  const correctedOn = new Map(r.history.flatMap((h) => (h.sentences ?? []).map((id) => [id, h.date] as const)));
  const sources = new Map(t.sources.map((x) => [x.id, x]));
  const refs: ArticleView['refs'] = [];
  const numbers = new Map<string, number>();
  const number = (key: string, label: string, href: string) => {
    let n = numbers.get(key);
    if (!n) {
      n = refs.length + 1;
      refs.push({ n, label, href });
      numbers.set(key, n);
    }
    return n;
  };
  const refsOf = (s: Sentence) => {
    const out: number[] = [];
    for (const e of (s.assertions ?? []).flatMap((x) => x.evidence)) {
      let n: number | undefined;
      if (e.kind === 'study') {
        const file = e.cite.split('#')[0].split('/').pop()!;
        n = number(e.cite, `${t.docNames[file] ?? file}, lines ${citeLines(e.cite)}`, citeHref(repo, e.cite));
      } else if (e.kind === 'statement') {
        const x = sources.get(e.source);
        const exhibit = record.exhibits[e.source] ?? x?.exhibit;
        if (x) n = number(`source:${x.id}`, `${exhibit ? `Exhibit ${exhibit}: ` : ''}${x.title}`, x.href);
      }
      if (n && !out.includes(n)) out.push(n);
    }
    return out;
  };
  return {
    headline: a.meta.headline,
    dek: a.meta.dek.text,
    sections: a.sections.map((sec) => ({
      heading: sec.heading,
      blocks: sec.blocks.map((b): ViewBlock => {
        if (b.kind === 'prose')
          return {
            kind: 'p',
            ...(b.callout && { callout: b.callout }),
            sentences: b.sentences.map((s) => ({
              id: s.id,
              text: s.text,
              refs: refsOf(s),
              corrected: correctedOn.has(s.id),
              ...(correctedOn.has(s.id) && { correctedOn: correctedOn.get(s.id) }),
            })),
          };
        if (b.kind === 'table')
          return {
            kind: 'table',
            caption: b.caption,
            columns: b.columns,
            rows: b.rows.map((x) => ({ label: x.label, cells: x.cells.map((c) => c.display) })),
          };
        const table = figures?.get(b.ref);
        return { kind: 'figure', ref: b.ref, caption: b.caption, ...(table && { table }) };
      }),
    })),
    refs,
    corrections: r.history
      .filter((h) => h.note)
      .map((h) => ({ date: h.date, note: h.note!, sentences: h.sentences ?? [] }))
      .reverse(),
    stale: articleStale(r, record),
  };
}
