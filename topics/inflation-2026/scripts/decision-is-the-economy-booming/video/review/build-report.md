# Build report: Is the Economy Booming, or Just Growing?

inflation-2026 / decision:is-the-economy-booming, 2026-10-21T03:02:25.986Z. `npm run video -- qa inflation-2026 decision:is-the-economy-booming`

**Segment.** 18 of 18 storyboard scenes (sc01 to sc18), 22 sentences. Kinds: sc01 list, sc02 question, sc03 quote, sc04 quote, sc05 bar, sc06 bar, sc07 stat-tiles, sc08 quote, sc09 stat-tiles, sc10 title, sc11 stat-tiles, sc12 eb-real-pay, sc13 stat-tiles, sc14 quote, sc15 title, sc16 stat-tiles, sc17 list, sc18 question.

**Output.** topics/inflation-2026/scripts/decision-is-the-economy-booming/video/segment.mp4: 183.68s, 1920x1080 @ 30 fps, h264 + aac, 5510 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 172.92s of speech at about 157 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 10.44 | 29 | f443ae3686 |
| s02 | 3.312 | 10 | 2b0e68e01e |
| s03 | 2.832 | 11 | f65db7fb53 |
| s04 | 7.344 | 18 | 61f067d146 |
| s05 | 10.44 | 32 | ec28370520 |
| s06 | 3.84 | 11 | 7dd1dd54df |
| s07 | 13.776 | 32 | ca7fc58fa6 |
| s08 | 11.352 | 32 | 79b5ef6088 |
| s09 | 1.872 | 3 | 44f5cd222f |
| s10 | 8.112 | 17 | 875305befd |
| s11 | 8.04 | 20 | 964b62e5fd |
| s12 | 6.24 | 11 | 2841be9a6f |
| s13 | 7.896 | 20 | 68e5c9bc35 |
| s14 | 3.624 | 9 | 7a23751a87 |
| s15 | 8.04 | 17 | 042f25ef2c |
| s16 | 7.44 | 22 | 0fbdd20fb7 |
| s17 | 10.08 | 18 | 229926c200 |
| s18 | 9.048 | 23 | 19461c6fb3 |
| s19 | 7.368 | 24 | 40e0bfa043 |
| s20 | 13.824 | 36 | 237f47b699 |
| s22 | 11.184 | 26 | a37065facd |
| s23 | 6.816 | 21 | a85410049f |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix e82609b83e: music -19.5 dB under the voice while it speaks, peak -1.4 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.5s | -11 dB | -37.6 dB |
| setup | undertow/active | 18.5s | 36.9s | -13 dB | -38.2 dB |
| evidence | undertow/texture | 36.9s | 148.8s | -13 dB | -40.4 dB |
| ending | undertow/pulse | 148.8s | 183.7s | -11 dB | -37.2 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 99e44600cc, storyboard 5d4b22dd4b, narration 4089f42f03, config e35068e42c, music e82609b83e.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 183.680s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 5510 frames, timeline 5510 |
| duration in range | ok | 183.68s in [182.7,184.7] |
| duration matches timeline | ok | 183.680s vs 183.667s (5510 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.4 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s |
| narration not truncated | ok | 22 sentences fit their slots |
| scene order | ok | sc01 to sc18 (18) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 18 scenes |
| every script sentence narrated | ok | 22 sentences in script order |
| sentences in script order | ok | 22 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 99e44600cc, storyboard 5d4b22dd4b (locked) |
| citations present | ok | 23 on-screen citations resolved |
| chart data matches storyboard | ok | 7 charts |
| excerpts resolve | ok | 1 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-21T03:01:42.611Z |
| mix is of this cue sheet | ok | mix e82609b83e, cue sheet e82609b83e |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.5 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.4 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 18 scenes, 22 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 183.67s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 40 in video/frames/; contact sheet topics/inflation-2026/scripts/decision-is-the-economy-booming/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
