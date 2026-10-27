# Run report: ai-coding decision:quality-and-understanding

- Review mp4: `video/review/decision-quality-and-understanding-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 47 min (2026-10-26 17:46 to 18:33), of which the render took 26 min. Approver: jonathan m borchardt (`automated: /produce run started by jonathan m borchardt`).
- This is a re-production. The story was packaged on 2026-10-21 and release-built on 2026-10-22. New verdicts on its security claim then made the evidence package stale. Nothing has been published.

## Evidence added

This run recorded no new evidence. The package was rebuilt (09874f191a) after verdicts recorded elsewhere on `generated-code-frequently-contains-security-vulnerabilities`, which moved from partly 0.55 to right 0.6:

- `2606.23130.txt#L457-L464`: an audit of 200 deployed vibe-coded apps (right, 0.6; decides the claim). In 91% of them a manually validated vulnerability was found.
- `2607.09902.txt#L469-L477`: a post-merge fate study (partly, 0.4; qualifies). Agentic code had 1.14x the human per-line rate of Semgrep security findings, and 1.51x for high-severity findings.
- `coderabbit-ai-vs-human-code-report.txt#L32-L33`: a vendor report (partly, 0.25; qualifies). The script does not use it.

## Script revisions

- r4: added s34 (the audit: over 90% of the sampled AI-built apps had at least one vulnerability), s35 (1.14x the human rate) and s36 (the answer: security is where the worry holds up). Rewrote s31 ("Both are counts of weaknesses in AI code alone"). Narrowed s25 to "maintenance warnings". The review approved 34 sentences and held two, on warnings only:
  - s35 was selective: it gave only 1.14x and said "modestly", leaving out the 1.51x high-severity rate.
  - s36 overgeneralised: "riddled with vulnerabilities", all AI-built apps, and "if not by much".
- r5: s35 now also gives 1.51x for the most severe findings. s36 now reads "most of the AI-built apps that audit sampled had at least one vulnerability, and against human code the rate was higher, more so for the most severe findings". The review passed: 33 of 33 assertions verified, 0 warnings.
- The writer noted that r4 marked `revisionLimitReached`. Nothing blocked, so the limit never applied.

## Storyboard

There are now 31 scenes, up from 28, with a 380 s plan:

- New scenes: sc29 (s34, a stat tile reading "Over 90%"), sc30 (s31 and s35, typography) and sc31 (s36, a title card).
- sc17 now holds only s30.
- sc25 has new on-screen text: "Maintenance: ...".
- `video/render.json` lists the new scenes in storyboard order.

## Graphics

None bespoke. Every scene is a generic kind.

## Music

Undertow (cleared), with cues unchanged: sc01-sc02, sc03-sc04, sc05-sc23, sc24-sc28. The new scenes fall inside those spans. The music sits 19.7 dB under the voice while it speaks, with a peak of -1.3 dB.

## Render

All 32 scenes were re-rendered: the narration was re-synthesised and none of the cached chunks were reused. That gave 10870 frames, 362.33 s.

## QA

`RESULT: PASSED`, 36 of 36 checks.

## Release blockers

- Narration is draft only: edge-tts uses the unofficial Microsoft Edge read-aloud API, which has no terms for published media. The earlier Azure release build is replaced by this draft. Once a person accepts the draft, run `npm run video -- final ai-coding decision:quality-and-understanding --approved-by <name>`.
- Music: cleared.
