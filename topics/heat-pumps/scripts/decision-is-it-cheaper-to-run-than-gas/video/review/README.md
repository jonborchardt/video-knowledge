# RELEASE BUILD: Is a Heat Pump Cheaper Than Gas, and Does It Pay for Itself?

Upload `decision-is-it-cheaper-to-run-than-gas.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Is a Heat Pump Cheaper Than Gas, and Does It Pay for Itself?
- Duration: 7:54 (474.4s), 1920x1080 @ 30 fps
- MP4 sha: 2cff7f0478; build report e18bb5b136; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:18 Is a heat pump cheaper to run than a gas furnace? (sc03)
- 4:21 Does a heat pump pay for itself, and does it matter when you buy? (sc22)
- 7:36 Close (sc34)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 458.51s of speech, $0.1099 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.9 dB under the voice while it speaks, peak -1.2 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
