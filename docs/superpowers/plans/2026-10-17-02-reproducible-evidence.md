# Plan 2: Make evidence and approvals reproducible

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clean checkout can re-run and inspect the MLM validation; changing a cited source document or the evidence package invalidates approvals; two documents describing one study count once.

**Architecture:** The evidence package already records a sha per cited document and (after Plan 1) the quote context; this plan makes `validateScript` compare those shas against the working tree, binds the reviewer's file to the package fingerprint, routes document identity through the topic's `sameStudy` map in the evidence gate and story discovery, and forbids reviewer references to gitignored paths.

**Tech Stack:** TypeScript (tsx, vitest); `src/lib/evidence.ts`, `src/lib/stories.ts`, `src/lib/script.ts`, `src/lib/storyboard.ts`, `scripts/script.ts`.

**Spec:** `docs/superpowers/specs/2026-10-17-hardening-spec.md` section 2; audit findings 3, 4, 7, 8 and section 4.7.

## Global Constraints

- Plan 1 is merged first: `validateScript` takes `pkg: EvidencePackage | null` and `buildPackage` takes `readTranscript` and `previous`.
- `stories.json` is derived: regenerate with `npm run stories -- discover <topic>` for every topic with a `stories.json` (`get-rich-quick`, `ai-coding`) after changing `src/lib/stories.ts`, and commit.
- Never hand-edit the store. Do not run `npm run record-sources` or `npm run report` in this plan.
- `npm run validate` green at the end of every task.

## Review Focus

1. A cited document whose text changed but whose line range still exists: must block, not warn (Task 2 test `a changed source document blocks`).
2. A package regenerated from a clean checkout without transcripts: fingerprint must be unchanged (Plan 1 Task 4 covers reuse; Task 5 here verifies end to end with the real MLM package).
3. A reviewer file whose `packageFingerprint` is missing (older format): treat as stale, every sentence `needs-review`, with one info issue explaining why (Task 3 test).
4. `sameStudy` chains (A → B → C) or a self-mapping: `docKey` must terminate (Task 1 test `docKey follows one hop and ignores cycles`).
5. A finding `refs` entry that is a URL or an absolute path outside the repo: warning `unreproducible-ref` (Task 4 test).

---

### Task 1: `sameStudy` deduplication in the evidence gate and story discovery

**Files:**
- Modify: `src/lib/evidence.ts:19` (`Corpus`), `:120` (`docOf`), `:140-147` (`studyVerdicts`, one per document), `:258` (`independent`), `:294` (disagreement `docs`), `:241-247` (`citedDocs`)
- Modify: `src/lib/stories.ts:29` (`StoryInput`), `:374` (corpus object), `:99` (`docOf`), `:405` and `:444` (document counts)
- Modify: `tests/corpus.ts` (`topic()` accepts `sameStudy`)
- Test: `tests/evidence.test.ts`, `tests/stories.test.ts`

**Interfaces:**
- Produces: `export type Corpus = Pick<Topic, 'name' | 'claims'> & { sameStudy?: Record<string, string> }` and `export function docKey(cite: string, sameStudy: Record<string, string> = {}): string` returning the cited file, mapped one hop through `sameStudy` by file basename (`'ftc-mlm-report-blog.txt' -> 'ftc-2024-mlm-income-disclosures.txt'`), so `'<topic>/sources/ftc-mlm-report-blog.txt#L35'` and `'<topic>/sources/ftc-2024-mlm-income-disclosures.txt#L1481-L1498'` share a key. `StoryInput` gains `sameStudy?: Record<string, string>`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/evidence.test.ts
it('two documents marked sameStudy count as one independent source', () => {
  const same = { 'survey-b.txt': 'rct-a.txt' };
  const c = claim('faster', FASTER, { verdicts: [study('RCT A', 'right', 0.7, DOC_A), study('Summary B', 'right', 0.5, DOC_B)] });
  const v = validate(fact(FASTER, [studyRef(DOC_A), studyRef(DOC_B)]), { ...corpus(c), sameStudy: same }, reader);
  expect(v.supporting).toHaveLength(2);
  expect(v.independent).toBe(1);
  expect(validate(fact(FASTER, [studyRef(DOC_A), studyRef(DOC_B)]), corpus(c), reader).independent).toBe(2);
});
it('docKey follows one hop and ignores cycles', () => {
  expect(docKey('demo/sources/b.txt#L1', { 'b.txt': 'a.txt', 'a.txt': 'b.txt' })).toBe('demo/sources/a.txt');
  expect(docKey('demo/sources/a.txt#L1', { 'a.txt': 'a.txt' })).toBe('demo/sources/a.txt');
});
// tests/stories.test.ts: in the first test, pass sameStudy and assert the decision story's audit.central.independent
// and scores.explanation's "independent document" count exclude the summary.
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/evidence.test.ts -t "sameStudy|docKey"`
Expected: FAIL (`independent` is 2; `docKey` not exported).

- [ ] **Step 3: Implement**: add `docKey`, use it everywhere `docOf` grouped by document in `evidence.ts` and `stories.ts` (the `studyVerdicts` one-per-document rule must also use it so a summary never supersedes the primary report's verdict; keep the newest-first order), pass `sameStudy: t.sameStudy` in `stories.ts:374` and from `loadTopic` through `StoryInput`.

- [ ] **Step 4: Run tests, regenerate stories**

Run: `npx vitest run && npm run stories -- discover get-rich-quick && npm run stories -- discover ai-coding && npx vitest run tests/stories.test.ts`
Expected: PASS; `get-rich-quick/stories.json` MLM story shows `audit.central.independent: 3`. Update the snapshot only if the ranked id list changed and the change is explained by the dedupe (`npx vitest run -u` then inspect the diff).

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidence.ts src/lib/stories.ts tests/corpus.ts tests/evidence.test.ts tests/stories.test.ts get-rich-quick/stories.json ai-coding/stories.json tests/__snapshots__
git commit -m "fix(evidence): count documents of the same study once"
```

