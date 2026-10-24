# Build report: Oil, propane or electric heat, plus AC? A national model says 95 to 100 percent of homes save.

heat-pumps / conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac, 2026-10-24T16:27:21.837Z. `npm run video -- spike heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac`

**Segment.** 6 of 6 storyboard scenes (sc01 to sc06), 7 sentences. Kinds: sc01 short-stat-tiles, sc02 short-title, sc03 short-list, sc04 short-stat-tiles, sc05 short-bar, sc06 short-list.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac/video/segment.mp4: 69.03s, 1080x1920 @ 30 fps, h264 + aac, 2071 frames, rendered in 85.2s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 63.48s of speech at about 168 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 13.104 | 32 | 417ec40fb0 |
| s02 | 3.576 | 14 | 1f202afa6b |
| s03 | 9.648 | 32 | fbc2bf47d0 |
| s04 | 11.472 | 28 | f63c490eb9 |
| s05 | 10.68 | 27 | 8e5ffe4b2f |
| s06 | 4.296 | 11 | 8bfce74e92 |
| s07 | 10.704 | 30 | f90a4da337 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 84774b08fe, storyboard 72a23a544d, narration b7492b8434, config 6684542f02.

## QA: passed (32 of 32)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 69.033s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 2071 frames, timeline 2071 |
| duration in range | ok | 69.03s in [68.0,70.0] |
| duration matches timeline | ok | 69.033s vs 69.033s (2071 frames) |
| short length | ok | 69.0s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.5 dB, mean -19.5 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 7 sentences fit their slots |
| scene order | ok | sc01 to sc06 (6) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 6 scenes |
| every script sentence narrated | ok | 7 sentences in script order |
| sentences in script order | ok | 7 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 84774b08fe, storyboard 72a23a544d (locked) |
| citations present | ok | 4 on-screen citations resolved |
| chart data matches storyboard | ok | 3 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 4 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 6 scenes, 7 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 69.03s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 13 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
