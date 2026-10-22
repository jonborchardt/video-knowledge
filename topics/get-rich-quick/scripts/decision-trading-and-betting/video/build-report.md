# Build report: Do 97% of Day Traders Really Lose Money?

get-rich-quick / decision:trading-and-betting, 2026-10-22T07:49:05.076Z. `npm run video -- final get-rich-quick decision:trading-and-betting --approved-by Jon`

**Segment.** 24 of 24 storyboard scenes (sc01 to sc24), 27 sentences. Kinds: sc01 quote, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 quote, sc07 excerpt, sc08 bar, sc09 excerpt, sc10 stat-tiles, sc11 stat-tiles, sc12 stat-tiles, sc13 question, sc14 excerpt, sc15 excerpt, sc16 stat-tiles, sc17 question, sc18 excerpt, sc19 waffle, sc20 quote, sc21 stat-tiles, sc22 list, sc23 list, sc24 list.

**Output.** topics/get-rich-quick/scripts/decision-trading-and-betting/video/segment.mp4: 231.02s, 1920x1080 @ 30 fps, h264 + aac, 6930 frames, rendered in 923.4s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 220.02s of speech at about 167 wpm, $0.0506 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 11.125 | 27 | 6fdd3ea636 |
| s02 | 4.6875 | 17 | c78f20192a |
| s03 | 4.95 | 12 | 8990a6d77b |
| s04 | 9.65 | 27 | 31fb76eca1 |
| s05 | 9.725 | 24 | 46afceac4a |
| s06 | 7.2375 | 18 | 42986c55e2 |
| s08 | 11.1625 | 27 | dc0eef177c |
| s09 | 8.25 | 23 | 2e3b086fcd |
| s10 | 5.325 | 17 | a83ccf31be |
| s11 | 10.3875 | 21 | 6218468d58 |
| s12 | 7.3 | 16 | 4ca07fa884 |
| s13 | 9.0875 | 26 | 517492999d |
| s14 | 3.05 | 11 | fcd6099352 |
| s15 | 2.5125 | 8 | c335d46c42 |
| s27 | 10.55 | 19 | c7e4022046 |
| s16 | 11.3375 | 33 | 54f9b0e0c1 |
| s17 | 2.5125 | 7 | 78902f29e3 |
| s18 | 9.9125 | 31 | a0ac8a3c95 |
| s19 | 7.35 | 18 | 4b91e907a5 |
| s20 | 10.0125 | 27 | 88ea88d4f0 |
| s21 | 11.6375 | 27 | 2b26ed8e12 |
| s22 | 7.475 | 24 | 26fd7f183e |
| s23 | 8.5375 | 28 | 3362e9153f |
| s28 | 8.8125 | 26 | 4d2ed70ddd |
| s24 | 10.9125 | 35 | efa9613999 |
| s25 | 8.4875 | 22 | 2ec1bbb533 |
| s26 | 8.0375 | 28 | 5292b4871b |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 752f7678bf: music -19.4 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 22.4s | -11 dB | -37.4 dB |
| setup | undertow/active | 22.4s | 50.1s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 50.1s | 175.7s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 175.7s | 231.0s | -11 dB | -37.1 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script a1196b72ff, storyboard c2f52b25bb, narration 8fd3c6b5be, config ddc2bfe9d2, music 752f7678bf.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 231.018s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 6930 frames, timeline 6930 |
| duration in range | ok | 231.02s in [230.0,232.0] |
| duration matches timeline | ok | 231.018s vs 231.000s (6930 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.018s apart |
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
| soundtrack mixed | ok | 4 cues, 2026-10-22T07:48:07.978Z |
| mix is of this cue sheet | ok | mix 752f7678bf, cue sheet 752f7678bf |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.4 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 24 scenes, 27 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 231.00s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 52 in video/frames/; contact sheet topics/get-rich-quick/scripts/decision-trading-and-betting/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
