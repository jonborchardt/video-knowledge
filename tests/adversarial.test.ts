// The exit criterion of docs/superpowers/specs/2026-10-17-hardening-spec.md section 1, one deliberate error per test:
// invented numbers, unsupported quotations and unverifiable speaker attributions fail validation.
import { describe, expect, it } from 'vitest';
import {
  type EvidencePackage,
  type Script,
  type ScriptReviewFile,
  sentenceFingerprint,
  sentences,
} from '../src/lib/script';
import { validateScript } from '../src/lib/script-validation';
import { type ChartSpec, type StoryboardPlan, buildStoryboard } from '../src/lib/storyboard';
import { TOPIC, claim, study } from './corpus';
import {
  DOC_D,
  MLM,
  approveAll,
  cats,
  corpus,
  fact,
  good,
  hashOf,
  partlySentence,
  pkg,
  plan,
  read,
  run,
  scene,
  script,
  sentence,
} from './script-helpers';

const factual = (text: string, assertion: string) =>
  script([sentence('s01', text, 'factual', [fact('s01.a', assertion)])]);
const attributed = (text: string, quote?: { text: string; source: string; speaker?: string }) =>
  script([
    sentence('s01', text, 'attributed', [
      {
        id: 's01.a',
        text,
        kind: 'attribution',
        claims: [{ id: MLM, stance: 'asserts' }],
        evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
        ...(quote ? { quote } : {}),
      },
    ]),
  ]);

describe('adversarial: every deliberate error is blocked', () => {
  it('1. an invented digit statistic', () => {
    expect(cats(run(factual('In the survey 62 percent lost money.', '62% lost money.')))).toContain('invented-number');
  });

  it('2. an invented statistic written in words', () => {
    expect(
      cats(run(factual('In the survey sixty-two percent lost money.', 'sixty-two percent lost money.'))),
    ).toContain('invented-number');
  });

  it('3. a figure present only in the verdict note', () => {
    const noteOnly = claim('mlm-income', 'Most MLM participants earn nothing or lose money', {
      verdicts: [study('Survey D', 'right', 0.7, DOC_D, 'The survey found 62% lost money once expenses were counted.')],
    });
    const v = validateScript(
      factual('Counting expenses, 62 percent lost money.', 'Counting expenses, 62% lost money.'),
      { name: TOPIC, claims: [noteOnly] },
      read,
    );
    expect(cats(v)).toContain('invented-number');
  });

  it('4. a figure that rounds the passage figure', () => {
    expect(cats(run(factual('About 48 percent lost money.', 'About 48% reported losing money.')))).toContain(
      'invented-number',
    );
  });

  it('5. a figure in the sentence that no assertion owns', () => {
    const v = run(
      script([
        sentence('s01', 'Of 601 people, 47 percent lost money and 9 in 10 regretted it.', 'factual', [
          fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
        ]),
      ]),
    );
    expect(cats(v)).toContain('figure-without-assertion');
  });

  it('6. a fabricated quotation', () => {
    const text = 'The survey reports "47% reported making money".';
    const v = run(
      script([
        sentence('s01', text, 'factual', [
          fact('s01.a', text, [DOC_D], { quote: { text: '47% reported making money', cite: DOC_D } }),
        ]),
      ]),
    );
    expect(cats(v)).toContain('misquote');
  });

  it('7. a real quotation attributed to a speaker the evidence does not identify', () => {
    const q = pkg();
    q.claims[0].statements[0].context = 'to hear another former distributor tell it: quote s1a words and so on';
    const s = attributed('John Oliver said "quote s1a words".', {
      text: 'quote s1a words',
      source: 's1a',
      speaker: 'John Oliver',
    });
    expect(cats(validateScript(s, corpus(), read, { pkg: q, hashDoc: hashOf(q) }))).toContain('speaker-unverified');
  });

  it('8. an attributed figure that is not in the recorded quote', () => {
    expect(cats(run(attributed('One source says ten people joined.')))).toContain('figure-not-in-quote');
  });

  it('9. a calculation with an input that is not in the passage', () => {
    const v = run(
      script([
        sentence('s01', 'That leaves 20 percent.', 'factual', [
          fact('s01.a', '20% of participants neither lost money nor broke even.', [DOC_D], {
            calc: {
              expression: '100 - 47 - 33',
              inputs: [
                { value: '47', cite: DOC_D },
                { value: '33', cite: DOC_D },
              ],
              result: '20',
            },
          }),
        ]),
      ]),
    );
    expect(cats(v)).toContain('bad-arithmetic');
  });

  it('10. a chart value that is not in the cited passage, in digits or in words', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const chart = (display: string) =>
      plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: {
            category: 'data-chart',
            description: 'bars',
            chart: { type: 'bar', points: [{ label: 'lost', value: 62, unit: 'percent', display, cite: DOC_D }] },
          },
        }),
      ]);
    for (const display of ['62%', 'sixty-two percent'])
      expect(buildStoryboard(chart(display), s, v, pkg(), read).issues.map((i) => i.category)).toContain('chart-data');
  });

  it('11. an on-screen figure that is in neither the narration nor a cited passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const sb = buildStoryboard(
      plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: { category: 'typography', description: 'big number', onScreenText: ['62% lost money'] },
        }),
      ]),
      s,
      v,
      pkg(),
      read,
    );
    expect(sb.issues.map((i) => i.category)).toContain('on-screen-figure');
  });

  it('12. a blanket reviewer approval over a blocked assertion', () => {
    const s = factual('In the survey 62 percent lost money.', '62% lost money.');
    expect(run(s, approveAll(s)).status).toBe('blocked');
  });
});

