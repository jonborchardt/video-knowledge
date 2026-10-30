import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Article,
  type Block,
  type FigureData,
  articleAsScript,
  articleDrift,
  articleFingerprint,
  articleModified,
  articleReviewUnits,
  correctArticle,
  lockArticle,
  reaffirmArticle,
  releaseFigures,
  renderArticleMd,
} from '../article';
import type { ChartSpec } from '../../../lib/storyboard';
import { Refusal } from '../../../shared/refusal';
import { publicRecordProblems, withArticleRevision } from '../../../shared/public-record';
import { LIMITS, figureData, figuresOf, validateArticle } from '../validation';
import { buildPackage } from '../../../lib/evidence-package';
import { scriptDir } from '../../../shared/io';
import type { EvidencePackage, Sentence } from '../../../shared/types';
import { approveArticle, article } from './article-helpers';
import { claim, guess, sources } from '../../../../tests/corpus';
import {
  DOC_D,
  asTopic,
  cats,
  corpus,
  hashOf,
  pkg,
  read,
  rental,
  review,
  run,
  sentence,
  story,
  t,
} from '../../../../tests/script-helpers';

describe('article format', () => {
  it('the adapter keeps section order and headings, with the dek and description first', () => {
    const s = articleAsScript(article());
    expect(s.sections.map((x) => [x.name, x.title])).toEqual([
      ['hook', 'Why it matters'],
      ['answer', 'What we found'],
    ]);
    expect(s.sections[0].sentences.slice(0, 2).map((x) => x.id)).toEqual(['meta.dek', 'meta.description']);
  });
  it('the fingerprint follows the text, not the generation record', () => {
    const a = article();
    expect(articleFingerprint({ ...a, generation: { ...a.generation, date: 'later' } })).toBe(articleFingerprint(a));
    const b = structuredClone(a);
    (b.sections[1].blocks[0] as { sentences: Sentence[] }).sentences[0].text = 'changed';
    expect(articleFingerprint(b)).not.toBe(articleFingerprint(a));
  });
  it('the fixture passes the script validator once approved', () => {
    const a = article();
    const v = run(articleAsScript(a), approveArticle(a));
    expect(cats(v)).toEqual([]);
    expect(v.status).toBe('passed');
  });
});

const check = (a: Article, extra: Partial<Parameters<typeof validateArticle>[3]> = {}, c = corpus()) => {
  const q = extra.pkg ?? pkg();
  return validateArticle(a, c, read, {
    pkg: q,
    hashDoc: hashOf(q),
    review: null,
    script: null,
    figures: new Set(),
    ...extra,
  });
};
const withBlock = (b: Block, a = article()): Article => {
  const x = structuredClone(a);
  x.sections[1].blocks.push(b);
  return x;
};
const prose = (id: string, text: string, extra: Partial<Extract<Block, { kind: 'prose' }>> = {}): Block => ({
  kind: 'prose',
  sentences: [sentence(id, text, 'rhetorical')],
  ...extra,
});

