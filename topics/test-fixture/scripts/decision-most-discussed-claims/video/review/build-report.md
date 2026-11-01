# Build report: Has a leap second ever been taken away?

test-fixture / decision:most-discussed-claims, 2026-11-01T08:03:22.489Z. `npm run video -- final test-fixture decision:most-discussed-claims --approved-by Claude Fable 5.1 (phase 2 gate run, authorised by Jon, register D16)`

**Segment.** 3 of 2 storyboard scenes (sc01 to end), 3 sentences. Kinds: sc01 question, sc02 stat-tiles, end close-card.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/video/segment.mp4: 33.30s, 1920x1080 @ 30 fps, h264 + aac, 999 frames, rendered in 74.4s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 15.34s of speech at about 153 wpm, $0.0031 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 2.85 | 8 | 131063612d |
| s02 | 7.7375 | 15 | 4169fd2638 |
| s03 | 4.75 | 14 | d223d47465 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 6b6a77cd22: music -18.3 dB under the voice while it speaks, peak -2.5 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 4.5s | -11 dB | -42.2 dB |
| ending | undertow/pulse | 4.5s | 33.3s | -11 dB | -35.9 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 2dbc2f40a7, storyboard 9178a43fd2, narration be70fd529c, config d16ce6e663, look bf7e3cb00f, music 6b6a77cd22.

## QA: passed (37 of 37)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 33.301s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 999 frames, timeline 999 |
| duration in range | ok | 33.30s in [32.3,34.3] |
| duration matches timeline | ok | 33.301s vs 33.300s (999 frames) |
| runtime | ok | 17.3s narrated against a 15 s target |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.001s apart |
| no clipping | ok | peak -2.5 dB, mean -22.8 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 3 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 3 sentences in script order |
| sentences in script order | ok | 3 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 2dbc2f40a7, storyboard 9178a43fd2 (locked) |
| citations present | ok | 1 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 3 kinds |
| music cues resolve | ok | 2 cues over 1 compositions |
| soundtrack mixed | ok | 2 cues, 2026-11-01T08:03:10.733Z |
| mix is of this cue sheet | ok | mix 6b6a77cd22, cue sheet 6b6a77cd22 |
| every cue sounded | ok | 2 cues audible where placed |
| music under the voice | ok | -18.3 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -2.5 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 3 scenes, 3 sentences |
| cues inside their sentences | ok | 1 cues |
| final scene complete | ok | ends 33.30s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 8 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
