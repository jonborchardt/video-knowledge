import { describe, expect, it } from 'vitest';
import { isListed, unlistedPaths } from '../src/lib/seo';
import { loadStories, storyUrlSlug } from '../src/lib/stories';
import { publicTopicNames } from '../src/lib/topics';

describe('seo', () => {
  it('unlisted paths match under a base', () => {
    const u = new Set(['/heat-pumps/x/']);
    expect(isListed('https://jonborchardt.github.io/video-knowledge/heat-pumps/x/', '/video-knowledge/', u)).toBe(
      false,
    );
    expect(isListed('https://commonwealthofreason.com/heat-pumps/x/', '/', u)).toBe(false);
    expect(isListed('https://commonwealthofreason.com/heat-pumps/', '/', u)).toBe(true);
  });

  it('unlisted paths are exactly the public stories not ready', () => {
    const want = publicTopicNames().flatMap((t) =>
      (loadStories(t)?.stories ?? []).filter((s) => s.readiness !== 'ready').map((s) => `/${t}/${storyUrlSlug(s)}/`),
    );
    expect(unlistedPaths().sort()).toEqual(want.sort());
  });
});
