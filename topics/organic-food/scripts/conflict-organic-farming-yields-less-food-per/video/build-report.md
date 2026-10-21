# Build report: Does Organic Farming Grow Less Food?

organic-food / conflict:organic-farming-yields-less-food-per, 2026-10-21T16:05:00.846Z. `npm run video -- qa organic-food conflict:organic-farming-yields-less-food-per`

**Segment.** 20 of 20 storyboard scenes (sc01 to sc20), 26 sentences. Kinds: sc01 question, sc02 transition, sc03 question, sc04 quote, sc05 quote, sc06 stat-tiles, sc07 excerpt, sc08 excerpt, sc09 excerpt, sc10 bar, sc11 question, sc12 quote, sc13 quote, sc14 title, sc15 stat-tiles, sc16 excerpt, sc17 title, sc18 title, sc19 question, sc20 question.

**Output.** topics/organic-food/scripts/conflict-organic-farming-yields-less-food-per/video/segment.mp4: 250.94s, 1920x1080 @ 30 fps, h264 + aac, 7528 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 237.07s of speech at about 153 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.216 | 26 | 96b75b1984 |
| s02 | 8.376 | 19 | 12c318378c |
| s03 | 6.6 | 19 | 51eea71d3b |
| s04 | 7.92 | 16 | e92406f9e6 |
| s05 | 7.392 | 20 | 059593b183 |
| s06 | 1.872 | 4 | 3ecf0d2e44 |
| s07 | 21.816 | 46 | ec4d36dd13 |
| s08 | 7.68 | 24 | 6ab92c77c3 |
| s09 | 5.544 | 15 | 042f58142b |
| s10 | 14.424 | 41 | 8226aa00ba |
| s11 | 9.504 | 19 | 1069310869 |
| s12 | 7.488 | 22 | 70eb908160 |
| s13 | 12.24 | 36 | 34e029da49 |
| s14 | 9.504 | 27 | a3e9200a8d |
| s15 | 5.424 | 13 | 619ca48737 |
| s16 | 8.904 | 19 | deac6aa166 |
| s17 | 10.656 | 27 | 02fb1dbeb8 |
| s18 | 6.216 | 9 | 0883347e5d |
| s19 | 8.808 | 16 | e76d68948f |
| s20 | 9.72 | 23 | 25b98cb51c |
| s21 | 7.488 | 20 | 6c0e2de9be |
| s22 | 12.408 | 32 | daf5a37e0e |
| s23 | 13.656 | 37 | 5df56b85f2 |
| s24 | 10.248 | 26 | 3c87328813 |
| s25 | 6.624 | 20 | da061964d6 |
| s26 | 7.344 | 23 | 89f1b60278 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 41f8db6c8e: music -20.6 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 26.3s | -11 dB | -37.3 dB |
| evidence | undertow/texture | 26.3s | 235.4s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 235.4s | 250.9s | -11 dB | -38.4 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 6f8d4da15c, storyboard b1f07ffb9f, narration 276d93272d, config 501eeb87e0, music 41f8db6c8e.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 250.944s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7528 frames, timeline 7528 |
| duration in range | ok | 250.94s in [249.9,251.9] |
| duration matches timeline | ok | 250.944s vs 250.933s (7528 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.011s apart |
| no clipping | ok | peak -1.4 dB, mean -19.4 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 26 sentences fit their slots |
| scene order | ok | sc01 to sc20 (20) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 20 scenes |
| every script sentence narrated | ok | 26 sentences in script order |
| sentences in script order | ok | 26 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 6f8d4da15c, storyboard b1f07ffb9f (locked) |
| citations present | ok | 14 on-screen citations resolved |
| chart data matches storyboard | ok | 3 charts |
| excerpts resolve | ok | 4 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-21T16:04:08.504Z |
| mix is of this cue sheet | ok | mix 41f8db6c8e, cue sheet 41f8db6c8e |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 20 scenes, 26 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 250.93s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 46 in video/frames/; contact sheet topics/organic-food/scripts/conflict-organic-farming-yields-less-food-per/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
