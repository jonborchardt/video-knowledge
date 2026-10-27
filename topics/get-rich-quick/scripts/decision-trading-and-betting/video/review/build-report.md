# Build report: Do 97% of Day Traders Really Lose Money?

get-rich-quick / decision:trading-and-betting, 2026-10-27T02:23:39.067Z. `npm run video -- spike get-rich-quick decision:trading-and-betting`

**Segment.** 25 of 24 storyboard scenes (sc01 to end), 27 sentences. Kinds: sc01 quote, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 quote, sc07 excerpt, sc08 bar, sc09 excerpt, sc10 stat-tiles, sc11 stat-tiles, sc12 stat-tiles, sc13 question, sc14 excerpt, sc15 excerpt, sc16 stat-tiles, sc17 question, sc18 excerpt, sc19 waffle, sc20 quote, sc21 stat-tiles, sc22 list, sc23 list, sc24 list, end close-card.

**Output.** topics/get-rich-quick/scripts/decision-trading-and-betting/video/segment.mp4: 251.60s, 1920x1080 @ 30 fps, h264 + aac, 7548 frames, rendered in 1136.8s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 224.59s of speech at about 165 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 11.352 | 27 | 5598214e2b |
| s02 | 5.088 | 17 | 69fd084e64 |
| s03 | 5.04 | 12 | 9163b06ba5 |
| s04 | 9.768 | 27 | 314f300786 |
| s05 | 10.344 | 24 | 9adedcab9b |
| s06 | 7.32 | 18 | 3628899179 |
| s08 | 11.448 | 27 | 49fdbe2505 |
| s09 | 8.088 | 23 | a4fee6f175 |
| s10 | 5.28 | 17 | 2251f528d4 |
| s11 | 10.584 | 21 | 37b3a13fc1 |
| s12 | 7.248 | 16 | 8fa0266396 |
| s13 | 9.12 | 26 | 80373ce8d0 |
| s14 | 3.024 | 11 | d24e19091b |
| s15 | 2.808 | 8 | 70af76b8b9 |
| s27 | 10.488 | 19 | a06450cbea |
| s16 | 12.336 | 36 | 1a362de1b2 |
| s17 | 2.616 | 7 | 60de29840b |
| s18 | 10.032 | 31 | 7abbbdd59e |
| s19 | 6.864 | 18 | e4ba32718c |
| s20 | 10.896 | 27 | 0db3423481 |
| s21 | 11.808 | 27 | 8af74c88c1 |
| s22 | 7.608 | 24 | 1fe52d940c |
| s23 | 8.736 | 28 | 69df0642ce |
| s28 | 8.544 | 26 | a97902da48 |
| s24 | 10.968 | 35 | a9e5cd34d1 |
| s25 | 8.808 | 22 | 12124d0c8b |
| s26 | 8.376 | 28 | 0f4afa2a22 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 215e9f1566: music -19.3 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 23.1s | -11 dB | -37.4 dB |
| setup | undertow/active | 23.1s | 51.6s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 51.6s | 179.5s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 179.5s | 251.6s | -11 dB | -36.3 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final get-rich-quick decision:trading-and-betting --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script cf8aa41999, storyboard 0c4a7f06d6, narration ee89bf403b, config ddc2bfe9d2, music 215e9f1566.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 251.605s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7548 frames, timeline 7548 |
| duration in range | ok | 251.60s in [250.6,252.6] |
| duration matches timeline | ok | 251.605s vs 251.600s (7548 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.005s apart |
| no clipping | ok | peak -1.5 dB, mean -19.8 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 27 sentences fit their slots |
| scene order | ok | sc01 to sc24 (24) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 24 scenes |
| every script sentence narrated | ok | 27 sentences in script order |
| sentences in script order | ok | 27 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script cf8aa41999, storyboard 0c4a7f06d6 (locked) |
| citations present | ok | 19 on-screen citations resolved |
| chart data matches storyboard | ok | 7 charts |
| excerpts resolve | ok | 5 excerpts with their highlights |
| assets and kinds supported | ok | 9 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-27T02:22:37.791Z |
| mix is of this cue sheet | ok | mix 215e9f1566, cue sheet 215e9f1566 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.3 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 25 scenes, 27 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 251.60s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 54 in video/frames/; contact sheet topics/get-rich-quick/scripts/decision-trading-and-betting/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
