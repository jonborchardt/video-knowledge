# RELEASE BUILD: What Really Happens to a Heat Pump at 0°F

Upload `decision-what-happens-when-it-gets-cold.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: What Really Happens to a Heat Pump at 0°F
- Duration: 7:30 (450.3s), 1920x1080 @ 30 fps
- MP4 sha: bcabccdfc5; build report 1e80391578; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:16 Setup (sc03)
- 0:38 Investigation (sc06)
- 6:14 Answer (sc29)
- 7:07 Takeaway (sc33)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 438.95s of speech, $0.1 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 4 cues, music -20.1 dB under the voice while it speaks, peak -1.4 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded heat-pumps decision:what-happens-when-it-gets-cold --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve heat-pumps decision:what-happens-when-it-gets-cold --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published heat-pumps decision:what-happens-when-it-gets-cold` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
