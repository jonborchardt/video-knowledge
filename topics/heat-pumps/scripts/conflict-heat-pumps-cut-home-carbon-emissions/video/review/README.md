# RELEASE BUILD: Do Heat Pumps Cut Emissions on Today's Grid?

Upload `conflict-heat-pumps-cut-home-carbon-emissions.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Do Heat Pumps Cut Emissions on Today's Grid?
- Duration: 4:18 (258.2s), 1920x1080 @ 30 fps
- MP4 sha: 6a083c31a6; build report fb6b02a167; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:12 Setup (sc03)
- 0:43 Investigation (sc06)
- 3:31 Answer (sc15)
- 4:03 Takeaway (sc16)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 247.75s of speech, $0.0608 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -20.1 dB under the voice while it speaks, peak -1.1 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded heat-pumps conflict:heat-pumps-cut-home-carbon-emissions --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve heat-pumps conflict:heat-pumps-cut-home-carbon-emissions --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published heat-pumps conflict:heat-pumps-cut-home-carbon-emissions` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
