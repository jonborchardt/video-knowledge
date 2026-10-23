# RELEASE BUILD: How High Is Inflation, Really?

Upload `decision-how-high-is-inflation.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: How High Is Inflation, Really?
- Duration: 5:44 (344.1s), 1920x1080 @ 30 fps
- MP4 sha: d220fed703; build report 6fb75001f5; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:21 How high is inflation right now? (sc04)
- 3:15 What is pushing inflation up? (sc22)
- 5:23 Close (sc34)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 332.2s of speech, $0.0745 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.7 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
