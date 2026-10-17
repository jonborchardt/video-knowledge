// The exit criterion of docs/superpowers/specs/2026-10-17-hardening-spec.md section 1, one deliberate error per test:
// invented numbers, unsupported quotations and unverifiable speaker attributions fail validation.
import { describe, expect, it } from 'vitest';
import { validateScript } from '../src/lib/script';
import { buildStoryboard } from '../src/lib/storyboard';
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
    expect(cats(validateScript(s, corpus(), read, null, {}, null, q, hashOf(q)))).toContain('speaker-unverified');
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
    const chart = (value: string) =>
      plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: {
            category: 'data-chart',
            description: 'bars',
            chart: { type: 'bar', series: [{ label: 'lost', value, cite: DOC_D }] },
          },
        }),
      ]);
    for (const value of ['62%', 'sixty-two percent'])
      expect(buildStoryboard(chart(value), s, v, pkg(), read).issues.map((i) => i.category)).toContain('chart-data');
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
