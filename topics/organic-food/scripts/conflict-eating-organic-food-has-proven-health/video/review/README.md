# RELEASE BUILD: Does Eating Organic Make You Healthier?

Upload `conflict-eating-organic-food-has-proven-health.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: Does Eating Organic Make You Healthier?
- Duration: 5:20 (320.2s), 1920x1080 @ 30 fps
- MP4 sha: 45e589866b; build report e7b9a54f4f; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:21 Does eating organic make you healthier? (sc04)
- 2:44 Does eating organic lower your risk of cancer? (sc18)
- 5:02 Close (sc30)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 309.33s of speech, $0.0755 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.8 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded organic-food conflict:eating-organic-food-has-proven-health --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve organic-food conflict:eating-organic-food-has-proven-health --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published organic-food conflict:eating-organic-food-has-proven-health` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
