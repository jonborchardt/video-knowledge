// The content graph (plan 4, D1): every asset made from a story (its matter page, video, Shorts, article, charts,
// datasets, tool), joined by stable ids and rebuilt from the committed files at every build; never stored. `urlOf` is
// the one way a page, description or package builds a link to a node (D2); a URL comes from an id, never a title.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commissionKey, commissionOf } from '../config/site';
import { toolOf } from '../tools';
import { loadArticleRelease } from './article';
import { dataRef, loadDatasets } from './datasets';
import { readJson, ROOT, topicDir } from './io';
import { storyOutputs } from './outputs';
import { loadLedger } from './publish';
import { scriptDir } from './script';
import { loadStories, storyUrlSlug } from './stories';
import type { Story } from '../shared/types';
import { publicTopicNames } from './topics';
import { absoluteUrl } from './url';

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

/** What is public: `live` = stories whose YouTube video is live; `preview` (the dev server) adds packaged ones. */
export type View = 'live' | 'preview';

const memo = new Map<string, Graph>();
// ponytail: memoised for the life of the process (one build); the dev server needs a restart to see new stories.
// `assumeLive` holds story node ids treated as live (the description of a video about to go live).
export function contentGraph(
  root = ROOT,
  topics: string[] = publicTopicNames(),
  view: View = 'live',
  assumeLive: string[] = [],
): Graph {
  const key = `${root}|${topics.join(',')}|${view}|${assumeLive.join(',')}`;
  if (!memo.has(key)) memo.set(key, buildGraph(root, topics, view, assumeLive));
  return memo.get(key)!;
}

