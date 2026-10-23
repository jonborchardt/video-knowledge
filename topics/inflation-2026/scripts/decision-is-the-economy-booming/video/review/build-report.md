# Build report: Is the Economy Booming, or Just Growing?

inflation-2026 / decision:is-the-economy-booming, 2026-10-22T18:20:48.472Z. `npm run video -- final inflation-2026 decision:is-the-economy-booming --approved-by Jon`

**Segment.** 18 of 18 storyboard scenes (sc01 to sc18), 22 sentences. Kinds: sc01 list, sc02 question, sc03 quote, sc04 quote, sc05 bar, sc06 bar, sc07 stat-tiles, sc08 quote, sc09 stat-tiles, sc10 title, sc11 stat-tiles, sc12 eb-real-pay, sc13 stat-tiles, sc14 quote, sc15 title, sc16 stat-tiles, sc17 list, sc18 question.

**Output.** topics/inflation-2026/scripts/decision-is-the-economy-booming/video/segment.mp4: 179.54s, 1920x1080 @ 30 fps, h264 + aac, 5386 frames, rendered in 680.5s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 168.94s of speech at about 161 wpm, $0.0387 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 10.325 | 29 | 5fe4fb60c5 |
| s02 | 3.2125 | 10 | 68e2e0d202 |
| s03 | 2.7125 | 11 | 9bc88f98cc |
| s04 | 7.35 | 18 | aa70af6f88 |
| s05 | 10.2125 | 32 | d43331d3d4 |
| s06 | 3.7125 | 11 | 8cc3254de6 |
| s07 | 13.3 | 32 | 71510d5adf |
| s08 | 11.225 | 32 | 4bdbf20df2 |
| s09 | 1.82 | 3 | 41f607f921 |
| s10 | 8.1375 | 17 | a313b74253 |
| s11 | 8.1 | 20 | dac506744c |
| s12 | 6.25 | 11 | 1da7ca9fc5 |
| s13 | 7.7 | 20 | 43b0bd98c2 |
| s14 | 3.6 | 9 | de8727e4f0 |
| s15 | 8.025 | 17 | 1a526baf65 |
| s16 | 6.775 | 22 | 827ebec34c |
| s17 | 9.6625 | 18 | d4c9fc8943 |
| s18 | 8.325 | 23 | 5ffd4659e8 |
| s19 | 7.325 | 24 | 41dc211213 |
| s20 | 13.375 | 36 | d0aaf98650 |
| s22 | 10.975 | 26 | b140c957b9 |
| s23 | 6.825 | 21 | 3ee91dde12 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 610a228dfd: music -19.7 dB under the voice while it speaks, peak -1.5 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.2s | -11 dB | -37.6 dB |
| setup | undertow/active | 18.2s | 36.3s | -13 dB | -38.2 dB |
| evidence | undertow/texture | 36.3s | 145.3s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 145.3s | 179.5s | -11 dB | -37.2 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 99e44600cc, storyboard 5d4b22dd4b, narration 2ab2c1e0e5, config e35068e42c, music 610a228dfd.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 179.541s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 5386 frames, timeline 5386 |
| duration in range | ok | 179.54s in [178.5,180.5] |
| duration matches timeline | ok | 179.541s vs 179.533s (5386 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.008s apart |
| no clipping | ok | peak -1.6 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 22 sentences fit their slots |
| scene order | ok | sc01 to sc18 (18) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 18 scenes |
| every script sentence narrated | ok | 22 sentences in script order |
| sentences in script order | ok | 22 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 99e44600cc, storyboard 5d4b22dd4b (locked) |
| citations present | ok | 23 on-screen citations resolved |
| chart data matches storyboard | ok | 7 charts |
| excerpts resolve | ok | 1 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-22T18:20:07.304Z |
| mix is of this cue sheet | ok | mix 610a228dfd, cue sheet 610a228dfd |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.5 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 18 scenes, 22 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 179.53s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 40 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-is-the-economy-booming/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
