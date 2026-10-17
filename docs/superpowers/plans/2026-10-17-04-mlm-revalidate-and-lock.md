# Plan 4: Revalidate and editorially lock the MLM package

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MLM script passes the hardened validator with every warning explicitly dispositioned by the independent reviewer, the dense passages are readable, the storyboard follows the final narration, and the package is locked with recorded fingerprints once the independent reviewer has passed it.

**Architecture:** Two small mechanisms (reviewer `dispositions` for warnings; a `lock` command that writes `release.json` from the current fingerprints) plus the editorial work itself, done as the repository does it: the writer agent revises `script.json` (revision 3), a different agent re-reviews and writes dispositions, code re-runs validation and the storyboard, and the executing agent runs `lock`, recording that the approval is automated.

**Tech Stack:** TypeScript; `src/lib/script.ts`, `scripts/script.ts`, briefs; the MLM artifacts in `get-rich-quick/scripts/decision-mlm-and-seminars/`.

**Spec:** `docs/superpowers/specs/2026-10-17-hardening-spec.md` section 4; audit section 6 (three weakest sections) and the 21 warnings in `review.md`.

## Global Constraints

- Plans 1 to 3 merged. The writer and the reviewer are different agents (CLAUDE.md); the reviewer writes `script-review.json` and dispositions, the writer never does.
- No new evidence except through `record-sources`; if a figure cannot be cited, the sentence changes. Recording the FTC "79 of more than 600" footnote is allowed in Task 2 if the writer wants it, following `scripts/briefs/sources.md`, followed by `npm run report` and `npm run stories -- discover get-rich-quick`.
- Revision limit is 3 (`MAX_REVISIONS`); this plan produces revision 3. If it still blocks, stop and report; do not bump the limit.
- Approval is automated: `lock` is run by the executing agent, never by the writer of the revision under review before the reviewer has passed it, and `release.json` records `approvedBy` as `automated: independent review passed, <model id>` so a reader knows no person signed off.

## Review Focus

1. A warning dispositioned at one fingerprint and the sentence then edited: the disposition must lapse (Task 1 test).
2. A disposition written by the writer in `script.json` rather than by the reviewer: impossible by construction (dispositions live only in the review file); the brief says so.
3. `lock` run while a sentence is unreviewed or a storyboard issue is blocking: refused with exit 2 (Task 4 test).
4. After `lock`, any later `validate` or `storyboard` run whose fingerprints differ from `release.json`: warning `release-stale` (Task 4 test).
5. Runtime after trims: narration must stay within 8 to 12 minutes by the numeral-aware estimate (Task 2 check).

---

### Task 1: Reviewer dispositions for warnings

**Files:**
- Modify: `src/lib/script.ts:340-347` (`ScriptReviewFile`), issue typing (`Issue.disposition?: string`), merge near `:486-500`, `renderReviewMd` (new "Dispositions" list; dispositioned warnings leave "Open issues" and "Outstanding editorial decisions")
- Modify: `scripts/briefs/script-review.md`
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `ScriptReviewFile.dispositions?: Record<string, { fingerprint: string; reason: string }>` keyed by assertion id (or sentence id for sentence-level warnings). Rule: a deterministic `warning` on that assertion whose sentence fingerprint matches gets `disposition = reason`; counts gain `dispositioned`; `counts.warnings` excludes dispositioned ones; status is unaffected (warnings never block). Blocking issues cannot be dispositioned.

- [ ] **Step 1: Write the failing test**

