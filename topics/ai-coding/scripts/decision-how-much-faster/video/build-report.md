# Build report: How Much Faster Does AI Actually Make Programmers?

ai-coding / decision:how-much-faster, 2026-10-21T09:12:46.659Z. `npm run video -- qa ai-coding decision:how-much-faster`

**Segment.** 27 of 27 storyboard scenes (sc01 to sc27), 35 sentences. Kinds: sc01 question, sc02 list, sc03 quote, sc04 quote, sc05 title, sc06 stat-tiles, sc07 stat-tiles, sc08 title, sc09 stat-tiles, sc10 stat-tiles, sc11 stat-tiles, sc12 question, sc13 excerpt, sc14 stat-tiles, sc15 excerpt, sc16 question, sc17 stat-tiles, sc18 list, sc19 transition, sc20 question, sc21 bar, sc22 question, sc23 bar, sc24 title, sc25 excerpt, sc26 title, sc27 list.

**Output.** topics/ai-coding/scripts/decision-how-much-faster/video/segment.mp4: 345.34s, 1920x1080 @ 30 fps, h264 + aac, 10360 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 332.23s of speech at about 154 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 4.32 | 12 | 6cba575685 |
| s02 | 6.936 | 16 | fe93982dcc |
| s03 | 7.824 | 22 | 0c0b61c74f |
| s04 | 12.648 | 34 | 0512c4cbcc |
| s05 | 13.512 | 37 | 873b413d66 |
| s06 | 2.28 | 4 | 3fa863f9c4 |
| s07 | 17.352 | 40 | 68000f2cae |
| s08 | 11.4 | 36 | 0041f31a97 |
| s09 | 13.296 | 32 | 4e730d63c4 |
| s10 | 3.048 | 9 | 614750ecde |
| s11 | 16.296 | 35 | cd2f82273f |
| s12 | 9.12 | 19 | 7d91990bf6 |
| s13 | 4.416 | 9 | ac2d794a79 |
| s14 | 14.784 | 33 | 5b1344657f |
| s15 | 1.968 | 6 | c10fbe57a5 |
| s16 | 10.584 | 25 | 4538f5b9df |
| s17 | 13.416 | 32 | 0c948abc7d |
| s18 | 13.392 | 39 | 3b784409cc |
| s19 | 1.752 | 6 | d0e4c40d9e |
| s20 | 16.968 | 44 | 74dea1def2 |
| s21 | 9.672 | 28 | 12c158d465 |
| s22 | 9.336 | 25 | 056a0d1bc9 |
| s23 | 13.608 | 31 | 3ad76ea243 |
| s24 | 6.984 | 18 | 325db98579 |
| s25 | 4.368 | 15 | 819dc9e655 |
| s26 | 7.704 | 16 | 4df86da020 |
| s27 | 9.024 | 26 | 310d64a3d9 |
| s28 | 9.816 | 16 | 1d765c4342 |
| s29 | 3.432 | 7 | 984c0b74cb |
| s30 | 17.112 | 37 | da3a4c534c |
| s31 | 9.768 | 30 | 4bbbceb045 |
| s32 | 11.4 | 26 | 9e6cebea41 |
| s33 | 6.864 | 18 | 8e05a6dad2 |
| s34 | 6.672 | 15 | 495db45663 |
| s35 | 11.16 | 37 | 9327e54c8b |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 0ab17b1580: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 20.5s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 20.5s | 325.7s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 325.7s | 345.3s | -11 dB | -37.8 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 2a63e0efe5, storyboard f2a4d88dff, narration 254fdaedad, config 12b33c540e, music 0ab17b1580.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 345.344s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 10360 frames, timeline 10360 |
| duration in range | ok | 345.34s in [344.3,346.3] |
| duration matches timeline | ok | 345.344s vs 345.333s (10360 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.011s apart |
| no clipping | ok | peak -1.3 dB, mean -19.2 dB |
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
| soundtrack mixed | ok | 3 cues, 2026-10-21T09:11:38.210Z |
| mix is of this cue sheet | ok | mix 0ab17b1580, cue sheet 0ab17b1580 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 27 scenes, 35 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 345.33s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 60 in video/frames/; contact sheet topics/ai-coding/scripts/decision-how-much-faster/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
