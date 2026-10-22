# Build report: Does Eating Organic Make You Healthier?

organic-food / conflict:eating-organic-food-has-proven-health, 2026-10-22T18:43:12.733Z. `npm run video -- final organic-food conflict:eating-organic-food-has-proven-health --approved-by Jon`

**Segment.** 31 of 31 storyboard scenes (sc01 to sc31), 35 sentences. Kinds: sc01 list, sc02 question, sc03 question, sc04 quote, sc05 quote, sc06 quote, sc07 excerpt, sc08 excerpt, sc09 excerpt, sc10 question, sc11 excerpt, sc12 bar, sc13 excerpt, sc14 excerpt, sc15 title, sc16 excerpt, sc17 question, sc18 quote, sc19 quote, sc20 stat-tiles, sc21 excerpt, sc22 excerpt, sc23 excerpt, sc24 list, sc25 question, sc26 excerpt, sc27 excerpt, sc28 excerpt, sc29 list, sc30 question, sc31 list.

**Output.** topics/organic-food/scripts/conflict-eating-organic-food-has-proven-health/video/segment.mp4: 320.21s, 1920x1080 @ 30 fps, h264 + aac, 9606 frames, rendered in 1230.7s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 309.33s of speech at about 163 wpm, $0.0755 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.575 | 19 | d78ecfdbe4 |
| s02 | 3.8375 | 9 | 33850f09d5 |
| s03 | 2.9125 | 12 | 26009ab3a8 |
| s04 | 5.3875 | 15 | d14b70119f |
| s05 | 6 | 17 | 88b553a62e |
| s06 | 6.9875 | 15 | 00ad50091b |
| s07 | 6.9 | 15 | 8a2d421c49 |
| s08 | 13.7125 | 30 | 316cbf00f9 |
| s09 | 8.7 | 26 | 0663cb55cd |
| s10 | 12.425 | 31 | ad169211a0 |
| s11 | 14.125 | 39 | 76c6abc0ac |
| s12 | 5.4875 | 13 | 4559573ac1 |
| s13 | 7.725 | 19 | da883dc7b5 |
| s14 | 13.1875 | 29 | 86d36ae823 |
| s15 | 9.1375 | 21 | 4addcc8789 |
| s16 | 9.5875 | 26 | cad7ca43e6 |
| s17 | 4.9875 | 16 | c25f0463df |
| s18 | 15.5375 | 45 | 4147c419a6 |
| s19 | 5.575 | 18 | d0e3258dd3 |
| s20 | 7.6875 | 19 | 9730f79897 |
| s21 | 11.3625 | 31 | 152d76e826 |
| s22 | 16.8375 | 38 | 6934013836 |
| s23 | 6.075 | 16 | 9ddc730f91 |
| s24 | 7.4875 | 19 | 83801e6720 |
| s25 | 5.5125 | 14 | 64e07b0975 |
| s26 | 9.1875 | 31 | 9d750c78db |
| s27 | 8.7125 | 21 | 8054cfbd52 |
| s28 | 5.275 | 14 | 208a9972e0 |
| s29 | 1.82 | 5 | 469b02cf9b |
| s30 | 13.65 | 38 | ea2e8b003a |
| s31 | 13.4125 | 36 | 4134fd3eda |
| s32 | 15.6375 | 49 | 9dc79b659a |
| s33 | 11.925 | 34 | f7999008a8 |
| s34 | 11.25 | 37 | 5cff341acb |
| s35 | 4.7125 | 18 | 6248465608 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 99e2a66ab2: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 21.2s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 21.2s | 302.7s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 302.7s | 320.2s | -11 dB | -38.1 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 65e3c41d95, storyboard 022fd98339, narration 92f8a3010e, config e24e2e5ca2, music 99e2a66ab2.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 320.213s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 9606 frames, timeline 9606 |
| duration in range | ok | 320.21s in [319.2,321.2] |
| duration matches timeline | ok | 320.213s vs 320.200s (9606 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.5 dB, mean -19.2 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 35 sentences fit their slots |
| scene order | ok | sc01 to sc31 (31) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 31 scenes |
| every script sentence narrated | ok | 35 sentences in script order |
| sentences in script order | ok | 35 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 65e3c41d95, storyboard 022fd98339 (locked) |
| citations present | ok | 28 on-screen citations resolved |
| chart data matches storyboard | ok | 2 charts |
| excerpts resolve | ok | 13 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T18:42:01.031Z |
| mix is of this cue sheet | ok | mix 99e2a66ab2, cue sheet 99e2a66ab2 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 31 scenes, 35 sentences |
| cues inside their sentences | ok | 6 cues |
| final scene complete | ok | ends 320.20s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 69 in video/frames/; contact sheet topics/organic-food/scripts/conflict-eating-organic-food-has-proven-health/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
