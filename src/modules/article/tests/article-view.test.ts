import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTICLE_FILES, type ArticleRelease, loadArticleRelease } from '../article';
import { articleStale, articleView, releaseFigureDraws } from '../view';
import type { PublicRecord, Revision } from '../../../shared/types';
import { readJson } from '../../../shared/io';
import { scriptDir, scriptDirs } from '../../../shared/io';
import type { SourceView } from '../../evidence';
import { article } from './article-helpers';
import { DOC_D, MLM, fact, sentence } from '../../../../tests/script-helpers';

const A = DOC_D;
const B = 'demo/sources/field-c.txt#L20-L21';
const prose = (...ids: [string, string[]][]) => ({
  kind: 'prose' as const,
  sentences: ids.map(([id, cites]) => sentence(id, `Text ${id}.`, 'factual', [fact(`${id}.a`, 'A fact.', cites)])),
});
const base = () =>
  article({
    sections: [{ name: 'answer', heading: 'What we found', blocks: [prose(['s1', [A]], ['s2', [B]], ['s3', [A]])] }],
  });
const release = (extra: Partial<ArticleRelease> = {}): ArticleRelease => ({
  topic: 'demo',
  story: 'decision:mlm-and-seminars',
  approvedBy: 'Jon',
  date: '2026-11-01',
  revision: 1,
  fingerprints: { article: 'f', package: 'p', validation: 'v' },
  article: base(),
  history: [{ revision: 1, date: '2026-11-01', approvedBy: 'Jon', fingerprint: 'f' }],
  ...extra,
});
const vid1 = { id: 'vid1', title: 'A video', href: 'https://www.youtube.com/watch?v=vid1', exhibit: 3 } as SourceView;
const topic = { sources: [vid1], docNames: { 'field-c.txt': 'Field C' } };
const empty: PublicRecord = { exhibits: {}, revisions: [] };
const REPO = 'https://github.com/x/y';
const claimRev = (id: string, at: string): Revision => ({ at, kind: 'claim', id, from: null, to: null, note: 'n' });

