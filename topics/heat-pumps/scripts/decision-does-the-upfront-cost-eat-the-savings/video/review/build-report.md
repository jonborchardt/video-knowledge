# Build report: What a Heat Pump Really Costs to Install, and What Help Is Left

heat-pumps / decision:does-the-upfront-cost-eat-the-savings, 2026-10-21T19:40:24.895Z. `npm run video -- qa heat-pumps decision:does-the-upfront-cost-eat-the-savings`

**Segment.** 30 of 30 storyboard scenes (sc01 to sc30), 37 sentences. Kinds: sc01 title, sc02 question, sc03 question, sc04 quote, sc05 quote, sc06 list, sc07 stat-tiles, sc08 transition, sc09 stat-tiles, sc10 stat-tiles, sc11 excerpt, sc12 excerpt, sc13 stat-tiles, sc14 stat-tiles, sc15 excerpt, sc16 stat-tiles, sc17 list, sc18 question, sc19 quote, sc20 stat-tiles, sc21 excerpt, sc22 quote, sc23 excerpt, sc24 quote, sc25 excerpt, sc26 stat-tiles, sc27 stat-tiles, sc28 excerpt, sc29 list, sc30 list.

**Output.** topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/video/segment.mp4: 390.25s, 1920x1080 @ 30 fps, h264 + aac, 11707 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 376.9s of speech at about 158 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.048 | 30 | e581575643 |
| s02 | 4.08 | 13 | c8913cae06 |
| s03 | 5.856 | 22 | 2faa2c211f |
| s04 | 9.096 | 30 | 7c1da2df7e |
| s05 | 9.384 | 23 | f717360a4a |
| s06 | 6.696 | 24 | 7564b33922 |
| s07 | 13.392 | 31 | ae5f0fe32c |
| s08 | 10.776 | 29 | e93857ae2f |
| s09 | 2.088 | 5 | 7581b272a8 |
| s10 | 11.88 | 27 | c55780d1ca |
| s11 | 14.976 | 45 | 8ede6edc9b |
| s12 | 14.136 | 40 | 59779f637b |
| s13 | 15.024 | 42 | 638d455136 |
| s14 | 10.896 | 28 | f4a7622ca8 |
| s15 | 9.84 | 21 | afe1211cef |
| s16 | 8.568 | 19 | 2730af24dd |
| s17 | 14.088 | 39 | 4ccd2473a8 |
| s18 | 9.408 | 23 | 58ad6cea20 |
| s19 | 11.472 | 21 | dbe2566973 |
| s20 | 11.376 | 30 | b428da61f4 |
| s21 | 12 | 43 | d3e1b3b817 |
| s22 | 6.144 | 17 | 18b1d8d5d5 |
| s23 | 9.888 | 26 | 4a205bd7f5 |
| s24 | 9.168 | 22 | 9126429cc4 |
| s25 | 12.408 | 32 | fa51da61b5 |
| s26 | 8.424 | 21 | abe12bfe17 |
| s27 | 8.064 | 18 | aad1447e6f |
| s28 | 12.096 | 26 | 2f4c620092 |
| s29 | 8.04 | 22 | f2aac6d9e0 |
| s30 | 12.912 | 28 | 0aaa6226c2 |
| s31 | 7.416 | 16 | cc2e6bfede |
| s32 | 16.512 | 31 | fb76c3b7f6 |
| s33 | 14.4 | 28 | 748e070dfe |
| s34 | 7.32 | 20 | cb65204c53 |
| s35 | 13.08 | 35 | d6cc055bf5 |
| s36 | 7.44 | 21 | 3de3c3c6a5 |
| s37 | 9.504 | 29 | c5f950a049 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix f5533e3df3: music -20.8 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 20.6s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 20.6s | 371.9s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 371.9s | 390.2s | -11 dB | -38.0 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 2a40a4627c, storyboard b8b42f19cb, narration 75f7a7cbaa, config e56775d378, music f5533e3df3.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 390.250s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 11707 frames, timeline 11707 |
| duration in range | ok | 390.25s in [389.2,391.2] |
| duration matches timeline | ok | 390.250s vs 390.233s (11707 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.017s apart |
| no clipping | ok | peak -1.2 dB, mean -19.3 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 37 sentences fit their slots |
| scene order | ok | sc01 to sc30 (30) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 30 scenes |
| every script sentence narrated | ok | 37 sentences in script order |
| sentences in script order | ok | 37 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 2a40a4627c, storyboard b8b42f19cb (locked) |
| citations present | ok | 26 on-screen citations resolved |
| chart data matches storyboard | ok | 9 charts |
| excerpts resolve | ok | 7 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-21T19:39:06.785Z |
| mix is of this cue sheet | ok | mix f5533e3df3, cue sheet f5533e3df3 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 30 scenes, 37 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 390.23s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 64 in video/frames/; contact sheet topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