describe('article validation', () => {
  it('an approved, cited article passes', () => {
    const a = article();
    const v = check(a, { review: approveArticle(a) });
    expect(cats(v)).toEqual([]);
    expect(v.status).toBe('passed');
  });
  it('a factual sentence on a claim no study decided blocks, as in a script', () => {
    const guessed = claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
      verdicts: [guess('right', 0.4)],
      sources: sources(3),
    });
    const a = article();
    const v = check(a, { review: approveArticle(a) }, { name: corpus().name, claims: [guessed, rental()] });
    expect(v.status).toBe('blocked');
    expect(v.issues.filter((i) => i.sentence === 's02' && i.severity === 'blocking').map((i) => i.category)).toEqual([
      'bad-reference',
    ]);
  });
  it('an uncovered qualification blocks; a callout naming the claim clears it', () => {
    const q = structuredClone(pkg());
    q.claims[0].verdict = 'partly';
    q.claims[0].decidedBy = 'S';
    q.claims[0].confidence = 0.9;
    const bare = structuredClone(article());
    bare.sections[1].blocks = bare.sections[1].blocks.filter((b) => b.kind !== 'prose' || !b.callout);
    expect(cats(check(bare, { pkg: q }))).toContain('qualification-coverage');
    const called = withBlock(
      prose('s04', 'It holds only in part.', { callout: 'qualification', claim: q.claims[0].id }),
      bare,
    );
    expect(cats(check(called, { pkg: q }))).not.toContain('qualification-coverage');
  });
  it('a qualified assertion covers a claim only when its qualification names a sentence of the article', () => {
    const q = structuredClone(pkg());
    q.claims[0].verdict = 'partly';
    q.claims[0].decidedBy = 'S';
    q.claims[0].confidence = 0.9;
    const qualified = (qualifications: string[]) => {
      const x = structuredClone(article());
      x.sections[1].blocks = x.sections[1].blocks.filter((b) => b.kind !== 'prose' || !b.callout);
      (x.sections[1].blocks[0] as { sentences: Sentence[] }).sentences[0].assertions![0].qualifications =
        qualifications;
      return cats(check(x, { pkg: q }));
    };
    expect(qualified(['.'])).toContain('qualification-coverage');
    expect(qualified(['s99 says so.'])).toContain('qualification-coverage');
    expect(qualified(['s01 says it is one survey.'])).not.toContain('qualification-coverage');
  });
  it('an uncovered gap warns; an unresolved callout naming it clears it', () => {
    const q: EvidencePackage = { ...pkg(), gaps: ['no second survey'] };
    const warn = (a: Article) => check(a, { pkg: q }).issues.filter((i) => i.category === 'gap-coverage').length;
    expect(warn(article())).toBe(1);
    expect(warn(withBlock(prose('s04', 'No one has looked twice.', { callout: 'unresolved', gap: 0 })))).toBe(0);
  });
  it('metadata over its limit blocks', () => {
    const a = article();
    expect(cats(check(a))).not.toContain('metadata');
    const long = { ...a, meta: { ...a.meta, seoTitle: 'x'.repeat(LIMITS.seoTitle + 1) } };
    expect(cats(check(long))).toContain('metadata');
    const empty = { ...a, meta: { ...a.meta, dek: { ...a.meta.dek, text: ' ' } } };
    expect(cats(check(empty))).toContain('metadata');
  });
  it('a URL in prose blocks', () => {
    expect(cats(check(withBlock(prose('s04', 'For more, see https://example.com today.'))))).toContain('no-url');
  });
  it('a URL in the headline, a heading or a caption blocks too', () => {
    const urls = (a: Article) =>
      check(a)
        .issues.filter((i) => i.category === 'no-url')
        .map((i) => i.sentence);
    const a = article();
    expect(urls({ ...a, meta: { ...a.meta, headline: 'Read www.example.com' } })).toEqual(['meta.headline']);
    expect(urls({ ...a, meta: { ...a.meta, seoTitle: 'http://x.org' } })).toEqual(['meta.seoTitle']);
    const h = structuredClone(a);
    h.sections[0].heading = 'See https://x.org';
    expect(urls(h)).toEqual(['-']);
    expect(urls(withBlock({ kind: 'figure', ref: 'x/sc01', caption: 'from www.x.org' }))).toEqual(['x/sc01']);
  });
  it('a URL in a table column, row label, cell label or display blocks', () => {
    const cell = { label: 'Lost money', value: 47, unit: 'percent' as const, display: '47%', cite: DOC_D };
    const table = (patch: (b: Extract<Block, { kind: 'table' }>) => void) => {
      const b: Extract<Block, { kind: 'table' }> = {
        kind: 'table',
        id: 'tb1',
        caption: 'Outcomes',
        columns: ['Share'],
        rows: [{ label: 'Lost money', cells: [{ ...cell }] }],
      };
      patch(b);
      return check(withBlock(b))
        .issues.filter((i) => i.category === 'no-url')
        .map((i) => i.sentence);
    };
    expect(table(() => {})).toEqual([]);
    expect(table((b) => (b.columns[0] = 'www.x.org'))).toEqual(['tb1']);
    expect(table((b) => (b.rows[0].label = 'see https://x.org'))).toEqual(['tb1']);
    expect(table((b) => (b.rows[0].cells[0].label = 'www.x.org'))).toEqual(['tb1']);
    expect(table((b) => (b.rows[0].cells[0].display = '47% www.x.org'))).toEqual(['tb1']);
  });
  it('a table cell whose display does not state its value blocks', () => {
    const table = (cite: string, display: string): Block => ({
      kind: 'table',
      id: 'tb1',
      caption: 'Outcomes',
      columns: ['Share'],
      rows: [{ label: 'Lost money', cells: [{ label: 'Lost money', value: 47, unit: 'percent', display, cite }] }],
    });
    expect(cats(check(withBlock(table(DOC_D, '47%'))))).toEqual([]);
    const bad = check(withBlock(table(DOC_D, '27%'))).issues.filter((i) => i.category === 'table-data');
    expect(bad.map((i) => i.explanation)).toEqual([
      'table tb1 row "Lost money": display "27%" does not state the value 47',
    ]);
    const unknown = check(withBlock(table('demo/sources/x.txt#L1-L2', '47%'))).issues.find(
      (i) => i.category === 'table-data',
    );
    expect(unknown?.explanation).toBe(
      'table tb1 row "Lost money" cites demo/sources/x.txt#L1-L2, which is not in the evidence package',
    );
  });
  it('a figure must name a chart the story has', () => {
    const a = withBlock({ kind: 'figure', ref: 'x/sc99', caption: 'c' });
    const v = check(a, { figures: new Set(['x/sc01']) });
    expect(v.issues.filter((i) => i.category === 'figure').map((i) => i.sentence)).toEqual(['x/sc99']);
    expect(cats(check(a, { figures: new Set(['x/sc99']) }))).not.toContain('figure');
  });
  it('figureData lists storyboard charts and datasets, and figuresOf is its keys', { timeout: 5000 }, () => {
    const root = mkdtempSync(join(tmpdir(), 'figures-'));
    const dir = scriptDir('demo', 'decision:mlm-and-seminars', root);
    mkdirSync(dir, { recursive: true });
    const scenes = [
      { id: 'sc01', visual: { category: 'chart', chart: { type: 'bar', points: [] } } },
      { id: 'sc02', visual: { category: 'typography' } },
    ];
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ scenes }));
    expect([...figuresOf('demo', 'decision:mlm-and-seminars', root)]).toEqual(['decision-mlm-and-seminars/sc01']);
    expect(figureData('demo', 'decision:mlm-and-seminars', root).get('decision-mlm-and-seminars/sc01')).toEqual({
      chart: { type: 'bar', points: [] },
    });
    expect(figuresOf('demo', 'decision:none', root).size).toBe(0);
    mkdirSync(join(root, 'topics', 'demo', 'data'), { recursive: true });
    writeFileSync(join(root, 'topics', 'demo', 'data', 'prices.json'), JSON.stringify({ id: 'prices' }));
    expect(figuresOf('demo', 'decision:none', root).has('data:demo/prices')).toBe(true);
  });
  it('an article that repeats the narration warns once per section', () => {
    const a = article();
    const v = check(a, { script: articleAsScript(a) });
    // the hook is under eight words, so only the answer section has 8-grams to compare
    expect(v.issues.filter((i) => i.category === 'transcript-overlap').map((i) => i.sentence)).toEqual(['s02']);
    expect(v.counts.warnings).toBe(check(a).counts.warnings + 1);
    // a reviewer retires it at the sentence's fingerprint, as for pacing
    const r = approveArticle(a);
    r.dispositions = { s02: { fingerprint: r.approved.s02, category: 'transcript-overlap', reason: 'said once' } };
    const d = check(a, { script: articleAsScript(a), review: r });
    expect(d.issues.find((i) => i.category === 'transcript-overlap')?.disposition).toBe('said once');
    expect(d.counts.warnings).toBe(check(a, { review: r }).counts.warnings);
  });
  it('a chained article without a question section blocks', () => {
    const q = buildPackage(story(), asTopic(t()), read, { review, chain: [story()] });
    const a = article();
    const chained: Article = {
      ...a,
      sections: [
        a.sections[0],
        { ...a.sections[1], name: 'question-1' },
        { name: 'close', heading: 'So', blocks: [prose('s05', 'So what comes next?')] },
      ],
    };
    const v = check(chained, { pkg: q });
    expect(v.status).toBe('blocked');
    expect(v.issues.map((i) => i.explanation)).toContainEqual(expect.stringMatching(/no "question-2" section/));
  });
  it('an article-only blocking issue blocks the status, the history and the revision limit', () => {
    const a = { ...withBlock(prose('s04', 'See www.example.com.')), revision: 3 };
    const v = check(a, { review: approveArticle(a) });
    expect(v.status).toBe('blocked');
    expect(v.counts.blocking).toBe(1);
    expect(v.history.at(-1)).toMatchObject({ status: 'blocked', blocking: 1 });
    expect(v.revisionLimitReached).toBe(true);
    // the sentence carrying the URL is blocked, not verified, though the reviewer approved it
    const s04 = v.sentences.find((s) => s.id === 's04')!;
    expect(s04.status).toBe('blocked');
    expect(s04.issues.map((i) => i.category)).toContain('no-url');
    expect(v.sentences.find((s) => s.id === 's02')!.status).toBe('verified');
  });
});

