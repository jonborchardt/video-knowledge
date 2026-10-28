# Build report: Does Organic Mean No Pesticides?

organic-food / conflict:organic-farming-uses-pesticides, 2026-10-28T07:56:23.767Z. `npm run video -- spike organic-food conflict:organic-farming-uses-pesticides`

**Segment.** 27 of 26 storyboard scenes (sc01 to end), 32 sentences. Kinds: sc01 quote, sc02 question, sc03 quote, sc04 excerpt, sc05 excerpt, sc06 title, sc07 quote, sc08 columns, sc09 stat-tiles, sc10 list, sc11 excerpt, sc12 excerpt, sc13 title, sc14 question, sc15 quote, sc16 question, sc17 bar, sc18 stat-tiles, sc19 bar, sc20 question, sc21 quote, sc22 stat-tiles, sc23 title, sc24 list, sc25 transition, sc26 question, end close-card.

**Output.** topics/organic-food/scripts/conflict-organic-farming-uses-pesticides/video/segment.mp4: 343.74s, 1920x1080 @ 30 fps, h264 + aac, 10312 frames, rendered in 1440.5s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 315.19s of speech at about 149 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 8.616 | 20 | 131a1a7ac0 |
| s03 | 7.656 | 23 | 730845860c |
| s04 | 6.456 | 15 | 03dea5760a |
| s05 | 3.408 | 11 | 36d4ea3367 |
| s06 | 18.168 | 40 | 84c4eae54f |
| s07 | 17.544 | 42 | 98481a0d7c |
| s08 | 6.336 | 17 | 37a4bffe55 |
| s09 | 7.152 | 13 | 962075b7e5 |
| s10 | 6.72 | 16 | 0d0f9ce922 |
| s11 | 15.336 | 36 | c3f7497ff1 |
| s12 | 11.52 | 26 | 3afbd23f22 |
| s13 | 11.088 | 28 | 8bfc6a3086 |
| s14 | 9.984 | 25 | 191b4ccbcd |
| s15 | 11.64 | 23 | 9f672b0aca |
| s16 | 8.64 | 23 | dd92f9fb53 |
| s17 | 10.8 | 26 | c4f72a5ec9 |
| s18 | 17.28 | 44 | 60385a4d65 |
| s19 | 8.136 | 23 | 15dea815ae |
| s20 | 9.048 | 22 | fc91618fe1 |
| s21 | 3.768 | 8 | 4443f6fe8f |
| s22 | 13.152 | 26 | c4d4eebd74 |
| s23 | 10.248 | 24 | d350549f8e |
| s24 | 15.792 | 37 | 2bdb7c272a |
| s25 | 4.512 | 14 | ce99170fb3 |
| s26 | 7.944 | 17 | dd70b61cd2 |
| s27 | 14.376 | 39 | cf309999dc |
| s28 | 5.904 | 16 | 3bda09e007 |
| s29 | 9.888 | 25 | ddd6c3cbca |
| s30 | 13.368 | 40 | e1cac44927 |
| s31 | 4.2 | 10 | 3a2196154d |
| s32 | 8.472 | 22 | bf52d4af64 |
| s33 | 8.04 | 27 | 98b1596bf8 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 40d117b1f7: music -20.6 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.4s | -11 dB | -37.6 dB |
| evidence | undertow/texture | 18.4s | 305.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 305.2s | 343.7s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final organic-food conflict:organic-farming-uses-pesticides --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 1754c299c9, storyboard 5d61aeac98, narration c015f662c8, config afc3663142, look e2660f156f, music 40d117b1f7.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 343.744s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 10312 frames, timeline 10312 |
| duration in range | ok | 343.74s in [342.7,344.7] |
| duration matches timeline | ok | 343.744s vs 343.733s (10312 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.011s apart |
| no clipping | ok | peak -1.3 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 32 sentences fit their slots |
| scene order | ok | sc01 to sc26 (26) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 26 scenes |
| every script sentence narrated | ok | 32 sentences in script order |
| sentences in script order | ok | 32 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 1754c299c9, storyboard 5d61aeac98 (locked) |
| citations present | ok | 24 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 4 excerpts with their highlights |
| assets and kinds supported | ok | 10 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-28T07:55:05.732Z |
| mix is of this cue sheet | ok | mix 40d117b1f7, cue sheet 40d117b1f7 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 27 scenes, 32 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 343.73s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 60 in video/frames/; contact sheet topics/organic-food/scripts/conflict-organic-farming-uses-pesticides/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
