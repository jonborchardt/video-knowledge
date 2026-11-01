// The graph every public page builds from. The dev server sees the preview view (packaged stories too); a build sees
// only what has a live video; a `FIXTURE_SITE=1` build (the fixture's preview deployment, spec §5.8) adds the fixture
// topics with their packaged stories. Tests use `contentGraph()` (live) directly, since vitest runs with DEV true.
import type { Commission } from '../../config/site';
import { contentGraph, type View } from './content-graph';
import { ROOT } from '../../shared/io';
import { fixtureTopicNames, publicTopicNames } from '../evidence';

export const fixtureSite = process.env.FIXTURE_SITE === '1';
export const siteView: View = import.meta.env.DEV ? 'preview' : fixtureSite ? 'fixture' : 'live';

/** The topics this build may page: the public ones, plus the fixture topics in a fixture build only. */
export const siteTopicNames = (): string[] => [...publicTopicNames(), ...(fixtureSite ? fixtureTopicNames() : [])];

export const siteGraph = () => contentGraph(ROOT, siteTopicNames(), siteView);

/** Topics whose inquiry has at least one public story in the site graph. */
export const siteTopics = (g = siteGraph()): string[] => siteTopicNames().filter((t) => g.nodes.get(t)?.public);

/** The topics a commission's pages list: its public topics, plus its fixture topics in a fixture build. */
export const commissionTopics = (c: Commission): string[] => [
  ...c.topics,
  ...(fixtureSite ? (c.fixtureTopics ?? []) : []),
];
