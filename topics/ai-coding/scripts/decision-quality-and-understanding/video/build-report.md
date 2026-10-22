# Build report: Is AI-Written Code Harder to Maintain?

ai-coding / decision:quality-and-understanding, 2026-10-22T01:28:52.556Z. `npm run video -- qa ai-coding decision:quality-and-understanding`

**Segment.** 28 of 28 storyboard scenes (sc01 to sc28), 33 sentences. Kinds: sc01 question, sc02 title, sc03 excerpt, sc04 quote, sc05 question, sc06 excerpt, sc07 title, sc08 excerpt, sc09 excerpt, sc10 quote, sc11 question, sc12 list, sc13 stat-tiles, sc14 title, sc15 excerpt, sc16 excerpt, sc17 stat-tiles, sc18 stat-tiles, sc19 excerpt, sc20 title, sc21 title, sc22 stat-tiles, sc23 stat-tiles, sc24 title, sc25 title, sc26 title, sc27 quote, sc28 list.

**Output.** topics/ai-coding/scripts/decision-quality-and-understanding/video/segment.mp4: 299.01s, 1920x1080 @ 30 fps, h264 + aac, 8970 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 288.96s of speech at about 165 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 5.544 | 19 | 111b11b78c |
| s02 | 8.592 | 20 | ce4dcf2fc9 |
| s03 | 12.24 | 31 | 5e43274972 |
| s04 | 12.048 | 24 | b0a075ff86 |
| s05 | 5.04 | 17 | 0fcdb6a016 |
| s06 | 5.832 | 14 | 34e51cb3c7 |
| s07 | 8.952 | 27 | 338c5960f6 |
| s08 | 8.328 | 20 | 0ea7307383 |
| s09 | 9.792 | 26 | d2d6b89dc7 |
| s10 | 7.368 | 23 | efd488f585 |
| s11 | 2.256 | 9 | 9321a98c8a |
| s12 | 11.832 | 27 | 6fa72ad09e |
| s13 | 5.64 | 17 | 9d34d44a73 |
| s14 | 8.352 | 19 | 04ff005a40 |
| s15 | 4.992 | 16 | 187e7d309d |
| s16 | 10.032 | 32 | 2a7c24b06d |
| s17 | 11.688 | 28 | 9b04a02bd6 |
| s18 | 9.816 | 28 | f4f39575e2 |
| s30 | 12 | 23 | f450af1254 |
| s31 | 7.824 | 27 | 4be0f23cfc |
| s19 | 9.312 | 27 | 88d1a55cf4 |
| s20 | 9.456 | 23 | 9b2dc522dc |
| s21 | 5.496 | 19 | 47b96226da |
| s32 | 12.408 | 35 | 001dac6e96 |
| s33 | 8.256 | 22 | c96d3eac44 |
| s22 | 11.136 | 25 | 50abfe0aff |
| s23 | 7.632 | 24 | 7d6f8e1789 |
| s24 | 13.944 | 41 | 7bcf99a3af |
| s25 | 7.632 | 19 | f1dc10b131 |
| s26 | 14.496 | 47 | 80ac5a802b |
| s27 | 8.688 | 28 | 6cc0f5879a |
| s28 | 9.24 | 28 | ee17ba13e7 |
| s29 | 3.096 | 8 | 61911a0cce |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix ca8e64dcdd: music -19.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 15.3s | -11 dB | -37.9 dB |
| setup | undertow/active | 15.3s | 40.1s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 40.1s | 239.0s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 239.0s | 299.0s | -11 dB | -37.0 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 577b3309e7, storyboard 1b019b912d, narration f7174c5971, config 988a67486a, music ca8e64dcdd.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 299.008s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 8970 frames, timeline 8970 |
| duration in range | ok | 299.01s in [298.0,300.0] |
| duration matches timeline | ok | 299.008s vs 299.000s (8970 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.008s apart |
| no clipping | ok | peak -1.5 dB, mean -19.4 dB |
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
| soundtrack mixed | ok | 4 cues, 2026-10-22T01:27:48.646Z |
| mix is of this cue sheet | ok | mix ca8e64dcdd, cue sheet ca8e64dcdd |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 28 scenes, 33 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 299.00s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 60 in video/frames/; contact sheet topics/ai-coding/scripts/decision-quality-and-understanding/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
