// A small synthetic corpus in the shape loadTopic() produces, for the evidence and story tests.
import type { Corpus, PassageReader } from '../src/lib/evidence';
import type { StoryInput } from '../src/lib/stories';
import type { ClaimSourceView, ClaimVerdictView, ClaimView, Verdict } from '../src/lib/topics';

export const TOPIC = 'demo';
export const DOC_A = `${TOPIC}/sources/rct-a.txt#L10-L12`;
export const DOC_B = `${TOPIC}/sources/survey-b.txt#L5-L6`;
export const DOC_C = `${TOPIC}/sources/field-c.txt#L20-L21`;

export const passages: Record<string, string> = {
  [DOC_A]: 'In the trial, developers using the tool finished tasks 26 percent faster on average.',
  [DOC_B]: 'Survey respondents reported mixed results; experienced staff saw smaller gains.',
  [DOC_C]:
    'In the field study experienced developers were slower with the tool; the gain was 18 percent, not ten times.',
};
export const reader: PassageReader = (cite) => passages[cite] ?? null;

type V = Partial<ClaimVerdictView> & { by: string; verdict: Verdict };
export function guess(verdict: Verdict, confidence = 0.4, note = 'guess note'): ClaimVerdictView {
  return { by: 'AI guess', verdict, confidence, note, cite: null, date: '2026-01-01' };
}
export function study(
  by: string,
  verdict: Verdict,
  confidence: number,
  cite: string,
  note = `${by} note`,
): ClaimVerdictView {
  return { by, verdict, confidence, note, cite, date: '2026-01-02' };
}
export function source(id: string, channel: string, stance: 'asserts' | 'denies' = 'asserts'): ClaimSourceView {
  return {
    id,
    title: `Video ${id}`,
    channel,
    kind: 'video',
    href: `https://youtu.be/${id}`,
    stance,
    quote: `quote ${id} words`,
  };
}
/** Sources from distinct channels: s1 on channel c1, s2 on c2, ... */
export const sources = (k: number, stance: 'asserts' | 'denies' = 'asserts') =>
  Array.from({ length: k }, (_, i) => source(`s${i + 1}${stance[0]}`, `c${i + 1}`, stance));

export function claim(
  slug: string,
  text: string,
  o: {
    verdicts?: V[];
    sources?: ClaimSourceView[];
    verdict?: Verdict | null;
    confidence?: number | null;
    decidedBy?: string | null;
    lean?: string | null;
  } = {},
): ClaimView {
  const verdicts = (o.verdicts ?? []).map((v) => ({ confidence: null, note: '', cite: null, date: null, ...v }));
  const srcs = o.sources ?? [];
  const studies = new Set(verdicts.filter((v) => v.cite).map((v) => v.cite!.split('#')[0])).size;
  // Unless told otherwise, the first study decides, else the AI guess (the watcher's rule, simplified).
  const deciding =
    o.decidedBy === null
      ? verdicts.find((v) => v.by === 'AI guess')
      : (verdicts.find((v) => v.by !== 'AI guess') ?? verdicts[0]);
  return {
    id: `${TOPIC}/${slug}`,
    text,
    asserted: srcs.filter((s) => s.stance === 'asserts').length,
    denied: srcs.filter((s) => s.stance === 'denies').length,
    verdict: o.verdict ?? deciding?.verdict ?? null,
    confidence: o.confidence ?? deciding?.confidence ?? null,
    note: deciding?.note ?? '',
    decidedBy: o.decidedBy === undefined ? (verdicts.find((v) => v.by !== 'AI guess')?.by ?? null) : o.decidedBy,
    studies,
    lean: o.lean ?? null,
    sources: srcs,
    verdicts,
  };
}

export const corpus = (...claims: ClaimView[]): Corpus => ({ name: TOPIC, claims });
export const topic = (
  claims: ClaimView[],
  recap: StoryInput['recap'] = [],
  sameStudy?: Record<string, string>,
): StoryInput => ({
  name: TOPIC,
  label: 'Demo',
  claims,
  recap,
  ...(sameStudy ? { sameStudy } : {}),
});
