// The companion article: prose blocks over the script's sentences, so the script validator judges it unchanged.
import { sha } from './io';
import type { Script, SectionName, Sentence } from './script';
import type { ChartPoint } from './storyboard';

export const ARTICLE_FILES = {
  article: 'article.json',
  review: 'article-review.json',
  validation: 'article-validation.json',
  md: 'article.md',
  release: 'article-release.json',
} as const;

export type Callout = 'qualification' | 'unresolved';
export type Block =
  | { kind: 'prose'; sentences: Sentence[]; callout?: Callout; claim?: string; gap?: number }
  | {
      kind: 'table';
      id: string;
      caption: string;
      columns: string[];
      rows: { label: string; cells: ChartPoint[] }[];
    }
  | { kind: 'figure'; ref: string; caption: string };

export interface ArticleSection {
  name: SectionName;
  heading: string;
  blocks: Block[];
}
export interface Article {
  topic: string;
  story: string;
  revision: number;
  passStartRevision?: number;
  generation: Script['generation'];
  meta: { headline: string; seoTitle: string; dek: Sentence; description: Sentence };
  sections: ArticleSection[];
}

const proseOf = (s: ArticleSection) => s.blocks.flatMap((b) => (b.kind === 'prose' ? b.sentences : []));

export const articleSentences = (a: Article): Sentence[] => [
  a.meta.dek,
  a.meta.description,
  ...a.sections.flatMap(proseOf),
];

export function articleAsScript(a: Article): Script {
  const head = [a.meta.dek, a.meta.description];
  return {
    topic: a.topic,
    story: a.story,
    title: a.meta.headline,
    revision: a.revision,
    ...(a.passStartRevision === undefined ? {} : { passStartRevision: a.passStartRevision }),
    generation: a.generation,
    sections: a.sections.map((s, i) => ({
      name: s.name,
      title: s.heading,
      sentences: [...(i === 0 ? head : []), ...proseOf(s)],
    })),
  };
}

export const articleFingerprint = (a: Article) => sha(JSON.stringify({ meta: a.meta, sections: a.sections }));
