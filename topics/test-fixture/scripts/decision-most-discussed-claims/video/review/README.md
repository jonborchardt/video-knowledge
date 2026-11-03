# RELEASE BUILD: Has a leap second ever been taken away?

Upload `decision-most-discussed-claims.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: [fixture 20261103-0134-c6bc] Has a leap second ever been taken away?
- Duration: 0:35 (35.9s), 1920x1080 @ 30 fps
- MP4 sha: 4b225935c4; build report 5eaf8f891e; QA 37/37
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters


## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 18.3s of speech, $0.0035 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: Undertow (undertow), strudel-bench f63f2c5 (songs/undertow.strudel not yet committed) at https://github.com/jonborchardt/strudel-bench, source songs/undertow.strudel c7fbeafb07, 84 bpm D:minor. Cleared; no samples. original composition; every voice is a built-in oscillator or synth patch, no sample pack and no soundfont, so no third-party sound is in the render.
- Mix: 1 cues, music -17.7 dB under the voice while it speaks, peak -1.5 dB.
- Clearance: narration yes, music yes. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded test-fixture decision:most-discussed-claims --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve test-fixture decision:most-discussed-claims --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published test-fixture decision:most-discussed-claims` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
