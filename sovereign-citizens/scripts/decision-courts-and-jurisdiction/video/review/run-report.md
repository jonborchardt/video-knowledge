# /produce run: sovereign-citizens / decision:courts-and-jurisdiction

"The Courtroom Escape Hatches Sovereign Citizens Swear By". Started by jon, 2026-10-20 00:02, packaged 02:34 (about 2 h 32 min wall-clock, of which about 45 min was the extra pulse render).

## Output

- Review mp4 (classic brand, the one QA checked): `video/review/decision-courts-and-jurisdiction-review-private.mp4`, 744.1 s, 48 scenes, 7 chapters
- Checklist: `video/review/checklist.md`
- Pulse brand cut, as asked ("use the new theme"): `video/segment.pulse.mp4`, same timeline, narration and mix. The board, QA and the review package use the classic file by contract (CLAUDE.md, Video), so the pulse file is not QA'd or packaged. Its render passed the per-frame fit check on all 48 scenes.

## Evidence added

None. The evidence package (13 documents, 6 claims, 0 gaps) carried the script. Gaps the writer and reviewer worked around instead of adding passages:

- The case counts (1,089 Canadian decisions, 51 refused leave applications, 200+ Australasian cases) are only in verdict notes, not in the cited passages, so the script describes those results without the numbers.
- The near-exceptions (Credit River 1968, the Porisky and Naudi acquittals) are not cited; s56 is narrowed to "nothing in that record shows a jurisdiction trick that held up, though it cannot count unreported hearings or every American courtroom."
- The concrete cost in Benabe (defendants removed from their own trial, L56-L59) is not cited, so s59 names no specific cost.

## Script revisions

- Revision 1: 66 sentences. The review blocked two sentences:
  - s01 dated the courtroom "late in 2023"; the trial was January 2024 and 2023 was the stop.
  - s13 called a Mountain Democrat letter to the editor a column.
  - It also raised warnings on s07 (the 1871 act was never "tried"), s35 (one law firm presented as "lawyers agree"), s56 (near-exceptions missing) and s09 (Menard credits his quote to Canada's chief justice).
- Revision 2: fixed s01, s13, s07 and s35, and narrowed s56. The re-review blocked s56 because "the gap is only..." contradicted s54.
- Revision 3: s56 names both gaps; s09 frames the quote as Menard's claim and says it is not a ruling; s28 says "three consent arguments" up front. Passed: 63 of 63 assertions verified, 0 warnings, 1,790 words.

## Storyboard

48 scenes, about 737 s planned:

| Category | Scenes |
|---|---|
| Typography | 29 |
| Diagram | 8 |
| Document excerpt | 6 |
| Animation | 2 |
| Transition | 2 |
| Data chart | 1 |

## Graphics built

All components are new, in `src/video/remotion/scenes/`, with their kinds in `src/video/bespoke/decision-courts-and-jurisdiction.ts`.

| Scene | Kind | Component |
|---|---|---|
| sc01 | sc-courtroom | Courtroom |
| sc07 | sc-toolkit-down | Toolkit |
| sc11 | sc-toolkit-flip | Toolkit |
| sc47 | sc-toolkit-strike | Toolkit |
| sc15 | sc-protest-strip | ProtestStrip |
| sc22 | sc-flag-stamps | FlagStamps |
| sc26 | sc-district-tiers | DistrictTiers |
| sc32 | sc-trick-vs-document | TrickVsDocument |
| sc38 | sc-courts-evidence | CourtsEvidence |
| sc44 | sc-ticket-signature | TicketSignature |

The visual review approved all ten on the first pass, then again after the fixes below changed every key. No scene fell back to labelled text. Parts of the descriptions that are not drawn, because the words are not in the scene's `onScreenText`:

- sc11 and sc47: the heading "A court needs your consent".
- sc15: the step captions and the "not mentioned" tag text, which show as icons and empty tags.

## Render fixes (QA-failed: 2 of 3 allowed)

1. `Citation.tsx`: a 168-character citation detail line (sc09) ran off the frame. Long label and detail lines now shrink, then ellipsize, to fit one line inside the gutters.
2. QA failed on two checks, fixed as follows:
   - **Duration (audio 0.1 s long):** loudnorm left a timestamp gap at the end of the narration track. `src/video/ffmpeg.ts` now restamps the audio after loudnorm (`asetpts=N/SR/TB`).
   - **Blank section in sc07:** `Toolkit.tsx` now shows dashed card slots from the first frame.
   - **Blank section in sc28:** `Transition.tsx` falls back to `onScreenText` for its labels, and without a `wipe` cue the wipe finishes on the last frame.

## Music

Composition `undertow`, four cues, ducked under the voice: music -19.5 dB while the voice speaks, peak -1.3 dB.

| Cue | Asset | Scenes | Gain |
|---|---|---|---|
| opening | undertow/pulse | sc01-sc05 | -11 dB |
| setup | undertow/active | sc06-sc12 | -13 dB |
| evidence | undertow/texture | sc13-sc40 | -13 dB |
| ending | undertow/pulse | sc41-sc48 | -11 dB |

## QA

`passed: 36 of 36 checks` / `RESULT: PASSED`

## Release blockers

- Narration is draft only: edge-tts, the unofficial Microsoft Edge read-aloud API, with no terms for published media.
- Music clearance for `undertow` is not recorded as cleared by this run.
