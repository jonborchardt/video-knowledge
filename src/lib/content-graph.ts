// The content graph (plan 4, D1): every asset made from a story (its matter page, video, Shorts, article, charts,
// datasets, tool), joined by stable ids and rebuilt from the committed files at every build; never stored. `urlOf` is
// the one way a page, description or package builds a link to a node (D2); a URL comes from an id, never a title.
import { join } from 'node:path';
import { commissionKey, commissionOf, site } from '../config/site';
import { TOOLS } from '../tools';
import { loadArticleRelease } from './article';
import { dataRef, loadDatasets } from './datasets';
import { readJson, ROOT, topicDir } from './io';
import { storyOutputs } from './outputs';
import { loadLedger } from './publish';
import { loadStories, type Story, storyUrlSlug } from './stories';
import { publicTopicNames } from './topics';

export type NodeKind =
  'institution' | 'inquiry' | 'story' | 'video' | 'short' | 'article' | 'chart' | 'dataset' | 'tool';
export interface Node {
  id: string;
  kind: NodeKind;
  title: string;
  topic: string | null;
  story: string | null; // the story node id it belongs to
  public: boolean;
  url?: string; // a video's or a Short's watch URL, once live
}
export type EdgeKind = 'publishes' | 'in' | 'partOf' | 'madeFrom' | 'derivedFrom' | 'cites' | 'uses' | 'shares-claims';
export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  weight?: number; // shared claim count
}
export interface Graph {
  nodes: Map<string, Node>;
  edges: Edge[];
  stories: Map<string, Story>; // story node id → the story, for ordering and the call-to-action checks
}

export const storyNode = (topic: string, storyId: string) => `${topic}/${storyId}`;
/** A matter page's root-relative path, from the story id (never its title). */
export const matterPath = (topic: string, s: Pick<Story, 'id'>) => `/${topic}/${storyUrlSlug(s)}/`;

const memo = new Map<string, Graph>();
// ponytail: memoised for the life of the process (one build); the dev server needs a restart to see new stories.
export function contentGraph(root = ROOT, topics: string[] = publicTopicNames()): Graph {
  const key = `${root}|${topics.join(',')}`;
  if (!memo.has(key)) memo.set(key, buildGraph(root, topics));
  return memo.get(key)!;
}