function buildGraph(root: string, topics: string[], view: View, assumeLive: string[]): Graph {
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
    const inquiry: Node = { id: topic, kind: 'inquiry', title: label, topic, story: null, public: false };
    node(inquiry);
    edge(inst, topic, 'publishes');
    const datasets = loadDatasets(topic, root);
    for (const d of datasets)
      node({ id: dataRef(topic, d.id), kind: 'dataset', title: d.title, topic, story: null, public: false });
    const stories = loadStories(topic, root)?.stories ?? [];
    for (const s of stories) {
      const id = storyNode(topic, s.id);
      g.stories.set(id, s);
      const rootId = s.partOf ?? s.id; // a follow-up is public exactly when its first question is
      const isLive = !!storyOutputs(topic, rootId, root).video || assumeLive.includes(storyNode(topic, rootId));
      const packaged =
        view === 'preview' && existsSync(join(scriptDir(topic, rootId, root), 'video', 'review', 'review.json'));
      node({ id, kind: 'story', title: s.title, topic, story: id, public: isLive || packaged });
      edge(id, topic, 'in');
    }
    for (const s of stories) {
      const id = storyNode(topic, s.id);
      if (s.partOf) edge(id, storyNode(topic, s.partOf), 'partOf');
      // What is live comes from storyOutputs (the one reader of publishing state); the ledger adds the outputs that
      // exist but are not live yet.
      const live = storyOutputs(topic, s.id, root);
      const outputs = Object.entries(loadLedger(topic, s.id, root)?.outputs ?? {});
      if (live.video && !outputs.some(([, o]) => o.kind === 'youtube-video'))
        outputs.unshift([live.video.output, { kind: 'youtube-video', metadata: {}, events: [] }]);
      for (const [key, o] of outputs) {
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
      const release = loadArticleRelease(topic, s.id, root);
      if (release) {
        const art = `${id}#article`;
        const pub = g.nodes.get(id)!.public;
        node({ id: art, kind: 'article', title: release.article.meta.headline, topic, story: id, public: pub });
        edge(art, id, 'madeFrom');
        for (const b of release.article.sections.flatMap((x) => x.blocks)) {
          if (b.kind !== 'figure') continue;
          // A storyboard chart is a node only once an article figures it: it has no page of its own.
          if (!b.ref.startsWith('data:') && !g.nodes.has(b.ref))
            node({ id: b.ref, kind: 'chart', title: b.ref, topic, story: id, public: pub });
          edge(art, b.ref, 'cites');
        }
      }
      const t = toolOf(topic, s.id);
      if (t) {
        node({ id: `tool:${t.id}`, kind: 'tool', title: t.id, topic, story: id, public: g.nodes.get(id)!.public });
        edge(id, `tool:${t.id}`, 'uses');
        // A tool's prices table is one of its defaults: the dataset it cites is public with the tool.
        const ref = t.defaults.prices;
        if (typeof ref === 'string') edge(`tool:${t.id}`, ref, 'cites');
      }
    }
    // shares-claims: one edge each way per pair of stories with claims in common, weighted by the count.
    for (const a of stories)
      for (const b of stories) {
        if (a === b) continue;
        const n = a.claims.filter((x) => b.claims.includes(x)).length;
        if (n) edge(storyNode(topic, a.id), storyNode(topic, b.id), 'shares-claims', n);
      }
    inquiry.public = stories.some((s) => g.nodes.get(storyNode(topic, s.id))!.public);
    for (const e of g.edges)
      if (
        e.kind === 'cites' &&
        ['article', 'tool'].includes(g.nodes.get(e.from)?.kind ?? '') &&
        g.nodes.get(e.from)!.public
      )
        for (const d of datasets) if (e.to === dataRef(topic, d.id)) g.nodes.get(e.to)!.public = true;
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
  return u && (u.startsWith('/') ? absoluteUrl(u) : u);
};

/** A story node's chain: a follow-up resolves to its first question's node id, any other story to itself. */
export const chainRoot = (g: Graph, id: string) => {
  const s = g.stories.get(id);
  return s?.partOf ? id.replace(/[^/]+$/, s.partOf) : id;
};

/** Whether a story has a live video (a follow-up's video is its first question's). */
export const hasVideo = (g: Graph, story: string) => !!g.nodes.get(`${chainRoot(g, story)}#youtube`)?.public;

/** A public story with no live video: shown only in the preview view. */
export const isPreview = (g: Graph, story: string) => !!g.nodes.get(story)?.public && !hasVideo(g, story);

/** The claim ids of the topic's stories that have a live video, whatever the view. */
export function liveClaims(g: Graph, topic: string): Set<string> {
  const claims = new Set<string>();
  for (const n of g.nodes.values())
    if (n.kind === 'story' && n.topic === topic && hasVideo(g, n.id))
      for (const c of g.stories.get(n.id)!.claims) claims.add(c);
  return claims;
}

/** The one order of matters in every list (D9): a live video first, then the overall score, then the id. */
export function matterOrder(g: Graph, a: Node, b: Node): number {
  const sa = g.stories.get(a.id)!;
  const sb = g.stories.get(b.id)!;
  return (
    Number(hasVideo(g, b.id)) - Number(hasVideo(g, a.id)) ||
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
  const shared = new Map(
    g.edges.filter((e) => e.kind === 'shares-claims' && e.from === story).map((e) => [e.to, e.weight ?? 0]),
  );
  const inst = (topic: string | null) => g.edges.find((e) => e.kind === 'publishes' && e.to === topic)?.from;
  const tier = (n: Node) =>
    opts.pin?.includes(n.id)
      ? 0
      : chainRoot(g, n.id) === chainRoot(g, story)
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
  preview: boolean; // packaged but not live: shown in the dev preview only
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
    preview: isPreview(g, id),
    follow: follow.map((f) => matterItem(g, f)),
  };
}

/** Every matter of an inquiry in `matterOrder`, each follow-up under its first question. */
export function inquiryMatters(g: Graph, topic: string): MatterItem[] {
  const stories = [...g.nodes.values()].filter((n) => n.kind === 'story' && n.topic === topic && n.public);
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

/** A topic's moved stories (`topics/<topic>/moved.json`, written by a person): old story id → current story id. `{}`
 *  when there is none; a target that is not a current story throws. */
export function loadMoved(topic: string, root = ROOT): Record<string, string> {
  const moved = readJson<Record<string, string>>(join(topicDir(topic, root), 'moved.json')) ?? {};
  const ids = new Set((loadStories(topic, root)?.stories ?? []).map((s) => s.id));
  for (const to of Object.values(moved))
    if (!ids.has(to)) throw new Error(`moved.json: ${to} is not a story of ${topic}`);
  return moved;
}

/** Every redirect the build emits, old matter path → current matter path, for Astro's `redirects` (which writes each
 *  as a noindex page with a canonical link and a meta refresh). */
export const movedRedirects = (topics: string[] = publicTopicNames()): Record<string, string> =>
  Object.fromEntries(
    topics.flatMap((t) =>
      Object.entries(loadMoved(t)).map(([from, to]) => [matterPath(t, { id: from }), matterPath(t, { id: to })]),
    ),
  );

/** The pages a build wrote under `dist`, as root-relative paths (`/heat-pumps/`): `built` is every page, redirects
 *  included; `indexed` leaves out redirect pages, noindex pages and the 404 (what `public-urls.json` lists). */
export function distPages(dist: string): { built: Set<string>; indexed: Set<string> } {
  const built = new Set<string>();
  const indexed = new Set<string>();
  for (const f of readdirSync(dist, { recursive: true, encoding: 'utf8' })) {
    const file = f.replaceAll('\\', '/');
    if (file !== 'index.html' && !file.endsWith('/index.html')) continue;
    const path = `/${file.slice(0, -'index.html'.length)}`;
    built.add(path);
    const html = readFileSync(join(dist, file), 'utf8');
    if (!/http-equiv="refresh"|name="robots" content="noindex/.test(html)) indexed.add(path);
  }
  return { built, indexed };
}

/** The URL manifest's problems (D3): a path the manifest promised that the build lost (no page and no redirect), and an
 *  indexed page the manifest does not list yet. */
export function manifestProblems(manifest: string[], built: Set<string>, indexed: Set<string> = built): string[] {
  const listed = new Set(manifest);
  return [
    ...manifest.filter((p) => !built.has(p)).map((p) => `lost ${p}: add a moved.json entry`),
    ...[...indexed]
      .filter((p) => !listed.has(p))
      .sort()
      .map((p) => `new ${p}: run npm run links -- freeze`),
  ];
}
