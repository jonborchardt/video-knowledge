# Build report: Does Organic Mean No Pesticides?

organic-food / conflict:organic-farming-uses-pesticides, 2026-10-22T19:05:17.873Z. `npm run video -- final organic-food conflict:organic-farming-uses-pesticides --approved-by Jon`

**Segment.** 26 of 26 storyboard scenes (sc01 to sc26), 32 sentences. Kinds: sc01 quote, sc02 question, sc03 quote, sc04 excerpt, sc05 excerpt, sc06 title, sc07 quote, sc08 columns, sc09 stat-tiles, sc10 list, sc11 excerpt, sc12 excerpt, sc13 title, sc14 question, sc15 quote, sc16 question, sc17 bar, sc18 stat-tiles, sc19 bar, sc20 question, sc21 quote, sc22 stat-tiles, sc23 title, sc24 list, sc25 transition, sc26 question.

**Output.** topics/organic-food/scripts/conflict-organic-farming-uses-pesticides/video/segment.mp4: 325.12s, 1920x1080 @ 30 fps, h264 + aac, 9753 frames, rendered in 1224.3s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 312.75s of speech at about 150 wpm, $0.0714 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 8.35 | 20 | 151405bc17 |
| s03 | 7.575 | 23 | a9f93f316f |
| s04 | 6.05 | 15 | 21d8250816 |
| s05 | 3.4375 | 11 | 723640bb85 |
| s06 | 17.8875 | 40 | f9caddfc16 |
| s07 | 17.35 | 42 | de731f3094 |
| s08 | 6.375 | 17 | f60762ebc7 |
| s09 | 7.025 | 13 | 96c112531f |
| s10 | 6.825 | 16 | 23f20272a0 |
| s11 | 15.0125 | 36 | 4015f76727 |
| s12 | 11.4125 | 26 | 27724fa453 |
| s13 | 11.5125 | 28 | 3de1fafc8d |
| s14 | 10.2 | 25 | 9c1f6b4311 |
| s15 | 11.35 | 23 | 4c84338022 |
| s16 | 8.2625 | 23 | 7f22cd9e21 |
| s17 | 11.025 | 26 | 2a20741cb1 |
| s18 | 17.525 | 44 | c40def5f20 |
| s19 | 7.8375 | 23 | b962d5de64 |
| s20 | 9.0625 | 22 | ce5459613f |
| s21 | 4.075 | 8 | fac7c7a1c6 |
| s22 | 12.825 | 26 | ab2f4ed616 |
| s23 | 10.125 | 24 | 09d4300bbf |
| s24 | 15.3625 | 37 | 5fc0d79be6 |
| s25 | 4.3625 | 14 | d4289edec9 |
| s26 | 8.175 | 17 | cae11db246 |
| s27 | 14.175 | 39 | afe431e47b |
| s28 | 5.8 | 16 | 6bfa82ed96 |
| s29 | 9.9625 | 25 | 6cbc4acf76 |
| s30 | 13.3875 | 40 | eeb6487679 |
| s31 | 4.2 | 10 | 2da532901c |
| s32 | 8.3125 | 22 | fe16b63b7a |
| s33 | 7.9125 | 27 | 5fb3462140 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix aa4fa5672d: music -20.6 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.1s | -11 dB | -37.6 dB |
| evidence | undertow/texture | 18.1s | 302.8s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 302.8s | 325.1s | -11 dB | -37.7 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 1754c299c9, storyboard 5d61aeac98, narration f631f8f1b6, config afc3663142, music aa4fa5672d.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 325.120s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 9753 frames, timeline 9753 |
| duration in range | ok | 325.12s in [324.1,326.1] |
| duration matches timeline | ok | 325.120s vs 325.100s (9753 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.020s apart |
| no clipping | ok | peak -1.4 dB, mean -19.4 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 32 sentences fit their slots |
| scene order | ok | sc01 to sc26 (26) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 26 scenes |
| every script sentence narrated | ok | 32 sentences in script order |
| sentences in script order | ok | 32 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 1754c299c9, storyboard 5d61aeac98 (locked) |
| citations present | ok | 24 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 4 excerpts with their highlights |
| assets and kinds supported | ok | 9 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T19:04:15.154Z |
| mix is of this cue sheet | ok | mix aa4fa5672d, cue sheet aa4fa5672d |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 26 scenes, 32 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 325.10s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 58 in video/frames/; contact sheet topics/organic-food/scripts/conflict-organic-farming-uses-pesticides/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
