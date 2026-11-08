import { isFixtureTopic, site } from '../config/site';
import { absoluteUrl } from '../lib/url';
import { loadTopic } from '../modules/evidence';
import { matterOrder, matterPath } from '../modules/website';
import { siteGraph, siteTopics } from '../modules/website/site-graph';
import { type LlmsEntry, llmsTxt } from '../modules/website/syndication';

// The Markdown index for agents: every public matter (follow-ups included: each has an index.md) under its inquiry,
// in matterOrder, fixture topics out. The disclosure appears once.
export function GET() {
  const g = siteGraph();
  const entries: LlmsEntry[] = siteTopics(g)
    .filter((name) => !isFixtureTopic(name))
    .flatMap((name) => {
      const t = loadTopic(name);
      return [...g.nodes.values()]
        .filter((n) => n.kind === 'story' && n.topic === name && n.public)
        .sort((a, b) => matterOrder(g, a, b))
        .map((n) => {
          const s = g.stories.get(n.id)!;
          return {
            inquiry: t.label,
            inquiryUrl: absoluteUrl(`/${name}/`),
            title: s.title,
            question: s.question,
            markdownUrl: absoluteUrl(`${matterPath(name, s)}index.md`),
          };
        });
    });
  const txt = llmsTxt(entries, {
    name: site.name,
    description: site.description,
    disclosure: site.disclosure,
    url: absoluteUrl('/'),
  });
  return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
