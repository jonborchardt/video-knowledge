# Build report: An earlier video said the heat pump tax credit ran through 2033. The IRS says it ended in 2025.

heat-pumps / decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025, 2026-11-03T22:53:04.325Z. `npm run video -- spike heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025`

**Segment.** 5 of 5 storyboard scenes (sc01 to sc05), 5 sentences. Kinds: sc01 short-quote, sc02 short-stat-tiles, sc03 short-excerpt, sc04 short-list, sc05 short-endcard.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025/video/segment.mp4: 50.43s, 1080x1920 @ 30 fps, h264 + aac, 1513 frames, rendered in 99.6s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 46.44s of speech at about 156 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.648 | 26 | 266d153e29 |
| s02 | 8.568 | 22 | 966bb4646f |
| s03 | 12.792 | 33 | bb87c2ee42 |
| s04 | 10.92 | 22 | 90bf47c32b |
| s05 | 4.512 | 14 | ed12cc66b4 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025 --approved-by "your name"" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 3923d59680, storyboard b58a85713c, narration 5e4367bfff, config c9473c52a5, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 50.433s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1513 frames, timeline 1513 |
| duration in range | ok | 50.43s in [49.4,51.4] |
| duration matches timeline | ok | 50.433s vs 50.433s (1513 frames) |
| runtime | ok | 50.4s narrated, no target |
| short length | ok | 50.4s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.5 dB, mean -19.8 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 5 sentences fit their slots |
| scene order | ok | sc01 to sc05 (5) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 5 scenes |
| every script sentence narrated | ok | 5 sentences in script order |
| sentences in script order | ok | 5 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 3923d59680, storyboard b58a85713c (locked) |
| citations present | ok | 4 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 1 excerpts with their highlights |
| assets and kinds supported | ok | 5 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 5 scenes, 5 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 50.43s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 11 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by "your name"" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
