# Spec: harden the script pipeline and lock the MLM package

Source: Jon's brief of 2026-10-17, written against the audit in `2026-10-17-audit-report.md` (same folder). Reproduced verbatim below, followed by the deferred list.

The principal risks are not missing features. They are evidence verification loopholes and the fact that the storyboard is currently human-readable rather than directly executable by a renderer.

## 1. Close factual validation loopholes (P0, required)

The audit found that ten numerical values across eight assertions could be accepted through AI-generated verdict notes rather than source passages. It also found that spelled-out numbers could bypass checks.

- Require numerical facts to resolve to actual source passages or verified calculations.
- Normalize written numbers such as "fourteen percent" and 14%.
- Reject wrong or missing numerical references, including storyboard chart data.
- Require traceable speaker attribution and preserve quote context.
- Add adversarial regression tests for each case.

Exit criterion: Deliberately invented numbers, unsupported quotations, and unverifiable speaker attributions fail validation.

## 2. Make evidence and approvals reproducible (P1, required)

Some references depend on gitignored transcripts, source-file changes are not fully detected, and two descriptions of the same FTC study can be counted independently.

- Store or otherwise preserve the exact evidence necessary to reproduce validation.
- Check source-document fingerprints when validating.
- Deduplicate evidence counts using sameStudy.
- Bind semantic review results to their script and evidence fingerprints.
- Prevent stale approvals when source content changes.
- Preserve the resolved findings from previous revisions.

Exit criterion: Changing a cited document invalidates affected approval, and a clean checkout contains everything necessary to inspect the MLM evidence.

## 3. Make the storyboard machine-readable (P1, rendering prerequisite)

The existing 43 scenes describe useful visuals, but the current chart specifications and durations are not sufficiently structured to drive reliable video generation.

- Introduce a constrained visual-type schema.
- Store chart data as numeric values with units and source references, not prose strings.
- Give scenes stable narration sentence references.
- Add per-sentence estimated timing and scene boundaries.
- Improve duration estimates for spoken numerical values.
- Explicitly distinguish required assets from descriptive visual guidance.
- Ensure storyboard narration cannot diverge from the validated script.

Exit criterion: A simple renderer can consume a scene and determine its narration, duration, visual type, chart data, and citations without interpreting English descriptions.

## 4. Revalidate and editorially lock the MLM package (P1, required)

Rerun the real script through the hardened validator. Review the 21 current warnings rather than treating a passing status as sufficient.

- Categorize the warnings as meaningful factual issues or explainable false positives.
- Fix materially misleading statements.
- Review the dense numerical sections for comprehensibility.
- Trim repetitive findings and qualifications if needed.
- Regenerate the storyboard only where the narration changes.
- Save the approved script, evidence, storyboard, and fingerprints as one coherent package.

Exit criterion: No unresolved blocking facts, explicit disposition of significant warnings, and human approval of the complete narration and storyboard.

## 5. Commit, test, and establish the baseline (P1, required)

The audit reported 109 passing unit tests, 54 passing distribution tests, and a successful build, but the implementation was still uncommitted.

- Run the full test, lint, type-check, and build suite.
- Test the real MLM artifacts, not just synthetic fixtures.
- Commit the implementation and review package.
- Verify the documented workflow from a clean checkout.
- Preserve the approved output as the baseline for rendering.

Exit criterion: Reproducible green build and a stable, versioned package ready for MP4 production.

## Deferred (do not do)

| Item | Decision |
|---|---|
| Fully automatic Claude orchestration | Defer. Interactive agents work for now. |
| More sophisticated story ranking | Defer. Existing candidate is sufficient. |
| General-purpose visual component architecture | Defer. Implement what the MLM storyboard needs. |
| Deterministic detection of every causal or semantic error | Keep semantic review as the enforcement layer. |
| Fancy Astro editorial UI | Existing Markdown and JSON review is sufficient. |
| Generalized media asset management | Defer until repeated production proves the need. |
| Reducing timestamp churn and other cosmetic cleanup | Address opportunistically, not as a milestone. |
