# Build report: Heat with oil? The evaluators said turn the heat pump off below 8 degrees. A year later, 25.

heat-pumps / conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature, 2026-10-24T18:38:52.183Z. `npm run video -- spike heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature`

**Segment.** 4 of 4 storyboard scenes (sc01 to sc04), 4 sentences. Kinds: sc01 short-question, sc02 short-stat-tiles, sc03 short-list, sc04 short-endcard.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature/video/segment.mp4: 42.63s, 1080x1920 @ 30 fps, h264 + aac, 1279 frames, rendered in 123.1s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 38.45s of speech at about 172 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.92 | 26 | 2058f6b1fc |
| s02 | 12.504 | 31 | 57fb3829c8 |
| s04 | 10.656 | 26 | 84e77e9af6 |
| s06 | 7.368 | 25 | f8196b40f5 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script f72c0d2ac3, storyboard 3274b21f80, narration d3972fa64c, config 279b7336a6.

## QA: passed (32 of 32)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 42.633s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1279 frames, timeline 1279 |
| duration in range | ok | 42.63s in [41.6,43.6] |
| duration matches timeline | ok | 42.633s vs 42.633s (1279 frames) |
| short length | ok | 42.6s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.9 dB, mean -19.7 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 4 sentences fit their slots |
| scene order | ok | sc01 to sc04 (4) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 4 scenes |
| every script sentence narrated | ok | 4 sentences in script order |
| sentences in script order | ok | 4 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script f72c0d2ac3, storyboard 3274b21f80 (locked) |
| citations present | ok | 2 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 4 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 4 scenes, 4 sentences |
| cues inside their sentences | ok | 1 cues |
| final scene complete | ok | ends 42.63s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 10 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
