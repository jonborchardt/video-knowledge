import { writeFileSync } from 'node:fs';
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

describe('inspectArticle', { timeout: 30_000 }, () => {
  it('reports each status without naming a halt', () => {
    const fx = syntheticProduction('locked');
    try {
      const at = (v?: () => ScriptValidation) => inspectArticle(fx.topic, fx.story, fx.root, v);
      expect(at()).toEqual({ status: 'missing', findings: [ARTICLE_FINDINGS.missing] });

      const a = articleOf(fx);
      write(fx, 'article.json', a);
      const none = at(verdict('blocked'));
      expect(none).toMatchObject({
        status: 'invalid',
        findings: [ARTICLE_FINDINGS.blocking],
        output: expect.stringContaining('article.json'),
      });
      expect(at(verdict('blocked', true)).findings).toEqual([ARTICLE_FINDINGS.revisionLimit]);
      expect(at(verdict('needs-review')).findings).toEqual([ARTICLE_FINDINGS.unapproved]);
      expect(at(verdict('passed')).findings).toEqual([ARTICLE_FINDINGS.passed]);
      expect(Object.keys(none)).not.toContain('kind');

      const needs = structuredClone(a);
      needs.generation = { ...needs.generation, needsEvidence: ['a passage'] } as never;
      write(fx, 'article.json', needs);
      expect(at().findings).toEqual([ARTICLE_FINDINGS.needsEvidence]);
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
        findings: [],
        output: expect.stringContaining('article-release.json'),
      });

      const revised = structuredClone(a);
      revised.meta.dek = { ...revised.meta.dek, text: 'Newer words.' };
      write(fx, 'article.json', revised);
      expect(at(verdict('passed')).findings).toEqual([ARTICLE_FINDINGS.changed]);
      expect(at(verdict('needs-review')).findings).toEqual([ARTICLE_FINDINGS.unapproved]);

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
      expect(inspectArticle(fx.topic, fx.story, fx.root).findings).toEqual([ARTICLE_FINDINGS.noPackage]);
    } finally {
      fx.cleanup();
    }
  });
});
