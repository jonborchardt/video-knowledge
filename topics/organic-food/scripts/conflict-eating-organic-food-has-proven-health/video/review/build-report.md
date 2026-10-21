# Build report: Does Eating Organic Make You Healthier?

organic-food / conflict:eating-organic-food-has-proven-health, 2026-10-21T07:27:27.052Z. `npm run video -- qa organic-food conflict:eating-organic-food-has-proven-health`

**Segment.** 31 of 31 storyboard scenes (sc01 to sc31), 35 sentences. Kinds: sc01 list, sc02 question, sc03 question, sc04 quote, sc05 quote, sc06 quote, sc07 excerpt, sc08 excerpt, sc09 excerpt, sc10 question, sc11 excerpt, sc12 bar, sc13 excerpt, sc14 excerpt, sc15 title, sc16 excerpt, sc17 question, sc18 quote, sc19 quote, sc20 stat-tiles, sc21 excerpt, sc22 excerpt, sc23 excerpt, sc24 list, sc25 question, sc26 excerpt, sc27 excerpt, sc28 excerpt, sc29 list, sc30 question, sc31 list.

**Output.** topics/organic-food/scripts/conflict-eating-organic-food-has-proven-health/video/segment.mp4: 322.41s, 1920x1080 @ 30 fps, h264 + aac, 9672 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 311.5s of speech at about 162 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.672 | 19 | 345a949eb7 |
| s02 | 3.72 | 9 | 88d88f3efe |
| s03 | 3.192 | 12 | 39d88e955d |
| s04 | 5.544 | 15 | e8b6be0591 |
| s05 | 5.688 | 17 | 5d244f209c |
| s06 | 6.912 | 15 | 823d1c5ff1 |
| s07 | 7.368 | 16 | 0b95f0259f |
| s08 | 13.824 | 30 | bf1dff1f54 |
| s09 | 8.568 | 26 | 8fac52d4ef |
| s10 | 11.856 | 31 | 4575b67672 |
| s11 | 13.872 | 39 | 7eec4c82b8 |
| s12 | 5.4 | 13 | 09a7c10487 |
| s13 | 7.968 | 19 | d9074dc650 |
| s14 | 13.296 | 29 | c6589aca72 |
| s15 | 9.216 | 21 | 4cac65e380 |
| s16 | 9.96 | 26 | 121baea39a |
| s17 | 5.04 | 16 | 671aa83a9e |
| s18 | 15.456 | 45 | 71f28cf2d4 |
| s19 | 5.544 | 18 | e563b234b4 |
| s20 | 7.608 | 19 | 23d079b22f |
| s21 | 11.28 | 31 | 1c89b60b96 |
| s22 | 17.088 | 39 | bd3ceb4d58 |
| s23 | 5.952 | 16 | 77abd923ed |
| s24 | 7.464 | 19 | 6d13bcbb55 |
| s25 | 5.472 | 14 | 9a64055e07 |
| s26 | 9.696 | 31 | 1e9643dcde |
| s27 | 9.048 | 21 | a4eff00e3a |
| s28 | 5.28 | 14 | 297a170510 |
| s29 | 1.872 | 5 | f89fb7e428 |
| s30 | 14.28 | 39 | 802f40f745 |
| s31 | 13.464 | 36 | 71df7467f8 |
| s32 | 15.624 | 49 | e8d66bedbf |
| s33 | 12.48 | 34 | 6007728c16 |
| s34 | 10.656 | 37 | c81eae79d4 |
| s35 | 5.136 | 18 | 7b1ad945a1 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix c9512eb433: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 21.6s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 21.6s | 305.1s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 305.1s | 322.4s | -11 dB | -38.1 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 65e3c41d95, storyboard 022fd98339, narration 4d8e3cd806, config e24e2e5ca2, music c9512eb433.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 322.410s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 9672 frames, timeline 9672 |
| duration in range | ok | 322.41s in [321.4,323.4] |
| duration matches timeline | ok | 322.410s vs 322.400s (9672 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.010s apart |
| no clipping | ok | peak -1.3 dB, mean -19.3 dB |
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
| soundtrack mixed | ok | 3 cues, 2026-10-21T07:26:13.661Z |
| mix is of this cue sheet | ok | mix c9512eb433, cue sheet c9512eb433 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 31 scenes, 35 sentences |
| cues inside their sentences | ok | 6 cues |
| final scene complete | ok | ends 322.40s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 69 in video/frames/; contact sheet topics/organic-food/scripts/conflict-eating-organic-food-has-proven-health/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
