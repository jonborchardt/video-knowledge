// Fixtures shared by tests/script.test.ts and tests/adversarial.test.ts: a two-claim topic, a survey passage with
// figures, and builders for scripts, assertions, reviews and storyboard plans.
import type {
  PassageReader,
  ReviewFile,
  EvidencePackage,
  Script,
  ScriptAssertion,
  ScriptReviewFile,
  Sentence,
} from '../src/shared/types';
import { buildPackage } from '../src/modules/script';
import { scriptFingerprint, sentenceFingerprint, sentences } from '../src/shared/sentences';
import { validateScript } from '../src/shared/sentence-validation';
import { discover } from '../src/lib/stories';
import type { StoryboardPlan } from '../src/shared/types';
import type { Topic } from '../src/lib/topics';
import { TOPIC, claim, passages, sources, study, topic } from './corpus';

// A passage with figures, in the shape of a survey result.
export const DOC_D = `${TOPIC}/sources/survey-d.txt#L1-L2`;
export const read: PassageReader = (cite) =>
  cite === DOC_D
    ? 'Of the 601 participants surveyed, 47% reported losing money, 27% broke even and 25% made a profit. Fourteen percent made less than $5,000. One in 601 made nothing.'
    : (passages[cite] ?? null);

export const MLM = `${TOPIC}/mlm-income`;
export const RENTAL = `${TOPIC}/rental-leverage`;
export const mlm = () =>
  claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
    verdicts: [study('Survey D', 'right', 0.7, DOC_D, 'A probability sample of 601 participants: 47% lost money.')],
    sources: sources(3),
    lean: 'skeptic',
  });
export const rental = () =>
  claim('rental-leverage', 'Rental property lets investors borrow against appreciation', {
    verdicts: [study('Field C', 'partly', 0.5, `${TOPIC}/sources/field-c.txt#L20-L21`)],
    sources: sources(2),
  });
export const review: ReviewFile = {
  stories: {
    'decision:mlm-and-seminars': {
      coherence: { score: 0.9, reason: 'one question' },
      claims: [MLM],
      title: 'How Much Money Do MLM Participants Actually Make?',
    },
  },
};
export const t = () => topic([mlm(), rental()], [{ title: 'MLM and seminars', claims: [mlm(), rental()] }]);
export const asTopic = (x: ReturnType<typeof t>): Topic => ({ ...x, docNames: {}, sameStudy: {} }) as unknown as Topic;
export const story = () => discover(t(), read, review).stories.find((s) => s.id === 'decision:mlm-and-seminars')!;
export const pkg = () => buildPackage(story(), asTopic(t()), read, { review });

export const fact = (
  id: string,
  text: string,
  cites = [DOC_D],
  extra: Partial<ScriptAssertion> = {},
): ScriptAssertion => ({
  id,
  text,
  kind: 'fact',
  claims: [{ id: MLM, stance: 'asserts' }],
  evidence: cites.map((cite) => ({ kind: 'study' as const, claim: MLM, cite })),
  ...extra,
});
export const sentence = (
  id: string,
  text: string,
  type: Sentence['type'],
  assertions?: ScriptAssertion[],
): Sentence => ({
  id,
  text,
  type,
  ...(assertions ? { assertions } : {}),
});
export const script = (sent: Sentence[], revision = 1): Script => ({
  topic: TOPIC,
  story: 'decision:mlm-and-seminars',
  title: 'T',
  revision,
  generation: { model: 'test', brief: 'b', date: 'd', wordsPerMinute: 150, evidencePackage: pkg().fingerprint },
  sections: [{ name: 'hook', sentences: sent }],
});
export const approveAll = (
  s: Script,
  q: EvidencePackage | null = pkg(),
  findings: ScriptReviewFile['findings'] = [],
): ScriptReviewFile => ({
  reviewer: 'test',
  date: 'd',
  revision: s.revision,
  ...(q ? { packageFingerprint: q.fingerprint } : {}),
  approved: Object.fromEntries(sentences(s).map((x) => [x.id, sentenceFingerprint(x)])),
  findings,
});
export const corpus = () => ({ name: TOPIC, claims: [mlm(), rental()] });
/** Validation as the CLI runs it: against the package and a hasher that vouches for the fixture documents. */
export const run = (s: Script, r: ScriptReviewFile | null = null, q: EvidencePackage | null = pkg()) =>
  validateScript(s, corpus(), read, { review: r, pkg: q, hashDoc: hashOf(q) });
export const hashOf = (q: EvidencePackage | null) => () => q?.documents[0].sha ?? null;
export const cats = (v: ReturnType<typeof run>) =>
  v.issues.filter((i) => i.severity === 'blocking').map((i) => i.category);

/** A sentence whose only evidence is a 'partly' verdict: the gate says needs-qualification (a warning). */
export const partlySentence = (): Sentence =>
  sentence('s01', 'Rental property lets investors borrow against appreciation.', 'factual', [
    {
      id: 's01.a',
      text: 'Rental property lets investors borrow against appreciation.',
      kind: 'fact',
      claims: [{ id: RENTAL, stance: 'asserts' }],
      evidence: [{ kind: 'study', claim: RENTAL, cite: `${TOPIC}/sources/field-c.txt#L20-L21` }],
    },
  ]);

export const good = () =>
  script([
    sentence('s01', 'Say you join under a friend.', 'hypothetical'),
    sentence('s02', 'Of 601 people surveyed, 47 percent lost money.', 'factual', [
      fact('s02.a', 'Of 601 participants, 47% reported losing money.'),
    ]),
    sentence('s03', 'So what does that leave?', 'rhetorical'),
  ]);
export const plan = (scenes: StoryboardPlan['scenes'], s = good()): StoryboardPlan => ({
  topic: TOPIC,
  story: s.story,
  scriptFingerprint: scriptFingerprint(s),
  generation: { model: 'test', brief: 'b', date: 'd' },
  assets: {},
  scenes,
});
export const scene = (
  id: string,
  ss: string[],
  extra: Partial<StoryboardPlan['scenes'][0]> = {},
): StoryboardPlan['scenes'][0] => ({
  id,
  sentences: ss,
  purpose: 'p',
  visual: { category: 'typography', description: 'words on screen' },
  ...extra,
});
/** A script blocked by an invented figure (the passage says 47%, not 77%), at the given revision. */
export const blockedScript = (revision: number, extra: Partial<Script> = {}): Script => ({
  ...script(
    [
      sentence('s02', 'Of 601 people surveyed, 77 percent lost money.', 'factual', [
        fact('s02.a', 'Of 601 participants, 77% reported losing money.'),
      ]),
    ],
    revision,
  ),
  ...extra,
});
