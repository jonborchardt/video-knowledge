# Plan 1: Close factual validation loopholes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic script gate reject figures that are not in a cited passage (including figures written in words), chart values that are not in a cited passage, and quoted speakers that the recorded evidence does not identify.

**Architecture:** One shared number module replaces the three copies of the digit regex; the evidence gate matches figures against passages only (verdict notes stop counting), after converting number words to digits on both sides. Speaker attribution becomes checkable by persisting a transcript window around every recorded source quote in the evidence package and requiring a named speaker to appear in that window or in the source's title or channel.

**Tech Stack:** TypeScript (tsx, vitest), existing modules `src/lib/evidence.ts`, `src/lib/script.ts`, `src/lib/storyboard.ts`, `scripts/script.ts`.

**Spec:** `docs/superpowers/specs/2026-10-17-hardening-spec.md` section 1; findings 1, 2, 5 and section 3.1 of `docs/superpowers/specs/2026-10-17-audit-report.md`.

## Global Constraints

- The validator in `src/lib/evidence.ts` must stay deterministic and fail closed; an AI guess never counts as verification; contextual evidence never decides (CLAUDE.md).
- Never hand-edit `<topic>/store/`. Transcripts are read from `<topic>/store/transcripts/<source id>.txt` (gitignored cache) only to build the package.
- `npm run validate` (typecheck, lint, prettier, build, tests) must pass at the end of every task.
- Do not fix the MLM script's own content in this plan; Plan 4 does. It is expected that `npm run script -- validate get-rich-quick decision:mlm-and-seminars` reports blocking issues after Task 3 (figures that only a verdict note carried, e.g. s41.a "30") and after Task 5 (missing `speaker`).
- No new dependencies.

## Review Focus

Inputs the spec implies but no task's tests exercise, each pinned to a task below:

1. A number written with a unit suffix the writer invents ("83.3 dollars" when the passage says "$84"): must still be rejected. Task 2 test `rejects a figure that rounds a passage figure`.
2. Hyphenated and "and"-joined number words ("two hundred and eighty-five", "ninety-two point three seven"): the first must convert; the second may stay words and therefore must not be used to smuggle a figure. Task 1 tests.
3. A figure inside a quotation that the passage states in words ("Twenty-nine exclude") and the narration says as "29": must pass once normalised. Task 3 test.
4. A speaker named only in the narration and not in the assertion's `quote.speaker`: cannot be checked by code; the brief must require `speaker` whenever the narration names who said it, and the validator must warn when a source quotation has no speaker. Task 5 test `warns when a source quotation names no speaker`.
5. A transcript that is missing on this machine (clean checkout): the package must keep the previously persisted context rather than dropping it. Task 4 test.

---

### Task 1: Shared number module with word-to-digit normalisation

**Files:**
- Create: `src/lib/numbers.ts`
- Test: `tests/numbers.test.ts`

