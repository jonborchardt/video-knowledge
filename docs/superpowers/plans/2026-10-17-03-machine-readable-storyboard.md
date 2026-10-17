# Plan 3: Make the storyboard machine-readable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A renderer can read one scene and know its narration, per-sentence timing, visual type, numeric chart data with units and citations, and required assets, without parsing English.

**Architecture:** Tighten the existing `storyboard.json` contract: a closed chart-type enum, numeric chart points (`value`, `unit`, `display`, `qualifier`, `cite`), a top-level asset registry that scenes reference by id, per-sentence timing computed from a numeral-aware spoken-word estimate, and the same estimate used for the script runtime. The MLM storyboard is migrated to the new contract by a one-off script; descriptions stay as guidance.

**Tech Stack:** TypeScript (tsx, vitest); `src/lib/storyboard.ts`, `src/lib/numbers.ts`, `src/lib/script.ts`, `src/pages/[topic]/scripts/[slug].astro`, `scripts/briefs/storyboard.md`.

**Spec:** `docs/superpowers/specs/2026-10-17-hardening-spec.md` section 3; audit findings 6 and 10, section 8 "Barriers".

## Global Constraints

- Implement what the MLM storyboard needs (deferred list: no general-purpose visual component architecture, no media asset management).
- The script is the only source of narration; the storyboard never carries words of its own (CLAUDE.md).
- Plans 1 and 2 are merged (shared `numbers.ts`, `stale-validation` check).
- `npm run validate` green at the end of every task.

## Review Focus

1. A point whose `display` rounds the `value` ("$84" with value 83.33): must be rejected; `display` digits must equal `value` (Task 1 test).
2. A chart point with `unit: 'percent'` and value above 100 or below 0: reject (Task 1 test).
3. A scene whose `assetIds` reference an asset defined but of kind `document-render` without an `excerpt`: warning (Task 3 test).
4. A sentence whose spoken length is dominated by a long numeral ("$1,018,350"): per-sentence duration must exceed the plain word count estimate (Task 2 test).
5. A migrated MLM storyboard re-run through `storyboard`: identical output (idempotence, Task 5).

---

### Task 1: Numeric chart points with a closed type enum

**Files:**
- Modify: `src/lib/storyboard.ts:29-34` (`ChartSpec`), chart checks `:156-166`
- Modify: `src/lib/storyboard.ts` `renderStoryboardMd` chart table; `src/pages/[topic]/scripts/[slug].astro` chart table
- Test: `tests/script.test.ts` (storyboard describe)

**Interfaces:**
- Produces:
  ```ts
  export const CHART_TYPES = ['bar', 'stacked-bar', 'dot-plot', 'waffle', 'table', 'stat-tiles', 'composite'] as const;
  export type ChartType = (typeof CHART_TYPES)[number];
  export type Unit = 'percent' | 'usd' | 'count' | 'ratio';
  export interface ChartPoint { label: string; value: number; unit: Unit; display: string; qualifier?: 'lt' | 'lte' | 'gt' | 'gte' | 'about'; cite: string; }
  export interface ChartSpec { type: ChartType; title?: string; points: ChartPoint[]; note?: string; }
  ```
  (`series` is removed; a plan still using it is blocked with `chart`: "series was replaced by points".)
- Rules (blocking `chart-data` unless stated): `type` in `CHART_TYPES`; `points.length >= 1`; `cite` in the package; some figure in `nums(wordsToDigits(display))` has `Number(n) === value`; every figure in `display` satisfies `hasFigure(passage, n)`; `unit === 'percent'` requires `0 <= value <= 100`; `unit === 'ratio'` requires `display` to contain two figures (e.g. "1 in 238") and `value` to equal the second.

- [ ] **Step 1: Write the failing tests**

```ts
const point = (o: Partial<ChartPoint>): ChartPoint => ({ label: 'lost money', value: 47, unit: 'percent', display: '47%', cite: DOC_D, ...o });
const chartPlan = (points: ChartPoint[], type: string = 'bar') => plan([scene('sc1', ['s01', 's02', 's03'], { visual: { category: 'data-chart', description: 'bars', chart: { type: type as ChartType, points } } })]);
it('accepts numeric points whose display matches the value and the passage', () => {
  const s = good(); const v = run(s, approveAll(s, pkg()));
  expect(buildStoryboard(chartPlan([point({})]), s, v, pkg(), read).status).toBe('ok');
  expect(buildStoryboard(chartPlan([point({ value: 14, display: 'fourteen percent' })]), s, v, pkg(), read).status).toBe('ok'); // DOC_D text spells it; see read()
});
it('rejects display/value mismatch, out-of-passage figures, bad units and unknown types', () => {
  const s = good(); const v = run(s, approveAll(s, pkg()));
  const cat = (pts: ChartPoint[], type?: string) => buildStoryboard(chartPlan(pts, type), s, v, pkg(), read).issues.map((i) => i.category);
  expect(cat([point({ value: 83.33, display: '$84', unit: 'usd' })])).toContain('chart-data');
  expect(cat([point({ value: 62, display: '62%' })])).toContain('chart-data');
  expect(cat([point({ value: 147, display: '147%' })])).toContain('chart-data');
  expect(cat([point({})], 'proportional-table')).toContain('chart');
});
```

