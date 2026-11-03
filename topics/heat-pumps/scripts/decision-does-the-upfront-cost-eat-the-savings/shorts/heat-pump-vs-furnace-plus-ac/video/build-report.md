# Build report: Heat pump or furnace plus air conditioning? One study's medians were $270 apart.

heat-pumps / decision:does-the-upfront-cost-eat-the-savings/shorts/heat-pump-vs-furnace-plus-ac, 2026-11-03T23:06:16.840Z. `npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings/shorts/heat-pump-vs-furnace-plus-ac --approved-by Jon`

**Segment.** 6 of 6 storyboard scenes (sc01 to sc06), 6 sentences. Kinds: sc01 short-stat-tiles, sc02 short-list, sc03 short-bar, sc04 short-excerpt, sc05 short-list, sc06 short-endcard.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/heat-pump-vs-furnace-plus-ac/video/segment.mp4: 46.80s, 1080x1920 @ 30 fps, h264 + aac, 1404 frames, rendered in 98.5s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 42s of speech at about 159 wpm, $0.0099 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.45 | 16 | c05b0d247a |
| s02 | 8.375 | 24 | 9b9f819f77 |
| s03 | 5.925 | 13 | 4391e546f1 |
| s04 | 8.6125 | 21 | 043f781796 |
| s05 | 6.7625 | 23 | 22aedf62b0 |
| s06 | 4.875 | 13 | f0392a9477 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** none (narration only).

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 961950e643, storyboard 186ab43af1, narration 72078c1fc4, config 8174eeb9e7, look bf7e3cb00f.

## QA: passed (33 of 33)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 46.800s |
| video stream | ok | h264 1080x1920 @ 30 |
| resolution | ok | 1080x1920 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1404 frames, timeline 1404 |
| duration in range | ok | 46.80s in [45.8,47.8] |
| duration matches timeline | ok | 46.800s vs 46.800s (1404 frames) |
| runtime | ok | 46.8s narrated, no target |
| short length | ok | 46.8s of at most 180s (YouTube classifies longer uploads as videos) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.000s apart |
| no clipping | ok | peak -1.5 dB, mean -20.1 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 6 sentences fit their slots |
| scene order | ok | sc01 to sc06 (6) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 6 scenes |
| every script sentence narrated | ok | 6 sentences in script order |
| sentences in script order | ok | 6 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 961950e643, storyboard 186ab43af1 (locked) |
| citations present | ok | 5 on-screen citations resolved |
| chart data matches storyboard | ok | 2 charts |
| excerpts resolve | ok | 1 excerpts with their highlights |
| assets and kinds supported | ok | 5 kinds |
| soundtrack | ok | none: no video/music.json |
| scene boundaries follow measured audio | ok | 6 scenes, 6 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 46.80s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 13 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/shorts/heat-pump-vs-furnace-plus-ac/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- no soundtrack: narration only
