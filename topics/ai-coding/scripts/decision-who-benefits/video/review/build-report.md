# Build report: Does AI Help Junior or Senior Developers More?

ai-coding / decision:who-benefits, 2026-10-22T06:30:14.534Z. `npm run video -- final ai-coding decision:who-benefits --approved-by automated: final run started by Jon (release package preview)`

**Segment.** 27 of 27 storyboard scenes (sc01 to sc27), 38 sentences. Kinds: sc01 title, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 question, sc07 stat-tiles, sc08 excerpt, sc09 list, sc10 list, sc11 stat-tiles, sc12 excerpt, sc13 quote, sc14 list, sc15 question, sc16 stat-tiles, sc17 list, sc18 excerpt, sc19 list, sc20 question, sc21 stat-tiles, sc22 bar, sc23 quote, sc24 stat-tiles, sc25 list, sc26 quote, sc27 list.

**Output.** topics/ai-coding/scripts/decision-who-benefits/video/segment.mp4: 423.38s, 1920x1080 @ 30 fps, h264 + aac, 12701 frames, rendered in 1793.3s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 413.39s of speech at about 165 wpm, $0.1013 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.1 | 24 | 091bf07dfb |
| s02 | 1.82 | 8 | f62f4f5d1d |
| s03 | 6.2625 | 20 | e5c571bc8a |
| s04 | 10.825 | 32 | a86183fb7d |
| s05 | 8.225 | 28 | 9a8adec074 |
| s06 | 14.1375 | 43 | b9a44b85cd |
| s07 | 12.425 | 26 | 4338197b64 |
| s08 | 9.2375 | 23 | 97ab5676b0 |
| s09 | 13.5875 | 37 | 942e6fbf26 |
| s10 | 10.325 | 28 | 4b5ec4f0f2 |
| s11 | 11.8875 | 30 | 8e6dcc33ba |
| s12 | 13.8375 | 36 | 16e4e1bd39 |
| s13 | 9.375 | 24 | f0acb28ab1 |
| s14 | 9.4375 | 24 | 8b091a1b02 |
| s15 | 18.275 | 48 | 6bcbec0c01 |
| s16 | 9.025 | 30 | 8f5e542969 |
| s17 | 11.575 | 30 | c0df00a7bf |
| s18 | 6.5875 | 19 | 278da3335c |
| s19 | 7.1625 | 24 | 67fdba09c5 |
| s20 | 11.0875 | 27 | 47bd121432 |
| s21 | 13.0875 | 30 | 7f7500c848 |
| s22 | 22.5 | 60 | c2e8620314 |
| s23 | 15.4375 | 45 | 1ba1e68774 |
| s24 | 19.2 | 47 | c84bd8ea3e |
| s25 | 12.5875 | 37 | 5a5b9ef1ae |
| s26 | 4.6125 | 19 | fceb99b112 |
| s27 | 9.375 | 24 | df30d2d990 |
| s28 | 10.4125 | 25 | 34181c66e9 |
| s29 | 11.2375 | 28 | 7199b1292c |
| s30 | 10.025 | 28 | dd8613de8e |
| s31 | 10.775 | 33 | 90cc33fd39 |
| s32 | 15.7625 | 38 | cd715da2fb |
| s33 | 13.45 | 32 | 381dd63392 |
| s34 | 7.7625 | 20 | 0ddcfdb7d7 |
| s35 | 14.4 | 33 | 1330635ab7 |
| s36 | 3.3375 | 10 | 5fe4fe8610 |
| s37 | 7.3 | 26 | 33e68a6261 |
| s38 | 7.9375 | 33 | 5d8cc1a502 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix ea68ac145d: music -20.9 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.3s | -11 dB | -37.6 dB |
| evidence | undertow/texture | 18.3s | 406.8s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 406.8s | 423.4s | -11 dB | -38.2 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 69c62d9c0e, storyboard 8464572385, narration be3a4aac31, config 97689a8a89, music ea68ac145d.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 423.381s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 12701 frames, timeline 12701 |
| duration in range | ok | 423.38s in [422.4,424.4] |
| duration matches timeline | ok | 423.381s vs 423.367s (12701 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.014s apart |
| no clipping | ok | peak -1.4 dB, mean -19.2 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 38 sentences fit their slots |
| scene order | ok | sc01 to sc27 (27) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 27 scenes |
| every script sentence narrated | ok | 38 sentences in script order |
| sentences in script order | ok | 38 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 69c62d9c0e, storyboard 8464572385 (locked) |
| citations present | ok | 24 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 3 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T06:28:48.333Z |
| mix is of this cue sheet | ok | mix ea68ac145d, cue sheet ea68ac145d |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.9 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 27 scenes, 38 sentences |
| cues inside their sentences | ok | 4 cues |
| final scene complete | ok | ends 423.37s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 59 in video/frames/; contact sheet topics/ai-coding/scripts/decision-who-benefits/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