function buildGraph(root: string, topics: string[]): Graph {
  const g: Graph = { nodes: new Map(), edges: [], stories: new Map() };
  const node = (n: Node) => g.nodes.set(n.id, n);
  const edge = (from: string, to: string, kind: EdgeKind, weight?: number) =>
    g.edges.push({ from, to, kind, ...(weight !== undefined && { weight }) });
  for (const topic of topics) {
    const c = commissionOf(topic);
    if (!c) continue;
    const inst = `inst:${commissionKey(c)}`;
    if (!g.nodes.has(inst))
      node({ id: inst, kind: 'institution', title: c.ceremonialName, topic: null, story: null, public: true });
    const label =
      readJson<{ topics: { label?: string }[] }>(join(topicDir(topic, root), 'report.json'))?.topics[0]?.label ?? topic;
    node({ id: topic, kind: 'inquiry', title: label, topic, story: null, public: true });
    edge(inst, topic, 'publishes');
    const datasets = loadDatasets(topic, root);
    for (const d of datasets)
      node({ id: dataRef(topic, d.id), kind: 'dataset', title: d.title, topic, story: null, public: true });
    const stories = loadStories(topic, root)?.stories ?? [];
    for (const s of stories) {
      const id = storyNode(topic, s.id);
      g.stories.set(id, s);
      node({ id, kind: 'story', title: s.title, topic, story: id, public: s.readiness === 'ready' });
      edge(id, topic, 'in');
    }
    for (const s of stories) {
      const id = storyNode(topic, s.id);
      if (s.partOf) edge(id, storyNode(topic, s.partOf), 'partOf');
      const ledger = loadLedger(topic, s.id, root);
      if (ledger) {
        const live = storyOutputs(topic, s.id, root);
        for (const [key, o] of Object.entries(ledger.outputs)) {
          if (o.kind !== 'youtube-video' && o.kind !== 'youtube-short') continue;
          const short = o.kind === 'youtube-short';
          // Every video output of a story is its one #youtube node: a re-release replaces the original.
          const out = `${id}#${short ? key : 'youtube'}`;
          if (g.nodes.has(out)) continue;
          const v = short ? live.shorts.find((x) => x.output === key) : live.video;
          node({
            id: out,
            kind: short ? 'short' : 'video',
            title: v?.title || s.title,
            topic,
            story: id,
            public: !!v,
            ...(v && { url: v.url }),
          });
          edge(out, id, 'madeFrom');
          if (short && o.derivedFrom) edge(out, `${id}#youtube`, 'derivedFrom');
        }
      }
      const release = loadArticleRelease(topic, s.id, root);
      if (release) {
        const art = `${id}#article`;
        node({ id: art, kind: 'article', title: release.article.meta.headline, topic, story: id, public: true });
        edge(art, id, 'madeFrom');
        for (const b of release.article.sections.flatMap((x) => x.blocks)) {
          if (b.kind !== 'figure') continue;
          // A storyboard chart is a node only once an article figures it: it has no page of its own.
          if (!b.ref.startsWith('data:') && !g.nodes.has(b.ref))
            node({ id: b.ref, kind: 'chart', title: b.ref, topic, story: id, public: true });
          edge(art, b.ref, 'cites');
        }
      }
      for (const t of Object.values(TOOLS).filter((x) => x.topic === topic && x.story === s.id)) {
        node({ id: `tool:${t.id}`, kind: 'tool', title: t.id, topic, story: id, public: s.readiness === 'ready' });
        edge(id, `tool:${t.id}`, 'uses');
      }
    }
    // shares-claims: one edge each way per pair of stories with claims in common, weighted by the count.
    for (const a of stories)
      for (const b of stories) {
        if (a === b) continue;
        const n = a.claims.filter((x) => b.claims.includes(x)).length;
        if (n) edge(storyNode(topic, a.id), storyNode(topic, b.id), 'shares-claims', n);
      }
  }
  // An edge to a node that does not exist (a figure ref to a missing dataset) is dropped, never a node invented for it.
  g.edges = g.edges.filter((e) => g.nodes.has(e.from) && g.nodes.has(e.to));
  return g;
}

/** A node's link, root-relative for a site page (wrap it in `href()`), a watch URL for a live video or Short; null for a
 *  node that has nowhere public to point (an unpublished video, a story not ready, an unknown id). */
export function urlOf(g: Graph, id: string): string | null {
  const n = g.nodes.get(id);
  if (!n?.public) return null;
  const s = n.story ? g.stories.get(n.story) : undefined;
  const matter = s && n.topic ? matterPath(n.topic, s) : null;
  switch (n.kind) {
    case 'institution':
      return `/commissions/${id.slice('inst:'.length)}/`;
    case 'inquiry':
      return `/${id}/`;
    case 'story':
      return matter;
    case 'article':
    case 'chart':
      return matter && `${matter}#article`;
    case 'tool':
      return matter && `${matter}#tool`;
    case 'dataset':
      return `/${n.topic}/data/#${id.split('/').pop()}`;
    case 'video':
    case 'short':
      return n.url ?? null;
  }
}

/** A node's absolute URL: a site page under `site.url` (the canonical host; descriptions are read off-site), a video
 *  as its watch URL. */
export const absoluteOf = (g: Graph, id: string): string | null => {
  const u = urlOf(g, id);
  return u && (u.startsWith('/') ? new URL(u.slice(1), site.url).toString() : u);
};

