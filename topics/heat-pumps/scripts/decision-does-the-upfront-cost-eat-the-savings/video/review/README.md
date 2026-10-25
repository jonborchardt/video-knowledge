# RELEASE BUILD: What a Heat Pump Really Costs to Install, and What Help Is Left

Upload `decision-does-the-upfront-cost-eat-the-savings.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: What a Heat Pump Really Costs to Install, and What Help Is Left
- Duration: 6:27 (387.9s), 1920x1080 @ 30 fps
- MP4 sha: 8089133983; build report e82cd54235; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:20 What does a heat pump really cost compared with what you would buy anyway? (sc04)
- 3:47 What heat pump tax credits and rebates are left in 2026? (sc19)
- 6:10 Close (sc30)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 374.69s of speech, $0.0856 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.8 dB under the voice while it speaks, peak -1.1 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded heat-pumps decision:does-the-upfront-cost-eat-the-savings --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve heat-pumps decision:does-the-upfront-cost-eat-the-savings --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published heat-pumps decision:does-the-upfront-cost-eat-the-savings` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
