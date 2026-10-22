# Run report: ai-coding decision:quality-and-understanding

- Review mp4: `video/review/decision-quality-and-understanding-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 9 h end to end, mostly queued behind other renders and a PC sleep; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

- New document `2601.20245v2.txt#L468-L484` (Shen and Tamkin, How AI Impacts Skill Formation; partly, 0.45) on `developers-should-able-explain-generated-code`: 52 developers recruited online, mostly freelance or professional; the AI group scored 17% lower on a quiz about the library they had just used, with no significant time saving.
- New document `2310.02059.txt#L930-L936` (Fu et al., TOSEM 2025; partly, 0.55) on `generated-code-frequently-contains-security-vulnerabilities`: 27.3% of 733 Copilot-generated snippets in public GitHub projects had tool-flagged security weaknesses; no human comparison.
- Not recordable (each document already cited for its claim): the Echoes trial's scope (75 mostly professional developers, one small Java app), the code-ownership study's mostly-student participants, the 302k-commit study's rates.

## Script revisions

- r1: needsEvidence for the three gaps; after the evidence pass the same revision cited the two new papers. Review: no blocking; warnings s16 ("many" issues survive), s22 (participants unnamed), s23 ("several" re-checks), s24 (no scope beside "no"), s26 (seemed to contradict s24).
- r2: s16 "some"; s23 "other ways"; s24 "over the time it ran"; s26 "those same people". Review held s22 (read as the crowd workers of s32-s33).
- r3: s22 "In a separate experiment with different participants". Review passed, 33 of 33.

## Notes for the editor

- s22's experiment had 69 mostly-student participants, which the narration cannot say (needs `--replace-cited` on that document); the takeaway (s28) still applies it to reviewing a colleague's code.
- The two new sources show their file names, not a short display name, in citations (no docName); worth adding.

## Graphics

None bespoke: 28 generic scenes (15 typography, 8 excerpts, 5 stat tiles).

## Music

Undertow (cleared): sc01-sc02, sc03-sc04, sc05-sc23, sc24-sc28. Music -19.8 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.
