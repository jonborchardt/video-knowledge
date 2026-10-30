import { type Article, articleReviewUnits, articleSentences } from '../src/lib/article';
import { sentenceFingerprint } from '../src/shared/sentences';
import type { ScriptReviewFile } from '../src/shared/types';
import { TOPIC } from './corpus';
import { MLM, fact, pkg, sentence } from './script-helpers';

export const article = (extra: Partial<Article> = {}): Article => ({
  topic: TOPIC,
  story: 'decision:mlm-and-seminars',
  revision: 1,
  generation: { model: 'test', brief: 'b', date: 'd', wordsPerMinute: 150, evidencePackage: pkg().fingerprint },
  meta: {
    headline: 'How Much Money Do MLM Participants Make?',
    seoTitle: 'MLM income: what a survey found',
    dek: sentence('meta.dek', 'What does the evidence say?', 'rhetorical'),
    description: sentence('meta.description', 'A look at who earns what.', 'rhetorical'),
  },
  sections: [
    {
      name: 'hook',
      heading: 'Why it matters',
      blocks: [{ kind: 'prose', sentences: [sentence('s01', 'Say you join under a friend.', 'hypothetical')] }],
    },
    {
      name: 'answer',
      heading: 'What we found',
      blocks: [
        {
          kind: 'prose',
          sentences: [
            sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
              fact('s02.a', 'Of 601 participants, 47% reported losing money.'),
            ]),
          ],
        },
        // The package's claim is unresolved (one study, below the verified confidence): a callout carries it.
        {
          kind: 'prose',
          callout: 'unresolved',
          claim: MLM,
          sentences: [sentence('s03', 'One survey is not the last word.', 'rhetorical')],
        },
      ],
    },
  ],
  ...extra,
});

export const approveArticle = (a: Article): ScriptReviewFile => ({
  reviewer: 'test',
  date: 'd',
  revision: a.revision,
  packageFingerprint: pkg().fingerprint,
  approved: Object.fromEntries([
    ...articleSentences(a).map((x) => [x.id, sentenceFingerprint(x)]),
    ...articleReviewUnits(a),
  ]),
  findings: [],
});
