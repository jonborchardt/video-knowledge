# RELEASE BUILD: Do 97% of Day Traders Really Lose Money?

Upload `decision-trading-and-betting.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Do 97% of Day Traders Really Lose Money?
- Duration: 3:51 (231.0s), 1920x1080 @ 30 fps
- MP4 sha: 93713cd0c2; build report c77855d33b; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:22 Setup (sc04)
- 0:50 Investigation (sc07)
- 2:55 Answer (sc22)
- 3:32 Takeaway (sc24)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 220.02s of speech, $0.0506 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -19.4 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
