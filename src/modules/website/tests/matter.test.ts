import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Story, Topic } from '../../../shared/types';
import { loadArticleRelease } from '../../article';
import { loadTopic } from '../../evidence';
import { loadStories } from '../../stories';
import { site } from '../../../config/site';
import { matterPath } from '../content-graph';
import { matterAnswers, matterModel } from '../matter';

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

  // "What the Record finds" is the whole matter: the first question's resolution, then each chained question's own.
  it("a chain answers every question in order, from the chained stories' own resolutions", () => {
    const first = stories.find((s) => s.chain?.length)!;
    const find = (id: string) => stories.find((x) => x.id === id);
    const answers = matterAnswers(first, find);
    expect(answers.map((a) => a.id)).toEqual([first.id, ...first.chain!.map((c) => c.id)]);
    expect(answers[0]).toEqual({ id: first.id, question: first.question, text: first.arc.resolution });
    expect(answers[1]).toEqual({
      id: first.chain![0].id,
      question: first.chain![0].question,
      text: find(first.chain![0].id)!.arc.resolution,
    });
    expect(matterModel(t, first, stories, { repo: site.repo, preview: false }).answers).toEqual(answers);
  });
  it('a follow-up answers only its own question, and a chained story not in the list is skipped', () => {
    const first = stories.find((s) => s.chain?.length)!;
    expect(matterAnswers(followUp, (id) => stories.find((x) => x.id === id))).toEqual([
      { id: followUp.id, question: followUp.question, text: followUp.arc.resolution },
    ]);
    expect(matterAnswers(first, () => undefined)).toHaveLength(1);
  });
});

// The dev preview renders a validated article before its lock (plan: report pages, Task 4); a build never does.
describe('matterModel preview of an unreleased article', () => {
  const setup = (validation: object | null) => {
    const root = mkdtempSync(join(tmpdir(), 'matter-preview-'));
    const dir = join(root, 'topics', 'demo', 'scripts', 'decision-x');
    mkdirSync(dir, { recursive: true });
    const sentence = (id: string, text: string) => ({ id, text, type: 'transitional', assertions: [] });
    writeFileSync(
      join(dir, 'article.json'),
      JSON.stringify({
        topic: 'demo',
        story: 'decision:x',
        revision: 1,
        generation: { model: 'm', brief: 'b', date: 'd', wordsPerMinute: 150, evidencePackage: 'p' },
        meta: {
          headline: 'Draft headline',
          seoTitle: 'Draft',
          dek: sentence('meta.dek', 'Dek.'),
          description: sentence('meta.description', 'Desc.'),
        },
        sections: [
          { name: 'answer', heading: 'H', blocks: [{ kind: 'prose', sentences: [sentence('s01', 'Text.')] }] },
        ],
      }),
    );
    if (validation) writeFileSync(join(dir, 'article-validation.json'), JSON.stringify(validation));
    const t = { name: 'demo', claims: [], sources: [], docNames: {} } as unknown as Topic;
    const s = { id: 'decision:x', title: 'X', question: 'Q?', claims: [], arc: {} } as unknown as Story;
    return { root, t, s };
  };
  it('shows the validated draft in the preview, with its fingerprint, and never in a build', () => {
    const { root, t, s } = setup({ status: 'passed', revision: 1, issues: [], date: '2026-11-08' });
    const m = matterModel(t, s, [s], { repo: site.repo, preview: true, root });
    expect(m.view?.headline).toBe('Draft headline');
    expect(m.previewArticle).toBe(true);
    expect(m.release?.fingerprints.article).toBeTruthy();
    const built = matterModel(t, s, [s], { repo: site.repo, preview: false, root });
    expect(built.view).toBeNull();
    expect(built.previewArticle).toBe(false);
  });
  it('shows nothing of a draft whose validation has not passed', () => {
    const { root, t, s } = setup({ status: 'blocked', revision: 1, issues: [] });
    expect(matterModel(t, s, [s], { repo: site.repo, preview: true, root }).view).toBeNull();
  });
});
