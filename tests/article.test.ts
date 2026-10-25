import { describe, expect, it } from 'vitest';
import { articleAsScript, articleFingerprint } from '../src/lib/article';
import type { Sentence } from '../src/lib/script';
import { approveArticle, article } from './article-helpers';
import { cats, run } from './script-helpers';

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
