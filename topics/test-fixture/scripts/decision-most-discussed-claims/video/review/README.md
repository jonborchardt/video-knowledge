# PRIVATE REVIEW BUILD: Has a leap second ever been taken away?

Upload `decision-most-discussed-claims-review-private.mp4` to YouTube as a **private** video for review. Do not publish. Public release is blocked: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final test-fixture decision:most-discussed-claims --approved-by <name>" re-narrates it for release.

- Working title: [PRIVATE REVIEW] [fixture manual] Has a leap second ever been taken away?
- Duration: 0:33 (33.5s), 1920x1080 @ 30 fps
- MP4 sha: 8c7a157cb6; build report 522d6af09a; QA 37/37
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; captions: `captions.en.srt`

## Chapters


## Provenance

- Narration: edge / en-US-AndrewMultilingualNeural (rate +0%), 16.39s of speech, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only.**
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 2 cues, music -18.4 dB under the voice while it speaks, peak -3.6 dB.
- Clearance: narration no, music yes. Not cleared for public release.

## After the review

1. Record the private upload: `npm run publish -- uploaded test-fixture decision:most-discussed-claims --id <youtube id> --visibility private`.
2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.
3. Public release needs, besides approval: `npm run video -- final <topic> <story-id> --approved-by "<name>"` (the commercial voice), which packages the release build.
