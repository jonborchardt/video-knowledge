import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { articleFingerprint, type Article, type ArticleRelease } from '../article';
import { ARTICLE_FINDINGS, inspectArticle } from '../validation';
import { readJson, toJson } from '../../../shared/io';
import type { EvidencePackage, Script, ScriptValidation } from '../../../shared/types';
import { syntheticProduction, type Fixture } from '../../../../tests/production-helpers';

const say = (id: string, text: string) => ({ id, text, type: 'rhetorical' as const });
const articleOf = (fx: Fixture): Article => {
  const s = readJson<Script>(join(fx.dir, 'script.json'))!;
  return {
    topic: fx.topic,
    story: fx.story,
    revision: 1,
    generation: { ...s.generation, brief: 'src/modules/article/briefs/article.md' },
    meta: {
      headline: 'h',
      seoTitle: 's',
      dek: say('meta.dek', 'What do the sources say?'),
      description: say('meta.description', 'A look.'),
    },
    sections: s.sections.map((x) => ({
      name: x.name,
      heading: x.name,
      blocks: [{ kind: 'prose', sentences: x.sentences }],
    })),
  };
};
const write = (fx: Fixture, f: string, x: unknown) => writeFileSync(join(fx.dir, f), toJson(x));
const verdict =
  (status: string, revisionLimitReached = false) =>
  () =>
    ({ status, revisionLimitReached, sentences: [] }) as unknown as ScriptValidation;

describe('inspectArticle', () => {
  it('reports each status without naming a halt', () => {
    const fx = syntheticProduction('locked');
    try {
      const at = (v?: () => ScriptValidation) => inspectArticle(fx.topic, fx.story, fx.root, v);
      expect(at()).toEqual({ status: 'missing', code: 'missing', findings: [ARTICLE_FINDINGS.missing] });

      const a = articleOf(fx);
      write(fx, 'article.json', a);
      const none = at(verdict('blocked'));
      expect(none).toMatchObject({
        status: 'invalid',
        code: 'blocking',
        findings: [ARTICLE_FINDINGS.blocking],
        output: expect.stringContaining('article.json'),
      });
      expect(at(verdict('blocked', true)).code).toBe('revision-limit');
      expect(at(verdict('needs-review')).code).toBe('unapproved');
      // a passing text waits for the rendered-page review, keyed by its fingerprint and the tiles the reviewer saw
      expect(at(verdict('passed'))).toMatchObject({ code: 'page-review', findings: [ARTICLE_FINDINGS.pageReview] });
      const key = articleFingerprint(a);
      const page = (verdict: string, findings: unknown[]) => {
        mkdirSync(join(fx.dir, 'page'), { recursive: true });
        write(fx, 'page/index.json', { key, path: '/p/', captured: 'c', tiles: [] });
        write(fx, 'page-review.json', { key, verdict, findings, reviewer: 'r', date: 'd' });
      };
      page('changes', [{ scope: 'article', unit: 's01', severity: 'blocking', text: 'the unit is missing' }]);
      expect(at(verdict('passed'))).toMatchObject({ code: 'page-findings', findings: ['s01: the unit is missing'] });
      page('changes', [
        { scope: 'article', unit: 's01', severity: 'blocking', text: 'the unit is missing' },
        { scope: 'renderer', unit: 'page', severity: 'blocking', text: 'a value is clipped at 375' },
      ]);
      expect(at(verdict('passed'))).toMatchObject({
        code: 'page-defect',
        findings: ['renderer: a value is clipped at 375'],
      });
      page('approved', [{ scope: 'article', unit: 's01', severity: 'blocking', text: 'contradiction' }]);
      expect(at(verdict('passed'))).toMatchObject({
        code: 'page-review',
        findings: [expect.stringContaining('blocking')],
      });
      page('approved', []);
      expect(at(verdict('passed')).code).toBe('passed');
      expect(Object.keys(none)).not.toContain('kind');

      const needs = structuredClone(a);
      needs.generation = { ...needs.generation, needsEvidence: ['a passage'] } as never;
      write(fx, 'article.json', needs);
      expect(at().code).toBe('needs-evidence');
      write(fx, 'article.json', a);

      const pkg = readJson<EvidencePackage>(join(fx.dir, 'evidence-package.json'))!;
      const release: ArticleRelease = {
        topic: a.topic,
        story: a.story,
        approvedBy: 'fixture approver',
        date: '2026-01-02',
        revision: 1,
        fingerprints: { article: articleFingerprint(a), package: pkg.fingerprint, validation: '' },
        article: a,
        history: [],
      };
      write(fx, 'article-release.json', release);
      expect(at()).toMatchObject({
        status: 'ready',
        code: 'ready',
        findings: [],
        output: expect.stringContaining('article-release.json'),
      });

      const revised = structuredClone(a);
      revised.meta.dek = { ...revised.meta.dek, text: 'Newer words.' };
      write(fx, 'article.json', revised);
      expect(at(verdict('passed')).code).toBe('changed');
      expect(at(verdict('needs-review')).code).toBe('unapproved');

      write(fx, 'article.json', a);
      const claim = pkg.claims[0].id;
      release.article = structuredClone(a);
      release.article.meta.dek.assertions = [
        { id: 'meta.dek.a', text: 'x', claims: [{ id: claim, role: 'supports' }] } as never,
      ];
      release.fingerprints.article = articleFingerprint(release.article);
      write(fx, 'article-release.json', release);
      write(fx, 'article.json', release.article);
      write(fx, '../../public-record.json', {
        exhibits: {},
        revisions: [{ at: '2026-02-01', kind: 'claim', id: claim, from: null, to: null, note: 'a new study' }],
      });
      const stale = at();
      expect(stale.status).toBe('stale');
      expect(stale.code).toBe('stale');
      expect(stale.findings[0]).toContain('a new study');
    } finally {
      fx.cleanup();
    }
  });

  it('is invalid without an evidence package', () => {
    const fx = syntheticProduction('locked');
    try {
      write(fx, 'article.json', articleOf(fx));
      write(fx, 'evidence-package.json', null);
      expect(inspectArticle(fx.topic, fx.story, fx.root).code).toBe('no-package');
    } finally {
      fx.cleanup();
    }
  });
});