**Interfaces:**
- Produces: `wordsToDigits(text: string): string` (replaces English cardinal number words from zero to nine hundred ninety-nine thousand, plus "million", "a hundred", "a thousand", "a million", hyphenated and "and"-joined forms, with digits; leaves everything else untouched; case-insensitive; does not touch "half", "quarter", "percent"), `nums(text: string): string[]` (digit strings as today: `/\d[\d,]*(?:\.\d+)?/g` with commas removed, applied after `wordsToDigits`), `hasFigure(haystack: string, figure: string): boolean` (true when `figure` occurs in `wordsToDigits(haystack)` with commas removed, bounded so that "14" does not match inside "140" or "0.14": regex `(^|[^\d.])<figure>(?![\d])`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/numbers.test.ts
import { describe, expect, it } from 'vitest';
import { hasFigure, nums, wordsToDigits } from '../src/lib/numbers';

describe('number words', () => {
  it.each([
    ['Fourteen percent of the 601', '14 percent of the 601'],
    ['Twenty-nine exclude from their', '29 exclude from their'],
    ['have an organization of a thousand people', 'have an organization of 1000 people'],
    ['Two hundred and eighty-five MLM participants (47%)', '285 MLM participants (47%)'],
    ['one in 238 actually profited', '1 in 238 actually profited'],
    ['half of one percent', 'half of 1 percent'],
    ['Twenty of the disclosures', '20 of the disclosures'],
    ['ninety-two point three seven', '92 point 3 7'],
  ])('%s', (input, out) => expect(wordsToDigits(input)).toBe(out));
  it('extracts digit figures after normalisation', () => {
    expect(nums('Fourteen percent made $5,000; 3% made $25,000')).toEqual(['14', '5000', '3', '25000']);
  });
  it('matches figures on boundaries only', () => {
    expect(hasFigure('about 140 people', '14')).toBe(false);
    expect(hasFigure('a 0.14 share', '14')).toBe(false);
    expect(hasFigure('Fourteen percent made less than $5,000', '14')).toBe(true);
    expect(hasFigure('$1,018,350.20', '1018350.20')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/numbers.test.ts`
Expected: FAIL, cannot find module `../src/lib/numbers`.

- [ ] **Step 3: Implement `src/lib/numbers.ts`**

Export the three functions. Algorithm for `wordsToDigits`: tokenise on word boundaries; accumulate a run of number words (`a` counts as one only when followed by hundred, thousand or million; `and` is allowed inside a run that already has a value); on run end, emit the computed integer. Keep a `ponytail:` comment naming the ceiling: ordinal words, fractions ("half", "quarter") and decimals spelled with "point" are not converted.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/numbers.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/numbers.ts tests/numbers.test.ts
git commit -m "feat: shared number helpers with word-to-digit normalisation"
```

---

### Task 2: Figures must come from passages, not verdict notes

**Files:**
- Modify: `src/lib/evidence.ts:174` (delete local `numbers`), `src/lib/evidence.ts:368-381` (figure loop)
- Modify: `tests/corpus.ts` (DOC_C passage; see Step 3)
- Test: `tests/evidence.test.ts`

**Interfaces:**
- Consumes: `nums`, `hasFigure` from Task 1.
- Produces: unchanged `validate()` signature; the figure check now reads `evidenceText = supporting and qualifying passages only` (no `x.note`), compares with `hasFigure`, and still honours `a.derived`.

- [ ] **Step 1: Write the failing tests** (append to `describe('evidence validator')`)

```ts
it('a figure present only in the verdict note does not count', () => {
  const c = claim('faster', FASTER, {
    verdicts: [study('RCT A', 'right', 0.8, DOC_A, 'The trial reported a 26 percent gain among 601 developers.')],
  });
  const v = validate(fact(`${FASTER} among 601 developers`, [studyRef(DOC_A)]), corpus(c), reader);
  expect(v.decision).toBe('blocked');
  expect(v.limitations.join(' ')).toMatch(/"601"/);
});
it('a figure the passage states in words is accepted when the sentence uses digits, and vice versa', () => {
  const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
  expect(validate(fact(`${FASTER}, by 26 percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe('approved');
  expect(validate(fact(`${FASTER}, by twenty-six percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe('approved');
  expect(validate(fact(`${FASTER}, by twenty-five percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe('blocked');
});
it('rejects a figure that rounds a passage figure', () => {
  const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.8, DOC_A)] });
  expect(validate(fact(`${FASTER}, by about 25 percent`, [studyRef(DOC_A)]), corpus(c), reader).decision).toBe('blocked');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/evidence.test.ts`
Expected: the first and the "twenty-five"/"twenty-six" assertions FAIL (notes still count; words are invisible).

- [ ] **Step 3: Implement**

In `src/lib/evidence.ts`: import `nums, hasFigure` from `./numbers`; delete the local `numbers` const (line 174) and the `.replaceAll(',', '')` on `evidenceText`; build `evidenceText` from `x.passage ?? ''` only; loop `for (const n of nums(a.text)) if (!hasFigure(evidenceText, n) && !a.derived?.includes(n))`. In `tests/corpus.ts` change `DOC_C` passage to `'In the field study experienced developers were slower with the tool; the gain was 18 percent, not ten times.'` so the existing `tenx` fixture (claim text "ten times") still resolves its figure. Update the header comment of `evidence.ts` (lines 1-14) to say figures must be in the cited passage.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS. If `tests/stories.test.ts` snapshot or story fixtures fail on a figure, fix the fixture passage, not the validator.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidence.ts tests/evidence.test.ts tests/corpus.ts
git commit -m "fix(evidence): figures must appear in the cited passage, in digits or words"
```

---

### Task 3: Script and storyboard checks use the shared helpers

**Files:**
- Modify: `src/lib/script.ts:424-425` (delete `nums`, `has`), figure sites at `:527-537` (figure-without-assertion), `:556-566` (calc inputs and operands), `:616-622` (attribution figures)
- Modify: `src/lib/storyboard.ts:81-82` (delete `nums`, `has`), `:160-166` (chart data), `:191-203` (on-screen text)
- Test: `tests/script.test.ts`

**Interfaces:**
- Consumes: `nums`, `hasFigure`, `wordsToDigits` from Task 1.
- Produces: unchanged signatures; every figure comparison in both modules goes through `hasFigure`, and chart `value` strings and on-screen text are normalised with `wordsToDigits` before `nums`.

- [ ] **Step 1: Write the failing tests** (append inside `describe('script validation')` and `describe('storyboard')`)

```ts
it('a figure written in words is checked like a digit', () => {
  const v = run(script([sentence('s01', 'In the survey sixty-two percent lost money.', 'factual', [fact('s01.a', 'sixty-two percent lost money.')])]));
  expect(cats(v)).toContain('invented-number');
  const ok = run(script([sentence('s01', 'In the survey forty-seven percent lost money.', 'factual', [fact('s01.a', 'forty-seven percent of participants reported losing money.')])]));
  expect(cats(ok)).toEqual([]);
});
it('an attributed figure must be in the recorded quote, words or digits', () => {
  const quoteWords = (text: string) => script([sentence('s01', text, 'attributed', [{ id: 's01.a', text, kind: 'attribution', claims: [{ id: MLM, stance: 'asserts' }], evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }] }])]);
  // corpus.ts sources carry quote `quote s1a`; extend source() in tests/corpus.ts with an optional quote argument for this test
  expect(cats(run(quoteWords('One source says ten people joined.')))).toContain('figure-not-in-quote');
});
// storyboard
it('chart values written in words are checked against the passage', () => {
  const s = good(); const v = run(s, approveAll(s));
  const chart = (value: string) => plan([scene('sc1', ['s01', 's02', 's03'], { visual: { category: 'data-chart', description: 'bars', chart: { type: 'bar', series: [{ label: 'lost', value, cite: DOC_D }] } } })]);
  expect(buildStoryboard(chart('forty-seven percent'), s, v, p(), read).status).toBe('ok');
  expect(buildStoryboard(chart('sixty-two percent'), s, v, p(), read).issues.map((i) => i.category)).toContain('chart-data');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/script.test.ts`
Expected: the word-figure cases FAIL (no issue raised).

- [ ] **Step 3: Implement**

Replace the local helpers in both modules with imports from `./numbers`; apply `wordsToDigits` to sentence text, assertion text, quote strings, chart `value` and `onScreenText` lines before `nums`, and use `hasFigure` for every containment test. Keep the `CONSTANTS` whitelist for calculations.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script.ts src/lib/storyboard.ts tests/script.test.ts tests/corpus.ts
git commit -m "fix(script): normalise number words in figure, quote and chart checks"
```

---

### Task 4: Persist quote context in the evidence package

**Files:**
- Modify: `src/lib/script.ts:77-85` (`PackageStatement`), `:124-131` (`buildPackage` signature), statement mapping near `:215-225`
- Modify: `scripts/script.ts` `stagePackage()` (pass a transcript reader and the previous package)
- Test: `tests/script.test.ts` (`describe('evidence package')`)

**Interfaces:**
- Produces: `PackageStatement.context: string | null` (a window of at most 300 characters before and after the recorded quote in the source transcript, whitespace-collapsed; `null` when no transcript and no previous context), `export type TranscriptReader = (sourceId: string) => string | null`, `export function transcriptReader(topic: string, root = process.cwd()): TranscriptReader` reading `<root>/<topic>/store/transcripts/<id>.txt`, and `buildPackage(story, t, read, review = {}, inputs = {}, root = process.cwd(), readTranscript: TranscriptReader = () => null, previous: EvidencePackage | null = null)`.
- Rule: locate the quote with `norm()` on both sides; if not found, context is the first 300 characters of the transcript prefixed by `"(quote not located) "`; if the transcript is missing, reuse `previous.claims[].statements[]` context for the same `source` and `quote`.

- [ ] **Step 1: Write the failing tests**

```ts
it('persists a transcript window around each recorded quote, and keeps it when the transcript is gone', () => {
  const transcript = (id: string) => (id === 's1a' ? 'intro words here. to hear another former distributor tell it, quote s1a and so on. more words.' : null);
  const a = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), transcript);
  const st = a.claims[0].statements.find((s) => s.source === 's1a')!;
  expect(st.context).toMatch(/former distributor tell it, quote s1a/);
  const b = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), () => null, a);
  expect(b.claims[0].statements.find((s) => s.source === 's1a')!.context).toBe(st.context);
  expect(b.fingerprint).toBe(a.fingerprint);
  const c = buildPackage(story(), asTopic(t()), read, review, {}, process.cwd(), () => null, null);
  expect(c.claims[0].statements.find((s) => s.source === 's1a')!.context).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/script.test.ts -t "transcript window"`
Expected: FAIL (`context` undefined).

- [ ] **Step 3: Implement** in `src/lib/script.ts` and wire `scripts/script.ts` `stagePackage()` to pass `transcriptReader(topic)` and `readJson<EvidencePackage>(p(FILES.pkg))` as `previous`.

- [ ] **Step 4: Run tests and rebuild the MLM package**

Run: `npx vitest run && npm run script -- package get-rich-quick decision:mlm-and-seminars`
Expected: tests PASS; the package is rewritten with a new fingerprint and every statement has a non-null `context` (verify with `node -e` over the file: count of `context === null` is 0; transcripts exist locally for all 10 sources).

- [ ] **Step 5: Commit**

```bash
git add src/lib/script.ts scripts/script.ts tests/script.test.ts get-rich-quick/scripts/decision-mlm-and-seminars/evidence-package.json
git commit -m "feat(package): persist a transcript window around every recorded source quote"
```

---

### Task 5: Traceable speaker attribution

**Files:**
- Modify: `src/lib/script.ts:284-288` (`Quote`), `validateScript` signature `:441-449`, quotation checks `:624-646`
- Modify: `scripts/script.ts` `stageValidate()` (pass the package object)
- Modify: `scripts/briefs/script.md` (quote rules), `scripts/briefs/script-review.md` (speaker check)
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `Quote.speaker?: string` (who the narration says spoke the quoted words); `validateScript(script, t, read, review = null, judgments = {}, previous = null, pkg: EvidencePackage | null = null)` replacing the `packageFingerprint: string | null` parameter (derive the fingerprint from `pkg?.fingerprint`).
- Rules, for an assertion whose `quote.source` is set: if `quote.speaker` is set, `norm(speaker)` must occur in `norm(context ?? '') + ' ' + norm(title) + ' ' + norm(channel)` of that statement in `pkg`, else blocking `speaker-unverified`; if `pkg` is null or the statement has no context and the speaker is not in title or channel, blocking `speaker-unverified` with explanation "no transcript context in the evidence package"; if `quote.speaker` is absent, warning `speaker-missing` ("the reviewer confirms the narration does not name who spoke").

- [ ] **Step 1: Write the failing tests**

```ts
describe('speaker attribution', () => {
  const pkgWith = (context: string | null) => { const q = pkg(); q.claims[0].statements[0].context = context; return q; };
  const attributed = (speaker?: string) => script([sentence('s01', 'A former distributor said "quote s1a".', 'attributed', [{ id: 's01.a', text: 'A former distributor said "quote s1a".', kind: 'attribution', claims: [{ id: MLM, stance: 'asserts' }], evidence: [{ kind: 'statement', claim: MLM, source: 's1a' }], quote: { text: 'quote s1a', source: 's1a', ...(speaker ? { speaker } : {}) } }])]);
  const v = (s: Script, q: EvidencePackage | null) => validateScript(s, corpus(), read, null, {}, null, q);
  it('a named speaker must appear in the quote context or the source title', () => {
    expect(cats(v(attributed('former distributor'), pkgWith('to hear another former distributor tell it: quote s1a'))).toEqual([]);
    expect(cats(v(attributed('John Oliver'), pkgWith('to hear another former distributor tell it: quote s1a')))).toContain('speaker-unverified');
    expect(cats(v(attributed('Video s1a'), pkgWith(null)))).toEqual([]); // the source title
    expect(cats(v(attributed('former distributor'), pkgWith(null)))).toContain('speaker-unverified');
  });
  it('warns when a source quotation names no speaker', () => {
    expect(v(attributed(), pkgWith('x quote s1a y')).issues.map((i) => i.category)).toContain('speaker-missing');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/script.test.ts -t "speaker"`
Expected: FAIL (type error on `speaker` or no issue raised).

- [ ] **Step 3: Implement** the rule in the quotation block; update `scripts/script.ts` to pass `pkg` instead of `pkg?.fingerprint`; in `scripts/briefs/script.md` add under quotations: "`speaker`: required whenever the narration says who spoke (a name, a role, a show); it must appear in the package's `statements[].context` for that source, or in the source title or channel"; in `scripts/briefs/script-review.md` step 2 add: "for an attributed sentence, confirm the speaker from the package's `context`, never from a file outside the repository".

- [ ] **Step 4: Run everything**

Run: `npm run validate`
Expected: all five steps pass. Then run `npm run script -- validate get-rich-quick decision:mlm-and-seminars` and record its status line in the commit body; blocking issues on the MLM script are expected and are Plan 4's input.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script.ts scripts/script.ts scripts/briefs/script.md scripts/briefs/script-review.md tests/script.test.ts
git commit -m "feat(script): speaker attribution must trace to the recorded quote context"
```

---

### Task 6: Adversarial regression suite for the exit criterion

**Files:**
- Test: `tests/adversarial.test.ts`

**Interfaces:**
- Consumes: everything above. One file that a reviewer can read as the exit criterion of the spec: each `it` is one deliberate error and the assertion that it is blocked.

- [ ] **Step 1: Write the tests** (all must pass immediately if Tasks 1-5 are complete; any that fails is a defect to fix in the owning module)

Cases, each as its own `it`, using the helpers from `tests/script.test.ts` (move `fact`, `sentence`, `script`, `approveAll`, `run`, `cats` into `tests/script-helpers.ts` and import from both files):
1. invented digit statistic → `invented-number`
2. invented statistic in words ("sixty-two percent") → `invented-number`
3. figure present only in a verdict note → `invented-number`
4. figure that rounds the passage ("about 25 percent" vs 26) → `invented-number`
5. figure in the sentence that no assertion owns → `figure-without-assertion`
6. fabricated quotation → `misquote`
7. quotation present but attributed to a speaker not in context or title → `speaker-unverified`
8. attribution figure not in the recorded quote → `figure-not-in-quote`
9. calculation with an input not in the passage → `bad-arithmetic`
10. chart value not in the cited passage (digits and words) → storyboard `chart-data`
11. on-screen figure not in narration or a cited passage → `on-screen-figure`
12. blanket reviewer approval over a blocked assertion → status `blocked`

- [ ] **Step 2: Run**

Run: `npx vitest run tests/adversarial.test.ts`
Expected: 12 PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/adversarial.test.ts tests/script-helpers.ts tests/script.test.ts
git commit -m "test: adversarial regression suite for the script gate"
```

## Exit check (run by the orchestrator)

```
npm run validate                      # green
npx vitest run tests/adversarial.test.ts   # 12 passed
npm run script -- validate get-rich-quick decision:mlm-and-seminars   # may be blocked; record the issue list for Plan 4
```
