# Build report: Is AI-Written Code Harder to Maintain?

ai-coding / decision:quality-and-understanding, 2026-10-22T07:32:07.210Z. `npm run video -- final ai-coding decision:quality-and-understanding --approved-by Jon`

**Segment.** 28 of 28 storyboard scenes (sc01 to sc28), 33 sentences. Kinds: sc01 question, sc02 title, sc03 excerpt, sc04 quote, sc05 question, sc06 excerpt, sc07 title, sc08 excerpt, sc09 excerpt, sc10 quote, sc11 question, sc12 list, sc13 stat-tiles, sc14 title, sc15 excerpt, sc16 excerpt, sc17 stat-tiles, sc18 stat-tiles, sc19 excerpt, sc20 title, sc21 title, sc22 stat-tiles, sc23 stat-tiles, sc24 title, sc25 title, sc26 title, sc27 quote, sc28 list.

**Output.** topics/ai-coding/scripts/decision-quality-and-understanding/video/segment.mp4: 295.15s, 1920x1080 @ 30 fps, h264 + aac, 8854 frames, rendered in 1251.1s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 285.14s of speech at about 167 wpm, $0.0683 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 5.325 | 19 | 033e8fad94 |
| s02 | 8.425 | 20 | e1d349e934 |
| s03 | 11.675 | 31 | f87cab6289 |
| s04 | 11.9875 | 24 | eb50621493 |
| s05 | 4.8625 | 17 | d6e970bdf8 |
| s06 | 5.7125 | 14 | 01724685a2 |
| s07 | 9.125 | 27 | 00141730a5 |
| s08 | 8.15 | 20 | d4630ed237 |
| s09 | 9.6625 | 26 | a6bd5ff40f |
| s10 | 7.5125 | 23 | 2e70207be5 |
| s11 | 2.3 | 9 | 16fd7a74a4 |
| s12 | 11.65 | 27 | 2da5e1a4c9 |
| s13 | 5.8 | 17 | 5b4be39f99 |
| s14 | 8 | 19 | fadfd8a785 |
| s15 | 5.1625 | 16 | 784f1bef1d |
| s16 | 10.05 | 32 | b8bd9230c3 |
| s17 | 11.5875 | 28 | cc4ec42ae5 |
| s18 | 9.575 | 28 | 52ab7cbb6c |
| s30 | 11.55 | 23 | 3bc759b049 |
| s31 | 8.0875 | 27 | 8132c4aaba |
| s19 | 8.95 | 27 | 08d01db2fe |
| s20 | 9.175 | 23 | dcc8b4c865 |
| s21 | 5.1375 | 19 | 0e6f8e5278 |
| s32 | 12 | 35 | 1a99857845 |
| s33 | 7.925 | 22 | 165fa678ec |
| s22 | 11.2125 | 25 | eeffa2bd64 |
| s23 | 7.425 | 24 | 7099c569b5 |
| s24 | 14.6 | 41 | ba8ee0bd4a |
| s25 | 7.7875 | 19 | 59d93e4cc1 |
| s26 | 14.2 | 47 | 76cb984691 |
| s27 | 8.55 | 28 | deca801e2c |
| s28 | 9 | 28 | d2410e678c |
| s29 | 2.975 | 8 | 9983e925b8 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 545d941aca: music -19.9 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 14.9s | -11 dB | -38.0 dB |
| setup | undertow/active | 14.9s | 39.1s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 39.1s | 235.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 235.2s | 295.1s | -11 dB | -37.0 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 577b3309e7, storyboard 1b019b912d, narration 6333a288cd, config 988a67486a, music 545d941aca.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 295.146s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 8854 frames, timeline 8854 |
| duration in range | ok | 295.15s in [294.1,296.1] |
| duration matches timeline | ok | 295.146s vs 295.133s (8854 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.4 dB, mean -19.4 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 33 sentences fit their slots |
| scene order | ok | sc01 to sc28 (28) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 28 scenes |
| every script sentence narrated | ok | 33 sentences in script order |
| sentences in script order | ok | 33 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 577b3309e7, storyboard 1b019b912d (locked) |
| citations present | ok | 23 on-screen citations resolved |
| chart data matches storyboard | ok | 5 charts |
| excerpts resolve | ok | 7 excerpts with their highlights |
| assets and kinds supported | ok | 6 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-22T07:30:54.825Z |
| mix is of this cue sheet | ok | mix 545d941aca, cue sheet 545d941aca |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.9 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 28 scenes, 33 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 295.13s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 60 in video/frames/; contact sheet topics/ai-coding/scripts/decision-quality-and-understanding/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
