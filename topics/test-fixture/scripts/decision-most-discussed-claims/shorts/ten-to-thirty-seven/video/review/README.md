# RELEASE BUILD: A 10-second gap in 1972 grew to 37 by 2017. The record only climbs.

Upload `decision-most-discussed-claims-short-ten-to-thirty-seven.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: [fixture 20261103-0134-c6bc] A 10-second gap in 1972 grew to 37 by 2017. The record only climbs.
- Duration: 0:10 (10.9s), 1080x1920 @ 30 fps
- MP4 sha: 51943c9270; build report a15d365187; QA 33/33
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; captions: `captions.en.srt`

## Chapters


## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 9.43s of speech, $0.0012 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: none (narration only).
- Clearance: narration yes, music n/a. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded test-fixture decision:most-discussed-claims/shorts/ten-to-thirty-seven --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve test-fixture decision:most-discussed-claims/shorts/ten-to-thirty-seven --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published test-fixture decision:most-discussed-claims/shorts/ten-to-thirty-seven` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
