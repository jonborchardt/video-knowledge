// What a matter page shows, loaded once: the HTML page and its Markdown copy render this same model, so they cannot
// drift. Nothing here reads import.meta.env (the page passes `preview`).
import { type ArticleRelease, type ArticleView, articleView, loadArticleRelease, releaseFigureDraws } from '../article';
import { type ClaimView, FINDING_LABELS, type FindingLabel, findingLabel, type SourceView, type Topic } from '../evidence';
import { type PublicVideo, storyOutputs } from '../publishing';
import { loadPublicRecord } from '../../shared/public-record';
import type { ClaimRevision, Story } from '../../shared/types';
import { matterPath } from './content-graph';

export interface MatterModel {
  first: Story | undefined; // the first question when `s` is a follow-up
  claims: ClaimView[];
  groups: { label: FindingLabel; claims: ClaimView[] }[];
  exhibits: SourceView[]; // numbered exhibits; `preview` adds unnumbered ones last
  revisions: { r: ClaimRevision; text: string }[]; // oldest first
  revised: string | null;
  outputs: ReturnType<typeof storyOutputs>;
  embed: PublicVideo | null; // the live video, else the releasing one
  release: ArticleRelease | null; // null for a follow-up
  firstArticle: boolean;
  view: ArticleView | null;
  path: string;
}

export function matterModel(
  t: Topic,
  s: Story,
  stories: Story[],
  opts: { repo: string; preview: boolean },
): MatterModel {
  const first = s.partOf ? stories.find((x) => x.id === s.partOf) : undefined;
  const claims = s.claims.map((id) => t.claims.find((c) => c.id === id)).filter((c) => !!c);
  const groups = FINDING_LABELS.map((label) => ({
    label,
    claims: claims.filter((c) => findingLabel(c) === label),
  })).filter((g) => g.claims.length);
  // The sources this matter rests on: every source that asserts or denies one of its claims, by exhibit number.
  const exhibitIds = new Set(claims.flatMap((c) => c.sources.map((x) => x.id)));
  const exhibits = t.sources
    .filter((x) => exhibitIds.has(x.id) && (x.exhibit || opts.preview))
    .sort((a, b) => (a.exhibit ?? Infinity) - (b.exhibit ?? Infinity));
  const revisions = claims
    .flatMap((c) => c.revisions.map((r) => ({ r, text: c.text })))
    .sort((a, b) => a.r.at.localeCompare(b.r.at));
  // The video lives on the first question's page; a follow-up links to it. The embed shows a live video, or a releasing
  // one (decided ok, the page deployed before the tick takes it live).
  const outputs = storyOutputs(t.name, s.partOf ?? s.id);
  // The released companion article, each figure drawn from the release's snapshot, never the live files. A follow-up
  // links to its first question's article.
  const release = first ? null : loadArticleRelease(t.name, s.id);
  const firstArticle = !!first && !!loadArticleRelease(t.name, first.id);
  const figures = release ? releaseFigureDraws(release, t.docNames) : new Map();
  const view = release ? articleView(release, t, loadPublicRecord(t.name), opts.repo, figures) : null;
  return {
    first,
    claims,
    groups,
    exhibits,
    revisions,
    revised: revisions.at(-1)?.r.at ?? null,
    outputs,
    embed: outputs.video ?? outputs.releasing,
    release,
    firstArticle,
    view,
    path: matterPath(t.name, s),
  };
}
