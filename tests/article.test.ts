import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Article,
  type Block,
  articleAsScript,
  articleFingerprint,
  correctArticle,
  lockArticle,
  renderArticleMd,
} from '../src/lib/article';
import { Refusal } from '../src/lib/publish';
import { publicRecordProblems } from '../src/lib/public-record';
import { LIMITS, figuresOf, validateArticle } from '../src/lib/article-validation';
import { buildPackage } from '../src/lib/evidence-package';
import { type EvidencePackage, type Sentence, scriptDir } from '../src/lib/script';
import { approveArticle, article } from './article-helpers';
import { claim, guess, sources } from './corpus';
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
} from './script-helpers';

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
  it('figuresOf lists the storyboard scenes that draw a chart', { timeout: 5000 }, () => {
    const root = mkdtempSync(join(tmpdir(), 'figures-'));
    const dir = scriptDir('demo', 'decision:mlm-and-seminars', root);
    mkdirSync(dir, { recursive: true });
    const scenes = [
      { id: 'sc01', visual: { category: 'chart', chart: { type: 'bar', points: [] } } },
      { id: 'sc02', visual: { category: 'typography' } },
    ];
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify({ scenes }));
    expect([...figuresOf('demo', 'decision:mlm-and-seminars', root)]).toEqual(['decision-mlm-and-seminars/sc01']);
    expect(figuresOf('demo', 'decision:none', root).size).toBe(0);
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

describe('article release', () => {
  const a = article();
  const passed = check(a, { review: approveArticle(a) });
  const edited = structuredClone(a);
  (edited.sections[1].blocks[1] as { sentences: Sentence[] }).sentences[0].text = 'One survey is not the final word.';
  const passedEdited = check(edited, { review: approveArticle(edited) });
  const r = lockArticle(null, a, passed, 'Jon', '2026-11-01');

  it('the fixtures pass', () => {
    expect([passed.status, passedEdited.status]).toEqual(['passed', 'passed']);
  });
  it('lock refuses a placeholder approver, an unpassed validation, and a changed article after release', () => {
    expect(() => lockArticle(null, a, passed, '<name>', 'd')).toThrow(Refusal);
    expect(() => lockArticle(null, a, check(a), 'Jon', 'd')).toThrow(Refusal);
    expect(() => lockArticle(r, edited, passedEdited, 'Jon', 'd')).toThrow(/correct/);
  });
  it('lock is idempotent', () => {
    expect(lockArticle(r, a, passed, 'Jon', '2026-11-02')).toBe(r);
  });
  it('the release snapshots the article and starts its history', () => {
    expect(r.article).toEqual(a);
    expect(r.revision).toBe(1);
    expect(r.history).toEqual([
      { revision: 1, date: '2026-11-01', approvedBy: 'Jon', fingerprint: articleFingerprint(a) },
    ]);
  });
  it('correct needs a note, names the changed sentences and records an article revision', () => {
    expect(() => correctArticle(r, edited, passedEdited, 'Jon', ' ', '2026-11-05')).toThrow(Refusal);
    expect(() => correctArticle(r, edited, check(edited), 'Jon', 'n', '2026-11-05')).toThrow(Refusal);
    expect(() => correctArticle(r, edited, passedEdited, 'automated:', 'n', '2026-11-05')).toThrow(Refusal);
    const { release, revision } = correctArticle(r, edited, passedEdited, 'Jon', 'Fixed the 2024 price', '2026-11-05');
    expect(revision).toEqual({
      at: '2026-11-05',
      kind: 'article',
      id: a.story,
      from: null,
      to: null,
      sentences: ['s03'],
      note: 'Fixed the 2024 price',
    });
    expect(release.revision).toBe(2);
    expect(release.article).toEqual(edited);
    expect(release.history).toHaveLength(2);
    expect(release.history[1]).toMatchObject({ revision: 2, note: 'Fixed the 2024 price', sentences: ['s03'] });
    expect(publicRecordProblems({ exhibits: {}, revisions: [revision] })).toEqual([]);
  });
  const fix = (prev: typeof r, b: Article) =>
    correctArticle(prev, b, check(b, { review: approveArticle(b) }), 'Jon', 'n', 'd');
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
    const released = lockArticle(null, base, v, 'Jon', 'd');
    expect(fix(released, withBlock({ ...tb, caption: 'Outcomes reported' })).revision.sentences).toEqual(['tb1']);
  });
  it('correct refuses an unchanged article', () => {
    expect(() => correctArticle(r, a, passed, 'Jon', 'n', '2026-11-05')).toThrow(Refusal);
  });
  it('the markdown shows headings, sentence states and open issues', () => {
    const md = renderArticleMd(a, check(a));
    expect(md).toContain('# How Much Money Do MLM Participants Make?');
    expect(md).toContain('## What we found');
    expect(md).toMatch(/47 percent lost money\. \[s02 review\]/);
    expect(md).toContain('## Open issues');
  });
});
