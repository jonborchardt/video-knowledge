# Build report: Heat with oil? The evaluators said turn the heat pump off below 8 degrees. A year later, 25.

heat-pumps / conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature, 2026-10-24T16:28:28.064Z. `npm run video -- spike heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature`

**Segment.** 6 of 6 storyboard scenes (sc01 to sc06), 7 sentences. Kinds: sc01 short-question, sc02 short-stat-tiles, sc03 short-list, sc04 short-list, sc05 short-quote, sc06 short-list.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature/video/segment.mp4: 71.03s, 1080x1920 @ 30 fps, h264 + aac, 2131 frames, rendered in 33.7s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 65.57s of speech at about 173 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.92 | 26 | 2058f6b1fc |
| s02 | 11.424 | 24 | 9a2d9da993 |
| s03 | 11.064 | 35 | 27241b1dab |
| s04 | 15.456 | 38 | 5f7cf20bb6 |
| s05 | 6.528 | 17 | 09ecaede65 |
| s06 | 7.92 | 28 | 5f9eda88c4 |
| s07 | 5.256 | 18 | 453678c762 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 9fe3615994, storyboard 84cb0d0961, narration 9b0d155db3, config a316f024cd.

## QA: passed (32 of 32)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 71.033s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 2131 frames, timeline 2131 |
| duration in range | ok | 71.03s in [70.0,72.0] |
| duration matches timeline | ok | 71.033s vs 71.033s (2131 frames) |
| short length | ok | 71.0s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.5 dB, mean -19.7 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 7 sentences fit their slots |
| scene order | ok | sc01 to sc06 (6) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 6 scenes |
| every script sentence narrated | ok | 7 sentences in script order |
| sentences in script order | ok | 7 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 9fe3615994, storyboard 84cb0d0961 (locked) |
| citations present | ok | 4 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 4 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 6 scenes, 7 sentences |
| cues inside their sentences | ok | 1 cues |
| final scene complete | ok | ends 71.03s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 14 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
