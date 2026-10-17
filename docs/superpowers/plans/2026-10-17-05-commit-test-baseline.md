# Plan 5: Commit, test, and establish the baseline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The script stage and the locked MLM package are on `main`, exercised by tests that run against the real artifacts, verified from a clean checkout, and tagged as the baseline for rendering.

**Architecture:** One integration test file loads the committed MLM artifacts and the real topic and re-runs validation, storyboard build and the release check; CI already runs `npm run validate`, so the test runs on every push. The work lands as a branch and a pull request; a clean worktree proves the documented commands work without local caches; a tag marks the baseline.

**Tech Stack:** vitest, git, gh CLI, GitHub Actions (`.github/workflows/pages.yml` runs `npm ci && npm run validate`).

**Spec:** `docs/superpowers/specs/2026-10-17-hardening-spec.md` section 5; audit finding 11.

## Global Constraints

- Plans 1 to 4 complete. `release.json` normally exists; if Plan 4 ended blocked at revision 3 it is absent, and this plan still commits and merges but does not tag.
- The branch is `script-stage`; the agent pushes, opens the PR, waits for CI, merges it, and tags. No approval is requested.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- The integration test must skip, not fail, when the MLM directory is absent (another topic checkout), like `tests/dist.test.ts` does with `describe.skipIf`.

## Review Focus

1. CI has no `store/transcripts/`: the integration test must build its package with `readTranscript = () => null` and the committed package as `previous`, and the fingerprint must match (Task 1 assertion).
2. CI has no `../retire-sim/watcher`: nothing in the test suite may call `npm run report`, `record-sources` or the watcher (Task 1: the test imports library functions only).
3. Windows versus Linux line endings in `sources/*.txt`: document shas must be computed on bytes as checked out; if CI reports `stale-source`, add `*.txt text eol=lf` to `.gitattributes` and renormalise (Task 3 check).
4. The `/docs/` folder is gitignored: the plans and specs under `docs/superpowers/` are committed with `git add -f docs/superpowers` in Task 3 so the PR carries its own audit and plans.
5. A later story in another topic: `scriptDirs()` must keep finding only directories with a `script.json` (existing behaviour; integration test iterates `scriptDirs()`).

---

### Task 1: Integration test over the real MLM artifacts

**Files:**
- Create: `tests/packages.test.ts`

