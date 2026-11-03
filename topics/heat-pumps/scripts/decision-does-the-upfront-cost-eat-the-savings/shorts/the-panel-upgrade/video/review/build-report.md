# Build report: In a 21-site field test, 38 percent of heat pump installs needed a new electrical panel

heat-pumps / decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade, 2026-11-03T22:45:17.556Z. `npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade --approved-by Jon`

**Segment.** 5 of 5 storyboard scenes (sc01 to sc05), 5 sentences. Kinds: sc01 short-stat-tiles, sc02 short-list, sc03 short-stat-tiles, sc04 short-excerpt, sc05 short-endcard.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade/video/segment.mp4: 45.87s, 1080x1920 @ 30 fps, h264 + aac, 1376 frames, rendered in 104.5s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 41.21s of speech at about 140 wpm, $0.0082 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.9 | 16 | 71fbe197cd |
| s02 | 7.4875 | 22 | 7e9cb4601d |
| s03 | 11.1625 | 18 | 3535c9e3ba |
| s04 | 10.8375 | 23 | e07e4596b8 |
| s05 | 4.825 | 14 | 249cb978c5 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 441f58912b, storyboard c8671f2c19, narration 930b12493d, config c9473c52a5, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 45.867s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1376 frames, timeline 1376 |
| duration in range | ok | 45.87s in [44.9,46.9] |
| duration matches timeline | ok | 45.867s vs 45.867s (1376 frames) |
| runtime | ok | 45.9s narrated, no target |
| short length | ok | 45.9s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.7 dB, mean -19.7 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 5 sentences fit their slots |
| scene order | ok | sc01 to sc05 (5) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 5 scenes |
| every script sentence narrated | ok | 5 sentences in script order |
| sentences in script order | ok | 5 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 441f58912b, storyboard c8671f2c19 (locked) |
| citations present | ok | 4 on-screen citations resolved |
| chart data matches storyboard | ok | 2 charts |
| excerpts resolve | ok | 1 excerpts with their highlights |
| assets and kinds supported | ok | 4 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 5 scenes, 5 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 45.87s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 11 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
