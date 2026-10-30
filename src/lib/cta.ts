// Calls to action (plan 4, D4 and D6): an agent's editorial choice per story (`cta.json` in its script folder, from
// scripts/briefs/cta.md), each a typed destination checked against the content graph. A call to action whose value
// check fails is dropped and reported, never shown; a file error fails the build. Commercial links are fenced off: a
// disclosure, a person's approval, and never primary over a tool or the evidence. No script, storyboard or render
// carries one; the description and the matter page do.
import { join } from 'node:path';
import { toolOf } from '../tools';
import { loadArticleRelease } from './article';
import { absoluteOf, chainRoot, type Graph, matterPath } from './content-graph';
import { readJson, ROOT, FILES, scriptDir } from '../shared/io';
import { absoluteUrl } from './url';
import { approverProblem } from '../shared/approver';
import { sentences } from '../shared/sentences';
import type { Script } from '../shared/types';

export const CTA_TYPES = [
  'tool',
  'evidence',
  'article',
  'data',
  'video',
  'inquiry',
  'reference',
  'commercial',
] as const;
export type CtaType = (typeof CTA_TYPES)[number];
export const CTA_TEXT_MAX = 80;

export interface Cta {
  type: CtaType;
  target?: string; // a node id: tool, video, inquiry, data; derived for evidence and article
  url?: string; // reference and commercial only, https
  text: string;
  disclosure?: string; // commercial only: said before the link on every surface
  approvedBy?: string; // commercial only: a person, never automated:
}
export interface CtaFile {
  primary: Cta;
  secondary?: Cta[];
  related?: { pin?: string[]; exclude?: string[]; why: string };
}
export const ctaPath = (topic: string, storyId: string, root = ROOT) =>
  join(scriptDir(topic, storyId, root), 'cta.json');
export const loadCta = (topic: string, storyId: string, root = ROOT) =>
  readJson<CtaFile>(ctaPath(topic, storyId, root));

export interface ResolvedCta {
  type: CtaType;
  text: string;
  url: string; // absolute
  node: string | null;
  disclosure: string | null;
}
export interface CtaResult {
  primary: ResolvedCta;
  secondary: ResolvedCta[];
  dropped: { cta: Cta; why: string }[];
  problems: string[];
}

/** The file's errors: each fails the build (a commercial entry without its disclosure or a person's approval, too). */
function fileProblems(f: CtaFile): string[] {
  const out: string[] = [];
  const all = [f.primary, ...(f.secondary ?? [])];
  if ((f.secondary?.length ?? 0) > 2) out.push(`at most 2 secondary calls to action, found ${f.secondary!.length}`);
  for (const c of all) {
    if (!CTA_TYPES.includes(c.type)) out.push(`unknown call-to-action type: ${c.type}`);
    if (!c.text?.trim() || c.text.length > CTA_TEXT_MAX)
      out.push(`call-to-action text must be 1-${CTA_TEXT_MAX} characters: ${JSON.stringify(c.text)}`);
    if ((c.type === 'reference' || c.type === 'commercial') && !c.url?.startsWith('https://'))
      out.push(`${c.type} url must be https: ${c.url ?? '(none)'}`);
    if (c.type === 'commercial') {
      if (!c.disclosure?.trim()) out.push(`commercial link needs a disclosure: ${c.url}`);
      const who = c.approvedBy?.trim() ?? '';
      if (approverProblem(who) || who.startsWith('automated:'))
        out.push(`commercial link needs a person's approvedBy: ${c.url}`);
    }
  }
  return out;
}

export function resolveCtas(file: CtaFile | null, g: Graph, story: string, root = ROOT): CtaResult {
  const s = g.stories.get(story)!;
  const topic = g.nodes.get(story)!.topic!;
  const fallback: ResolvedCta = {
    type: 'evidence',
    text: 'The evidence and the full answer',
    url: absoluteUrl(matterPath(topic, s)),
    node: story,
    disclosure: null,
  };
  if (!file) return { primary: fallback, secondary: [], dropped: [], problems: [] };
  const problems = fileProblems(file);
  const tool = toolOf(topic, s.id);
  const release = loadArticleRelease(topic, s.id, root);
  const script = readJson<Script>(join(scriptDir(topic, s.id, root), FILES.script));
  const asserted = new Set(
    script ? sentences(script).flatMap((x) => (x.assertions ?? []).flatMap((a) => a.claims.map((c) => c.id))) : [],
  );
  const unasserted = s.claims.some((c) => !asserted.has(c));
  const at = (node: string, c: Cta, type: CtaType = c.type): ResolvedCta | string => {
    const url = absoluteOf(g, node);
    return url ? { type, text: c.text, url, node, disclosure: null } : 'not public';
  };

  // One call to action resolved, or the reason it is dropped.
  const resolve = (c: Cta): ResolvedCta | string => {
    switch (c.type) {
      case 'tool':
        if (!tool || (c.target && c.target !== `tool:${tool.id}`)) return 'no tool for this story';
        return at(`tool:${tool.id}`, c);
      case 'evidence':
        if (unasserted) return { ...fallback, text: c.text };
        // The video asserted every claim: the matter page still adds the written answer when an article is out.
        return release ? at(`${story}#article`, c, 'article') : 'the video already asserts every claim';
      case 'article':
        return release ? at(`${story}#article`, c) : 'no released article';
      case 'data': {
        const cited = g.edges.filter((e) => e.from === `${story}#article` && e.to.startsWith('data:')).map((e) => e.to);
        const node = c.target ?? cited[0];
        return node && cited.includes(node) ? at(node, c) : 'no dataset the article cites';
      }
      case 'video': {
        const n = c.target ? g.nodes.get(c.target) : undefined;
        if (n?.kind !== 'video') return 'not a video';
        if (!n.public) return 'not live';
        // A chain is one video: its first question's. Pointing at it from the chain points at itself.
        if (chainRoot(g, n.story!) === chainRoot(g, story)) return 'the same video';
        const shared = g.edges.some((e) => e.kind === 'shares-claims' && e.from === story && e.to === n.story);
        if (!shared) return 'not related';
        return at(n.id, c);
      }
      case 'inquiry':
        return !c.target || c.target === topic ? at(topic, c) : "not this story's inquiry";
      case 'reference':
      case 'commercial':
        return c.url?.startsWith('https://')
          ? { type: c.type, text: c.text, url: c.url, node: null, disclosure: c.disclosure ?? null }
          : 'needs an https url';
      default:
        return 'unknown type';
    }
  };

  const dropped: CtaResult['dropped'] = [];
  const kept = (c: Cta) => {
    // A commercial entry with a file problem is never shown.
    if (c.type === 'commercial' && fileProblems({ primary: c }).length) {
      dropped.push({ cta: c, why: 'commercial link without its disclosure or approval' });
      return null;
    }
    const r = resolve(c);
    if (typeof r === 'string') dropped.push({ cta: c, why: r });
    return typeof r === 'string' ? null : r;
  };

  let primary: ResolvedCta | null;
  if (file.primary.type === 'commercial' && (tool || unasserted)) {
    dropped.push({ cta: file.primary, why: 'not primary over a tool or evidence' });
    primary = tool ? kept({ type: 'tool', text: 'Run the numbers yourself' }) : null;
  } else primary = kept(file.primary);
  const secondary = (file.secondary ?? []).slice(0, 2).flatMap((c) => kept(c) ?? []);
  return { primary: primary ?? fallback, secondary, dropped, problems };
}