describe('article view', () => {
  it('renders the release snapshot, not article.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'article-view-'));
    const dir = scriptDir('demo', 'decision:mlm-and-seminars', root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ARTICLE_FILES.release), JSON.stringify(release()));
    writeFileSync(
      join(dir, ARTICLE_FILES.article),
      JSON.stringify(article({ meta: { ...base().meta, headline: 'Edited' } })),
    );
    const v = articleView(loadArticleRelease('demo', 'decision:mlm-and-seminars', root)!, topic, empty, REPO);
    expect(v.headline).toBe(base().meta.headline);
    expect(v.sections[0].blocks[0]).toMatchObject({ sentences: [{ text: 'Text s1.' }, {}, {}] });
  });

  it('numbers references in first-use order and reuses a number for a repeated cite', () => {
    const v = articleView(release(), topic, empty, REPO);
    const b = v.sections[0].blocks[0];
    expect(b.kind === 'p' && b.sentences.map((s) => s.refs)).toEqual([[1], [2], [1]]);
    expect(v.refs).toHaveLength(2);
    expect(v.refs[0].href).toBe(`${REPO}/blob/main/topics/${A}`);
    expect(v.refs[1].label).toBe('Field C, lines 20-21');
  });

  it('a statement reference names its exhibit', () => {
    const s = sentence('s1', 'A video says so.', 'attributed', [
      { ...fact('s1.a', 'It says so.'), evidence: [{ kind: 'statement', claim: MLM, source: 'vid1' }] },
    ]);
    const a = article({ sections: [{ name: 'answer', heading: 'H', blocks: [{ kind: 'prose', sentences: [s] }] }] });
    const v = articleView(release({ article: a }), topic, { exhibits: { vid1: 7 }, revisions: [] }, REPO);
    expect(v.refs[0].label.startsWith('Exhibit 7: ')).toBe(true);
    expect(v.refs[0].href).toBe(vid1.href);
  });

  it('a claim revised after the release makes it stale; one before does not', () => {
    const rec = (r: Revision) => ({ exhibits: {}, revisions: [r] });
    const after = claimRev(MLM, '2026-11-02');
    expect(articleStale(release(), rec(after))).toEqual(after);
    expect(articleStale(release(), rec(claimRev(MLM, '2026-10-30')))).toBeNull();
    expect(articleStale(release(), rec(claimRev('demo/other', '2026-11-02')))).toBeNull();
  });

  it('a release that records the revisions it saw is stale on any later one, the same day too', () => {
    const before = claimRev(MLM, '2026-11-01');
    const sameDayLater = claimRev(MLM, '2026-11-01');
    const r = release({ recordSeen: 1 });
    expect(articleStale(r, { exhibits: {}, revisions: [before] })).toBeNull();
    expect(articleStale(r, { exhibits: {}, revisions: [before, sameDayLater] })).toBe(sameDayLater);
    // without the count, the date decides (as before)
    expect(articleStale(release(), { exhibits: {}, revisions: [before, sameDayLater] })).toBeNull();
  });

  it('a claim named only by a callout counts toward staleness', () => {
    const r = release();
    r.article.sections[0].blocks.push({
      kind: 'prose',
      callout: 'qualification',
      claim: 'demo/callout-only',
      sentences: [sentence('s9', 'It depends.', 'rhetorical')],
    });
    const rev = claimRev('demo/callout-only', '2026-11-02');
    expect(articleStale(r, { exhibits: {}, revisions: [rev] })).toEqual(rev);
  });

  it('a reaffirmation is not shown as a correction', () => {
    const history = [
      ...release().history,
      {
        revision: 1,
        date: '2026-11-03',
        approvedBy: 'Jon',
        fingerprint: 'f',
        note: 'stands',
        reaffirmed: true as const,
      },
    ];
    expect(articleView(release({ history }), topic, empty, REPO).corrections).toEqual([]);
  });

  it('a correction marks its sentences', () => {
    const history = [
      ...release().history,
      { revision: 2, date: '2026-11-03', approvedBy: 'Jon', fingerprint: 'g', note: 'n', sentences: ['s3'] },
    ];
    const v = articleView(release({ history }), topic, empty, REPO);
    expect(v.corrections).toEqual([{ date: '2026-11-03', note: 'n', sentences: ['s3'] }]);
    const b = v.sections[0].blocks[0];
    expect(b.kind === 'p' && b.sentences.map((s) => !!s.correctedOn)).toEqual([false, false, true]);
  });

  it('a corrected sentence carries the date of the newest correction that names it', () => {
    const fix = (revision: number, date: string, sentences: string[]) => ({
      revision,
      date,
      approvedBy: 'Jon',
      fingerprint: `f${revision}`,
      note: `n${revision}`,
      sentences,
    });
    const history = [...release().history, fix(2, '2026-11-03', ['s1', 's3']), fix(3, '2026-11-05', ['s3'])];
    const v = articleView(release({ history }), topic, empty, REPO);
    expect(v.corrections.map((c) => c.date)).toEqual(['2026-11-05', '2026-11-03']);
    const b = v.sections[0].blocks[0];
    expect(b.kind === 'p' && b.sentences.map((s) => s.correctedOn)).toEqual(['2026-11-03', undefined, '2026-11-05']);
  });

  describe('released figures', () => {
    const ref = 'decision-mlm-and-seminars/sc01';
    const chart = {
      type: 'bar' as const,
      points: [{ label: 'Lost money', value: 47, unit: 'percent' as const, display: '47%', cite: B }],
    };
    const withFigure = (extra: Partial<ArticleRelease>) =>
      release({
        article: article({
          sections: [{ name: 'answer', heading: 'H', blocks: [{ kind: 'figure', ref, caption: 'C' }] }],
        }),
        ...extra,
      });
    it('figures are drawn from the release snapshot, not the storyboard', () => {
      const draws = releaseFigureDraws(withFigure({ figures: { [ref]: { chart } } }), topic.docNames);
      expect(draws.get(ref)).toEqual({ chart, source: 'Field C, lines 20-21' });
    });
    it('a release whose figure has no snapshot fails closed', () => {
      expect(() => releaseFigureDraws(withFigure({ figures: undefined }), topic.docNames)).toThrow(
        /no snapshot.*npm run article -- correct/,
      );
    });
    it('a snapshot that would mislead fails the build', () => {
      const bad = { ...chart, points: [{ ...chart.points[0], value: 147, display: '147%' }] };
      expect(() => releaseFigureDraws(withFigure({ figures: { [ref]: { chart: bad } } }), topic.docNames)).toThrow(
        new RegExp(`figure ${ref}`),
      );
    });
  });

  it('every committed article release snapshots each figure it shows', () => {
    for (const { topic: name, slug, dir } of scriptDirs()) {
      const r = readJson<ArticleRelease>(join(dir, ARTICLE_FILES.release));
      if (!r) continue;
      for (const b of r.article.sections.flatMap((s) => s.blocks))
        if (b.kind === 'figure') expect(r.figures?.[b.ref], `${name}/${slug} ${b.ref}`).toBeDefined();
    }
  });

  it('a figure with a known ref carries what it draws; an unknown one only its caption', () => {
    const a = article({
      sections: [
        {
          name: 'answer',
          heading: 'H',
          blocks: [
            { kind: 'figure', ref: 'slug/sc01', caption: 'Known' },
            { kind: 'figure', ref: 'slug/sc02', caption: 'Unknown' },
          ],
        },
      ],
    });
    const draw = { chart: { type: 'bar' as const, points: [] }, source: 'S' };
    const v = articleView(release({ article: a }), topic, empty, REPO, new Map([['slug/sc01', draw]]));
    expect(v.sections[0].blocks).toEqual([
      { kind: 'figure', ref: 'slug/sc01', caption: 'Known', draw },
      { kind: 'figure', ref: 'slug/sc02', caption: 'Unknown' },
    ]);
  });
});
