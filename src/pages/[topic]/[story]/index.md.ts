import type { APIContext } from 'astro';
import { author, commissionOf, site } from '../../../config/site';
import { absoluteUrl } from '../../../lib/url';
import { loadTopic, type Topic } from '../../../modules/evidence';
import { loadStories, storyUrlSlug } from '../../../modules/stories';
import { matterPath, storyNode } from '../../../modules/website';
import { matterModel } from '../../../modules/website/matter';
import { siteGraph, siteTopicNames } from '../../../modules/website/site-graph';
import { matterMarkdown } from '../../../modules/website/syndication';
import type { Story } from '../../../shared/types';

// Each public matter as Markdown beside its page (`<topic>/<slug>/index.md`): the same stories as `[story].astro`,
// the same model (matterModel), rendered by matterMarkdown. The page announces it with rel="alternate".
export function getStaticPaths() {
  const g = siteGraph();
  return siteTopicNames().flatMap((name) => {
    const t = loadTopic(name);
    const stories = loadStories(name)?.stories ?? [];
    return stories
      .filter((s) => g.nodes.get(storyNode(name, s.id))?.public)
      .map((s) => ({ params: { topic: name, story: storyUrlSlug(s) }, props: { t, s, stories } }));
  });
}

export function GET({ props }: APIContext) {
  const { t, s, stories } = props as { t: Topic; s: Story; stories: Story[] };
  const m = matterModel(t, s, stories, { repo: site.repo, preview: import.meta.env.DEV });
  const md = matterMarkdown(t, s, m, commissionOf(t.name)!, {
    canonical: absoluteUrl(m.path),
    inquiryUrl: absoluteUrl(`/${t.name}/`),
    firstUrl: m.first ? absoluteUrl(matterPath(t.name, m.first)) : undefined,
    repo: site.repo,
    disclosure: site.disclosure,
    publisher: author.name,
  });
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
