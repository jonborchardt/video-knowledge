# Build report: A 10-second gap in 1972 grew to 37 by 2017. The record only climbs.

test-fixture / decision:most-discussed-claims/shorts/ten-to-thirty-seven, 2026-11-03T04:43:36.563Z. `npm run video -- spike test-fixture decision:most-discussed-claims/shorts/ten-to-thirty-seven`

**Segment.** 2 of 2 storyboard scenes (sc01 to sc02), 3 sentences. Kinds: sc01 short-stat-tiles, sc02 short-endcard.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/shorts/ten-to-thirty-seven/video/segment.mp4: 10.83s, 1080x1920 @ 30 fps, h264 + aac, 325 frames, rendered in 47.3s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 9.36s of speech at about 115 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 2.376 | 5 | 129bcfb435 |
| s02 | 5.112 | 8 | 6e67b42b4e |
| s03 | 1.872 | 3 | bd9598b255 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final test-fixture decision:most-discussed-claims/shorts/ten-to-thirty-seven --approved-by "your name"" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 1be51fb83b, storyboard 940ed3a37a, narration 720e452b34, config d3df196b72, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 10.833s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 325 frames, timeline 325 |
| duration in range | ok | 10.83s in [9.8,11.8] |
| duration matches timeline | ok | 10.833s vs 10.833s (325 frames) |
| runtime | ok | 9.4s spoken against a 7.5 s target |
| short length | ok | 10.8s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.6 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 3 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 3 sentences in script order |
| sentences in script order | ok | 3 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 1be51fb83b, storyboard 940ed3a37a (locked) |
| citations present | ok | 1 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 2 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 2 scenes, 3 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 10.83s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 5 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/shorts/ten-to-thirty-seven/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by "your name"" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
