# Build report: In a 21-site field test, 38 percent of heat pump installs needed a new electrical panel

heat-pumps / decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade, 2026-11-03T20:42:28.913Z. `npm run video -- spike heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade`

**Segment.** 5 of 5 storyboard scenes (sc01 to sc05), 5 sentences. Kinds: sc01 short-stat-tiles, sc02 short-list, sc03 short-stat-tiles, sc04 short-excerpt, sc05 short-endcard.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade/video/segment.mp4: 45.57s, 1080x1920 @ 30 fps, h264 + aac, 1367 frames, rendered in 98.6s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 40.9s of speech at about 141 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.912 | 16 | 13a8ada9bd |
| s02 | 7.512 | 22 | cdaec753e8 |
| s03 | 11.184 | 18 | 32b00bfeb8 |
| s04 | 10.896 | 23 | ccddb208b9 |
| s05 | 4.392 | 14 | 1bbbd65402 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade --approved-by "your name"" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 441f58912b, storyboard c8671f2c19, narration f3fb96b8d9, config c9473c52a5, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 45.567s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1367 frames, timeline 1367 |
| duration in range | ok | 45.57s in [44.6,46.6] |
| duration matches timeline | ok | 45.567s vs 45.567s (1367 frames) |
| runtime | ok | 45.6s narrated, no target |
| short length | ok | 45.6s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.001s apart |
| no clipping | ok | peak -1.5 dB, mean -19.7 dB |
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
| final scene complete | ok | ends 45.57s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 11 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by "your name"" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
