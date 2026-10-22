# RELEASE BUILD: The Courtroom Escape Hatches Sovereign Citizens Swear By

Upload `decision-courts-and-jurisdiction.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: The Courtroom Escape Hatches Sovereign Citizens Swear By
- Duration: 9:22 (562.5s), 1920x1080 @ 30 fps
- MP4 sha: e9e5a73590; build report b53f655f65; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card)

## Chapters

- 0:00 Hook (sc01)
- 0:42 Can you sign, say or point your way out of a court's power? (sc05)
- 5:52 Can declaring a new status put you outside the law? (sc27)
- 8:56 Close (sc40)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 545.39s of speech, $0.1315 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.5 dB under the voice while it speaks, peak -0.9 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record the public URL in `production.json` (`decision: "published"`, `url`).
2. Any later edit renders a draft again; run `npm run video -- final` once more before re-uploading.