```ts
it('a reviewer disposition retires a warning until the sentence changes', () => {
  // the rental-leverage sentence from tests/script.test.ts "partial or contextual evidence never establishes ..." (RENTAL claim, cite demo/sources/field-c.txt#L20-L21): move it to tests/script-helpers.ts as `partlySentence`
  const partlySentence = partlySentenceFixture();
  const s1 = script([partlySentence]); const q = pkg();
  const r = { ...approveAll(s1, q), dispositions: { 's01.a': { fingerprint: sentenceFingerprint(sentences(s1)[0]), reason: 'the narration says "in a narrower setting"' } } };
  const v1 = validateScript(s1, corpus(), read, r, {}, null, q, () => q.documents[0].sha);
  expect(v1.counts.warnings).toBe(0);
  expect(v1.issues.find((i) => i.category === 'needs-qualification')?.disposition).toMatch(/narrower/);
  const s2 = script([{ ...partlySentence, text: partlySentence.text + ' Really.' }], 2);
  const v2 = validateScript(s2, corpus(), read, r, {}, null, q, () => q.documents[0].sha);
  expect(v2.counts.warnings).toBe(1);
});
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**; add to the brief: "For each deterministic warning you judge a false positive or already carried by the narration, add a `dispositions` entry with the sentence fingerprint and a one-sentence reason; a warning you judge real becomes a finding instead."

- [ ] **Step 4: Run** `npx vitest run`. **Step 5: Commit** `git commit -m "feat(review): reviewer dispositions retire warnings by fingerprint"`.

---

### Task 2: Revision 3 of the script (writer agent)

**Files:**
- Modify: `get-rich-quick/scripts/decision-mlm-and-seminars/script.json` (revision 3)
- Reads: `validation.json` after Plans 1-3 (the blocking list), `review.md`, `scripts/briefs/script.md`

**Interfaces:**
- The writer is an agent given `scripts/briefs/script.md`, the story id, and this task's list. It bumps `revision` to 3, keeps ids, and writes `generation.notes` naming every change.

- [ ] **Step 1: Fix the deterministic blockers** reported by `npm run script -- validate get-rich-quick decision:mlm-and-seminars`. Expected from the audit: s41.a and any assertion whose figure lived only in a verdict note (add the passage that states it, e.g. `taylor-case-against-mlm.txt#L870-L877` for "30"; or drop the figure); `speaker` on every source quotation that names who spoke (s12 `"former Herbalife distributor"`, s43 `"John Oliver"`, s13 `"FTC consumer advice page"` or the source title); `speaker-missing` warnings on the rest are for the reviewer.
- [ ] **Step 2: Editorial trims** (writer's judgement within these limits): the Findings recap (s45 to s49) to at most three sentences; s08 split or shortened to under 35 words; the survey distribution (s28 to s31, s65) reads at most six figures aloud, the rest stay in charts sc20 to sc22; nothing new is asserted. Keep every qualification sentence (s50 to s54).
- [ ] **Step 3: Validate** until no blocking issue remains: `npm run script -- validate get-rich-quick decision:mlm-and-seminars`. Expected: `needs-review` (approvals lapsed), runtime between 8 and 12 minutes by the spoken-word estimate.
- [ ] **Step 4: Commit** `git add get-rich-quick/scripts/decision-mlm-and-seminars/script.json validation.json script.md review.md && git commit -m "chore(mlm): script revision 3 against the hardened gate"`.

---

### Task 3: Independent re-review with dispositions (reviewer agent)

**Files:**
- Modify: `get-rich-quick/scripts/decision-mlm-and-seminars/script-review.json`

**Interfaces:**
- A different agent (spawned fresh, given `scripts/briefs/script-review.md`) reviews every sentence lacking a current approval, sets `revision: 3` and `packageFingerprint`, and writes a `dispositions` entry or a finding for each of the deterministic warnings. The reviewer uses only `npm run script -- show` output, the package, and `get-rich-quick/sources/*.txt`.

- [ ] **Step 1: Dispatch** a fresh general-purpose subagent (never the session that edited `script.json`) with this prompt, filling the two placeholders from `validation.json` (`unreviewed` = ids of sentences with `status: "needs-review"`; `fingerprint` = `evidence-package.json` `fingerprint`):

  > You are the independent reviewer for a YouTube narration script in the repo `F:\github\video-knowledge` (Windows; use forward slashes in bash; ASCII-only commands). You did not write the script. Read `scripts/briefs/script-review.md` in full and follow it exactly. Topic id `get-rich-quick`, story id `decision:mlm-and-seminars`, artifact directory `get-rich-quick/scripts/decision-mlm-and-seminars/`.
  > Steps: (1) run `npm run script -- show get-rich-quick decision:mlm-and-seminars` from the repo root and read all of it (redirect to a file in your scratch space and read it in parts); it prints every sentence with its id, type, `fp=` fingerprint, assertions, deterministic result, cited passages and, for source quotations, the recorded quote and its transcript `context`. Read `evidence-package.json`. (2) Where a passage needs its surroundings, open the document in `get-rich-quick/sources/` at the cited lines; never read `store/transcripts/` or `work/`, and never cite them in `refs`. (3) Judge every sentence per the brief; these sentences currently lack an approval and must be reviewed: `<unreviewed>`. Sentences already approved at their current fingerprint stay approved unless you find a problem. (4) For each deterministic `needs-qualification` or `speaker-missing` warning, either add a `dispositions` entry (sentence fingerprint plus one-sentence reason) if the narration already carries the limitation or the warning is a false positive, or raise a finding. (5) Update `script-review.json` in place: keep all earlier findings, set `revision` to the script's revision, set `packageFingerprint` to `<fingerprint>`, add approvals with the `fp=` values, append new findings with the current revision. (6) Run `npm run script -- validate get-rich-quick decision:mlm-and-seminars` and confirm the file merged. (7) Final reply: the validator's status line, sentences approved versus total, dispositions written, and new findings by severity with one line each. Do not edit `script.json` or any other file.
- [ ] **Step 2: Validate**: `npm run script -- validate get-rich-quick decision:mlm-and-seminars`. Expected: `passed`, `counts.unreviewed 0`, `counts.warnings` equal to the number of warnings the reviewer turned into findings (which must be zero for `passed` only if none is blocking; a warning-level finding is allowed and stays listed).
- [ ] **Step 3: If blocked**, return to Task 2 only if `revision < 3`; otherwise stop the plan and report the blockers (the orchestrator treats this as a halt).
- [ ] **Step 4: Commit** `git add get-rich-quick/scripts/decision-mlm-and-seminars/script-review.json validation.json script.md review.md && git commit -m "chore(mlm): independent review of revision 3 with warning dispositions"`.

---

### Task 4: `lock` command and `release.json`

**Files:**
- Modify: `scripts/script.ts` (new `lock` command; `release-stale` warning in `validate` and `storyboard`), `src/lib/script.ts` (`FILES.release`, `Release` type, `releaseCheck()`), `README.md`, `CLAUDE.md`
- Test: `tests/script.test.ts`

**Interfaces:**
- Produces: `export interface Release { topic: string; story: string; approvedBy: string; date: string; revision: number; fingerprints: { script: string; package: string; validation: string; storyboard: string } }` where `validation` and `storyboard` are `sha()` of the files; `npm run script -- lock <topic> <story-id> --approved-by "<name>"` writes `release.json` only when `validation.status === 'passed'`, `storyboard.status === 'ok'`, and `storyboard.scriptFingerprint === validation.scriptFingerprint`; otherwise prints the reason and exits 2. `export function releaseCheck(release: Release | null, v: ScriptValidation, sb: Storyboard | null): Issue[]` returns one warning `release-stale` per mismatched fingerprint; `validate` and `storyboard` append its result to their issue lists.

- [ ] **Step 1: Write the failing test**

```ts
it('releaseCheck warns when the locked fingerprints no longer match', () => {
  const s = good(); const q = pkg(); const v = validateScript(s, corpus(), read, approveAll(s, q), {}, null, q, () => q.documents[0].sha);
  const rel = { topic: TOPIC, story: s.story, approvedBy: 'test', date: 'd', revision: 1, fingerprints: { script: v.scriptFingerprint, package: q.fingerprint, validation: 'x', storyboard: 'y' } };
  expect(releaseCheck(rel, v, null).map((i) => i.category)).toEqual([]);
  expect(releaseCheck({ ...rel, fingerprints: { ...rel.fingerprints, script: 'other' } }, v, null)[0].category).toBe('release-stale');
});
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (the CLI refusal paths are exercised manually in Step 4), **Step 4: Manual check**: `npm run script -- lock get-rich-quick decision:mlm-and-seminars --approved-by test` on a tree where the storyboard has not been re-run → exit 2 with the reason. Remove any `release.json` it may have written.

- [ ] **Step 5: Commit** `git commit -m "feat(script): lock command records approved fingerprints in release.json"`.

---

### Task 5: Storyboard follow-up and the lock

**Files:**
- Modify: `get-rich-quick/scripts/decision-mlm-and-seminars/storyboard.json` (only scenes whose sentences changed or were added in revision 3), then derived files via the CLI
- Create: `get-rich-quick/scripts/decision-mlm-and-seminars/release.json` (by the `lock` command)

- [ ] **Step 1: Update scenes** whose `sentences` reference ids that changed or were added (compare `validation.json` sentence list against the plan); set `scriptFingerprint` to the revision 3 value; leave every other scene untouched.
- [ ] **Step 2: Run** `npm run script -- storyboard get-rich-quick decision:mlm-and-seminars`. Expected: `ok`, no `stale-script`, no `stale-validation`, runtime within 8 to 12.5 minutes with pauses.
- [ ] **Step 3: Disposition summary.** Append to `generation.notes` in `script.json` one paragraph: warnings dispositioned versus turned into findings (counts and ids), what was trimmed, what remains uncertain. Re-run `validate` so `script.md` and `review.md` carry it (this edits no sentence, so no approval lapses; confirm `counts.unreviewed` is still 0).
- [ ] **Step 4: Lock.** Run `npm run script -- lock get-rich-quick decision:mlm-and-seminars --approved-by "automated: independent review passed, <model id>"`. Expected: `release.json` written, exit 0. If it refuses (not `passed`, storyboard not `ok`, fingerprints differ), fix the cause (re-run `storyboard`, or return to Task 2 only if `revision < 3`); if the script is blocked at revision 3, skip the lock, leave `release.json` absent, and continue.
- [ ] **Step 5: Commit** `git add get-rich-quick/scripts/decision-mlm-and-seminars && git commit -m "chore(mlm): approved package locked (release.json)"`.

## Exit check (run by the orchestrator)

```
npm run script -- run get-rich-quick decision:mlm-and-seminars     # passed, ok, exit 0, no release-stale
node -e "const r=require('./get-rich-quick/scripts/decision-mlm-and-seminars/release.json'); const v=require('./get-rich-quick/scripts/decision-mlm-and-seminars/validation.json'); console.log(r.approvedBy, r.fingerprints.script===v.scriptFingerprint, v.counts.blocking, v.counts.unreviewed)"
# expected: automated: independent review passed, <model id> true 0 0   (or no release.json when revision 3 is blocked; then Plan 5 ships without the tag)
```
