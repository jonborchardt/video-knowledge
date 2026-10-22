# Build report: Does Organic Farming Grow Less Food?

organic-food / conflict:organic-farming-yields-less-food-per, 2026-10-22T19:22:27.696Z. `npm run video -- final organic-food conflict:organic-farming-yields-less-food-per --approved-by Jon`

**Segment.** 20 of 20 storyboard scenes (sc01 to sc20), 26 sentences. Kinds: sc01 question, sc02 transition, sc03 question, sc04 quote, sc05 quote, sc06 stat-tiles, sc07 excerpt, sc08 excerpt, sc09 excerpt, sc10 bar, sc11 question, sc12 quote, sc13 quote, sc14 title, sc15 stat-tiles, sc16 excerpt, sc17 title, sc18 title, sc19 question, sc20 question.

**Output.** topics/organic-food/scripts/conflict-organic-farming-yields-less-food-per/video/segment.mp4: 250.05s, 1920x1080 @ 30 fps, h264 + aac, 7501 frames, rendered in 947.6s ($0 (local CPU)).

**Narration.** azure / en-US-AndrewMultilingualNeural (rate +0%, neural), wav, 236.33s of speech at about 153 wpm, $0.0536 (estimated from characters). Licence: commercial: Azure AI Speech terms allow the generated audio in published media. Publishable.

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.4875 | 26 | 486595ea83 |
| s02 | 8.125 | 19 | d52f0057a4 |
| s03 | 6.4375 | 19 | 3b2e717642 |
| s04 | 8 | 16 | e7b27dffd3 |
| s05 | 7.3625 | 20 | 3b45e23ec9 |
| s06 | 1.82 | 4 | f31309de53 |
| s07 | 21.6125 | 46 | 0c36854cc7 |
| s08 | 7.575 | 24 | adae633ddb |
| s09 | 5.4625 | 15 | 934a7f32a3 |
| s10 | 14.125 | 41 | c44283e9a4 |
| s11 | 9.625 | 19 | 0ecf974731 |
| s12 | 7.3625 | 22 | 8ec91c0094 |
| s13 | 12.175 | 36 | 7c089e08bf |
| s14 | 9.4375 | 27 | 093970271c |
| s15 | 5.2625 | 13 | ac7501f2ae |
| s16 | 9 | 19 | 54f913dad7 |
| s17 | 10.4625 | 27 | 95c1e39e32 |
| s18 | 6.4 | 9 | 981286e9a0 |
| s19 | 8.5625 | 16 | 3fb8850d3e |
| s20 | 9.3875 | 23 | 8f36a716a7 |
| s21 | 7.8875 | 20 | 33eae0b43f |
| s22 | 12.2875 | 32 | 42837bfffc |
| s23 | 13.6125 | 37 | 473add8b4d |
| s24 | 10.25 | 26 | b05fd74c33 |
| s25 | 6.9125 | 20 | 0ccfa41637 |
| s26 | 7.7 | 23 | 8e68dfd6ad |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 1bcc6881b0: music -20.6 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 26.2s | -11 dB | -37.3 dB |
| evidence | undertow/texture | 26.2s | 233.9s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 233.9s | 250.0s | -11 dB | -38.3 dB |

**Clearance.** Narration and music are both cleared for publication. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 6f8d4da15c, storyboard b1f07ffb9f, narration b479c6e579, config 501eeb87e0, music 1bcc6881b0.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 250.048s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 7501 frames, timeline 7501 |
| duration in range | ok | 250.05s in [249.0,251.0] |
| duration matches timeline | ok | 250.048s vs 250.033s (7501 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.015s apart |
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
| soundtrack mixed | ok | 3 cues, 2026-10-22T19:21:37.059Z |
| mix is of this cue sheet | ok | mix 1bcc6881b0, cue sheet 1bcc6881b0 |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 20 scenes, 26 sentences |
| cues inside their sentences | ok | 5 cues |
| final scene complete | ok | ends 250.03s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 46 in video/frames/; contact sheet topics/organic-food/scripts/conflict-organic-farming-yields-less-food-per/video/contact-sheet.png.

## Known limitations

- narration licence: commercial: Azure AI Speech terms allow the generated audio in published media
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
