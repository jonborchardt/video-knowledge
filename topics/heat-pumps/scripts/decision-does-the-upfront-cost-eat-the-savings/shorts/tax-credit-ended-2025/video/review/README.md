# RELEASE BUILD: An earlier video said the heat pump tax credit ran through 2033. The IRS says it ended in 2025.

Upload `decision-does-the-upfront-cost-eat-the-savings-short-tax-credit-ended-2025.mp4` to YouTube as a **public** video: the build report says narration and music are cleared, and the person who ran the final build approved it (see its command line).

- Title: An earlier video said the heat pump tax credit ran through 2033. The IRS says it ended in 2025.
- Duration: 0:50 (50.9s), 1080x1920 @ 30 fps
- MP4 sha: 8214ab9c42; build report 1627ecf3ad; QA 33/33
- Description: `description.txt` (paste as is; chapters are measured from the timeline)
- Checklist: `checklist.md`; build report: `build-report.md`; captions: `captions.en.srt`

## Chapters


## Provenance

- Narration: azure / en-US-AndrewMultilingualNeural (rate +0%), 46.88s of speech, $0.01 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.
- Music: none (narration only).
- Clearance: narration yes, music n/a. Cleared for public release.

## After the upload

1. Record it: `npm run publish -- uploaded heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025 --id <youtube id> --visibility private` (or `public` once approved).
2. Watch the upload with the checklist, then approve this build: `npm run publish -- approve heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025 --by "<name>"`.
3. Set it public or schedule it on YouTube, then `npm run publish -- published heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025` (or `scheduled --at <ISO>`).
4. Any later edit renders a draft again; a live video is never replaced: a re-release is a new output (`npm run publish -- add`).
