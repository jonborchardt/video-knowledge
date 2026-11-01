# Build report: Every leap second on record has only ever been added, never undone.

test-fixture / decision:most-discussed-claims/shorts/leap-seconds-only-added, 2026-11-01T09:08:29.925Z. `npm run video -- final test-fixture decision:most-discussed-claims/shorts/leap-seconds-only-added --approved-by Claude Fable 5.1 (phase 2 gate run, authorised by Jon, register D16)`

**Segment.** 2 of 2 storyboard scenes (sc01 to sc02), 4 sentences. Kinds: sc01 short-stat-tiles, sc02 short-title.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/shorts/leap-seconds-only-added/video/segment.mp4: 11.70s, 1080x1920 @ 30 fps, h264 + aac, 351 frames, rendered in 29.3s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 10.16s of speech at about 142 wpm, $0.0019 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 2.2 | 6 | fa45c6acb3 |
| s02 | 2.9625 | 6 | 52062004a9 |
| s03 | 3.175 | 8 | f1b0f4a419 |
| s04 | 1.82 | 4 | f503c505f0 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 225f67ece0, storyboard 4a9d211afb, narration aaadbe2393, config 592c7cbfdd, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 11.700s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 351 frames, timeline 351 |
| duration in range | ok | 11.70s in [10.7,12.7] |
| duration matches timeline | ok | 11.700s vs 11.700s (351 frames) |
| runtime | ok | 10.2s spoken against a 7.5 s target |
| short length | ok | 11.7s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.8 dB, mean -20.4 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 4 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 4 sentences in script order |
| sentences in script order | ok | 4 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 225f67ece0, storyboard 4a9d211afb (locked) |
| citations present | ok | 1 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 2 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 2 scenes, 4 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 11.70s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 5 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/shorts/leap-seconds-only-added/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