---

### Task 2: Source-document fingerprints checked at validation and storyboard time

**Files:**
- Modify: `src/lib/script.ts` `validateScript` (new parameter, new check near the `stale-package` warning at `:475-483`), `buildStoryboard` in `src/lib/storyboard.ts` (check near `:102-107`)
- Modify: `scripts/script.ts` `stageValidate()`, `stageStoryboard()`
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `export type DocHasher = (file: string) => string | null` and `export function docHasher(root = process.cwd()): DocHasher` (sha of the file as `sha()` does in `buildPackage`, `null` when missing); `validateScript(..., pkg = null, hashDoc: DocHasher = docHasher())`. Rule: for every document in `pkg.documents` that any assertion cites, if `hashDoc(file) !== doc.sha` emit blocking `stale-source` on sentence `'-'` naming the file ("regenerate the package and re-review"); if `hashDoc` returns null, blocking `missing-source`. `buildStoryboard(plan, script, v, pkg, read)` emits blocking `stale-validation` when `v.packageFingerprint !== pkg.fingerprint`.

- [ ] **Step 1: Write the failing tests**

```ts
it('a changed source document blocks', () => {
  const s = good(); const q = pkg();
  const ok = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => q.documents[0].sha);
  expect(ok.status).toBe('passed');
  const changed = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => 'deadbeef00');
  expect(changed.status).toBe('blocked');
  expect(changed.issues.map((i) => i.category)).toContain('stale-source');
  const missing = validateScript(s, corpus(), read, approveAll(s), {}, null, q, () => null);
  expect(missing.issues.map((i) => i.category)).toContain('missing-source');
});
it('a storyboard built against a validation from another package is blocked', () => {
  const s = good(); const v = { ...run(s, approveAll(s)), packageFingerprint: 'old' };
  expect(buildStoryboard(plan([scene('sc1', ['s01', 's02', 's03'])]), s, v, pkg(), read).issues.map((i) => i.category)).toContain('stale-validation');
});
```

