# RELEASE BUILD: Heat Pump vs Oil, Propane and Baseboard Heat

Upload `conflict-heat-pump-costs-less-run-heating.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Heat Pump vs Oil, Propane and Baseboard Heat
- Duration: 3:48 (229.0s), 1920x1080 @ 30 fps
- MP4 sha: f0bea5d61b; build report 4976eebb5c; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:14 Setup (sc03)
- 0:48 Investigation (sc06)
- 3:01 Answer (sc17)
- 3:26 Takeaway (sc20)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 220.44s of speech, $0.0526 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -19.8 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
