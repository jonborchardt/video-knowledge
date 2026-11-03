# Build report: Has a leap second ever been taken away?

test-fixture / decision:most-discussed-claims, 2026-11-03T03:50:54.528Z. `npm run video -- final test-fixture decision:most-discussed-claims --approved-by Jon`

**Segment.** 3 of 2 storyboard scenes (sc01 to end), 2 sentences. Kinds: sc01 stat-tiles, sc02 title, end close-card.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/video/segment.mp4: 35.95s, 1920x1080 @ 30 fps, h264 + aac, 1078 frames, rendered in 152.3s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 18.3s of speech at about 141 wpm, $0.0035 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 11.85 | 20 | a6e29b9f94 |
| s02 | 6.45 | 19 | 348b9c9001 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 44b36c7651: music -17.7 dB under the voice while it speaks, peak -1.5 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| ending | undertow/pulse | 0.0s | 35.9s | -11 dB | -36.0 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script d2206ea3ad, storyboard 8a45bc3b58, narration 099c87d2b2, config 129a2f5a9b, look bf7e3cb00f, music 44b36c7651.

## QA: passed (37 of 37)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 35.946s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1078 frames, timeline 1078 |
| duration in range | ok | 35.95s in [34.9,36.9] |
| duration matches timeline | ok | 35.946s vs 35.933s (1078 frames) |
| runtime | ok | 18.3s spoken against a 15 s target |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.5 dB, mean -22 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 2 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 2 sentences in script order |
| sentences in script order | ok | 2 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script d2206ea3ad, storyboard 8a45bc3b58 (locked) |
| citations present | ok | 2 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 3 kinds |
| music cues resolve | ok | 1 cues over 1 compositions |
| soundtrack mixed | ok | 1 cues, 2026-11-03T03:50:42.254Z |
| mix is of this cue sheet | ok | mix 44b36c7651, cue sheet 44b36c7651 |
| every cue sounded | ok | 1 cues audible where placed |
| music under the voice | ok | -17.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.5 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 3 scenes, 2 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 35.93s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 7 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
