# Build report: How Much Faster Does AI Actually Make Programmers?

ai-coding / decision:how-much-faster, 2026-10-27T07:30:48.328Z. `npm run video -- spike ai-coding decision:how-much-faster`

**Segment.** 28 of 27 storyboard scenes (sc01 to end), 35 sentences. Kinds: sc01 question, sc02 list, sc03 quote, sc04 quote, sc05 title, sc06 stat-tiles, sc07 stat-tiles, sc08 title, sc09 stat-tiles, sc10 stat-tiles, sc11 stat-tiles, sc12 question, sc13 excerpt, sc14 stat-tiles, sc15 excerpt, sc16 question, sc17 stat-tiles, sc18 list, sc19 transition, sc20 question, sc21 bar, sc22 question, sc23 bar, sc24 title, sc25 excerpt, sc26 title, sc27 list, end close-card.

**Output.** topics/ai-coding/scripts/decision-how-much-faster/video/segment.mp4: 361.58s, 1920x1080 @ 30 fps, h264 + aac, 10847 frames, rendered in 1501.2s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 332.42s of speech at about 154 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 4.32 | 12 | 02a226ef24 |
| s02 | 6.936 | 16 | 0d5dc40782 |
| s03 | 7.824 | 22 | df12989a31 |
| s04 | 12.648 | 34 | 91271d1311 |
| s05 | 13.512 | 37 | 8f0c7425dc |
| s06 | 2.28 | 4 | 27d8425475 |
| s07 | 17.352 | 40 | fc6f817aee |
| s08 | 11.4 | 36 | 34dbe4e8bf |
| s09 | 13.296 | 32 | 834c944626 |
| s10 | 3.048 | 9 | 21d6f09273 |
| s11 | 16.296 | 35 | de97d8528f |
| s12 | 9.12 | 19 | bc36a6951e |
| s13 | 4.416 | 9 | 601b6a049f |
| s14 | 14.784 | 33 | 191b54215e |
| s15 | 1.968 | 6 | c7bde46776 |
| s16 | 10.584 | 25 | e5ce545432 |
| s17 | 13.416 | 32 | 5bb8675e9a |
| s18 | 13.392 | 39 | b5d3365b36 |
| s19 | 1.872 | 6 | c62d9121e0 |
| s20 | 16.968 | 44 | 75a369cf66 |
| s21 | 9.672 | 28 | 17725d0a93 |
| s22 | 9.336 | 25 | f1134cf80c |
| s23 | 13.608 | 31 | 2a7e7470c3 |
| s24 | 6.984 | 18 | a405dd7c6a |
| s25 | 4.368 | 15 | eeeaa99f7c |
| s26 | 7.704 | 16 | 5950a12428 |
| s27 | 9.024 | 26 | a4e8fb8fb9 |
| s28 | 9.816 | 16 | ee9ddbbab0 |
| s29 | 3.432 | 7 | 1e2e12774c |
| s30 | 17.112 | 37 | 6dcb6b68ab |
| s31 | 9.768 | 30 | 810007aba2 |
| s32 | 11.4 | 26 | 8c5d9390e8 |
| s33 | 6.936 | 18 | 2896ec28f5 |
| s34 | 6.672 | 15 | 9de7ff0bae |
| s35 | 11.16 | 37 | 0f881feb10 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 3b29b1bdb2: music -20.7 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 20.5s | -11 dB | -37.4 dB |
| evidence | undertow/texture | 20.5s | 325.9s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 325.9s | 361.6s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final ai-coding decision:how-much-faster --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 2a63e0efe5, storyboard f2a4d88dff, narration 24fe479804, config 12b33c540e, music 3b29b1bdb2.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 361.578s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 10847 frames, timeline 10847 |
| duration in range | ok | 361.58s in [360.6,362.6] |
| duration matches timeline | ok | 361.578s vs 361.567s (10847 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.011s apart |
| no clipping | ok | peak -1.3 dB, mean -19.4 dB |
| no long silence | ok | none >= 3s before the end scene |
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
| assets and kinds supported | ok | 9 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-27T07:29:27.663Z |
| mix is of this cue sheet | ok | mix 3b29b1bdb2, cue sheet 3b29b1bdb2 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 28 scenes, 35 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 361.57s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 62 in video/frames/; contact sheet topics/ai-coding/scripts/decision-how-much-faster/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