/** Whether a story has a live video (a follow-up's video is its first question's). */
export const hasVideo = (g: Graph, story: string) => {
  const s = g.stories.get(story);
  const first = s?.partOf ? story.replace(/[^/]+$/, s.partOf) : story;
  return !!g.nodes.get(`${first}#youtube`)?.public;
};

/** The one order of matters in every list (D9): a live video first, then ready before under examination, then the
 *  overall score, then the id. */
export function matterOrder(g: Graph, a: Node, b: Node): number {
  const sa = g.stories.get(a.id)!;
  const sb = g.stories.get(b.id)!;
  return (
    Number(hasVideo(g, b.id)) - Number(hasVideo(g, a.id)) ||
    Number(sb.readiness === 'ready') - Number(sa.readiness === 'ready') ||
    sb.scores.overall - sa.scores.overall ||
    a.id.localeCompare(b.id)
  );
}

/** Related matters (D7): pins, then chain members, then stories sharing the most claims, then the same inquiry, then
 *  the same institution; within a tier `matterOrder`. Ready stories only, never the story itself or an exclusion. */
export function related(
  g: Graph,
  story: string,
  opts: { pin?: string[]; exclude?: string[]; limit?: number } = {},
): Node[] {
  const self = g.stories.get(story);
  const me = g.nodes.get(story);
  if (!self || !me) return [];
  const chainOf = (id: string) => {
    const s = g.stories.get(id)!;
    return s.partOf ? id.replace(/[^/]+$/, s.partOf) : id;
  };
  const shared = new Map(
    g.edges.filter((e) => e.kind === 'shares-claims' && e.from === story).map((e) => [e.to, e.weight ?? 0]),
  );
  const inst = (topic: string | null) => g.edges.find((e) => e.kind === 'publishes' && e.to === topic)?.from;
  const tier = (n: Node) =>
    opts.pin?.includes(n.id)
      ? 0
      : chainOf(n.id) === chainOf(story)
        ? 1
        : shared.has(n.id)
          ? 2
          : n.topic === me.topic
            ? 3
            : inst(n.topic) === inst(me.topic)
              ? 4
              : 5;
  const pinAt = (n: Node) => opts.pin?.indexOf(n.id) ?? 0;
  return [...g.nodes.values()]
    .filter((n) => n.kind === 'story' && n.public && n.id !== story && !opts.exclude?.includes(n.id))
    .filter((n) => tier(n) < 5)
    .sort(
      (a, b) =>
        tier(a) - tier(b) ||
        (tier(a) === 0 ? pinAt(a) - pinAt(b) : 0) ||
        (tier(a) === 2 ? shared.get(b.id)! - shared.get(a.id)! : 0) ||
        matterOrder(g, a, b),
    )
    .slice(0, opts.limit ?? 4);
}

export interface MatterItem {
  title: string;
  question: string;
  href: string; // root-relative; the component wraps it in href()
  video: boolean;
  ready: boolean;
  follow: MatterItem[]; // a chain's follow-up questions, listed under their first
}
/** A story node as a list entry. */
export function matterItem(g: Graph, id: string, follow: string[] = []): MatterItem {
  const n = g.nodes.get(id)!;
  const s = g.stories.get(id)!;
  return {
    title: s.title,
    question: s.question,
    href: matterPath(n.topic!, s),
    video: hasVideo(g, id),
    ready: s.readiness === 'ready',
    follow: follow.map((f) => matterItem(g, f)),
  };
}

/** Every matter of an inquiry in `matterOrder`, each follow-up under its first question. */
export function inquiryMatters(g: Graph, topic: string): MatterItem[] {
  const stories = [...g.nodes.values()].filter((n) => n.kind === 'story' && n.topic === topic);
  return stories
    .filter((n) => !g.stories.get(n.id)!.partOf)
    .sort((a, b) => matterOrder(g, a, b))
    .map((n) =>
      matterItem(
        g,
        n.id,
        (g.stories.get(n.id)!.chain ?? []).map((c) => storyNode(topic, c.id)).filter((id) => g.stories.has(id)),
      ),
    );
}
