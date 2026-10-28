# Build report: Who Really Pays for Tariffs?

inflation-2026 / decision:do-tariffs-raise-prices, 2026-10-28T04:18:22.760Z. `npm run video -- spike inflation-2026 decision:do-tariffs-raise-prices`

**Segment.** 22 of 21 storyboard scenes (sc01 to end), 24 sentences. Kinds: sc01 quote, sc02 title, sc03 quote, sc04 quote, sc05 transition, sc06 excerpt, sc07 stat-tiles, sc08 bar, sc09 question, sc10 stat-tiles, sc11 stacked-bar, sc12 list, sc13 excerpt, sc14 question, sc15 stat-tiles, sc16 stat-tiles, sc17 excerpt, sc18 title, sc19 excerpt, sc20 title, sc21 list, end close-card.

**Output.** topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/segment.mp4: 254.34s, 1920x1080 @ 30 fps, h264 + aac, 7630 frames, rendered in 1229.8s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 228.55s of speech at about 169 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.504 | 17 | 4634bd8fd0 |
| s02 | 6.552 | 19 | 75d37b8f67 |
| s03 | 8.856 | 27 | 37ec17b003 |
| s04 | 7.968 | 23 | 2c98cfd7d9 |
| s05 | 4.56 | 13 | 5165372a26 |
| s06 | 9.072 | 32 | 821efc873c |
| s07 | 12.168 | 31 | 719ed10331 |
| s08 | 7.896 | 18 | cf1820292e |
| s09 | 6.456 | 23 | 1d9e573cc7 |
| s10 | 14.376 | 37 | ef348ee5a2 |
| s11 | 11.928 | 34 | 99d4258a95 |
| s12 | 3 | 10 | fa96884977 |
| s13 | 12.6 | 39 | 38d53412cf |
| s14 | 7.272 | 20 | 296c8b0317 |
| s15 | 14.208 | 39 | b25c53316b |
| s16 | 4.992 | 12 | 0454044da6 |
| s17 | 17.616 | 47 | 885a1fe18e |
| s18 | 11.016 | 28 | 237ca34897 |
| s19 | 12.288 | 28 | 4fa38c73cd |
| s20 | 13.32 | 34 | a16f8f0593 |
| s21 | 12.816 | 33 | e29cfac3cd |
| s22 | 7.896 | 24 | 027de867d1 |
| s23 | 7.44 | 19 | cf1b0ecf5b |
| s24 | 7.752 | 27 | 2cfd685515 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 443a34890e: music -19.6 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 14.5s | -11 dB | -38.1 dB |
| setup | undertow/active | 14.5s | 36.5s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 36.5s | 186.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 186.2s | 254.3s | -11 dB | -36.3 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final inflation-2026 decision:do-tariffs-raise-prices --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script c96ee7b7ba, storyboard 819bcdcf88, narration 59bf4a9b3a, config b2cef72976, look bf7e3cb00f, music 443a34890e.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 254.336s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7630 frames, timeline 7630 |
| duration in range | ok | 254.34s in [253.3,255.3] |
| duration matches timeline | ok | 254.336s vs 254.333s (7630 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -1.4 dB, mean -19.7 dB |
| no long silence | ok | none >= 3s before the end scene |
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
| assets and kinds supported | ok | 10 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-28T04:17:17.529Z |
| mix is of this cue sheet | ok | mix 443a34890e, cue sheet 443a34890e |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 22 scenes, 24 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 254.33s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 47 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
