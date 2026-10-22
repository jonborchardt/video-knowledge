# Build report: Heat Pump vs Oil, Propane and Baseboard Heat

heat-pumps / conflict:heat-pump-costs-less-run-heating, 2026-10-22T15:20:54.233Z. `npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating --approved-by Jon`

**Segment.** 22 of 22 storyboard scenes (sc01 to sc22), 24 sentences. Kinds: sc01 title, sc02 question, sc03 quote, sc04 quote, sc05 quote, sc06 title, sc07 stat-tiles, sc08 stat-tiles, sc09 stat-tiles, sc10 question, sc11 stat-tiles, sc12 excerpt, sc13 excerpt, sc14 list, sc15 excerpt, sc16 stat-tiles, sc17 question, sc18 list, sc19 list, sc20 title, sc21 question, sc22 title.

**Output.** topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/video/segment.mp4: 228.97s, 1920x1080 @ 30 fps, h264 + aac, 6869 frames, rendered in 871.7s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 220.44s of speech at about 164 wpm, $0.0526 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 7.4 | 23 | 118b2d189c |
| s02 | 5.45 | 21 | 0cedd3f6ca |
| s03 | 10.5125 | 20 | 954ceccd4a |
| s04 | 10.3625 | 28 | 9703827c74 |
| s05 | 12.0625 | 33 | d685b6c1df |
| s06 | 3 | 9 | 8cfe8da415 |
| s07 | 14.075 | 35 | 0359843ebe |
| s08 | 5.3375 | 9 | 0860116e7e |
| s09 | 13.875 | 40 | 587ff814f2 |
| s10 | 11.1 | 26 | b6c05040c1 |
| s11 | 3.6875 | 12 | 02fd1589b7 |
| s12 | 11.225 | 30 | c2e0e424a8 |
| s13 | 11.4875 | 27 | 57e6d94627 |
| s14 | 7.1375 | 19 | bb7263ec39 |
| s15 | 15.0625 | 41 | 034cc64a51 |
| s22 | 14.7 | 42 | b39ab40d94 |
| s23 | 19.9375 | 51 | efcfbd15a2 |
| s24 | 1.95 | 7 | 232a22efcb |
| s25 | 6.6375 | 16 | 97e67367f7 |
| s26 | 6.2625 | 18 | 0d3f8c925f |
| s27 | 7.5 | 21 | 047c719e15 |
| s28 | 6.4125 | 21 | 3e00ed0145 |
| s30 | 11.725 | 34 | 48e25296e5 |
| s31 | 3.5375 | 11 | 08c5e4f341 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix d84bc61fb0: music -19.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 14.5s | -11 dB | -38.1 dB |
| setup | undertow/active | 14.5s | 48.4s | -13 dB | -37.9 dB |
| evidence | undertow/texture | 48.4s | 181.5s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 181.5s | 229.0s | -11 dB | -37.0 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script c8f01d495c, storyboard 5439813b6d, narration 97ab00208d, config 5fbb2ac135, music d84bc61fb0.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 228.970s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 6869 frames, timeline 6869 |
| duration in range | ok | 228.97s in [228.0,230.0] |
| duration matches timeline | ok | 228.970s vs 228.967s (6869 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -1.4 dB, mean -19.3 dB |
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
| soundtrack mixed | ok | 4 cues, 2026-10-22T15:20:04.451Z |
| mix is of this cue sheet | ok | mix d84bc61fb0, cue sheet d84bc61fb0 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 22 scenes, 24 sentences |
| cues inside their sentences | ok | 4 cues |
| final scene complete | ok | ends 228.97s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 49 in video/frames/; contact sheet topics/heat-pumps/scripts/conflict-heat-pump-costs-less-run-heating/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
