// What a matter page shows, loaded once: the HTML page and its Markdown copy render this same model, so they cannot
// drift. Nothing here reads import.meta.env (the page passes `preview`).
import {
  type ArticleRelease,
  type ArticleView,
  articleView,
  loadArticleRelease,
  previewRelease,
  releaseFigureDraws,
} from '../article';
import { ROOT } from '../../shared/io';
import {
  type ClaimView,
  FINDING_LABELS,
  type FindingLabel,
  findingLabel,
  type SourceView,
  type Topic,
} from '../evidence';
import { type PublicVideo, storyOutputs } from '../publishing';
import { loadPublicRecord } from '../../shared/public-record';
import type { ClaimRevision, Story } from '../../shared/types';
import { matterPath } from './content-graph';

/** One question of a matter and what the Record finds on it. */
export interface MatterAnswer {
  id: string; // the story
  question: string;
  text: string; // its arc's resolution
}

/** "What the Record finds" for a whole matter: the story's own resolution, then, for a chain, each chained question
 *  and its own story's resolution in chain order (a chained story missing from `find` is skipped). The consumers
 *  (the matter page, its Markdown copy, the feed, the home card) lay the list out each in its own way. */
export function matterAnswers(s: Story, find: (id: string) => Story | undefined): MatterAnswer[] {
  const chained = (s.chain ?? []).flatMap((c) => {
    const x = find(c.id);
    return x ? [{ id: c.id, question: c.question, text: x.arc.resolution }] : [];
  });
  return [{ id: s.id, question: s.question, text: s.arc.resolution }, ...chained];
}

export interface MatterModel {
  first: Story | undefined; // the first question when `s` is a follow-up
  answers: MatterAnswer[]; // what the Record finds, one per question of the matter
  claims: ClaimView[];
  groups: { label: FindingLabel; claims: ClaimView[] }[];
  exhibits: SourceView[]; // numbered exhibits; `preview` adds unnumbered ones last
  revisions: { r: ClaimRevision; text: string }[]; // oldest first
  revised: string | null;
  outputs: ReturnType<typeof storyOutputs>;
  embed: PublicVideo | null; // the live video, else the releasing one
  release: ArticleRelease | null; // null for a follow-up; in a preview, the validated draft's snapshot when unreleased
  previewArticle: boolean; // the view is a validated draft, not a release: the dev page marks it, a build never has one
  firstArticle: boolean;
  view: ArticleView | null;
  path: string;
}

export function matterModel(
  t: Topic,
  s: Story,
  stories: Story[],
  opts: { repo: string; preview: boolean; root?: string },
): MatterModel {
  const root = opts.root ?? ROOT;
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
  const outputs = storyOutputs(t.name, s.partOf ?? s.id, root);
  // The released companion article, each figure drawn from the release's snapshot, never the live files. A follow-up
  // links to its first question's article. The dev preview shows a validated draft before its lock, so the page
  // review judges the page a visitor will see; a build has no draft.
  const released = first ? null : loadArticleRelease(t.name, s.id, root);
  const release = released ?? (first || !opts.preview ? null : previewRelease(t.name, s.id, root));
  const firstArticle = !!first && !!loadArticleRelease(t.name, first.id, root);
  const figures = release ? releaseFigureDraws(release, t.docNames) : new Map();
  const view = release ? articleView(release, t, loadPublicRecord(t.name, root), opts.repo, figures) : null;
  return {
    first,
    answers: matterAnswers(s, (id) => stories.find((x) => x.id === id)),
    claims,
    groups,
    exhibits,
    revisions,
    revised: revisions.at(-1)?.r.at ?? null,
    outputs,
    embed: outputs.video ?? outputs.releasing,
    release,
    previewArticle: !!release && !released,
    firstArticle,
    view,
    path: matterPath(t.name, s),
  };
}
