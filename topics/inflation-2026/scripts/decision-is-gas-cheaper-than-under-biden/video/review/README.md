# PRIVATE REVIEW BUILD: Is Gas Cheaper Now Than Under Biden?

Upload `decision-is-gas-cheaper-than-under-biden-review-private.mp4` to YouTube as a **private** video for review. Do not publish. Public release is blocked: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final inflation-2026 decision:is-gas-cheaper-than-under-biden --approved-by <name>" re-narrates it for release.

- Working title: [PRIVATE REVIEW] Is Gas Cheaper Now Than Under Biden?
- Duration: 4:52 (292.7s), 1920x1080 @ 30 fps
- MP4 sha: e168f99480; build report dc93dee2c5; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:16 Is gas cheaper now than under Biden? (sc04)
- 3:04 Have prices risen less under Trump than under Biden? (sc18)
- 4:19 Close (sc24)

## Provenance

- Narration: edge / en-US-AndrewMultilingualNeural (rate +0%), 267.65s of speech, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only.**
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.6 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration no, music yes. Not cleared for public release.

## After the review

1. Record the private upload: `npm run publish -- uploaded inflation-2026 decision:is-gas-cheaper-than-under-biden --id <youtube id> --visibility private`.
2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.
3. Public release needs, besides approval: `npm run video -- final <topic> <story-id> --approved-by "<name>"` (the commercial voice), which packages the release build.
