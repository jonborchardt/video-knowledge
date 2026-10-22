# Build report: Who Really Pays for Tariffs?

inflation-2026 / decision:do-tariffs-raise-prices, 2026-10-22T17:24:31.816Z. `npm run video -- final inflation-2026 decision:do-tariffs-raise-prices --approved-by Jon`

**Segment.** 21 of 21 storyboard scenes (sc01 to sc21), 24 sentences. Kinds: sc01 quote, sc02 title, sc03 quote, sc04 quote, sc05 transition, sc06 excerpt, sc07 stat-tiles, sc08 bar, sc09 question, sc10 stat-tiles, sc11 stacked-bar, sc12 list, sc13 excerpt, sc14 question, sc15 stat-tiles, sc16 stat-tiles, sc17 excerpt, sc18 title, sc19 excerpt, sc20 title, sc21 list.

**Output.** topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/segment.mp4: 236.50s, 1920x1080 @ 30 fps, h264 + aac, 7095 frames, rendered in 900.4s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 226.66s of speech at about 170 wpm, $0.0546 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 6.9875 | 17 | a642ed1cf7 |
| s02 | 6.4375 | 19 | 0479f05e50 |
| s03 | 8.8125 | 27 | 91d5d14300 |
| s04 | 8 | 23 | dab41c96c6 |
| s05 | 4.5875 | 13 | 0bf763c242 |
| s06 | 8.975 | 32 | 1dab5a656e |
| s07 | 12.2375 | 31 | 763498cfc0 |
| s08 | 7.675 | 18 | 3a3df9df1e |
| s09 | 6.85 | 23 | acdb9c429d |
| s10 | 14.1375 | 37 | 5c886301e4 |
| s11 | 11.8 | 34 | bac320d9e5 |
| s12 | 2.775 | 10 | d93eab1b40 |
| s13 | 12.4875 | 39 | d89bdf1fb2 |
| s14 | 7.4125 | 20 | 9fa0d47e75 |
| s15 | 14.1375 | 39 | 68fc1798b4 |
| s16 | 4.7125 | 12 | 3272295652 |
| s17 | 17.6125 | 47 | 518a543470 |
| s18 | 10.6125 | 28 | 1d982d91f8 |
| s19 | 12.025 | 28 | fcfc06faa5 |
| s20 | 13.125 | 34 | 9bdd5b4d0e |
| s21 | 12.375 | 33 | cafbd0a310 |
| s22 | 8.075 | 24 | 28fbb4cb16 |
| s23 | 7.025 | 19 | dde020b7d7 |
| s24 | 7.7875 | 27 | 2ed4780cba |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 08629b1df3: music -19.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 14.9s | -11 dB | -38.0 dB |
| setup | undertow/active | 14.9s | 36.9s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 36.9s | 185.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 185.2s | 236.5s | -11 dB | -37.1 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script c96ee7b7ba, storyboard 819bcdcf88, narration eb86566696, config b2cef72976, music 08629b1df3.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 236.501s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7095 frames, timeline 7095 |
| duration in range | ok | 236.50s in [235.5,237.5] |
| duration matches timeline | ok | 236.501s vs 236.500s (7095 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.001s apart |
| no clipping | ok | peak -1.3 dB, mean -19.4 dB |
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
| soundtrack mixed | ok | 4 cues, 2026-10-22T17:23:40.760Z |
| mix is of this cue sheet | ok | mix 08629b1df3, cue sheet 08629b1df3 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 21 scenes, 24 sentences |
| cues inside their sentences | ok | 2 cues |
| final scene complete | ok | ends 236.50s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 45 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-do-tariffs-raise-prices/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
