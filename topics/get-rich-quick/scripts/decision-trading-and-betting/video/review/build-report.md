# Build report: Do 97% of Day Traders Really Lose Money?

get-rich-quick / decision:trading-and-betting, 2026-10-22T01:07:48.430Z. `npm run video -- qa get-rich-quick decision:trading-and-betting`

**Segment.** 24 of 24 storyboard scenes (sc01 to sc24), 27 sentences. Kinds: sc01 quote, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 quote, sc07 excerpt, sc08 bar, sc09 excerpt, sc10 stat-tiles, sc11 stat-tiles, sc12 stat-tiles, sc13 question, sc14 excerpt, sc15 excerpt, sc16 stat-tiles, sc17 question, sc18 excerpt, sc19 waffle, sc20 quote, sc21 stat-tiles, sc22 list, sc23 list, sc24 list.

**Output.** topics/get-rich-quick/scripts/decision-trading-and-betting/video/segment.mp4: 234.24s, 1920x1080 @ 30 fps, h264 + aac, 7027 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 223.22s of speech at about 165 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 11.352 | 27 | dddc1a9184 |
| s02 | 5.088 | 17 | f008f1df9c |
| s03 | 5.04 | 12 | db63c573ab |
| s04 | 9.768 | 27 | 622d27d3ff |
| s05 | 10.344 | 24 | ea9384d34f |
| s06 | 7.32 | 18 | c87d5580a1 |
| s08 | 11.448 | 27 | acaa287be6 |
| s09 | 8.088 | 23 | 92b206b9d8 |
| s10 | 5.28 | 17 | e6610a0e13 |
| s11 | 10.584 | 21 | a9d060d16c |
| s12 | 7.248 | 16 | 2d2e124326 |
| s13 | 9.12 | 26 | 72e7ea5af0 |
| s14 | 3.024 | 11 | 5dab532a61 |
| s15 | 2.808 | 8 | c087081a7d |
| s27 | 10.488 | 19 | 4acafd755f |
| s16 | 11.376 | 33 | 368fd09ffc |
| s17 | 2.616 | 7 | fa4962baa9 |
| s18 | 10.032 | 31 | ffafbc93e5 |
| s19 | 6.864 | 18 | b8975eae77 |
| s20 | 10.488 | 27 | e702c2d783 |
| s21 | 11.808 | 27 | 95649d33ac |
| s22 | 7.608 | 24 | 9a23b2f41f |
| s23 | 8.736 | 28 | bdb49407c7 |
| s28 | 8.544 | 26 | feee968a39 |
| s24 | 10.968 | 35 | a5af982c73 |
| s25 | 8.808 | 22 | 12693d0ec4 |
| s26 | 8.376 | 28 | 864cafb8ca |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 83640bc3e9: music -19.4 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 23.1s | -11 dB | -37.4 dB |
| setup | undertow/active | 23.1s | 51.6s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 51.6s | 178.1s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 178.1s | 234.2s | -11 dB | -37.1 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script a1196b72ff, storyboard c2f52b25bb, narration aea9966848, config ddc2bfe9d2, music 83640bc3e9.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 234.240s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7027 frames, timeline 7027 |
| duration in range | ok | 234.24s in [233.2,235.2] |
| duration matches timeline | ok | 234.240s vs 234.233s (7027 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.007s apart |
| no clipping | ok | peak -1.5 dB, mean -19.5 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 27 sentences fit their slots |
| scene order | ok | sc01 to sc24 (24) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 24 scenes |
| every script sentence narrated | ok | 27 sentences in script order |
| sentences in script order | ok | 27 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script a1196b72ff, storyboard c2f52b25bb (locked) |
| citations present | ok | 19 on-screen citations resolved |
| chart data matches storyboard | ok | 7 charts |
| excerpts resolve | ok | 5 excerpts with their highlights |
| assets and kinds supported | ok | 8 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-22T01:06:54.044Z |
| mix is of this cue sheet | ok | mix 83640bc3e9, cue sheet 83640bc3e9 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.4 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 24 scenes, 27 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 234.23s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 52 in video/frames/; contact sheet topics/get-rich-quick/scripts/decision-trading-and-betting/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