describe('article review units', () => {
  const tb: Block = {
    kind: 'table',
    id: 'tb1',
    caption: 'Outcomes',
    columns: ['Share'],
    rows: [
      {
        label: 'Lost money',
        cells: [{ label: 'Lost money', value: 47, unit: 'percent', display: '47%', cite: DOC_D }],
      },
    ],
  };
  const a = withBlock(tb);
  const ok = approveArticle(a);
  it('the headline, SEO title, headings and tables are approved by unit id', () => {
    expect(articleReviewUnits(a).map(([id]) => id)).toEqual([
      'meta.headline',
      'meta.seoTitle',
      'heading:hook',
      'heading:answer',
      'tb1',
    ]);
    expect(check(a, { review: ok }).status).toBe('passed');
  });
  it.each(['meta.headline', 'meta.seoTitle', 'heading:answer', 'tb1'])('%s unapproved holds the article', (id) => {
    const { [id]: _gone, ...approved } = ok.approved;
    void _gone;
    const v = check(a, { review: { ...ok, approved } });
    expect(v.status).toBe('needs-review');
    expect(v.issues.find((i) => i.sentence === id)?.category).toBe('unreviewed');
  });
  it('an edit after the review makes the approval stale', () => {
    const edits: ((x: Article) => void)[] = [
      (x) => (x.meta.headline = 'Another headline'),
      (x) => (x.meta.seoTitle = 'Another SEO title'),
      (x) => (x.sections[1].heading = 'Another heading'),
      (x) => ((x.sections[1].blocks.at(-1) as { caption: string }).caption = 'Outcomes reported'),
    ];
    for (const edit of edits) {
      const b = structuredClone(a);
      edit(b);
      expect(check(b, { review: ok }).status).toBe('needs-review');
    }
  });
  it('the markdown prints each unit with its fingerprint', () => {
    const md = renderArticleMd(a, check(a, { review: ok }));
    for (const [id, fp] of articleReviewUnits(a)) expect(md).toContain(`[${id} fp=${fp}]`);
  });
});

