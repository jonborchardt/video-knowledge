# RELEASE BUILD: Is the Economy Booming, or Just Growing?

Upload `decision-is-the-economy-booming.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Is the Economy Booming, or Just Growing?
- Duration: 2:59 (179.5s), 1920x1080 @ 30 fps
- MP4 sha: c1e66defdd; build report f23769cee2; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:18 Setup (sc03)
- 0:36 Investigation (sc05)
- 2:25 Answer (sc16)
- 2:50 Takeaway (sc18)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 168.94s of speech, $0.0387 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -19.7 dB under the voice while it speaks, peak -1.5 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded inflation-2026 decision:is-the-economy-booming --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve inflation-2026 decision:is-the-economy-booming --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published inflation-2026 decision:is-the-economy-booming` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