describe('adversarial: review findings', () => {
  const pkgWith = (context: string | null) => {
    const q = pkg();
    q.claims[0].statements[0].context = context;
    return q;
  };
  const quoted = (text: string, quote?: { text: string; source: string; speaker?: string }) =>
    script([
      sentence('s01', text, 'attributed', [
        {
          id: 's01.a',
          text,
          kind: 'attribution',
          claims: [{ id: MLM, stance: 'asserts' }],
          evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }],
          ...(quote ? { quote } : {}),
        },
      ]),
    ]);
  const v = (s: Script, q: EvidencePackage) => validateScript(s, corpus(), read, { pkg: q, hashDoc: hashOf(q) });
  const Q = 'quote s1a words';

  it('13. an invented number word at the end of a sentence', () => {
    const s = script([
      sentence('s01', 'Of 601 people surveyed, the number who quit was fifteen.', 'factual', [
        fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
      ]),
    ]);
    expect(cats(run(s))).toContain('figure-without-assertion');
  });

  it('14. a quoted span in the narration that no assertion declares as a quote', () => {
    const s = script([
      sentence('s01', 'A study says "ninety percent lose everything they own" in MLMs.', 'factual', [
        fact('s01.a', 'Of 601 participants, 47% reported losing money.'),
      ]),
    ]);
    expect(cats(run(s))).toContain('quote-unchecked');
    const r = run(script([sentence('s01', 'Say "take the deal now" and leave.', 'hypothetical')]));
    expect(r.issues.map((i) => i.category)).toContain('quote-unchecked');
  });

  it('15. a speaker that is only a substring, or that the narration does not name', () => {
    const ctx = 'to hear another former distributor tell it: quote s1a words';
    const laureate = 'A Nobel laureate said "quote s1a words".';
    expect(cats(v(quoted(laureate, { text: Q, source: 's1a', speaker: 'a' }), pkgWith(ctx)))).toContain(
      'speaker-unverified',
    );
    expect(cats(v(quoted(laureate, { text: Q, source: 's1a', speaker: 'distributor' }), pkgWith(ctx)))).toContain(
      'speaker-unverified',
    );
    const former = 'A former distributor said "quote s1a words".';
    expect(cats(v(quoted(former, { text: Q, source: 's1a', speaker: 'distributor' }), pkgWith(ctx)))).toEqual([]);
    // a quote the package could not locate has no usable context
    const unlocated = pkgWith('(quote not located) a distributor spoke');
    expect(cats(v(quoted(former, { text: Q, source: 's1a', speaker: 'distributor' }), unlocated))).toContain(
      'speaker-unverified',
    );
  });

  it('16. a speaker on a study-passage quotation must be in the passage or the document name', () => {
    const withSpeaker = (text: string, speaker: string) =>
      script([
        sentence('s01', text, 'factual', [
          fact('s01.a', text, [DOC_D], { quote: { text: '47% reported losing money', cite: DOC_D, speaker } }),
        ]),
      ]);
    expect(cats(run(withSpeaker('Survey D reports "47% reported losing money".', 'Survey D')))).toEqual([]);
    expect(cats(run(withSpeaker('John Oliver reports "47% reported losing money".', 'John Oliver')))).toContain(
      'speaker-unverified',
    );
  });

  it('17. a disposition retires only the warning category it names, and only for the bound package', () => {
    const s = script([partlySentence()]);
    const q = pkg();
    const fp = sentenceFingerprint(sentences(s)[0]);
    const dispo = (category: string, bound = true) => ({
      ...approveAll(s, bound ? q : null),
      dispositions: { 's01.a': { fingerprint: fp, category, reason: 'carried by s01' } },
    });
    const count = (r: ScriptReviewFile) =>
      validateScript(s, corpus(), read, { review: r, pkg: q, hashDoc: hashOf(q) }).counts.dispositioned;
    expect(count(dispo('needs-qualification'))).toBe(1);
    expect(count(dispo('speaker-missing'))).toBe(0);
    expect(count(dispo('needs-qualification', false))).toBe(0);
  });

  it('18. number words in a non-factual sentence are flagged for the reviewer', () => {
    const r = run(script([sentence('s01', 'Picture fifteen thousand people quitting each month.', 'hypothetical')]));
    expect(r.issues.map((i) => i.category)).toContain('figure-in-non-factual');
  });

  it('19. a chart label, title or note with a figure not in the passage', () => {
    const s = good();
    const vv = run(s, approveAll(s));
    const chart = (extra: Partial<ChartSpec>, label = 'lost money') =>
      plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: {
            category: 'data-chart',
            description: 'bars',
            chart: {
              type: 'bar',
              points: [{ label, value: 47, unit: 'percent', display: '47%', cite: DOC_D }],
              ...extra,
            },
          },
        }),
      ]);
    const cat = (p: StoryboardPlan) => buildStoryboard(p, s, vv, pkg(), read).issues.map((i) => i.category);
    expect(cat(chart({}, 'lost money (average across 30 MLMs)'))).toContain('chart-data');
    expect(cat(chart({ title: 'Outcomes for 999 people' }))).toContain('chart-data');
    expect(cat(chart({ note: 'no data below $100' }))).toContain('chart-data');
    expect(cat(chart({ title: 'Outcomes for 601 people' }, '47% lost money'))).toEqual([]);
  });
});
