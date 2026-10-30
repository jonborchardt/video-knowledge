import { describe, expect, it } from 'vitest';
import { sentences, words } from '../../../shared/sentences';
import { spokenWords } from '../../../shared/numbers';
import { buildStoryboard, pointProblems } from '..';
import type { ChartPoint, ChartSpec, ChartType, PassageReader, StoryboardPlan, Unit } from '../../../shared/types';
import {
  DOC_D,
  approveAll,
  fact,
  good,
  pkg,
  plan,
  read,
  run,
  scene,
  script,
  sentence,
} from '../../../../tests/script-helpers';

describe('storyboard', () => {
  const p = () => pkg();
  it('takes its narration from the script and keeps timing consistent', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const sb = buildStoryboard(
      plan([
        scene('sc1', ['s01']),
        scene('sc2', ['s02'], {
          pauseSeconds: 2,
          visual: {
            category: 'data-chart',
            description: 'three bars',
            chart: {
              type: 'bar',
              points: [{ label: 'lost money', value: 47, unit: 'percent', display: '47%', cite: DOC_D }],
            },
          },
          citations: [{ label: 'Survey D', cite: DOC_D }],
        }),
        scene('sc3', ['s03']),
      ]),
      s,
      v,
      p(),
      read,
    );
    expect(sb.status).toBe('ok');
    expect(sb.scenes.map((x) => x.narration)).toEqual(sentences(s).map((x) => x.text));
    expect(sb.scenes[0].start).toBe(0);
    for (let i = 1; i < sb.scenes.length; i++) expect(sb.scenes[i].start).toBe(sb.scenes[i - 1].end);
    for (const x of sb.scenes) expect(x.end).toBeCloseTo(x.start + x.duration, 5);
    expect(sb.runtime).toBe(sb.scenes.at(-1)!.end);
    expect(sb.scenes[1].duration).toBeCloseTo((spokenWords(sentences(s)[1].text) / 150) * 60 + 2, 1);
  });

  it('rejects reworded narration, missing or repeated sentences, stale plans, and chart data outside the passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const cat = (sb: ReturnType<typeof buildStoryboard>) =>
      sb.issues.filter((i) => i.severity === 'blocking').map((i) => i.category);
    expect(
      cat(
        buildStoryboard(
          plan([
            scene('sc1', ['s01', 's02', 's03'], {
              narration:
                'Say you join under a friend. Of 601 people surveyed, 47 percent lose money. So what does that leave?',
            }),
          ]),
          s,
          v,
          p(),
          read,
        ),
      ),
    ).toContain('reworded-narration');
    expect(cat(buildStoryboard(plan([scene('sc1', ['s01', 's02'])]), s, v, p(), read))).toContain('missing-sentence');
    expect(
      cat(buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s02', 's03'])]), s, v, p(), read)),
    ).toContain('duplicate-sentence');
    expect(
      cat(buildStoryboard(plan([scene('sc1', ['s02']), scene('sc2', ['s01', 's03'])]), s, v, p(), read)),
    ).toContain('out-of-order');
    expect(
      cat(
        buildStoryboard({ ...plan([scene('sc1', ['s01', 's02', 's03'])]), scriptFingerprint: 'old' }, s, v, p(), read),
      ),
    ).toContain('stale-script');
    const badChart = plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: {
          category: 'data-chart',
          description: 'bars',
          chart: { type: 'bar', points: [{ label: 'lost', value: 62, unit: 'percent', display: '62%', cite: DOC_D }] },
        },
      }),
    ]);
    expect(cat(buildStoryboard(badChart, s, v, p(), read))).toContain('chart-data');
    // A blocked script cannot be storyboarded.
    const blocked = run(script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])]));
    expect(
      cat(
        buildStoryboard(
          plan([scene('sc1', ['s01'])], script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])])),
          script([sentence('s01', 'x 62', 'factual', [fact('s01.a', '62')])]),
          blocked,
          p(),
          read,
        ),
      ),
    ).toContain('script-blocked');
  });

  const point = (o: Partial<ChartPoint>): ChartPoint => ({
    label: 'lost money',
    value: 47,
    unit: 'percent',
    display: '47%',
    cite: DOC_D,
    ...o,
  });
  const chartPlan = (points: ChartPoint[], type: string = 'bar') =>
    plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: { category: 'data-chart', description: 'bars', chart: { type: type as ChartType, points } },
      }),
    ]);

  it('chart values written in words are checked against the passage', () => {
    const s = good();
    const v = run(s, approveAll(s));
    const chart = (display: string, value: number) => chartPlan([point({ display, value })]);
    expect(buildStoryboard(chart('forty-seven percent', 47), s, v, p(), read).status).toBe('ok');
    expect(buildStoryboard(chart('sixty-two percent', 62), s, v, p(), read).issues.map((i) => i.category)).toContain(
      'chart-data',
    );
  });

  it('per-sentence timing tiles the scene and numerals lengthen it', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    expect(v.spokenWords).toBeGreaterThan(v.words);
    const sb = buildStoryboard(
      plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'], { pauseSeconds: 1 })]),
      s,
      v,
      pkg(),
      read,
    );
    const t = sb.scenes[0].timing;
    expect(t.map((x) => x.id)).toEqual(['s01', 's02']);
    expect(t[0].start).toBe(0);
    expect(t[1].start).toBeCloseTo(t[0].end, 5);
    expect(sb.scenes[0].duration).toBeCloseTo(t[1].end, 5);
    expect(sb.scenes[1].duration).toBeCloseTo(sb.scenes[1].timing[0].duration + 1, 5);
    expect(t[1].duration).toBeGreaterThan((words(sentences(s)[1].text) / 150) * 60); // "601" and "47" lengthen it
    expect(sb.scenes[1].timing[0].start).toBeCloseTo(sb.scenes[1].start, 5); // absolute, not scene-relative
  });

  it('building a storyboard from its own output is byte-for-byte idempotent', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const once = buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'])]), s, v, pkg(), read);
    const twice = buildStoryboard(JSON.parse(JSON.stringify(once)) as StoryboardPlan, s, v, pkg(), read);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('scenes reference registered assets by id', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const withAssets = (
      ids: string[],
      assets: StoryboardPlan['assets'],
      extra: Partial<StoryboardPlan['scenes'][0]['visual']> = {},
    ) => ({
      ...plan([
        scene('sc1', ['s01', 's02', 's03'], {
          visual: { category: 'diagram', description: 'tree', assetIds: ids, ...extra },
        }),
      ]),
      assets,
    });
    const issues = (p: StoryboardPlan) => buildStoryboard(p, s, v, pkg(), read).issues;
    expect(
      buildStoryboard(
        withAssets(['tree'], { tree: { kind: 'component', description: 'node tree' } }),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
    expect(issues(withAssets(['ghost'], {})).map((i) => i.category)).toContain('asset');
    expect(
      issues(withAssets([], { unused: { kind: 'image', description: 'x' } })).some(
        (i) => i.category === 'asset' && i.severity === 'warning',
      ),
    ).toBe(true);
    const doc = { page: { kind: 'document-render' as const, description: 'the rank table' } };
    expect(issues(withAssets(['page'], doc)).some((i) => i.category === 'asset' && i.severity === 'warning')).toBe(
      true,
    );
    expect(
      issues(withAssets(['page'], doc, { excerpt: { cite: DOC_D } })).filter((i) => i.category === 'asset'),
    ).toEqual([]);
    const legacy = withAssets([], {}, { assets: ['a free-text asset'] } as unknown as Partial<
      StoryboardPlan['scenes'][0]['visual']
    >);
    expect(issues(legacy).map((i) => i.category)).toContain('asset');
  });

  it('accepts numeric points whose display matches the value and the passage', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    expect(buildStoryboard(chartPlan([point({})]), s, v, pkg(), read).status).toBe('ok');
    expect(
      buildStoryboard(chartPlan([point({ value: 14, display: 'fourteen percent' })]), s, v, pkg(), read).status,
    ).toBe('ok');
    expect(
      buildStoryboard(
        chartPlan([point({ value: 5000, unit: 'usd', display: 'less than $5,000', qualifier: 'lt' })]),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
    expect(
      buildStoryboard(
        chartPlan([point({ value: 601, unit: 'count', display: '601' })], 'stat-tiles'),
        s,
        v,
        pkg(),
        read,
      ).status,
    ).toBe('ok');
  });

  it('words an unknown cite and a display mismatch as it always has', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const msgs = (pts: ChartPoint[]) =>
      buildStoryboard(chartPlan(pts), s, v, pkg(), read).issues.map((i) => i.explanation);
    expect(msgs([point({ cite: 'nope/sources/x.txt#L1-L2' })])).toContain(
      `chart point "lost money" cites nope/sources/x.txt#L1-L2, which is not in the evidence package`,
    );
    expect(msgs([point({ value: 12, display: '13%' })])).toContain(
      `chart point "lost money": display "13%" does not state the value 12`,
    );
  });

  it('rejects display/value mismatch, out-of-passage figures, bad units and unknown types', () => {
    const s = good();
    const v = run(s, approveAll(s, pkg()));
    const cat = (pts: ChartPoint[], type?: string) =>
      buildStoryboard(chartPlan(pts, type), s, v, pkg(), read).issues.map((i) => i.category);
    expect(cat([point({ value: 83.33, display: '$84', unit: 'usd' })])).toContain('chart-data');
    expect(cat([point({ value: 62, display: '62%' })])).toContain('chart-data');
    expect(cat([point({ value: 147, display: '147%' })])).toContain('chart-data');
    expect(cat([point({ value: 601, unit: 'ratio', display: '1 in 601' })])).toEqual([]);
    expect(cat([point({ value: 1, unit: 'ratio', display: '1 in 601' })])).toContain('chart-data');
    expect(cat([point({})], 'proportional-table')).toContain('chart');
    expect(cat([])).toContain('chart');
    const legacy = plan([
      scene('sc1', ['s01', 's02', 's03'], {
        visual: {
          category: 'data-chart',
          description: 'bars',
          chart: { type: 'bar', series: [{ label: 'lost', value: '47%', cite: DOC_D }] } as unknown as ChartSpec,
        },
      }),
    ]);
    expect(
      buildStoryboard(legacy, s, v, pkg(), read)
        .issues.map((i) => i.explanation)
        .join(' '),
    ).toMatch(/series was replaced by points/);
  });
});

describe('chart point units', () => {
  const CITE = 'x/sources/uk.txt#L1';
  const read: PassageReader = (c) => (c === CITE ? 'running costs rose by £190 a year' : null);
  const p = (x: Partial<ChartPoint>): ChartPoint => ({
    label: 'Extra cost',
    value: 190,
    unit: 'gbp',
    display: '£190',
    cite: CITE,
    ...x,
  });
  it('accepts a pound point', () => {
    expect(pointProblems(p({}), new Set([CITE]), read)).toEqual([]);
  });
  it('refuses a unit outside UNITS', () => {
    expect(pointProblems(p({ unit: 'eur' as Unit }), new Set([CITE]), read)).toContain('unknown unit "eur"');
  });
  it('refuses a currency sign that contradicts the unit', () => {
    expect(pointProblems(p({ unit: 'usd' }), new Set([CITE]), read)).toEqual([
      'display "£190" is in pounds; the unit is usd',
    ]);
    const r2: PassageReader = () => 'it cost $240';
    expect(pointProblems(p({ value: 240, display: '$240' }), new Set([CITE]), r2)).toEqual([
      'display "$240" is in dollars; the unit is gbp',
    ]);
  });
});
