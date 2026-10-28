# Build report: Is Gas Cheaper Now Than Under Biden?

inflation-2026 / decision:is-gas-cheaper-than-under-biden, 2026-10-28T05:46:00.122Z. `npm run video -- spike inflation-2026 decision:is-gas-cheaper-than-under-biden`

**Segment.** 26 of 25 storyboard scenes (sc01 to end), 30 sentences. Kinds: sc01 stat-tiles, sc02 stat-tiles, sc03 question, sc04 quote, sc05 quote, sc06 stat-tiles, sc07 stat-tiles, sc08 stat-tiles, sc09 quote, sc10 stat-tiles, sc11 title, sc12 quote, sc13 stat-tiles, sc14 stat-tiles, sc15 quote, sc16 list, sc17 question, sc18 quote, sc19 list, sc20 title, sc21 list, sc22 bar, sc23 list, sc24 title, sc25 list, end close-card.

**Output.** topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/segment.mp4: 292.74s, 1920x1080 @ 30 fps, h264 + aac, 8782 frames, rendered in 1278.1s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 267.65s of speech at about 148 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.488 | 16 | 8dd6a3f746 |
| s02 | 2.424 | 7 | 2c916ee67f |
| s03 | 4.44 | 16 | 46337bd96b |
| s04 | 9.528 | 26 | a6fde619f2 |
| s05 | 6.696 | 15 | 827e4fae8a |
| s06 | 10.488 | 24 | 7c50919614 |
| s07 | 11.328 | 17 | 5fc4b3d3d6 |
| s08 | 8.592 | 13 | 858144fb96 |
| s09 | 6.768 | 19 | 8b60095b79 |
| s10 | 8.688 | 17 | 7b4ca84d40 |
| s11 | 14.424 | 43 | 880bc37354 |
| s12 | 11.64 | 19 | 693b4ac404 |
| s13 | 8.064 | 25 | d464654f2f |
| s14 | 7.392 | 22 | eb07d924e9 |
| s15 | 11.928 | 27 | 1a1402f31f |
| s16 | 5.376 | 8 | 7f1fb5e4eb |
| s17 | 12.84 | 34 | 4df8b557b5 |
| s18 | 12.912 | 36 | a71363c068 |
| s19 | 13.368 | 32 | 7b805967cb |
| s20 | 4.056 | 11 | fd7aff996d |
| s21 | 7.848 | 16 | 040ca3adc0 |
| s22 | 9.816 | 14 | 39f3b71d63 |
| s23 | 7.512 | 8 | 3ac6814d27 |
| s24 | 5.256 | 16 | 75758d677c |
| s25 | 16.536 | 28 | c114923f47 |
| s26 | 11.664 | 23 | c2f12c4bbb |
| s27 | 14.736 | 44 | bc8ea619a7 |
| s28 | 6.312 | 18 | 9986cca994 |
| s29 | 5.736 | 16 | 20ea31093e |
| s30 | 3.792 | 13 | 4d0fa9ee85 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix cb3db59510: music -20.6 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 16.0s | -11 dB | -37.8 dB |
| evidence | undertow/texture | 16.0s | 259.5s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 259.5s | 292.7s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final inflation-2026 decision:is-gas-cheaper-than-under-biden --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script f489e4a980, storyboard 27e5fa4407, narration 2cf8ceb1b8, config 793ff38485, look bf7e3cb00f, music cb3db59510.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 292.736s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 8782 frames, timeline 8782 |
| duration in range | ok | 292.74s in [291.7,293.7] |
| duration matches timeline | ok | 292.736s vs 292.733s (8782 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -1.4 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s before the end scene |
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
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-28T05:44:50.726Z |
| mix is of this cue sheet | ok | mix cb3db59510, cue sheet cb3db59510 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 26 scenes, 30 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 292.73s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 55 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-is-gas-cheaper-than-under-biden/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
