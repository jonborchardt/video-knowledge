# Build report: Who Really Pays for Tariffs?

inflation-2026 / decision:do-tariffs-raise-prices, 2026-10-22T00:50:57.366Z. `npm run video -- qa inflation-2026 decision:do-tariffs-raise-prices`

**Segment.** 21 of 21 storyboard scenes (sc01 to sc21), 24 sentences. Kinds: sc01 quote, sc02 title, sc03 quote, sc04 quote, sc05 transition, sc06 excerpt, sc07 stat-tiles, sc08 bar, sc09 question, sc10 stat-tiles, sc11 stacked-bar, sc12 list, sc13 excerpt, sc14 question, sc15 stat-tiles, sc16 stat-tiles, sc17 excerpt, sc18 title, sc19 excerpt, sc20 title, sc21 list.

**Output.** topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/segment.mp4: 238.34s, 1920x1080 @ 30 fps, h264 + aac, 7150 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 228.55s of speech at about 169 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.504 | 17 | 8efc96eed0 |
| s02 | 6.552 | 19 | 6914c97096 |
| s03 | 8.856 | 27 | 8cae3dd541 |
| s04 | 7.968 | 23 | f1dbbb3bdb |
| s05 | 4.56 | 13 | a8b13c4fb9 |
| s06 | 9.072 | 32 | 02fc49914d |
| s07 | 12.168 | 31 | 0c807f8a7d |
| s08 | 7.896 | 18 | 6c2ecc0398 |
| s09 | 6.456 | 23 | 0e59758c36 |
| s10 | 14.376 | 37 | dbe13af6c8 |
| s11 | 11.928 | 34 | db8529f93d |
| s12 | 3 | 10 | b11fc6de83 |
| s13 | 12.6 | 39 | aa0ece17ca |
| s14 | 7.272 | 20 | d8db36356c |
| s15 | 14.208 | 39 | 35456dd48a |
| s16 | 4.992 | 12 | 625d4412b9 |
| s17 | 17.616 | 47 | 4ffda5f3db |
| s18 | 11.016 | 28 | 3b6488ac5a |
| s19 | 12.288 | 28 | aab7e5c4ed |
| s20 | 13.32 | 34 | 7358a532ec |
| s21 | 12.816 | 33 | d33f1fe833 |
| s22 | 7.896 | 24 | 1433f5c2ae |
| s23 | 7.44 | 19 | 25fd4e3880 |
| s24 | 7.752 | 27 | 4376b2c959 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix a84781fa13: music -19.7 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 14.5s | -11 dB | -38.1 dB |
| setup | undertow/active | 14.5s | 36.5s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 36.5s | 186.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 186.2s | 238.3s | -11 dB | -37.1 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script c96ee7b7ba, storyboard 819bcdcf88, narration 10dba88df6, config b2cef72976, music a84781fa13.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 238.336s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7150 frames, timeline 7150 |
| duration in range | ok | 238.34s in [237.3,239.3] |
| duration matches timeline | ok | 238.336s vs 238.333s (7150 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -1.4 dB, mean -19.4 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 24 sentences fit their slots |
| scene order | ok | sc01 to sc21 (21) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 21 scenes |
| every script sentence narrated | ok | 24 sentences in script order |
| sentences in script order | ok | 24 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script c96ee7b7ba, storyboard 819bcdcf88 (locked) |
| citations present | ok | 20 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 4 excerpts with their highlights |
| assets and kinds supported | ok | 9 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-22T00:50:01.291Z |
| mix is of this cue sheet | ok | mix a84781fa13, cue sheet a84781fa13 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 21 scenes, 24 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 238.33s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 45 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
