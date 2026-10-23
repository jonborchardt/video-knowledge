# RELEASE BUILD: Does Organic Farming Grow Less Food?

Upload `conflict-organic-farming-yields-less-food-per.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Does Organic Farming Grow Less Food?
- Duration: 4:10 (250.0s), 1920x1080 @ 30 fps
- MP4 sha: dd07021423; build report 4a6e2b3078; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:26 Does organic farming really grow less food? (sc04)
- 2:16 Is organic farming actually better for the planet? (sc12)
- 3:53 Close (sc19)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 236.33s of speech, $0.0536 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.6 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
