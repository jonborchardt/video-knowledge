# PRIVATE REVIEW BUILD: Heat Pump vs Oil, Propane and Baseboard Heat

Upload `conflict-heat-pump-costs-less-run-heating-review-private.mp4` to YouTube as a **private** video for review. Do not publish. Public release is blocked: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating --approved-by <name>" re-narrates it for release.

- Working title: [PRIVATE REVIEW] Heat Pump vs Oil, Propane and Baseboard Heat
- Duration: 4:05 (245.0s), 1920x1080 @ 30 fps
- MP4 sha: b97da6ed2f; build report 4f6168e2b8; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:14 Setup (sc03)
- 0:48 Investigation (sc06)
- 3:01 Answer (sc17)
- 3:26 Takeaway (sc20)

## Provenance

- Narration: edge / en-US-AndrewMultilingualNeural (rate +0%), 220.46s of speech, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only.**
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -19.6 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration no, music yes. Not cleared for public release.

## After the review

1. Record the private upload: `npm run publish -- uploaded heat-pumps conflict:heat-pump-costs-less-run-heating --id <youtube id> --visibility private`.
2. Fix what the checklist found; a re-render keeps every cached scene the fix does not touch.
3. Public release needs, besides approval: `npm run video -- final <topic> <story-id> --approved-by "<name>"` (the commercial voice), which packages the release build.
