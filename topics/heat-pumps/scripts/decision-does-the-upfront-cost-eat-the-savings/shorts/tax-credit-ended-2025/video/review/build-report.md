# Build report: An earlier video said the heat pump tax credit ran through 2033. The IRS says it ended in 2025.

heat-pumps / decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025, 2026-11-04T02:17:48.577Z. `npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025 --approved-by Jon (OK by chat, 2026-11-04)`

**Segment.** 5 of 5 storyboard scenes (sc01 to sc05), 5 sentences. Kinds: sc01 short-quote, sc02 short-stat-tiles, sc03 short-excerpt, sc04 short-list, sc05 short-endcard.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025/video/segment.mp4: 50.87s, 1080x1920 @ 30 fps, h264 + aac, 1526 frames, rendered in 111.2s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 46.88s of speech at about 155 wpm, $0.01 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.575 | 26 | 75985f93f5 |
| s02 | 8.9625 | 22 | 631adbfb6b |
| s03 | 12.8875 | 33 | d9f2258794 |
| s04 | 10.8375 | 22 | 3c6d203ea5 |
| s05 | 4.6125 | 14 | 34f83bb664 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 3923d59680, storyboard b58a85713c, narration fe05fe2c75, config c9473c52a5, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 50.867s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1526 frames, timeline 1526 |
| duration in range | ok | 50.87s in [49.9,51.9] |
| duration matches timeline | ok | 50.867s vs 50.867s (1526 frames) |
| runtime | ok | 50.9s narrated, no target |
| short length | ok | 50.9s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.5 dB, mean -19.7 dB |
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
| final scene complete | ok | ends 50.87s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 11 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/tax-credit-ended-2025/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