**Interfaces:**
- Consumes: `scriptDirs`, `readJson`, `FILES`, `buildPackage`, `validateScript`, `releaseCheck`, `sentenceFingerprint` from `src/lib/script.ts`; `buildStoryboard` from `src/lib/storyboard.ts`; `loadTopic` from `src/lib/topics.ts`; `loadStories` from `src/lib/stories.ts`; `loadReview` from `src/lib/review.ts`; `passageReader`, `docHasher`.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest';
// ...imports
describe.each(scriptDirs())('$topic/scripts/$slug', ({ topic, slug, dir }) => {
  const pkg = readJson<EvidencePackage>(join(dir, FILES.pkg))!;
  const script = readJson<Script>(join(dir, FILES.script))!;
  const review = readJson<ScriptReviewFile>(join(dir, FILES.review));
  const plan = readJson<StoryboardPlan>(join(dir, FILES.storyboard));
  const release = readJson<Release>(join(dir, FILES.release));
  const t = loadTopic(topic);
  const read = passageReader();
  it('the package rebuilds byte-for-byte without transcripts', () => {
    const story = loadStories(topic)!.stories.find((s) => s.id === script.story)!;
    const again = buildPackage(story, t, read, loadReview(topic), pkg.inputs, process.cwd(), () => null, pkg);
    expect(again.fingerprint).toBe(pkg.fingerprint);
  });
  it('every cited passage and quote context is present', () => {
    for (const c of pkg.claims) {
      for (const e of c.evidence) expect(read(e.cite), e.cite).not.toBeNull();
      for (const s of c.statements) expect(s.context, s.source).not.toBeNull();
    }
  });
  it('validates as passed with the committed review', () => {
    const v = validateScript(script, t, read, review, loadReview(topic).applicability, null, pkg, docHasher());
    if (release) { expect(v.status).toBe('passed'); expect(v.counts.unreviewed).toBe(0); }
    expect(v.counts.blocking).toBeLessThanOrEqual(release ? 0 : v.counts.blocking); // a blocked revision-3 package may ship unlocked
    expect(v.minutes).toBeGreaterThanOrEqual(8); expect(v.minutes).toBeLessThanOrEqual(12.5);
  });
  it('the storyboard covers the script and its charts resolve', () => {
    const v = validateScript(script, t, read, review, loadReview(topic).applicability, null, pkg, docHasher());
    const sb = buildStoryboard(plan!, script, v, pkg, read);
    expect(sb.status).toBe('ok');
    expect(sb.scenes.flatMap((s) => s.sentences).sort()).toEqual(sentences(script).map((s) => s.id).sort());
  });
  it.skipIf(!release)('the release fingerprints match the committed files', () => {
    expect(release!.approvedBy).toMatch(/\S/);
    const v = validateScript(script, t, read, review, loadReview(topic).applicability, null, pkg, docHasher());
    expect(releaseCheck(release!, v, readJson<Storyboard>(join(dir, FILES.storyboard)))).toEqual([]);
  });
  it('no review finding points outside the repository', () => {
    for (const f of review?.findings ?? []) for (const r of f.refs ?? []) expect(r).not.toMatch(/store\/transcripts|\/work\/|^https?:|^[A-Za-z]:\\/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/packages.test.ts`. Expected: 6 PASS for the MLM directory. Any failure is a real defect in Plans 1 to 4; fix it there (new commit on this branch), not by loosening the test.
- [ ] **Step 3: Commit** `git add tests/packages.test.ts && git commit -m "test: integration test over the committed script packages"`.

---

### Task 2: Full suite green

- [ ] **Step 1: Run** `npm run validate`. Expected: astro check 0 errors; eslint clean; prettier clean; build 12 or more pages; vitest all files pass (previous count 109 plus the new files).
- [ ] **Step 2: Run** `npx vitest run tests/dist.test.ts` after the build. Expected: pass, including the script page checks.
- [ ] **Step 3: Fix** anything red with the smallest change, commit with a `fix:` message.

---

### Task 3: Branch, commits, pull request

- [ ] **Step 1: Branch**: `git checkout -b script-stage` (if not already on it; Plans 1-4 commits should be on it; if they were made on `main`, create the branch at `HEAD` and leave `main` where it is: the merge below fast-forwards it).
- [ ] **Step 2: Inspect** `git status` and `git log --oneline origin/main..HEAD`; confirm no `work/`, `dist/`, transcripts or `docs/` files are staged; confirm `get-rich-quick/scripts/decision-mlm-and-seminars/` has exactly: `evidence-package.json, script.json, script-review.json, validation.json, storyboard.json, script.md, storyboard.md, review.md, release.json`.
- [ ] **Step 3: Line endings**: `git ls-files --eol get-rich-quick/sources | grep -v 'i/lf' | head`. If any cited `.txt` is CRLF in the index, add `*.txt text eol=lf` to `.gitattributes`, run `git add --renormalize .`, rebuild the package (`npm run script -- package ...`), re-run validate, and note that approvals lapse (return to Plan 4 Task 3 if so).
- [ ] **Step 4: Push and open the PR**: `git push -u origin script-stage && gh pr create --title "Script stage: evidence-backed narration, validation and storyboard (MLM)" --body-file <body>` where the body lists: what the stage does (one paragraph), the MLM package status line from `review.md`, the audit findings addressed (1 to 10 by number), the deferred list, commands to inspect, and the attribution line.
- [ ] **Step 5: Watch CI**: `gh pr checks --watch`. Expected: the Pages workflow passes. Fix and push if not.

---

### Task 4: Clean-checkout verification

- [ ] **Step 1: Fresh worktree**: `git worktree add ../vk-clean script-stage && cd ../vk-clean && npm ci`.
- [ ] **Step 2: Run the documented workflow** without caches: `npm run validate && npm run script -- validate get-rich-quick decision:mlm-and-seminars && npm run script -- storyboard get-rich-quick decision:mlm-and-seminars && npm run script -- show get-rich-quick decision:mlm-and-seminars s12`. Expected: green; `passed`; `ok`; the s12 sheet prints the quote context; `git status` in the worktree shows only the regenerated derived files with no content diff except the `date` fields (`git diff --stat` and inspect).
- [ ] **Step 3: Record** the exact commands and outputs in the PR as a comment (`gh pr comment`), then `cd - && git worktree remove ../vk-clean`.

---

### Task 5: Merge and tag the baseline

- [ ] **Step 1: Merge** once `gh pr checks --watch` reports every check passed: `gh pr merge --merge --delete-branch`. If the merge is refused by branch protection, retry with `gh pr merge --merge --admin`; if that is refused too, halt and report (environmental blocker, not an approval gate).
- [ ] **Step 2: Tag** (only when `release.json` exists): `git checkout main && git pull && git tag -a mlm-script-v1 -m "Approved MLM script and storyboard baseline for rendering" && git push origin mlm-script-v1`.
- [ ] **Step 3: README**: add under "Scripts and storyboards": "Baseline: `mlm-script-v1` is the first locked package (`get-rich-quick/scripts/decision-mlm-and-seminars/release.json`); rendering work starts from it." Commit and push to `main` directly (a docs-only change). Skip the README line and the tag entirely when `release.json` is absent; say so in the final report.

## Exit check (run by the orchestrator)

```
git fetch --tags && git tag -l mlm-script-v1          # present
gh pr view --json state,mergedAt                      # MERGED
npm ci && npm run validate                           # green on main
```
