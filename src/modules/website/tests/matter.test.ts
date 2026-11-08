import { describe, expect, it } from 'vitest';
import { loadArticleRelease } from '../../article';
import { loadTopic } from '../../evidence';
import { loadStories } from '../../stories';
import { site } from '../../../config/site';
import { matterPath } from '../content-graph';
import { matterModel } from '../matter';

// Against the real heat-pumps topic: the loader returns exactly what the matter page renders.
describe('matterModel', () => {
  const t = loadTopic('heat-pumps');
  const stories = loadStories('heat-pumps')!.stories;
  const released = stories.find((s) => !s.partOf && loadArticleRelease('heat-pumps', s.id))!;
  const followUp = stories.find((s) => s.partOf)!;

  it('a released first question carries its article view, claims and numbered exhibits', () => {
    const m = matterModel(t, released, stories, { repo: site.repo, preview: false });
    const release = loadArticleRelease('heat-pumps', released.id)!;
    expect(m.first).toBeUndefined();
    expect(m.view?.headline).toBe(release.article.meta.headline);
    expect(m.claims.length).toBe(released.claims.length);
    expect(m.exhibits.length).toBeGreaterThan(0);
    for (const x of m.exhibits) expect(x.exhibit).toBeTruthy();
    const ats = m.revisions.map((r) => r.r.at);
    expect(ats).toEqual([...ats].sort());
    expect(m.path).toBe(matterPath('heat-pumps', released));
  });

  it('a follow-up has no article of its own and points at its first question', () => {
    const m = matterModel(t, followUp, stories, { repo: site.repo, preview: false });
    expect(m.first?.id).toBe(followUp.partOf);
    expect(m.release).toBeNull();
    expect(m.view).toBeNull();
    expect(m.firstArticle).toBe(!!loadArticleRelease('heat-pumps', followUp.partOf!));
  });
});
