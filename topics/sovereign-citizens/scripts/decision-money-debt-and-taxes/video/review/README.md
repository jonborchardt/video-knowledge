# RELEASE BUILD: The Secret Account Behind Your Birth Certificate

Upload `decision-money-debt-and-taxes.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: The Secret Account Behind Your Birth Certificate
- Duration: 6:35 (395.9s), 1920x1080 @ 30 fps
- MP4 sha: 62ef47e3cc; build report 11b36705a8; QA 36/36
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters

- 0:00 Hook (sc01)
- 0:33 Is there a secret Treasury account in your name? (sc05)
- 4:33 Since 1933, is money just credit that can never pay a debt? (sc26)
- 6:08 Close (sc33)

## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 381.57s of speech, $0.0913 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 3 cues, music -20.5 dB under the voice while it speaks, peak -1.3 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded sovereign-citizens decision:money-debt-and-taxes --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve sovereign-citizens decision:money-debt-and-taxes --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published sovereign-citizens decision:money-debt-and-taxes` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
