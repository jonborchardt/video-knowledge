# PRIVATE REVIEW BUILD: Does Organic Farming Grow Less Food?

Upload `conflict-organic-farming-yields-less-food-per-review-private.mp4` to YouTube as a **private** video for review. Do not publish. Public release is blocked: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final organic-food conflict:organic-farming-yields-less-food-per --approved-by <name>" re-narrates it for release.

- Working title: [PRIVATE REVIEW] Does Organic Farming Grow Less Food?
- Duration: 4:26 (266.3s), 1920x1080 @ 30 fps
- MP4 sha: b48e904f32; build report d7fd96f958; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:26 Does organic farming really grow less food? (sc04)
- 2:16 Is organic farming actually better for the planet? (sc12)
- 3:54 Close (sc19)

## Provenance

- Narration: edge / en-US-AndrewMultilingualNeural (rate +0%), 236.42s of speech, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only.**
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.5 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration no, music yes. Not cleared for public release.

## After the review

1. Record the private upload: `npm run publish -- uploaded organic-food conflict:organic-farming-yields-less-food-per --id <youtube id> --visibility private`.
2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.
3. Public release needs, besides approval: `npm run video -- final <topic> <story-id> --approved-by "<name>"` (the commercial voice), which packages the release build.
