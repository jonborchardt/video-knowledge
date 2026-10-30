// The graph every public page builds from. The dev server sees the preview view (packaged stories too); a build sees
// only what has a live video. Tests use `contentGraph()` (live) directly, since vitest runs with DEV true.
import { contentGraph, type View } from './content-graph';
import { ROOT } from '../shared/io';
import { publicTopicNames } from './topics';

export const siteView: View = import.meta.env.DEV ? 'preview' : 'live';

export const siteGraph = () => contentGraph(ROOT, publicTopicNames(), siteView);

/** Public topics whose inquiry has at least one public story in the site graph. */
export const siteTopics = (g = siteGraph()): string[] => publicTopicNames().filter((t) => g.nodes.get(t)?.public);
