# RELEASE BUILD: Does Organic Mean No Pesticides?

Upload `conflict-organic-farming-uses-pesticides.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Does Organic Mean No Pesticides?
- Duration: 5:25 (325.1s), 1920x1080 @ 30 fps
- MP4 sha: c8a15cebb2; build report 402612ff45; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:18 Do organic farmers spray pesticides? (sc03)
- 3:12 Does eating organic lower the pesticides in you? (sc15)
- 5:02 Close (sc25)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 312.75s of speech, $0.0714 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.6 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
