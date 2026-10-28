// The released article as the matter page shows it: the release's snapshot (never article.json), each sentence's
// source marks numbered in first-use order, the noted corrections and a revised finding it relies on.
import { type ArticleRelease, type Callout, articleSentences } from './article';
import { chartProblems, datasetChart } from './chart-geometry';
import { type PublicRecord, type Revision, isClaimRevision } from './public-record';
import type { Sentence } from './script';
import type { DataTable } from './datasets';
import type { ChartSpec } from './storyboard';
import type { Topic } from './topics';
import { citeHref, citeLabel, datasetSource } from './url';

/** What a figure draws: a storyboard chart or an evidence dataset, with the source line its caption carries. */
export interface FigureDraw {
  chart?: ChartSpec;
  table?: DataTable;
  source: string;
}
export type ViewBlock =
  | {
      kind: 'p';
      callout?: Callout;
      sentences: { id: string; text: string; refs: number[]; correctedOn?: string }[];
    }
  | { kind: 'table'; caption: string; columns: string[]; rows: { label: string; cells: string[] }[] }
  | { kind: 'figure'; ref: string; caption: string; draw?: FigureDraw };
export interface ArticleView {
  headline: string;
  dek: string;
  sections: { heading: string; blocks: ViewBlock[] }[];
  refs: { n: number; label: string; href: string }[];
  corrections: { date: string; note: string; sentences: string[] }[];
  stale: Revision | null;
}

/** What each figure of the release draws, only ever from the release's own snapshot: a release without one fails
 *  (the build stops), never falling back to the live storyboard or dataset. */
export function releaseFigureDraws(r: ArticleRelease, docNames: Record<string, string>): Map<string, FigureDraw> {
  const out = new Map<string, FigureDraw>();
  for (const b of r.article.sections.flatMap((s) => s.blocks)) {
    if (b.kind !== 'figure') continue;
    const d = r.figures?.[b.ref];
    if (!d)
      throw new Error(
        `figure ${b.ref}: the release has no snapshot of its data; run npm run article -- correct ${r.topic} ${r.story} --note "<why>"`,
      );
    const chart = 'chart' in d ? d.chart : datasetChart(d.table);
    const problems = chart ? chartProblems(chart) : [];
    if (problems.length) throw new Error(`figure ${b.ref}: ${problems.join('; ')}`);
    if ('chart' in d)
      out.set(b.ref, {
        chart: d.chart,
        // "Document name, lines 10-24" for each distinct passage its points cite
        source: [...new Set(d.chart.points.map((p) => p.cite))].map((c) => citeLabel(docNames, c)).join('; '),
      });
    else
      out.set(b.ref, {
        table: d.table,
        ...(chart && { chart }),
        source: datasetSource(
          docNames,
          d.table.rows.flatMap((x) => x.cells.map((c) => c.cite)),
          d.table.asOf,
        ),
      });
  }
  return out;
}

/** The newest revision of a claim the release asserts, made after the release. */
export function articleStale(r: ArticleRelease, record: PublicRecord): Revision | null {
  const claims = new Set([
    ...articleSentences(r.article).flatMap((s) => (s.assertions ?? []).flatMap((a) => a.claims.map((c) => c.id))),
    ...r.article.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'prose' && b.claim ? [b.claim] : []))),
  ]);
  // The record is append-only: a release that counted it knows exactly which revisions came after, even the same day.
  // An older release falls back to whole days.
  const seen = r.recordSeen;
  return (
    record.revisions
      .filter((v, i) => isClaimRevision(v) && claims.has(v.id) && (seen === undefined ? v.at > r.date : i >= seen))
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1) ?? null
  );
}

export function articleView(
  r: ArticleRelease,
  t: Pick<Topic, 'sources' | 'docNames'>,
  record: PublicRecord,
  repo: string,
  figures?: Map<string, FigureDraw>,
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
        n = number(e.cite, citeLabel(t.docNames, e.cite), citeHref(repo, e.cite));
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
        const draw = figures?.get(b.ref);
        return { kind: 'figure', ref: b.ref, caption: b.caption, ...(draw && { draw }) };
      }),
    })),
    refs,
    corrections: r.history
      .filter((h) => h.note && !h.reaffirmed)
      .map((h) => ({ date: h.date, note: h.note!, sentences: h.sentences ?? [] }))
      .reverse(),
    stale: articleStale(r, record),
  };
}
