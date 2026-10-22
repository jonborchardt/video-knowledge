# RELEASE BUILD: Is Gas Cheaper Now Than Under Biden?

Upload `decision-is-gas-cheaper-than-under-biden.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Is Gas Cheaper Now Than Under Biden?
- Duration: 4:34 (274.2s), 1920x1080 @ 30 fps
- MP4 sha: 196c3e5f2b; build report fa1abcdc3c; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:15 Is gas cheaper now than under Biden? (sc04)
- 3:03 Have prices risen less under Trump than under Biden? (sc18)
- 4:17 Close (sc24)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 265.13s of speech, $0.0541 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.7 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
