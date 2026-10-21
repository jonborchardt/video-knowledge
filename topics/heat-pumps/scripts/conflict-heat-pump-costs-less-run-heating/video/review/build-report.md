# Build report: Heat Pump vs Oil, Propane and Baseboard Heat

heat-pumps / conflict:heat-pump-costs-less-run-heating, 2026-10-21T15:42:14.967Z. `npm run video -- qa heat-pumps conflict:heat-pump-costs-less-run-heating`

**Segment.** 22 of 22 storyboard scenes (sc01 to sc22), 24 sentences. Kinds: sc01 title, sc02 question, sc03 quote, sc04 quote, sc05 quote, sc06 title, sc07 stat-tiles, sc08 stat-tiles, sc09 stat-tiles, sc10 question, sc11 stat-tiles, sc12 excerpt, sc13 excerpt, sc14 list, sc15 excerpt, sc16 stat-tiles, sc17 question, sc18 list, sc19 list, sc20 title, sc21 question, sc22 title.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/video/segment.mp4: 229.01s, 1920x1080 @ 30 fps, h264 + aac, 6870 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 220.46s of speech at about 164 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.464 | 23 | c5bead5af7 |
| s02 | 5.88 | 21 | 8196c4952b |
| s03 | 10.776 | 20 | 416f6443cd |
| s04 | 10.224 | 28 | fe4be65d89 |
| s05 | 11.904 | 33 | cb91bf4dee |
| s06 | 3.024 | 9 | 8a726c3463 |
| s07 | 14.256 | 35 | 97031080dd |
| s08 | 5.328 | 9 | 53491a58cd |
| s09 | 13.296 | 40 | a1159840ee |
| s10 | 10.824 | 26 | 878514af7d |
| s11 | 3.912 | 12 | 811002ba34 |
| s12 | 11.496 | 30 | 3b3f909c43 |
| s13 | 11.376 | 27 | b71bc543c3 |
| s14 | 7.248 | 19 | bd0d969bf7 |
| s15 | 14.952 | 41 | bb8d3bc5d9 |
| s22 | 14.808 | 42 | dcbbb36e35 |
| s23 | 19.608 | 51 | 9df8ab0b69 |
| s24 | 2.376 | 7 | d572959344 |
| s25 | 6.624 | 16 | 869e7db1fb |
| s26 | 6.192 | 18 | 3182d3e848 |
| s27 | 7.32 | 21 | ca8e80d9f1 |
| s28 | 6.456 | 21 | 32b2b7ac9a |
| s30 | 11.424 | 34 | a5d81ce704 |
| s31 | 3.696 | 11 | 0ff4b251aa |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix f10f5b1a9a: music -19.7 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 15.0s | -11 dB | -38.0 dB |
| setup | undertow/active | 15.0s | 48.9s | -13 dB | -37.9 dB |
| evidence | undertow/texture | 48.9s | 181.5s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 181.5s | 229.0s | -11 dB | -37.0 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script c8f01d495c, storyboard 5439813b6d, narration 356f542e3b, config 5fbb2ac135, music f10f5b1a9a.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 229.013s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 6870 frames, timeline 6870 |
| duration in range | ok | 229.01s in [228.0,230.0] |
| duration matches timeline | ok | 229.013s vs 229.000s (6870 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.3 dB, mean -19.3 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 24 sentences fit their slots |
| scene order | ok | sc01 to sc22 (22) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 22 scenes |
| every script sentence narrated | ok | 24 sentences in script order |
| sentences in script order | ok | 24 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script c8f01d495c, storyboard 5439813b6d (locked) |
| citations present | ok | 14 on-screen citations resolved |
| chart data matches storyboard | ok | 5 charts |
| excerpts resolve | ok | 3 excerpts with their highlights |
| assets and kinds supported | ok | 6 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-21T15:41:22.842Z |
| mix is of this cue sheet | ok | mix f10f5b1a9a, cue sheet f10f5b1a9a |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 22 scenes, 24 sentences |
| cues inside their sentences | ok | 4 cues |
| final scene complete | ok | ends 229.00s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 49 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
