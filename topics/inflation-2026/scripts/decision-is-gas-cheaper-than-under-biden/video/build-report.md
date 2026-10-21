# Build report: Is Gas Cheaper Now Than Under Biden?

inflation-2026 / decision:is-gas-cheaper-than-under-biden, 2026-10-21T06:41:02.014Z. `npm run video -- qa inflation-2026 decision:is-gas-cheaper-than-under-biden`

**Segment.** 25 of 25 storyboard scenes (sc01 to sc25), 30 sentences. Kinds: sc01 stat-tiles, sc02 stat-tiles, sc03 question, sc04 quote, sc05 quote, sc06 stat-tiles, sc07 stat-tiles, sc08 stat-tiles, sc09 quote, sc10 stat-tiles, sc11 title, sc12 quote, sc13 stat-tiles, sc14 stat-tiles, sc15 quote, sc16 list, sc17 question, sc18 quote, sc19 list, sc20 title, sc21 list, sc22 bar, sc23 list, sc24 title, sc25 list.

**Output.** topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/segment.mp4: 276.74s, 1920x1080 @ 30 fps, h264 + aac, 8302 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 267.65s of speech at about 148 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.488 | 16 | f29608746c |
| s02 | 2.424 | 7 | 25b951454b |
| s03 | 4.44 | 16 | 2dc94651fe |
| s04 | 9.528 | 26 | d9d8c60527 |
| s05 | 6.696 | 15 | 1ebfe96b7a |
| s06 | 10.488 | 24 | fe6a42d0e9 |
| s07 | 11.328 | 17 | 16feebb74a |
| s08 | 8.592 | 13 | 48e369650c |
| s09 | 6.768 | 19 | a3dfd6ab14 |
| s10 | 8.688 | 17 | e45fba2eaa |
| s11 | 14.424 | 43 | 1961fd0bb0 |
| s12 | 11.64 | 19 | b65c853c13 |
| s13 | 8.064 | 25 | 45df9b7aba |
| s14 | 7.392 | 22 | 75390fef99 |
| s15 | 11.928 | 27 | b719903378 |
| s16 | 5.376 | 8 | d427e027fe |
| s17 | 12.84 | 34 | 82b85c9169 |
| s18 | 12.912 | 36 | 4e5988183d |
| s19 | 13.368 | 32 | 89874259de |
| s20 | 4.056 | 11 | 6fb8eb4b8a |
| s21 | 7.848 | 16 | ea06872b95 |
| s22 | 9.816 | 14 | f2dd6a925b |
| s23 | 7.512 | 8 | bdd1479cba |
| s24 | 5.256 | 16 | 7a2dbf0043 |
| s25 | 16.536 | 28 | debda12692 |
| s26 | 11.664 | 23 | 42e857328e |
| s27 | 14.736 | 44 | 15864985e3 |
| s28 | 6.312 | 18 | 59829e8b57 |
| s29 | 5.736 | 16 | cc4ef5076d |
| s30 | 3.792 | 13 | 9c17450b41 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 3c1debc4ef: music -20.7 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 16.0s | -11 dB | -37.8 dB |
| evidence | undertow/texture | 16.0s | 259.5s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 259.5s | 276.7s | -11 dB | -38.1 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script f489e4a980, storyboard 27e5fa4407, narration 0258d6c8c5, config 793ff38485, music 3c1debc4ef.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 276.736s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 8302 frames, timeline 8302 |
| duration in range | ok | 276.74s in [275.7,277.7] |
| duration matches timeline | ok | 276.736s vs 276.733s (8302 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -1.4 dB, mean -19.4 dB |
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
| soundtrack mixed | ok | 3 cues, 2026-10-21T06:40:02.702Z |
| mix is of this cue sheet | ok | mix 3c1debc4ef, cue sheet 3c1debc4ef |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 25 scenes, 30 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 276.73s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 53 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