(In `pkg()` for tests, `documents[0].sha` is `sha('')` because the fixture file does not exist; pass a hasher that returns it.)

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run** `npx vitest run && npx tsc --noEmit -p tsconfig.json`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script.ts src/lib/storyboard.ts scripts/script.ts tests/script.test.ts
git commit -m "feat(script): block validation when a cited source document changed"
```

---

### Task 3: Bind the review file to the package fingerprint

**Files:**
- Modify: `src/lib/script.ts:340-347` (`ScriptReviewFile`), review merge `:486-500`, sentence approval `:663`
- Modify: `scripts/briefs/script-review.md` (output format)
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `ScriptReviewFile.packageFingerprint: string` (required in the brief; optional in the type for old files). Rule: a review whose `packageFingerprint` differs from `pkg.fingerprint` (or is missing while `pkg` is present) contributes no approvals; its findings still apply by sentence fingerprint; one info issue `stale-review` on `'-'` explains it. Approvals are therefore valid only for the exact script sentence and the exact evidence set.

- [ ] **Step 1: Write the failing test**

```ts
it('approvals lapse when the evidence package changes', () => {
  const s = good(); const q = pkg(); const r = { ...approveAll(s), packageFingerprint: q.fingerprint };
  const h = () => q.documents[0].sha;
  expect(validateScript(s, corpus(), read, r, {}, null, q, h).status).toBe('passed');
  const stale = validateScript(s, corpus(), read, { ...r, packageFingerprint: 'other' }, {}, null, q, h);
  expect(stale.status).toBe('needs-review');
  expect(stale.counts.unreviewed).toBe(3);
  expect(stale.issues.map((i) => i.category)).toContain('stale-review');
  const legacy = validateScript(s, corpus(), read, approveAll(s), {}, null, q, h); // no packageFingerprint
  expect(legacy.status).toBe('needs-review');
});
```

Update `approveAll` in `tests/script-helpers.ts` to accept an optional package and set `packageFingerprint` so existing tests keep passing.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**; in the brief's JSON example add `"packageFingerprint": "<evidence-package.json fingerprint>"` and the sentence "Copy the package fingerprint from `evidence-package.json`; a review of another package counts for nothing."

- [ ] **Step 4: Run** `npx vitest run`. **Step 5: Commit** `git commit -m "feat(review): approvals are bound to the evidence package fingerprint"`.

---

### Task 4: Reviewer references must be reproducible; resolved findings persist

**Files:**
- Modify: `src/lib/script.ts` review merge (`:486-500`) and `resolved` carry-forward (`:490-500`)
- Test: `tests/script.test.ts`

**Interfaces:**
- Rules: (a) any `refs` entry on a finding that starts with `http`, is absolute, or contains `/store/transcripts/` or `/work/` yields warning `unreproducible-ref` on that sentence ("cite the package context or a committed source path"); (b) `validation.resolved` is the union of the previous validation's `resolved` and the findings now resolved, keyed by `sentence|fingerprint|explanation`, so deleting a finding from the review file does not erase its history.

- [ ] **Step 1: Write the failing tests**

```ts
it('flags a finding whose reference is outside the repository', () => {
  const s = good(); const r = approveAll(s, pkg());
  r.findings.push({ sentence: 's02', fingerprint: sentenceFingerprint(sentences(s)[1]), category: 'omission', severity: 'info', explanation: 'x', refs: ['demo/store/transcripts/s1a.txt'] });
  expect(run(s, r).issues.map((i) => i.category)).toContain('unreproducible-ref');
});
it('resolved findings survive their removal from the review file', () => {
  // revision 1 with a finding, revision 2 with the sentence changed and the finding deleted from the file:
  // v2.resolved still contains it with resolvedBy 2; a third run with no change keeps resolvedBy 2.
});
```

Write the second test body with the `s1`/`s2` pattern from `tests/script.test.ts:262-299`.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run** `npx vitest run`.

- [ ] **Step 5: Commit** `git commit -m "feat(review): unreproducible references warn; resolved findings persist"`.

---

### Task 5: Clean-checkout inspection of the MLM evidence

**Files:**
- Modify: `scripts/script.ts` `show` (print `context` for statements; never read transcripts)
- Modify: `README.md` "Scripts and storyboards" (what a clean checkout contains)
- Test: manual verification recorded in the commit body

**Interfaces:**
- `show` prints, for each `statement` evidence item, the package's `context` window after the recorded quote.

- [ ] **Step 1: Rebuild the MLM package and validation with the new code**

Run: `npm run script -- package get-rich-quick decision:mlm-and-seminars && npm run script -- validate get-rich-quick decision:mlm-and-seminars`
Expected: the package fingerprint changes (documents now keyed through `sameStudy`; contexts present); validation reports `needs-review` or `blocked` (approvals lapsed because `packageFingerprint` is absent from the review file; blocking items from Plan 1 may remain). Do not fix the script here.

- [ ] **Step 2: Simulate a clean checkout**

Run (Git Bash): `mv get-rich-quick/store/transcripts /tmp/vk-transcripts && npm run script -- package get-rich-quick decision:mlm-and-seminars && npm run script -- show get-rich-quick decision:mlm-and-seminars s12 | head -40; mv /tmp/vk-transcripts get-rich-quick/store/transcripts`
Expected: "unchanged (<fingerprint>)" for the package (context reused from the previous package), and `show` prints the s12 statement with its context containing "former Herbalife distributor".

- [ ] **Step 3: Document** in README: the package persists passages and quote contexts, so `sources/*.txt` plus `scripts/<slug>/` is enough to inspect and re-validate; transcripts are only needed to build a package for a new story.

- [ ] **Step 4: Run** `npm run validate`.

- [ ] **Step 5: Commit**

```bash
git add scripts/script.ts README.md get-rich-quick/scripts/decision-mlm-and-seminars/evidence-package.json get-rich-quick/scripts/decision-mlm-and-seminars/validation.json get-rich-quick/scripts/decision-mlm-and-seminars/script.md get-rich-quick/scripts/decision-mlm-and-seminars/review.md
git commit -m "chore(mlm): rebuild package with contexts and sameStudy; show prints quote context"
```

## Exit check (run by the orchestrator)

```
npm run validate
# change a cited document and confirm the block, then restore it:
printf '\n' >> get-rich-quick/sources/ftc-mlm-report-blog.txt && npm run script -- validate get-rich-quick decision:mlm-and-seminars; git checkout -- get-rich-quick/sources/ftc-mlm-report-blog.txt
# expected: "BLOCKING - stale-source ..." in the output and exit code 2
```
