# RELEASE BUILD: Every leap second on record has only ever been added, never undone.

Upload `decision-most-discussed-claims-short-leap-seconds-only-added.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: [fixture 20261101-0729-8f4e] Every leap second on record has only ever been added, never undone.
- Duration: 0:11 (11.7s), 1080x1920 @ 30 fps
- MP4 sha: 25d2cf8532; build report 92e0e0e8b9; QA 33/33
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; thumbnail: `thumbnail.png` (the title card); captions: `captions.en.srt`

## Chapters


## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 10.16s of speech, $0.0019 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: none (narration only).
- Clearance: narration yes, music n/a. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded test-fixture decision:most-discussed-claims/shorts/leap-seconds-only-added --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve test-fixture decision:most-discussed-claims/shorts/leap-seconds-only-added --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published test-fixture decision:most-discussed-claims/shorts/leap-seconds-only-added` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
