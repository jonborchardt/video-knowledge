import { isFixtureTopic, site } from '../config/site';
import { absoluteUrl } from '../lib/url';
import { loadTopic } from '../modules/evidence';
import { storyOutputs } from '../modules/publishing';
import { urlOf } from '../modules/website';
import { siteGraph } from '../modules/website/site-graph';
import { type FeedItem, feedXml } from '../modules/website/syndication';

// The Record as RSS 2.0: every public first question (a follow-up has no entry, as it has no row elsewhere), its
// matter page as the link, its answer as the content, dated by its live video. Fixture topics stay out, as in the
// sitemap. The disclosure appears once, in the channel description.
export function GET() {
  const g = siteGraph();
  const labels = new Map<string, string>();
  const label = (topic: string) => labels.get(topic) ?? labels.set(topic, loadTopic(topic).label).get(topic)!;
  const items: FeedItem[] = [...g.stories]
    .filter(([id, s]) => {
      const n = g.nodes.get(id);
      return n?.public && n.topic && !s.partOf && !isFixtureTopic(n.topic);
    })
    .map(([id, s]) => ({
      title: s.title,
      url: absoluteUrl(urlOf(g, id)!),
      answer: s.arc.resolution,
      inquiry: label(g.nodes.get(id)!.topic!),
      publishedAt: storyOutputs(g.nodes.get(id)!.topic!, s.id).video?.publishedAt,
    }));
  const xml = feedXml(items, {
    title: site.name,
    url: absoluteUrl('/'),
    description: `${site.description} ${site.disclosure}`,
    language: site.locale,
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