Extend `read()` in `tests/script.test.ts` so `DOC_D` ends with "Fourteen percent made less than $5,000." for the word-form case.

- [ ] **Step 2: Run to verify failure** (`npx vitest run tests/script.test.ts -t "numeric points|mismatch"`), **Step 3: Implement** types, checks, and the two renderers (table columns: label, display, value, unit, source); migrate every existing test that builds a chart with `series` (`tests/script.test.ts` storyboard describe, `tests/adversarial.test.ts` case 10) to `points`, **Step 4: Run** `npx vitest run && npx astro check`.

- [ ] **Step 5: Commit** `git commit -m "feat(storyboard): numeric chart points with units and a closed type enum"`.

---

### Task 2: Numeral-aware spoken-word estimate and per-sentence timing

**Files:**
- Modify: `src/lib/numbers.ts` (add `spokenWords`), `src/lib/script.ts:399-400` (`minutes` uses spoken words; keep `words`), `src/lib/storyboard.ts:59-67` (`Scene`), `:204-210` (timing)
- Test: `tests/numbers.test.ts`, `tests/script.test.ts`

**Interfaces:**
- Produces: `spokenWords(text: string): number` = plain word count where each numeric token (`/\$?\d[\d,]*(?:\.\d+)?%?/`) counts as `max(1, ceil(digits * 0.7)) + ($ ? 1 : 0) + (% ? 1 : 0)` words instead of 1 (so "47%" = 3, "$1,018,350" = 6, "92.37" = 3, "2018" = 3). `ScriptValidation.spokenWords: number`, `minutes` computed from it. `Scene.timing: { id: string; start: number; duration: number; end: number }[]` (one entry per sentence in scene order; durations from `spokenWords / wpm * 60`; the scene's `pauseSeconds` is added after the last sentence) and `Scene.duration === sum(timing) + pause`.

- [ ] **Step 1: Write the failing tests**

```ts
// numbers.test.ts
it('counts numerals by spoken length', () => {
  expect(spokenWords('they lost money')).toBe(3);
  expect(spokenWords('47% lost money')).toBe(5);
  expect(spokenWords('averages $1,018,350')).toBe(7);
});
// script.test.ts storyboard describe
it('per-sentence timing tiles the scene and numerals lengthen it', () => {
  const s = good(); const v = run(s, approveAll(s, pkg()));
  const sb = buildStoryboard(plan([scene('sc1', ['s01', 's02']), scene('sc2', ['s03'], { pauseSeconds: 1 })]), s, v, pkg(), read);
  const t = sb.scenes[0].timing;
  expect(t.map((x) => x.id)).toEqual(['s01', 's02']);
  expect(t[0].start).toBe(0); expect(t[1].start).toBeCloseTo(t[0].end, 5);
  expect(sb.scenes[0].duration).toBeCloseTo(t[1].end, 5);
  expect(sb.scenes[1].duration).toBeCloseTo(sb.scenes[1].timing[0].duration + 1, 5);
  expect(t[1].duration).toBeGreaterThan((words(sentences(s)[1].text) / 150) * 60); // "601" and "47" lengthen it
});
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run** `npx vitest run`.

- [ ] **Step 5: Commit** `git commit -m "feat(storyboard): per-sentence timing from a numeral-aware spoken-word estimate"`.

---

### Task 3: Asset registry separate from visual guidance

**Files:**
- Modify: `src/lib/storyboard.ts:35-58` (`ScenePlan.visual.assets` removed; `assetIds` added), `StoryboardPlan.assets` added, checks, `renderStoryboardMd` (assets section at top)
- Modify: `src/pages/[topic]/scripts/[slug].astro` (list assets per scene by id)
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `export type AssetKind = 'component' | 'animation' | 'image' | 'document-render'; export interface Asset { kind: AssetKind; description: string; }` ; `StoryboardPlan.assets: Record<string, Asset>`; `ScenePlan.visual.assetIds?: string[]`. Rules: unknown id → blocking `asset`; an asset no scene uses → warning `asset`; a scene with a `document-render` asset and no `visual.excerpt` → warning `asset`. `visual.description` is guidance only and is never checked.

- [ ] **Step 1: Write the failing test**

```ts
it('scenes reference registered assets by id', () => {
  const s = good(); const v = run(s, approveAll(s, pkg()));
  const withAssets = (ids: string[], assets: StoryboardPlan['assets']) => ({ ...plan([scene('sc1', ['s01', 's02', 's03'], { visual: { category: 'diagram', description: 'tree', assetIds: ids } })]), assets });
  expect(buildStoryboard(withAssets(['tree'], { tree: { kind: 'component', description: 'node tree' } }), s, v, pkg(), read).status).toBe('ok');
  expect(buildStoryboard(withAssets(['ghost'], {}), s, v, pkg(), read).issues.map((i) => i.category)).toContain('asset');
  expect(buildStoryboard(withAssets([], { unused: { kind: 'image', description: 'x' } }), s, v, pkg(), read).issues.some((i) => i.category === 'asset' && i.severity === 'warning')).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run** `npx vitest run && npx astro check`.

- [ ] **Step 5: Commit** `git commit -m "feat(storyboard): asset registry referenced by id"`.

---

### Task 4: Brief and contract documentation

**Files:**
- Modify: `scripts/briefs/storyboard.md` (chart points, assets, timing), `README.md` "Scripts and storyboards" paragraph, `CLAUDE.md` script-artifacts rule

- [ ] **Step 1: Update** the brief's JSON example to the new shapes (`chart.points` with `value`, `unit`, `display`, `qualifier`, `cite`; top-level `assets`; `visual.assetIds`), list `CHART_TYPES`, and state: "a renderer reads `timing`, `visual.category`, `visual.chart.points`, `citations` and `assetIds`; `visual.description` and `direction` are guidance for a human".
- [ ] **Step 2: Run** `npm run format:check` (fix with `npm run format` if the markdown moved).
- [ ] **Step 3: Commit** `git commit -m "docs(storyboard): machine-readable contract"`.

---

### Task 5: Migrate the MLM storyboard

**Files:**
- Modify: `get-rich-quick/scripts/decision-mlm-and-seminars/storyboard.json` (agent-authored plan; migration allowed)
- Create (scratch, not committed): a one-off node script in the scratchpad that rewrites `series` to `points`, moves the free-text `assets` strings into a top-level registry with ids (`node-tree`, `dot-plot-601`, `person-grid`, `phone-ui`, `disclosure-thumbnails`, `evidence-cards`, `commission-icons`, `quote-card`), and sets `assetIds` per scene.

**Interfaces:**
- Consumes: Tasks 1-3. Values per point come from the existing `value` strings: percent `"92.37%"` → `{value: 92.37, unit: 'percent', display: '92.37%'}`; usd `"$1,018,350.20"` → `{value: 1018350.2, unit: 'usd'}`; `"$1,000 or less"` → `{value: 1000, unit: 'usd', qualifier: 'lte', display: '$1,000 or less'}`; `"less than $84"` → `{value: 84, unit: 'usd', qualifier: 'lt'}`; `"at least 17 of 70"` → `{value: 17, unit: 'count', qualifier: 'gte', display: 'at least 17 of 70'}`; `"one in 238"` → `{value: 238, unit: 'ratio', display: '1 in 238'}`; `"996 out of 1,000"` → `{value: 996, unit: 'count'}`; `"3 people"` → `{value: 3, unit: 'count'}`; `"fourteen percent (as written in the source)"` → `{value: 14, unit: 'percent', display: 'fourteen percent'}`. Chart types: `proportional-table` → `table`, `three-panel` → `composite`.

- [ ] **Step 1: Run the migration script**, then `npm run script -- storyboard get-rich-quick decision:mlm-and-seminars`.
Expected: `ok: 43 scenes`; if `stale-validation` or `script-blocked` appears because Plans 1 and 2 left the script unapproved, that is expected: record the issue list and continue to Plan 4, which re-approves and re-runs. Chart-data issues are migration errors and must be fixed here.
- [ ] **Step 2: Idempotence**: run the `storyboard` command twice and `git diff --stat` the file between runs: no change.
- [ ] **Step 3: Run** `npm run validate`.
- [ ] **Step 4: Commit**

```bash
git add get-rich-quick/scripts/decision-mlm-and-seminars/storyboard.json get-rich-quick/scripts/decision-mlm-and-seminars/storyboard.md get-rich-quick/scripts/decision-mlm-and-seminars/review.md
git commit -m "chore(mlm): migrate storyboard to numeric points, assets and per-sentence timing"
```

## Exit check (run by the orchestrator)

```
npm run validate
node -e "const sb=require('./get-rich-quick/scripts/decision-mlm-and-seminars/storyboard.json'); const s=sb.scenes.find(x=>x.id==='sc18'); console.log(s.visual.category, s.visual.chart.type, s.visual.chart.points[0], s.timing[0], s.visual.assetIds, s.citations[0])"
# expected: data-chart table { label, value: 41.69, unit: 'usd', display: '$41.69', cite } { id: 's24', start, duration, end } [...] { label, cite }
```
