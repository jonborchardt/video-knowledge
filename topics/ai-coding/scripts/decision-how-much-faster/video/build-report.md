# Build report: How Much Faster Does AI Actually Make Programmers?

ai-coding / decision:how-much-faster, 2026-10-22T07:09:19.148Z. `npm run video -- final ai-coding decision:how-much-faster --approved-by Jon`

**Segment.** 27 of 27 storyboard scenes (sc01 to sc27), 35 sentences. Kinds: sc01 question, sc02 list, sc03 quote, sc04 quote, sc05 title, sc06 stat-tiles, sc07 stat-tiles, sc08 title, sc09 stat-tiles, sc10 stat-tiles, sc11 stat-tiles, sc12 question, sc13 excerpt, sc14 stat-tiles, sc15 excerpt, sc16 question, sc17 stat-tiles, sc18 list, sc19 transition, sc20 question, sc21 bar, sc22 question, sc23 bar, sc24 title, sc25 excerpt, sc26 title, sc27 list.

**Output.** topics/ai-coding/scripts/decision-how-much-faster/video/segment.mp4: 342.51s, 1920x1080 @ 30 fps, h264 + aac, 10275 frames, rendered in 1477.6s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 329.51s of speech at about 155 wpm, $0.075 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 4.175 | 12 | 6a30002cf5 |
| s02 | 7 | 16 | 057a27b19d |
| s03 | 7.8 | 22 | f63801aaa1 |
| s04 | 12.7625 | 34 | 445888faa8 |
| s05 | 13.325 | 37 | 1ba282e575 |
| s06 | 2.175 | 4 | 293884e6eb |
| s07 | 17.0875 | 40 | 2a58873118 |
| s08 | 11.3 | 36 | 339fc462a8 |
| s09 | 13.775 | 32 | deb2381b9f |
| s10 | 3.35 | 9 | 85efac0956 |
| s11 | 16.025 | 35 | 6edecce6cc |
| s12 | 8.9875 | 19 | cba4ab9c90 |
| s13 | 4.525 | 9 | 197fa12511 |
| s14 | 14.825 | 33 | 0f856c1069 |
| s15 | 1.925 | 6 | b67046302a |
| s16 | 10.4875 | 25 | 7d3ebde0c7 |
| s17 | 13.3125 | 32 | 53e1cc17e8 |
| s18 | 13.4375 | 39 | c94a25574b |
| s19 | 1.82 | 6 | b4b8bad873 |
| s20 | 16.475 | 44 | f78aae5d33 |
| s21 | 9.1375 | 28 | baf3f88d0e |
| s22 | 8.975 | 25 | e33ed0b516 |
| s23 | 13.2625 | 31 | 2471a3072e |
| s24 | 6.625 | 18 | 11ff6d4857 |
| s25 | 4.4125 | 15 | af73bc84de |
| s26 | 7.6625 | 16 | 11f1d66afb |
| s27 | 9.15 | 26 | 47c95d29c0 |
| s28 | 9.2625 | 16 | f41633c794 |
| s29 | 3.3 | 7 | c2b5100f89 |
| s30 | 16.675 | 37 | 608ca1d7cb |
| s31 | 10.225 | 30 | 23ff474f48 |
| s32 | 11.4875 | 26 | 5fadd1f987 |
| s33 | 6.6375 | 18 | 98370cc1b3 |
| s34 | 7.2125 | 15 | 90eb76df90 |
| s35 | 10.9125 | 37 | fbc382b32b |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix c1b0c410a4: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 20.4s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 20.4s | 322.5s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 322.5s | 342.5s | -11 dB | -37.8 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 2a63e0efe5, storyboard f2a4d88dff, narration 8877000f7f, config 12b33c540e, music c1b0c410a4.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 342.506s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 10275 frames, timeline 10275 |
| duration in range | ok | 342.51s in [341.5,343.5] |
| duration matches timeline | ok | 342.506s vs 342.500s (10275 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.006s apart |
| no clipping | ok | peak -1.3 dB, mean -19.1 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 35 sentences fit their slots |
| scene order | ok | sc01 to sc27 (27) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 27 scenes |
| every script sentence narrated | ok | 35 sentences in script order |
| sentences in script order | ok | 35 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 2a63e0efe5, storyboard f2a4d88dff (locked) |
| citations present | ok | 20 on-screen citations resolved |
| chart data matches storyboard | ok | 9 charts |
| excerpts resolve | ok | 3 excerpts with their highlights |
| assets and kinds supported | ok | 8 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T07:08:02.960Z |
| mix is of this cue sheet | ok | mix c1b0c410a4, cue sheet c1b0c410a4 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 27 scenes, 35 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 342.50s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 60 in video/frames/; contact sheet topics/ai-coding/scripts/decision-how-much-faster/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
