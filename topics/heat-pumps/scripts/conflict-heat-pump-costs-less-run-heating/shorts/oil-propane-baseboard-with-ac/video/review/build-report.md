# Build report: Oil, propane or electric heat, plus AC? A national model says 95 to 100 percent of homes save.

heat-pumps / conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac, 2026-10-24T18:38:56.466Z. `npm run video -- spike heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac`

**Segment.** 5 of 5 storyboard scenes (sc01 to sc05), 5 sentences. Kinds: sc01 short-stat-tiles, sc02 short-list, sc03 short-stat-tiles, sc04 short-bar, sc05 short-endcard.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac/video/segment.mp4: 44.37s, 1080x1920 @ 30 fps, h264 + aac, 1331 frames, rendered in 125.4s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 39.72s of speech at about 154 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 11.064 | 27 | d89d80f7fc |
| s03 | 8.088 | 22 | eef08fba3b |
| s04 | 8.328 | 18 | d64f51a474 |
| s05 | 7.512 | 17 | 476f3fe4de |
| s07 | 4.728 | 14 | 0fe3c334b6 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 4d7fae0bff, storyboard 5145df1f10, narration e064740f15, config c9473c52a5.

## QA: passed (32 of 32)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 44.367s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1331 frames, timeline 1331 |
| duration in range | ok | 44.37s in [43.4,45.4] |
| duration matches timeline | ok | 44.367s vs 44.367s (1331 frames) |
| short length | ok | 44.4s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.001s apart |
| no clipping | ok | peak -1.5 dB, mean -19.5 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 5 sentences fit their slots |
| scene order | ok | sc01 to sc05 (5) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 5 scenes |
| every script sentence narrated | ok | 5 sentences in script order |
| sentences in script order | ok | 5 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 4d7fae0bff, storyboard 5145df1f10 (locked) |
| citations present | ok | 4 on-screen citations resolved |
| chart data matches storyboard | ok | 3 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 4 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 5 scenes, 5 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 44.37s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 11 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
