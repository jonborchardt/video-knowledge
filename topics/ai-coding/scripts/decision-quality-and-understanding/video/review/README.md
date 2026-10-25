# RELEASE BUILD: Is AI-Written Code Harder to Maintain?

Upload `decision-quality-and-understanding.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Is AI-Written Code Harder to Maintain?
- Duration: 4:55 (295.1s), 1920x1080 @ 30 fps
- MP4 sha: 12b60a9b01; build report a0854bf9e2; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:14 Setup (sc03)
- 0:39 Investigation (sc05)
- 3:55 Answer (sc24)
- 4:33 Takeaway (sc27)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 285.14s of speech, $0.0683 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -19.9 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded ai-coding decision:quality-and-understanding --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve ai-coding decision:quality-and-understanding --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published ai-coding decision:quality-and-understanding` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
