# Build report: Is Gas Cheaper Now Than Under Biden?

inflation-2026 / decision:is-gas-cheaper-than-under-biden, 2026-10-22T18:08:19.510Z. `npm run video -- final inflation-2026 decision:is-gas-cheaper-than-under-biden --approved-by Jon`

**Segment.** 25 of 25 storyboard scenes (sc01 to sc25), 30 sentences. Kinds: sc01 stat-tiles, sc02 stat-tiles, sc03 question, sc04 quote, sc05 quote, sc06 stat-tiles, sc07 stat-tiles, sc08 stat-tiles, sc09 quote, sc10 stat-tiles, sc11 title, sc12 quote, sc13 stat-tiles, sc14 stat-tiles, sc15 quote, sc16 list, sc17 question, sc18 quote, sc19 list, sc20 title, sc21 list, sc22 bar, sc23 list, sc24 title, sc25 list.

**Output.** topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/segment.mp4: 274.22s, 1920x1080 @ 30 fps, h264 + aac, 8226 frames, rendered in 1036s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 265.13s of speech at about 149 wpm, $0.0541 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.3375 | 16 | 69bec9debe |
| s02 | 2.3375 | 7 | b9cda25fa6 |
| s03 | 4.4 | 16 | 8fda0cdda1 |
| s04 | 9.75 | 26 | 027c8aba39 |
| s05 | 6.475 | 15 | da014f9d56 |
| s06 | 10.1875 | 24 | b1cb8653ab |
| s07 | 11.125 | 17 | 65fe57c5f4 |
| s08 | 8.225 | 13 | 2ef1d966dd |
| s09 | 6.8625 | 19 | 41c7feee71 |
| s10 | 8.85 | 17 | f9d13b36ff |
| s11 | 13.9375 | 43 | 8742002674 |
| s12 | 11.7125 | 19 | 824484531a |
| s13 | 8.275 | 25 | 9770318632 |
| s14 | 7.4125 | 22 | 7e9aca5421 |
| s15 | 11.7375 | 27 | 35858caf93 |
| s16 | 5.7 | 8 | 26d4224758 |
| s17 | 13.1625 | 34 | 08cc6dc465 |
| s18 | 12.65 | 36 | 3006785cd2 |
| s19 | 13.1875 | 32 | 7e70f1d0a7 |
| s20 | 4 | 11 | 04cf795e84 |
| s21 | 7.5375 | 16 | b7013bb22a |
| s22 | 9.3875 | 14 | 838148bd7e |
| s23 | 7.725 | 8 | 854efc7688 |
| s24 | 5.7125 | 16 | 382328a79c |
| s25 | 16.8875 | 28 | 0ce73363b7 |
| s26 | 11.1875 | 23 | 8609f63904 |
| s27 | 13.9875 | 44 | 0062f1541a |
| s28 | 6.0875 | 18 | 5dba0ba5e6 |
| s29 | 5.6125 | 16 | ff6953f591 |
| s30 | 3.675 | 13 | 6a9ad538bc |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 1d2fe6d6d1: music -20.7 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 15.7s | -11 dB | -37.9 dB |
| evidence | undertow/texture | 15.7s | 257.5s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 257.5s | 274.2s | -11 dB | -38.2 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script f489e4a980, storyboard 27e5fa4407, narration ed7e1a58ef, config 793ff38485, music 1d2fe6d6d1.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 274.218s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 8226 frames, timeline 8226 |
| duration in range | ok | 274.22s in [273.2,275.2] |
| duration matches timeline | ok | 274.218s vs 274.200s (8226 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.018s apart |
| no clipping | ok | peak -1.4 dB, mean -19.3 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 30 sentences fit their slots |
| scene order | ok | sc01 to sc25 (25) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 25 scenes |
| every script sentence narrated | ok | 30 sentences in script order |
| sentences in script order | ok | 30 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script f489e4a980, storyboard 27e5fa4407 (locked) |
| citations present | ok | 24 on-screen citations resolved |
| chart data matches storyboard | ok | 9 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 6 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T18:07:23.017Z |
| mix is of this cue sheet | ok | mix 1d2fe6d6d1, cue sheet 1d2fe6d6d1 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 25 scenes, 30 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 274.20s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 53 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