describe('article release', () => {
  const a = article();
  const passed = check(a, { review: approveArticle(a) });
  const edited = structuredClone(a);
  (edited.sections[1].blocks[1] as { sentences: Sentence[] }).sentences[0].text = 'One survey is not the final word.';
  const passedEdited = check(edited, { review: approveArticle(edited) });
  const r = lockArticle(null, a, passed, 'Jon', '2026-11-01', {});

  it('the fixtures pass', () => {
    expect([passed.status, passedEdited.status]).toEqual(['passed', 'passed']);
  });
  it('lock refuses a placeholder approver, an unpassed validation, and a changed article after release', () => {
    expect(() => lockArticle(null, a, passed, '<name>', 'd', {})).toThrow(Refusal);
    expect(() => lockArticle(null, a, check(a), 'Jon', 'd', {})).toThrow(Refusal);
    expect(() => lockArticle(r, edited, passedEdited, 'Jon', 'd', {})).toThrow(/correct/);
  });
  it('lock is idempotent', () => {
    expect(lockArticle(r, a, passed, 'Jon', '2026-11-02', {})).toBe(r);
  });
  it('the release snapshots the article and starts its history', () => {
    expect(r.article).toEqual(a);
    expect(r.revision).toBe(1);
    expect(r.history).toEqual([
      { revision: 1, date: '2026-11-01', approvedBy: 'Jon', fingerprint: articleFingerprint(a) },
    ]);
  });
  it('correct needs a note, names the changed sentences and records an article revision', () => {
    expect(() => correctArticle(r, edited, passedEdited, 'Jon', ' ', '2026-11-05', {})).toThrow(Refusal);
    expect(() => correctArticle(r, edited, check(edited), 'Jon', 'n', '2026-11-05', {})).toThrow(Refusal);
    expect(() => correctArticle(r, edited, passedEdited, 'automated:', 'n', '2026-11-05', {})).toThrow(Refusal);
    const { release, revision } = correctArticle(
      r,
      edited,
      passedEdited,
      'Jon',
      'Fixed the 2024 price',
      '2026-11-05',
      {},
    );
    expect(revision).toEqual({
      at: '2026-11-05',
      kind: 'article',
      id: a.story,
      from: null,
      to: null,
      sentences: ['s03'],
      note: 'Fixed the 2024 price',
      release: 2,
    });
    expect(release.revision).toBe(2);
    expect(release.article).toEqual(edited);
    expect(release.history).toHaveLength(2);
    expect(release.history[1]).toMatchObject({ revision: 2, note: 'Fixed the 2024 price', sentences: ['s03'] });
    expect(publicRecordProblems({ exhibits: {}, revisions: [revision] })).toEqual([]);
  });
  const fix = (prev: typeof r, b: Article) =>
    correctArticle(prev, b, check(b, { review: approveArticle(b) }), 'Jon', 'n', 'd', {});
  it('correct names added and removed sentences, and a changed headline or heading', () => {
    const b = structuredClone(a);
    b.sections[0].blocks = [prose('s09', 'Say you sign up under a friend.')];
    expect(fix(r, b).revision.sentences).toEqual(['s09', 's01']);
    const h = structuredClone(a);
    h.meta.headline = 'Another headline';
    h.sections[1].heading = 'What the survey found';
    expect(fix(r, h).revision.sentences).toEqual(['meta.headline', 'heading:answer']);
  });
  it('a table-only correction names the table id', () => {
    const cell = { label: 'Lost money', value: 47, unit: 'percent' as const, display: '47%', cite: DOC_D };
    const tb: Block = {
      kind: 'table',
      id: 'tb1',
      caption: 'Outcomes',
      columns: ['Share'],
      rows: [{ label: 'Lost money', cells: [cell] }],
    };
    const base = withBlock(tb);
    const v = check(base, { review: approveArticle(base) });
    expect(v.status).toBe('passed');
    const released = lockArticle(null, base, v, 'Jon', 'd', {});
    expect(fix(released, withBlock({ ...tb, caption: 'Outcomes reported' })).revision.sentences).toEqual(['tb1']);
  });
  it('a re-run of correct does not record the same revision twice', () => {
    const { revision } = correctArticle(r, edited, passedEdited, 'Jon', 'n', '2026-11-05', {});
    const once = withArticleRevision({ exhibits: {}, revisions: [] }, revision);
    expect(once.revisions).toEqual([revision]);
    expect(withArticleRevision(once, structuredClone(revision))).toBe(once);
    // a revision recorded before release numbers were kept dedupes on day, note and sentences
    const { release: _r, ...legacy } = revision;
    void _r;
    const old = withArticleRevision({ exhibits: {}, revisions: [] }, legacy);
    expect(withArticleRevision(old, structuredClone(legacy))).toBe(old);
    expect(withArticleRevision(old, { ...legacy, note: 'other' }).revisions).toHaveLength(2);
  });
  it('reaffirm keeps a stale text with a note and moves the release date', () => {
    expect(() => reaffirmArticle(r, false, a, passed, 'Jon', 'stands', '2026-11-09')).toThrow(/not stale/);
    expect(() => reaffirmArticle(r, true, edited, passedEdited, 'Jon', 'stands', '2026-11-09')).toThrow(/correct/);
    expect(() => reaffirmArticle(r, true, a, check(a), 'Jon', 'stands', '2026-11-09')).toThrow(Refusal);
    expect(() => reaffirmArticle(r, true, a, passed, '<name>', 'stands', '2026-11-09')).toThrow(Refusal);
    expect(() => reaffirmArticle(r, true, a, passed, 'Jon', ' ', '2026-11-09')).toThrow(Refusal);
    const x = reaffirmArticle(r, true, a, passed, 'Jon', 'the new study agrees', '2026-11-09');
    expect(x.date).toBe('2026-11-09');
    expect(x.revision).toBe(1);
    expect(x.article).toBe(r.article);
    expect(x.history.at(-1)).toEqual({
      revision: 1,
      date: '2026-11-09',
      approvedBy: 'Jon',
      fingerprint: articleFingerprint(a),
      note: 'the new study agrees',
      reaffirmed: true,
    });
  });
  it('correct refuses an unchanged article', () => {
    expect(() => correctArticle(r, a, passed, 'Jon', 'n', '2026-11-05', {})).toThrow(Refusal);
  });
  it('an edit no reader sees (a note, a qualification, whitespace) leaves the release standing', () => {
    const quiet = structuredClone(a);
    const s02 = (quiet.sections[1].blocks[0] as { sentences: Sentence[] }).sentences[0];
    s02.note = 'writer note';
    s02.assertions![0].qualifications = ['s03 says it is one survey.'];
    s02.text = s02.text.replace(' ', '  ');
    expect(articleFingerprint(quiet)).toBe(articleFingerprint(a));
    expect(lockArticle(r, quiet, passed, 'Jon', '2026-11-02', {})).toBe(r);
    expect(() => correctArticle(r, quiet, passed, 'Jon', 'n', '2026-11-05', {})).toThrow(/unchanged/);
    // a release whose stored fingerprint predates the unit fingerprint still matches its own snapshot
    const legacy = { ...r, fingerprints: { ...r.fingerprints, article: 'legacy' } };
    expect(lockArticle(legacy, a, passed, 'Jon', '2026-11-02', {})).toBe(legacy);
  });
  it('the last text change dates the article; a reaffirmation does not', () => {
    const x = reaffirmArticle(r, true, a, passed, 'Jon', 'stands', '2026-11-09');
    expect(articleModified(x)).toBe('2026-11-01');
    expect(articleModified(correctArticle(x, edited, passedEdited, 'Jon', 'n', '2026-11-12', {}).release)).toBe(
      '2026-11-12',
    );
  });
  it('a correction carries its release number, and the record dedupes on it', () => {
    const one = correctArticle(r, edited, passedEdited, 'Jon', 'n', '2026-11-05', {}).revision;
    expect(one.release).toBe(2);
    const rec = withArticleRevision({ exhibits: {}, revisions: [] }, one);
    // a re-run on a later day finds it
    expect(withArticleRevision(rec, { ...one, at: '2026-11-06' })).toBe(rec);
    // a second, identical correction the same day is a new release: both are recorded
    expect(withArticleRevision(rec, { ...one, release: 3 }).revisions).toHaveLength(2);
    expect(publicRecordProblems(rec)).toEqual([]);
  });
  describe('figure snapshots', () => {
    const ref = 'decision-mlm-and-seminars/sc01';
    const point = { label: 'Lost money', value: 47, unit: 'percent' as const, display: '47%', cite: DOC_D };
    const chart: ChartSpec = { type: 'bar', points: [point] };
    const figs: Record<string, FigureData> = { [ref]: { chart } };
    const fa = withBlock({ kind: 'figure', ref, caption: 'Outcomes' });
    const fv = check(fa, { review: approveArticle(fa), figures: new Set([ref]) });
    it('the fixture passes', () => expect(fv.status).toBe('passed'));
    it('the release snapshots the figures it names', () => {
      expect(lockArticle(null, fa, fv, 'Jon', '2026-11-01', figs).figures).toEqual(figs);
      expect(releaseFigures(fa, new Map([[ref, figs[ref]]]))).toEqual(figs);
      expect(() => releaseFigures(fa, new Map())).toThrow(/not a chart this story has/);
    });
    it('a chart changed after the release is a correction naming the figure', () => {
      const r1 = lockArticle(null, fa, fv, 'Jon', '2026-11-01', figs);
      const moved = { [ref]: { chart: { ...chart, points: [{ ...point, value: 48, display: '48%' }] } } };
      const { release, revision } = correctArticle(r1, fa, fv, 'Jon', 'the chart was re-cut', '2026-11-05', moved);
      expect(revision.sentences).toEqual([ref]);
      expect(release.figures).toEqual(moved);
    });
    it('a release without a snapshot names every figure on its first correction', () => {
      const legacy = { ...lockArticle(null, fa, fv, 'Jon', 'd', figs), figures: undefined };
      expect(correctArticle(legacy, fa, fv, 'Jon', 'figures now fixed', 'd2', figs).revision.sentences).toEqual([ref]);
    });
    it('correct still refuses when neither text nor figures changed', () => {
      const r1 = lockArticle(null, fa, fv, 'Jon', 'd', figs);
      expect(() => correctArticle(r1, fa, fv, 'Jon', 'n', 'd2', figs)).toThrow(/unchanged/);
    });
    it('articleDrift names a moved package and a changed figure, and nothing when both match', () => {
      const r1 = lockArticle(null, fa, fv, 'Jon', 'd', figs);
      const pkgNow = r1.fingerprints.package;
      expect(articleDrift(r1, { package: pkgNow, figures: new Map([[ref, figs[ref]]]) })).toEqual([]);
      const moved: FigureData = { chart: { ...chart, title: 'Re-cut' } };
      expect(articleDrift(r1, { package: 'new', figures: new Map([[ref, moved]]) })).toEqual([
        `package ${pkgNow} -> new`,
        `figure ${ref}`,
      ]);
      expect(
        articleDrift({ ...r1, figures: undefined }, { package: pkgNow, figures: new Map([[ref, figs[ref]]]) }),
      ).toEqual([`figure ${ref}`]);
    });
  });
  it('the markdown shows headings, sentence states and open issues', () => {
    const md = renderArticleMd(a, check(a));
    expect(md).toContain('# How Much Money Do MLM Participants Make?');
    expect(md).toContain('## What we found');
    expect(md).toMatch(/47 percent lost money\. \[s02 review fp=[0-9a-f]{10}\]/);
    const fp = check(a).sentences.find((x) => x.id === 's02')?.fingerprint;
    expect(md).toContain(`fp=${fp}]`);
    const gap = renderArticleMd(
      withBlock(prose('s04', 'Nobody has measured it.', { callout: 'unresolved', gap: 2 })),
      check(a),
    );
    expect(gap).toContain('**unresolved (gap 2):** Nobody has measured it.');
    expect(md).toContain('## Open issues');
  });
});
