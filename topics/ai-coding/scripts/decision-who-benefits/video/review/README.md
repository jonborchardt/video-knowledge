# RELEASE BUILD: Does AI Help Junior or Senior Developers More?

Upload `decision-who-benefits.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Does AI Help Junior or Senior Developers More?
- Duration: 7:03 (423.4s), 1920x1080 @ 30 fps
- MP4 sha: 7544736150; build report 6ea44c03cc; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:18 Does AI help junior or senior developers more? (sc04)
- 4:57 Why can AI assistance cost experts more time than it saves? (sc21)
- 6:46 Close (sc27)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 413.39s of speech, $0.1013 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.9 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded ai-coding decision:who-benefits --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve ai-coding decision:who-benefits --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published ai-coding decision:who-benefits` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
